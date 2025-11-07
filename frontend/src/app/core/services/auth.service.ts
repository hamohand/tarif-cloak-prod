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
    
    // Charger le document de découverte d'abord
    this.oauthService.loadDiscoveryDocument()
      .then(() => {
        console.log('Document de découverte chargé avec succès');
        // Une fois le document chargé, essayer de se connecter automatiquement si un token existe
        return this.oauthService.tryLogin();
      })
      .then(() => {
        // Vérifier si la connexion automatique a réussi
        this.isAuthenticatedSubject.next(this.oauthService.hasValidAccessToken());
      })
      .catch((error) => {
        // Si le chargement du document de découverte échoue, c'est un problème critique
        if (error.message && error.message.includes('discovery')) {
          console.error('Erreur critique : Impossible de charger le document de découverte Keycloak:', error);
          // Nettoyer les tokens en cache au cas où
          this.cleanupTokens();
          this.isAuthenticatedSubject.next(false);
        } else {
          // Si c'est juste la tentative de connexion automatique qui échoue, ce n'est pas grave
          // (utilisateur supprimé, token invalide, etc.)
          console.warn('Échec de la reconnexion automatique (normal si pas de session active), nettoyage des tokens:', error);
          this.cleanupTokens();
          this.isAuthenticatedSubject.next(false);
        }
      });

    // Rafraîchir le statut d'authentification
    this.oauthService.events.subscribe((event: any) => {
      // Si une erreur de token est détectée, nettoyer automatiquement
      if (event.type === 'token_error' || event.type === 'token_refresh_error') {
        console.warn('Erreur de token détectée, nettoyage automatique');
        this.cleanupTokens();
        this.isAuthenticatedSubject.next(false);
      } else {
        this.isAuthenticatedSubject.next(this.oauthService.hasValidAccessToken());
      }
    });
  }

  private cleanupTokens() {
    try {
      this.oauthService.logOut();
    } catch (error) {
      // Ignorer les erreurs de logout
    }
    // Nettoyer aussi manuellement les clés OAuth restantes
    const oauthKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('oauth') || key.startsWith('angular-oauth2-oidc')
    );
    oauthKeys.forEach(key => localStorage.removeItem(key));
    const oauthSessionKeys = Object.keys(sessionStorage).filter(key => 
      key.startsWith('oauth') || key.startsWith('angular-oauth2-oidc')
    );
    oauthSessionKeys.forEach(key => sessionStorage.removeItem(key));
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
