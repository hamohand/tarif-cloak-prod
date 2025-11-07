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
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hasCode = urlParams.has('code') || hashParams.has('code');
    const hasState = urlParams.has('state') || hashParams.has('state');
    const hasError = urlParams.has('error') || hashParams.has('error');
    
    console.log('URL actuelle:', url);
    console.log('Query params:', window.location.search);
    console.log('Hash params:', window.location.hash);
    console.log('Callback OAuth détecté (code):', hasCode);
    console.log('Callback OAuth détecté (state):', hasState);
    console.log('Erreur OAuth détectée:', hasError);
    
    if (hasError) {
      const error = urlParams.get('error') || hashParams.get('error');
      const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
      console.error('Erreur OAuth:', error, errorDescription);
      this.isAuthenticatedSubject.next(false);
      return;
    }
    
    // Charger d'abord le document de découverte
    this.oauthService.loadDiscoveryDocument()
      .then(() => {
        console.log('Document de découverte chargé avec succès');
        
        // Si on a un code dans l'URL, c'est un callback OAuth - le traiter explicitement
        if (hasCode) {
          console.log('Traitement du callback OAuth...');
          return this.oauthService.tryLoginCodeFlow()
            .then(() => {
              console.log('Callback OAuth traité');
              const isAuthenticated = this.oauthService.hasValidAccessToken();
              const token = this.oauthService.getAccessToken();
              console.log('Authentifié après callback:', isAuthenticated);
              console.log('Token disponible:', !!token);
              
              if (isAuthenticated) {
                const userInfo = this.oauthService.getIdentityClaims();
                console.log('Informations utilisateur:', userInfo);
                // Nettoyer l'URL des paramètres OAuth
                window.history.replaceState({}, document.title, window.location.pathname);
              }
              
              this.isAuthenticatedSubject.next(isAuthenticated);
            })
            .catch((error) => {
              console.error('Erreur lors du traitement du callback OAuth:', error);
              this.isAuthenticatedSubject.next(false);
            });
        } else {
          // Pas de callback, essayer une reconnexion automatique
          console.log('Pas de callback OAuth, tentative de reconnexion automatique...');
          return this.oauthService.tryLogin()
            .then(() => {
              const isAuthenticated = this.oauthService.hasValidAccessToken();
              console.log('Reconnexion automatique. Authentifié:', isAuthenticated);
              this.isAuthenticatedSubject.next(isAuthenticated);
            })
            .catch((error) => {
              // La reconnexion automatique échoue normalement si pas de session active
              console.log('Reconnexion automatique échouée (normal si pas de session active):', error.message);
              this.isAuthenticatedSubject.next(false);
            });
        }
      })
      .catch((error) => {
        console.error('Erreur lors du chargement du document de découverte:', error);
        console.error('Message d\'erreur:', error.message);
        console.error('Stack:', error.stack);
        this.cleanupTokens();
        this.isAuthenticatedSubject.next(false);
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
