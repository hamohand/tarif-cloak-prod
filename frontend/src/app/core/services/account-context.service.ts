import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { AccountContext, AccountType } from '../models/account-context.model';

@Injectable({
  providedIn: 'root'
})
export class AccountContextService {
  private readonly contextSubject = new BehaviorSubject<AccountContext>({
    accountType: null,
    organizationEmail: null
  });

  private readonly persistedKey = 'account_context';

  constructor() {
    this.loadFromStorage();
  }

  get context$(): Observable<AccountContext> {
    return this.contextSubject.asObservable();
  }

  get accountType$(): Observable<AccountType> {
    return this.context$.pipe(map(ctx => ctx.accountType), distinctUntilChanged());
  }

  get organizationEmail$(): Observable<string | null> {
    return this.context$.pipe(map(ctx => ctx.organizationEmail), distinctUntilChanged());
  }

  get isOrganizationAccount$(): Observable<boolean> {
    return this.accountType$.pipe(
      map(type => type === 'ORGANIZATION'),
      distinctUntilChanged()
    );
  }

  get isCollaboratorAccount$(): Observable<boolean> {
    // Les utilisateurs ORGANISATION ont aussi accès aux fonctionnalités collaborateur
    return this.accountType$.pipe(
      map(type => type === 'COLLABORATOR' || type === 'ORGANIZATION'),
      distinctUntilChanged()
    );
  }

  get currentAccountType(): AccountType {
    return this.contextSubject.getValue().accountType;
  }

  setContext(context: AccountContext): void {
    const current = this.contextSubject.getValue();
    this.saveToStorage(context);
    if (current.accountType === context.accountType && current.organizationEmail === context.organizationEmail) {
      return;
    }
    this.contextSubject.next(context);
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.persistedKey);
      if (raw) {
        const parsed = JSON.parse(raw) as AccountContext;
        this.contextSubject.next(parsed);
      }
    } catch (error) {
      console.warn('Impossible de charger le contexte compte depuis le stockage:', error);
    }
  }

  private saveToStorage(context: AccountContext): void {
    try {
      localStorage.setItem(this.persistedKey, JSON.stringify(context));
    } catch (error) {
      console.warn('Impossible de persister le contexte compte:', error);
    }
  }

  clear(): void {
    localStorage.removeItem(this.persistedKey);
    const current = this.contextSubject.getValue();
    if (current.accountType !== null || current.organizationEmail !== null) {
      this.contextSubject.next({ accountType: null, organizationEmail: null });
    }
  }
}

