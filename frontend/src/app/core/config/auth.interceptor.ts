import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import { inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import {catchError} from 'rxjs/operators';
import {throwError} from 'rxjs';
import {Router} from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const oauthService = inject(OAuthService);
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = oauthService.getAccessToken();

  console.log('Requête interceptée:', req.url);
  console.log('Token disponible:', !!token);

  // Ne pas ajouter le token pour les requêtes vers Keycloak
  if (token && !req.url.includes('/realms/')) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned).pipe(
      catchError((error: HttpErrorResponse) => {
        // Si erreur 401 (Unauthorized), déconnecter l'utilisateur
        if (error.status === 401) {
          console.warn('Token expiré ou invalide. Déconnexion automatique.');
          authService.logout();
        }
        return throwError(() => error);
      })
    );
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Gérer aussi les erreurs 401 pour les requêtes sans token (token expiré)
      if (error.status === 401) {
        console.warn('Token expiré ou invalide. Déconnexion automatique.');
        authService.logout();
      }
      return throwError(() => error);
    })
  );

}
