import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { BehaviorSubject, Subscription, combineLatest, forkJoin, interval, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { AccountContextService } from './account-context.service';
import { AuthService } from './auth.service';
import { OrganizationAccountService, OrganizationStatus } from './organization-account.service';
import { UserQuota, UserService } from './user.service';

export interface OrganizationCreditsSnapshot {
  organizationName: string | null;
  monthlyQuota: number | null;
  currentUsage: number;
  remaining: number; // -1 si illimité
  isUnlimited: boolean;
  ratioRemaining: number; // 0..1 (1 si illimité)
  canMakeRequests: boolean;
  updatedAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrganizationCreditsService implements OnDestroy {
  private userService = inject(UserService);
  private organizationAccountService = inject(OrganizationAccountService);
  private authService = inject(AuthService);
  private accountContextService = inject(AccountContextService);
  private oauthService = inject(OAuthService);

  private readonly creditsSubject = new BehaviorSubject<OrganizationCreditsSnapshot | null>(null);
  readonly credits$ = this.creditsSubject.asObservable();
  readonly credits = signal<OrganizationCreditsSnapshot | null>(null);
  readonly justUpdated = signal<boolean>(false);

  private authSub?: Subscription;
  private pollingSub?: Subscription;
  private reconcileTimers: ReturnType<typeof setTimeout>[] = [];
  private pulseTimer?: ReturnType<typeof setTimeout>;
  private inFlight = false;
  private optimisticVersion = 0;

  private readonly visibilityHandler = (): void => {
    if (typeof document !== 'undefined'
      && document.visibilityState === 'visible'
      && this.oauthService.hasValidAccessToken()) {
      this.scheduleSingleReconcile(150);
    }
  };

  constructor() {
    this.authSub = combineLatest([
      this.authService.isAuthenticated(),
      this.accountContextService.isCollaboratorAccount$
    ]).subscribe(([isAuth, hasOrgAccess]) => {
      if (isAuth && hasOrgAccess) {
        this.refreshNow();
        this.startPolling();
      } else {
        this.stopPolling();
        this.clearReconcileTimers();
        this.setSnapshot(null, false);
      }
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.stopPolling();
    this.clearReconcileTimers();
    if (this.pulseTimer !== undefined) {
      clearTimeout(this.pulseTimer);
      this.pulseTimer = undefined;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  consumeOptimistic(endpoint: string): void {
    if (!this.oauthService.hasValidAccessToken()) {
      return;
    }

    const cost = endpoint.includes('positions10')
      ? 15
      : (endpoint.includes('positions6') ? 10 : 0);

    this.optimisticVersion++;

    const snap = this.credits();
    if (cost > 0 && snap !== null) {
      const nextUsage = snap.currentUsage + cost;
      const nextRemaining = snap.isUnlimited || snap.monthlyQuota === null
        ? -1
        : Math.max(0, snap.monthlyQuota - nextUsage);
      const nextRatio = snap.isUnlimited || !snap.monthlyQuota || snap.monthlyQuota <= 0
        ? 1
        : Math.max(0, Math.min(1, nextRemaining / snap.monthlyQuota));
      const nextCanMake = snap.isUnlimited
        ? snap.canMakeRequests
        : (nextRemaining > 0 && snap.canMakeRequests);

      this.setSnapshot({
        ...snap,
        currentUsage: nextUsage,
        remaining: nextRemaining,
        ratioRemaining: nextRatio,
        canMakeRequests: nextCanMake,
        updatedAt: Date.now()
      }, true);
    }

    // Réconcilier avec le backend après écriture asynchrone RabbitMQ -> PostgreSQL
    this.scheduleReconcile();
  }

  refreshNow(): void {
    if (!this.oauthService.hasValidAccessToken() || this.inFlight) {
      return;
    }

    this.inFlight = true;
    const versionAtStart = this.optimisticVersion;

    forkJoin({
      quota: this.userService.getMyQuota().pipe(catchError(() => of(null as UserQuota | null))),
      status: this.organizationAccountService.getOrganizationStatus().pipe(
        catchError(() => of(null as OrganizationStatus | null))
      )
    }).pipe(
      finalize(() => {
        this.inFlight = false;
      })
    ).subscribe(({ quota, status }) => {
      if (!this.oauthService.hasValidAccessToken()) {
        return;
      }
      if (this.optimisticVersion !== versionAtStart) {
        return;
      }
      if (!quota || !quota.hasOrganization) {
        this.setSnapshot(null, false);
        return;
      }

      const isUnlimited = quota.isUnlimited === true
        || quota.monthlyQuota === null
        || quota.monthlyQuota === undefined
        || quota.remaining === -1;
      const monthlyQuota = quota.monthlyQuota ?? null;
      const currentUsage = quota.currentUsage ?? 0;
      const remaining = isUnlimited
        ? -1
        : (quota.remaining !== undefined && quota.remaining !== null
            ? Math.max(0, quota.remaining)
            : Math.max(0, (monthlyQuota ?? 0) - currentUsage));
      const ratioRemaining = isUnlimited || !monthlyQuota || monthlyQuota <= 0
        ? 1
        : Math.max(0, Math.min(1, remaining / monthlyQuota));
      const canMakeRequests = status !== null
        ? status.canMakeRequests
        : (isUnlimited || remaining > 0);

      const prev = this.credits();
      const changed = prev !== null
        && (prev.remaining !== remaining || prev.currentUsage !== currentUsage || prev.monthlyQuota !== monthlyQuota);

      this.setSnapshot({
        organizationName: quota.organizationName ?? null,
        monthlyQuota,
        currentUsage,
        remaining,
        isUnlimited,
        ratioRemaining,
        canMakeRequests,
        updatedAt: Date.now()
      }, changed);
    });
  }

  private scheduleReconcile(): void {
    this.clearReconcileTimers();
    this.reconcileTimers.push(
      setTimeout(() => this.refreshNow(), 500),
      setTimeout(() => this.refreshNow(), 2000)
    );
  }

  private scheduleSingleReconcile(delayMs: number): void {
    this.clearReconcileTimers();
    this.reconcileTimers.push(
      setTimeout(() => this.refreshNow(), delayMs)
    );
  }

  private clearReconcileTimers(): void {
    for (const timer of this.reconcileTimers) {
      clearTimeout(timer);
    }
    this.reconcileTimers = [];
  }

  private startPolling(): void {
    if (this.pollingSub) {
      return;
    }
    this.pollingSub = interval(15000).subscribe(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        this.refreshNow();
      }
    });
  }

  private stopPolling(): void {
    this.pollingSub?.unsubscribe();
    this.pollingSub = undefined;
  }

  private setSnapshot(snapshot: OrganizationCreditsSnapshot | null, pulse: boolean): void {
    this.credits.set(snapshot);
    this.creditsSubject.next(snapshot);

    if (pulse && snapshot !== null) {
      this.justUpdated.set(true);
      if (this.pulseTimer !== undefined) {
        clearTimeout(this.pulseTimer);
      }
      this.pulseTimer = setTimeout(() => {
        this.justUpdated.set(false);
        this.pulseTimer = undefined;
      }, 700);
    } else if (snapshot === null) {
      this.justUpdated.set(false);
    }
  }
}
