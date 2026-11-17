import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { OrganizationAccountService } from '../services/organization-account.service';
import { AuthService } from '../services/auth.service';
import { catchError, combineLatest, map, of, switchMap, take } from 'rxjs';

/**
 * Guard qui bloque la navigation si la licence Box IA est inactive/expirée ou le quota atteint.
 * Ne s'applique qu'aux comptes ORGANIZATION et COLLABORATOR.
 */
export const planRequiredGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const orgAccountService = inject(OrganizationAccountService);
  const router = inject(Router);

  if (!authService.isTokenValid()) {
    return of(true); // authGuard gère la redirection vers login
  }

  return combineLatest([
    authService.isOrganizationAccount().pipe(take(1)),
    authService.isCollaboratorAccount().pipe(take(1))
  ]).pipe(
    switchMap(([isOrg, isCollab]) => {
      if (!isOrg && !isCollab) return of(true);

      return orgAccountService.getOrganizationStatus().pipe(
        map(status => {
          if (status.canMakeRequests) return true;

          router.navigate([isOrg ? '/organization/account' : '/access-expired']);
          return false;
        }),
        catchError(() => of(true)) // En cas d'erreur réseau, laisser passer
      );
    })
  );
};
