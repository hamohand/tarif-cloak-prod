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
  private configured = false;

  constructor() {
    // Utiliser setTimeout pour s'assurer que l'injecteur Angular est prêt
    // Cela évite l'erreur NG0200 lors du callback OAuth
    setTimeout(() => {
      this.configure();
    }, 0);
  }

  private configure() {
    if (this.configured) {
      return;
    }
    
    this.configured = true;
    this.oauthService.configure(authConfig);
    
    // Vérifier si on revient d'un callback OAuth (code dans l'URL)
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hasCode = urlParams.has('code') || hashParams.has('code');
    const hasState = urlParams.has('state') || hashParams.has('state');
    const hasError = urlParams.has('error') || hashParams.has('error');
    
    if (hasError) {
      const error = urlParams.get('error') || hashParams.get('error');
      const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
      console.error('Erreur OAuth:', error, errorDescription);
      this.isAuthenticatedSubject.next(false);
      return;
    }
    
    // Utiliser loadDiscoveryDocumentAndTryLogin qui gère automatiquement le callback
    // Cette méthode charge le document ET traite le callback si présent
    this.oauthService.loadDiscoveryDocumentAndTryLogin()
      .then(() => {
        const isAuthenticated = this.oauthService.hasValidAccessToken();
        
        if (isAuthenticated) {
          // Nettoyer l'URL des paramètres OAuth
          if (hasCode || hasState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
        
        this.isAuthenticatedSubject.next(isAuthenticated);
      })
      .catch((error) => {
        // Si c'est une erreur NG0200 (injecteur non prêt), réessayer après un court délai
        if (error.message && error.message.includes('NG0200')) {
          setTimeout(() => {
            this.configured = false;
            this.configure();
          }, 100);
          return;
        }
        
        // Si le chargement du document de découverte échoue, c'est un problème critique
        if (error.message && (error.message.includes('discovery') || error.message.includes('Failed to load'))) {
          console.error('Erreur critique : Impossible de charger le document de découverte Keycloak:', error);
          this.cleanupTokens();
          this.isAuthenticatedSubject.next(false);
        } else {
          // Si c'est juste la tentative de connexion automatique qui échoue, ce n'est pas grave
          // (pas de log nécessaire, c'est normal si pas de session active)
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
      } 
      // Mettre à jour le statut d'authentification pour les événements importants
      else if (event.type === 'token_received' || event.type === 'discovery_document_loaded' || 
               event.type === 'session_changed' || event.type === 'session_unchanged') {
        this.isAuthenticatedSubject.next(this.oauthService.hasValidAccessToken());
      }
      // Mettre à jour le statut d'authentification pour tous les autres événements
      else {
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
    try {
      this.oauthService.initLoginFlow();
    } catch (error) {
      console.error('Erreur lors de l\'initiation du flux de connexion:', error);
      throw error;
    }
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
