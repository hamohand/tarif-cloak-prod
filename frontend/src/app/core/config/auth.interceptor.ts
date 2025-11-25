import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import { inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import {catchError} from 'rxjs/operators';
import {throwError} from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const oauthService = inject(OAuthService);
  const authService = inject(AuthService);
  const token = oauthService.getAccessToken();

  // Vérifier l'expiration du token avant chaque requête
  if (token && !req.url.includes('/realms/')) {
    // Utiliser hasValidAccessToken() qui gère le rafraîchissement automatique
    // au lieu de isTokenValid() qui est trop strict
    if (!oauthService.hasValidAccessToken()) {
      // Si le token n'est pas valide, laisser OAuthService tenter de le rafraîchir
      // Ne pas déconnecter immédiatement, laisser la requête passer et gérer l'erreur 401
      console.warn('Token invalide détecté, la requête sera envoyée pour permettre le rafraîchissement automatique.');
    }
    
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned).pipe(
      catchError((error: HttpErrorResponse) => {
        // Si erreur 401 (Unauthorized), déconnecter l'utilisateur
        if (error.status === 401) {
          console.warn('Token expiré ou invalide (401). Déconnexion automatique.');
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
        console.warn('Token expiré ou invalide (401). Déconnexion automatique.');
        authService.logout();
      }
      return throwError(() => error);
    })
  );

}
