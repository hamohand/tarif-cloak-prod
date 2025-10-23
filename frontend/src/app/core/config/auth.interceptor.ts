import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import { inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import {catchError} from 'rxjs/operators';
import {throwError} from 'rxjs';
import {Router} from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const oauthService = inject(OAuthService);
  const router = inject(Router);
  const token = oauthService.getAccessToken();

  console.log('Requête interceptée:', req.url);
  console.log('Token disponible:', !!token);

  // Ne pas ajouter le token pour les requêtes vers Keycloak
  if (token && !req.url.includes('/realms/')) {
    console.log('Ajout du token Bearer à la requête');
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Erreur HTTP interceptée:', error);
        // Si erreur 401 (Unauthorized), déconnecter l'utilisateur
        if (error.status === 401) {
          console.warn('Token expiré ou invalide. Déconnexion automatique.');
          oauthService.logOut();
          router.navigate(['/']);
        }
        return throwError(() => error);
      })
    );
  } else {
    console.log('Requête sans token ou vers Keycloak');
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('Erreur HTTP sans token:', error);
      return throwError(() => error);
    })
  );

}
