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
    
    // Vérifier si on revient d'un callback OAuth (code dans l'URL)
    const url = window.location.href;
    const hasCode = url.includes('code=') || url.includes('state=');
    console.log('URL actuelle:', url);
    console.log('Callback OAuth détecté:', hasCode);
    
    // Utiliser loadDiscoveryDocumentAndTryLogin qui gère automatiquement le callback OAuth
    // Cette méthode charge le document de découverte ET traite le callback si on revient de Keycloak
    this.oauthService.loadDiscoveryDocumentAndTryLogin()
      .then(() => {
        // Vérifier si la connexion a réussi (soit automatique, soit via callback)
        const isAuthenticated = this.oauthService.hasValidAccessToken();
        const token = this.oauthService.getAccessToken();
        console.log('Document de découverte chargé et tentative de connexion effectuée.');
        console.log('Authentifié:', isAuthenticated);
        console.log('Token disponible:', !!token);
        console.log('Token:', token ? token.substring(0, 20) + '...' : 'null');
        
        if (isAuthenticated) {
          const userInfo = this.oauthService.getIdentityClaims();
          console.log('Informations utilisateur:', userInfo);
        }
        
        this.isAuthenticatedSubject.next(isAuthenticated);
      })
      .catch((error) => {
        console.error('Erreur lors de loadDiscoveryDocumentAndTryLogin:', error);
        console.error('Message d\'erreur:', error.message);
        console.error('Stack:', error.stack);
        
        // Si le chargement du document de découverte échoue, c'est un problème critique
        if (error.message && (error.message.includes('discovery') || error.message.includes('Failed to load'))) {
          console.error('Erreur critique : Impossible de charger le document de découverte Keycloak:', error);
          // Nettoyer les tokens en cache au cas où
          this.cleanupTokens();
          this.isAuthenticatedSubject.next(false);
        } else {
          // Si c'est juste la tentative de connexion automatique qui échoue, ce n'est pas grave
          // (utilisateur supprimé, token invalide, pas de callback OAuth, etc.)
          // Ne pas nettoyer les tokens ici car cela peut interrompre un callback OAuth en cours
          console.warn('Échec de la reconnexion automatique (normal si pas de session active):', error);
          this.isAuthenticatedSubject.next(false);
        }
      });

    // Rafraîchir le statut d'authentification
    this.oauthService.events.subscribe((event: any) => {
      console.log('Événement OAuth:', event.type);
      
      // Si une erreur de token est détectée, nettoyer automatiquement
      if (event.type === 'token_error' || event.type === 'token_refresh_error') {
        console.warn('Erreur de token détectée, nettoyage automatique');
        this.cleanupTokens();
        this.isAuthenticatedSubject.next(false);
      } 
      // Si la connexion réussit (token reçu)
      else if (event.type === 'token_received' || event.type === 'discovery_document_loaded') {
        console.log('Token reçu ou document de découverte chargé');
        this.isAuthenticatedSubject.next(this.oauthService.hasValidAccessToken());
      }
      // Si la session est validée
      else if (event.type === 'session_changed' || event.type === 'session_unchanged') {
        console.log('Session changée ou inchangée');
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
    console.log('Démarrage du flux de connexion...');
    console.log('Redirect URI configurée:', authConfig.redirectUri);
    console.log('Issuer configuré:', authConfig.issuer);
    console.log('Client ID configuré:', authConfig.clientId);
    
    try {
      this.oauthService.initLoginFlow();
      console.log('Flux de connexion initié avec succès');
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
