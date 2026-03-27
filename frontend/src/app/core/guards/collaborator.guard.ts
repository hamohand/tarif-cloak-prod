import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const collaboratorGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Lecture synchrone des rôles depuis le JWT pour éviter la condition de course
  // avec le chargement asynchrone du contexte de compte (AccountContextService)
  const isCollaborator = authService.hasRole('ORGANIZATION') || authService.hasRole('COLLABORATOR');

  if (!isCollaborator) {
    router.navigate(['/organization/account']);
    return false;
  }
  return true;
};

