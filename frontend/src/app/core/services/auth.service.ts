import { Injectable, inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { authConfig } from '../config/auth.config';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { AccountContextService } from './account-context.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private oauthService = inject(OAuthService);
  private router = inject(Router);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private configured = false;
  private tokenCheckInterval?: Subscription;
  private accountContextService = inject(AccountContextService);

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
    
    // Forcer requireHttps à false dans la configuration pour éviter les erreurs HTTPS
    const config = {
      ...authConfig,
      requireHttps: false,
      strictDiscoveryDocumentValidation: false,
      skipIssuerCheck: true,
      skipSubjectCheck: true
    };
    
    this.oauthService.configure(config);
    
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
        const initialToken = this.oauthService.getAccessToken();

        if (isAuthenticated && initialToken) {
          // Afficher le token dans la console après connexion réussie
          console.log('=== TOKEN JWT ===');
          console.log('Token complet:', initialToken);
          console.log('Token (premiers 50 caractères):', initialToken.substring(0, 50) + '...');
          
          // Décoder et afficher les informations du token (payload)
          try {
            const payload = JSON.parse(atob(initialToken.split('.')[1]));
            console.log('Informations du token:', payload);
            console.log('Rôles:', payload.realm_access?.roles || payload.resource_access?.['frontend-client']?.roles || 'Aucun rôle trouvé');
            console.log('Utilisateur:', payload.preferred_username || payload.email || payload.sub);
            console.log('Expiration:', new Date(payload.exp * 1000).toLocaleString());
          } catch (e) {
            console.warn('Impossible de décoder le token:', e);
          }
          console.log('================');
          
          // Nettoyer l'URL des paramètres OAuth
          if (hasCode || hasState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          
          // Démarrer la vérification périodique de l'expiration du token
          this.startTokenCheck();
          this.updateAccountContext(initialToken);
        }
        
        this.isAuthenticatedSubject.next(isAuthenticated);
        if (isAuthenticated) {
          this.updateAccountContext(initialToken);
        }
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
        
        // Si le chargement du document de découverte échoue, vérifier le type d'erreur
        if (error?.message) {
          // Si c'est une erreur HTTPS, essayer de contourner en reconfigurant
          if (error.message.includes('HTTPS') || error.message.includes('TLS') || error.message.includes('requireHttps')) {
            console.warn('Erreur HTTPS détectée. La configuration requireHttps: false devrait résoudre ce problème.');
            console.warn('Vérifiez que l\'URL de l\'issuer Keycloak est correcte:', authConfig.issuer);
            // Ne pas nettoyer les tokens, juste marquer comme non authentifié
            this.isAuthenticatedSubject.next(false);
          } else if (error.message.includes('discovery') || error.message.includes('Failed to load')) {
            console.error('Erreur critique : Impossible de charger le document de découverte Keycloak:', error);
            this.cleanupTokens();
            this.isAuthenticatedSubject.next(false);
          } else {
            // Si c'est juste la tentative de connexion automatique qui échoue, ce n'est pas grave
            // (pas de log nécessaire, c'est normal si pas de session active)
            this.isAuthenticatedSubject.next(false);
          }
        } else {
          // Si pas de message d'erreur, c'est peut-être juste une absence de session
          this.isAuthenticatedSubject.next(false);
        }
      });

    // Rafraîchir le statut d'authentification
    this.oauthService.events.subscribe((event: any) => {
      // Si une erreur de token est détectée, nettoyer automatiquement
      if (event.type === 'token_error' || event.type === 'token_refresh_error') {
        console.warn('Erreur de token détectée, nettoyage automatique');
        this.stopTokenCheck();
        this.cleanupTokens();
        this.isAuthenticatedSubject.next(false);
        this.accountContextService.setContext({ accountType: null, organizationEmail: null });
      } 
      // Mettre à jour le statut d'authentification pour les événements importants
      else if (event.type === 'token_received' || event.type === 'token_refreshed') {
        // Afficher le token quand il est reçu
        const eventToken = this.oauthService.getAccessToken();
        if (eventToken) {
          console.log('=== TOKEN REÇU ===');
          console.log('Token complet:', eventToken);
          console.log('Token (premiers 50 caractères):', eventToken.substring(0, 50) + '...');
          
          // Décoder et afficher les informations du token
          try {
            const payload = JSON.parse(atob(eventToken.split('.')[1]));
            console.log('Informations du token:', payload);
            console.log('Rôles:', payload.realm_access?.roles || payload.resource_access?.['frontend-client']?.roles || 'Aucun rôle trouvé');
            console.log('Utilisateur:', payload.preferred_username || payload.email || payload.sub);
            console.log('Expiration:', new Date(payload.exp * 1000).toLocaleString());
          } catch (e) {
            console.warn('Impossible de décoder le token:', e);
          }
          console.log('==================');
        }
        this.startTokenCheck();
        this.isAuthenticatedSubject.next(this.oauthService.hasValidAccessToken());
        const refreshedToken = this.oauthService.getAccessToken();
        if (refreshedToken) {
          this.updateAccountContext(refreshedToken);
        }
      }
      else if (event.type === 'discovery_document_loaded' || 
               event.type === 'session_changed' || event.type === 'session_unchanged') {
        const isValid = this.oauthService.hasValidAccessToken();
        this.isAuthenticatedSubject.next(isValid);
        if (isValid) {
          this.startTokenCheck();
          const sessionToken = this.oauthService.getAccessToken();
          if (sessionToken) {
            this.updateAccountContext(sessionToken);
          }
        } else {
          this.accountContextService.setContext({ accountType: null, organizationEmail: null });
          this.stopTokenCheck();
        }
      }
      else if (event.type === 'logout') {
        this.stopTokenCheck();
        this.isAuthenticatedSubject.next(false);
        this.accountContextService.setContext({ accountType: null, organizationEmail: null });
      }
      // Mettre à jour le statut d'authentification pour tous les autres événements
      else {
        const isValid = this.oauthService.hasValidAccessToken();
        this.isAuthenticatedSubject.next(isValid);
        if (isValid) {
          const currentToken = this.oauthService.getAccessToken();
          if (currentToken) {
            this.updateAccountContext(currentToken);
          }
        } else {
          this.accountContextService.setContext({ accountType: null, organizationEmail: null });
          this.stopTokenCheck();
        }
      }
    });
  }

  /**
   * Démarre la vérification périodique de l'expiration du token
   */
  private startTokenCheck(): void {
    // Arrêter la vérification précédente si elle existe
    this.stopTokenCheck();
    
    // Vérifier l'expiration du token toutes les 30 secondes
    this.tokenCheckInterval = interval(30000).subscribe(() => {
      this.checkTokenExpiration();
    });
    
    // Vérifier immédiatement
    this.checkTokenExpiration();
  }

  /**
   * Arrête la vérification périodique de l'expiration du token
   */
  private stopTokenCheck(): void {
    if (this.tokenCheckInterval) {
      this.tokenCheckInterval.unsubscribe();
      this.tokenCheckInterval = undefined;
    }
  }

  /**
   * Vérifie si le token est expiré et déconnecte l'utilisateur si nécessaire
   * Cette méthode ne doit pas être appelée pendant la navigation (dans isAuthenticated())
   * car elle peut déclencher une redirection qui interrompt la navigation en cours.
   */
  private checkTokenExpiration(): void {
    const token = this.oauthService.getAccessToken();
    
    // Si pas de token, l'utilisateur n'est pas authentifié
    if (!token) {
      const currentValue = this.isAuthenticatedSubject.value;
      if (currentValue) {
        // Seulement mettre à jour le statut si nécessaire, sans redirection
        this.stopTokenCheck();
        this.isAuthenticatedSubject.next(false);
      }
      return;
    }
    
    // Vérifier l'expiration du token en décodant le payload
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convertir en millisecondes
      const currentTime = Date.now();
      
      // Si le token est expiré (avec une marge de 5 secondes pour éviter les problèmes de timing)
      if (currentTime >= (expirationTime - 5000)) {
        console.warn('Token expiré ou sur le point d\'expirer. Déconnexion automatique.');
        this.stopTokenCheck();
        this.cleanupTokens();
        this.isAuthenticatedSubject.next(false);
        this.accountContextService.setContext({ accountType: null, organizationEmail: null });
        // Utiliser setTimeout pour éviter d'interrompre la navigation en cours
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 0);
        return;
      }
      
      // Si le token est valide, s'assurer que le statut d'authentification est correct
      if (currentTime < expirationTime) {
        const isValid = this.oauthService.hasValidAccessToken();
        if (!isValid) {
          // Le token n'est pas valide selon OAuthService mais n'est pas expiré
          // Cela peut arriver si la session Keycloak a expiré
          console.warn('Token présent mais session Keycloak invalide. Déconnexion automatique.');
          this.stopTokenCheck();
          this.cleanupTokens();
          this.isAuthenticatedSubject.next(false);
          this.accountContextService.setContext({ accountType: null, organizationEmail: null });
          // Utiliser setTimeout pour éviter d'interrompre la navigation en cours
          setTimeout(() => {
            this.router.navigate(['/']);
          }, 0);
        } else {
          // Token valide, s'assurer que le statut est correct
          const currentValue = this.isAuthenticatedSubject.value;
          if (!currentValue) {
            this.isAuthenticatedSubject.next(true);
          }
        }
      }
    } catch (e) {
      // Si on ne peut pas décoder le token, il est invalide
      console.warn('Token invalide détecté (impossible de décoder). Déconnexion automatique.');
      this.stopTokenCheck();
      this.cleanupTokens();
      this.isAuthenticatedSubject.next(false);
      this.accountContextService.setContext({ accountType: null, organizationEmail: null });
      // Utiliser setTimeout pour éviter d'interrompre la navigation en cours
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 0);
    }
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
    this.stopTokenCheck();
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
      this.accountContextService.setContext({ accountType: null, organizationEmail: null });
      this.router.navigate(['/']);
    }
  }

  public isAuthenticated(): Observable<boolean> {
    // Ne pas appeler checkTokenExpiration() ici car cela peut causer des effets de bord
    // (redirection) qui interrompent la navigation. La vérification périodique s'en charge.
    // On vérifie juste si le token est valide sans déclencher de redirection
    const token = this.oauthService.getAccessToken();
    if (token && this.isTokenValid()) {
      // Si le token est valide, s'assurer que le statut est à jour
      const currentValue = this.isAuthenticatedSubject.value;
      if (!currentValue) {
        // Si le statut n'est pas à jour mais que le token est valide, le mettre à jour
        this.isAuthenticatedSubject.next(true);
      }
    }
    return this.isAuthenticatedSubject.asObservable();
  }

  /**
   * Vérifie si le token est valide en vérifiant son expiration
   */
  public isTokenValid(): boolean {
    if (!this.oauthService.hasValidAccessToken()) {
      return false;
    }
    
    const token = this.oauthService.getAccessToken();
    if (!token) {
      return false;
    }
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000;
      const currentTime = Date.now();
      return currentTime < expirationTime;
    } catch (e) {
      return false;
    }
  }

  public getUserInfo(): any {
    return this.oauthService.getIdentityClaims();
  }

  public isOrganizationAccount(): Observable<boolean> {
    return this.accountContextService.isOrganizationAccount$;
  }

  public isCollaboratorAccount(): Observable<boolean> {
    return this.accountContextService.isCollaboratorAccount$;
  }

  public getOrganizationEmail(): Observable<string | null> {
    return this.accountContextService.organizationEmail$;
  }

  /**
   * Vérifie si l'utilisateur a un rôle spécifique
   * @param role Le nom du rôle à vérifier (ex: 'ADMIN', 'USER')
   */
  public hasRole(role: string): boolean {
    const token = this.oauthService.getAccessToken();
    if (!token) {
      return false;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Vérifier dans realm_access.roles (rôles du realm)
      const realmRoles = payload.realm_access?.roles || [];
      // Vérifier dans resource_access[client-id].roles (rôles du client)
      const clientRoles = payload.resource_access?.['frontend-client']?.roles || [];
      // Vérifier aussi avec d'autres noms de client possibles
      const allClientRoles = Object.values(payload.resource_access || {}).flatMap((client: any) => client.roles || []);
      
      return realmRoles.includes(role) || clientRoles.includes(role) || allClientRoles.includes(role);
    } catch (e) {
      console.warn('Impossible de décoder le token pour vérifier les rôles:', e);
      return false;
    }
  }

  private updateAccountContext(tokenOverride?: string): void {
    const tokenToUse = tokenOverride ?? this.oauthService.getAccessToken();
    if (tokenToUse) {
      this.updateAccountContextWithToken(tokenToUse);
    } else {
      this.accountContextService.setContext({ accountType: null, organizationEmail: null });
    }
  }

  private updateAccountContextWithToken(token: string): void {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      let accountType: 'ORGANIZATION' | 'COLLABORATOR' | null = null;
      const attributes = payload.attributes || {};

      if (payload.account_type && typeof payload.account_type === 'string') {
        if (payload.account_type === 'ORGANIZATION' || payload.account_type === 'COLLABORATOR') {
          accountType = payload.account_type;
        }
      } else if (attributes.account_type && Array.isArray(attributes.account_type)) {
        const value = attributes.account_type[0];
        if (value === 'ORGANIZATION' || value === 'COLLABORATOR') {
          accountType = value;
        }
      }

      let organizationEmail: string | null = null;
      if (payload.organization_email) {
        organizationEmail = payload.organization_email;
      } else if (attributes.organization_email && Array.isArray(attributes.organization_email)) {
        organizationEmail = attributes.organization_email[0];
      }
      this.accountContextService.setContext({
        accountType,
        organizationEmail: organizationEmail ?? null
      });
    } catch (error) {
      console.warn('Impossible de décoder le token pour récupérer les informations du compte:', error);
      this.accountContextService.setContext({ accountType: null, organizationEmail: null });
    }
  }
}
