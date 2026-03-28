import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { AccountContextService } from '../services/account-context.service';

export const collaboratorGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const accountContextService = inject(AccountContextService);

  // Vérification 1 : lecture synchrone des rôles depuis le JWT (sessionStorage)
  if (
    authService.hasRole('ORGANIZATION') ||
    authService.hasRole('COLLABORATOR') ||
    authService.hasRole('ADMIN')
  ) {
    return true;
  }

  // Vérification 2 : fallback sur le contexte de compte chargé depuis localStorage
  // (utile si le token n'est pas encore disponible dans sessionStorage)
  const currentType = accountContextService.currentAccountType;
  if (currentType === 'ORGANIZATION' || currentType === 'COLLABORATOR') {
    return true;
  }

  router.navigate(['/organization/account']);
  return false;
};
