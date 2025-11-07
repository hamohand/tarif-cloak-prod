import { Injectable, inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { authConfig } from '../config/auth.config';
import { BehaviorSubject, Observable } from 'rxjs';
import {Router} from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private oauthService = inject(OAuthService);
  private router = inject(Router);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);

  constructor() {
    this.configure();
  }

  private configure() {
    this.oauthService.configure(authConfig);
    this.oauthService.loadDiscoveryDocumentAndTryLogin().then(() => {
      this.isAuthenticatedSubject.next(this.oauthService.hasValidAccessToken());
    }).catch((error) => {
      // Si la tentative de connexion automatique échoue (utilisateur supprimé, token invalide, etc.)
      // Nettoyer les tokens en cache et forcer une nouvelle authentification
      console.warn('Échec de la reconnexion automatique, nettoyage des tokens:', error);
      this.oauthService.logOut();
      // Nettoyer aussi manuellement les clés OAuth restantes
      const oauthKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('oauth') || key.startsWith('angular-oauth2-oidc')
      );
      oauthKeys.forEach(key => localStorage.removeItem(key));
      this.isAuthenticatedSubject.next(false);
    });

    // Rafraîchir le statut d'authentification
    this.oauthService.events.subscribe((event: any) => {
      // Si une erreur de token est détectée, nettoyer automatiquement
      if (event.type === 'token_error' || event.type === 'token_refresh_error') {
        console.warn('Erreur de token détectée, nettoyage automatique');
        this.oauthService.logOut();
        // Nettoyer aussi manuellement les clés OAuth restantes
        const oauthKeys = Object.keys(localStorage).filter(key => 
          key.startsWith('oauth') || key.startsWith('angular-oauth2-oidc')
        );
        oauthKeys.forEach(key => localStorage.removeItem(key));
        this.isAuthenticatedSubject.next(false);
      } else {
        this.isAuthenticatedSubject.next(this.oauthService.hasValidAccessToken());
      }
    });
  }

  public login(): void {
    this.oauthService.initLoginFlow();
  }

  public logout(): void {
    try {
      // Nettoyer le token localement d'abord
      this.oauthService.logOut();
      // Nettoyer les clés OAuth du localStorage (angular-oauth2-oidc utilise des clés spécifiques)
      const oauthKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('oauth') || key.startsWith('angular-oauth2-oidc')
      );
      oauthKeys.forEach(key => localStorage.removeItem(key));
      // Nettoyer aussi sessionStorage pour les clés OAuth
      const oauthSessionKeys = Object.keys(sessionStorage).filter(key => 
        key.startsWith('oauth') || key.startsWith('angular-oauth2-oidc')
      );
      oauthSessionKeys.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.warn('Erreur lors du logout Keycloak (probablement session expirée):', error);
      // Même en cas d'erreur, nettoyer les clés OAuth
      const oauthKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('oauth') || key.startsWith('angular-oauth2-oidc')
      );
      oauthKeys.forEach(key => localStorage.removeItem(key));
      const oauthSessionKeys = Object.keys(sessionStorage).filter(key => 
        key.startsWith('oauth') || key.startsWith('angular-oauth2-oidc')
      );
      oauthSessionKeys.forEach(key => sessionStorage.removeItem(key));
    } finally {
      // Toujours nettoyer l'état local et rediriger
      this.isAuthenticatedSubject.next(false);
      this.router.navigate(['/']);
    }
  }

  public isAuthenticated(): Observable<boolean> {
    return this.isAuthenticatedSubject.asObservable();
  }

  public getUserInfo(): any {
    return this.oauthService.getIdentityClaims();
  }
}
