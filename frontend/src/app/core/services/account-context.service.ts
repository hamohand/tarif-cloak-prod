import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AccountContext, AccountType } from '../models/account-context.model';

@Injectable({
  providedIn: 'root'
})
export class AccountContextService {
  private readonly contextSubject = new BehaviorSubject<AccountContext>({
    accountType: null,
    organizationEmail: null
  });

  get context$(): Observable<AccountContext> {
    return this.contextSubject.asObservable();
  }

  get accountType$(): Observable<AccountType> {
    return this.context$.pipe(map(ctx => ctx.accountType));
  }

  get organizationEmail$(): Observable<string | null> {
    return this.context$.pipe(map(ctx => ctx.organizationEmail));
  }

  get isOrganizationAccount$(): Observable<boolean> {
    return this.accountType$.pipe(map(type => type === 'ORGANIZATION'));
  }

  get isCollaboratorAccount$(): Observable<boolean> {
    return this.accountType$.pipe(map(type => type === 'COLLABORATOR'));
  }

  setContext(context: AccountContext): void {
    this.contextSubject.next(context);
  }
}

