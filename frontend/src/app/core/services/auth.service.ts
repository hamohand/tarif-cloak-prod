import { Injectable, inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { authConfig } from '../config/auth.config';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { AccountContextService } from './account-context.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private configured = false;
  private tokenCheckInterval?: Subscription;
  private visibilityListenersBound = false;

  constructor(
    private oauthService: OAuthService,
    private router: Router,
    private accountContextService: AccountContextService
  ) {
    setTimeout(() => {
      this.configure();
    }, 0);
  }

  private emitAuthenticated(isAuth: boolean): void {
    if (this.isAuthenticatedSubject.value !== isAuth) {
      this.isAuthenticatedSubject.next(isAuth);
    }
  }

  private configure() {
    if (this.configured) {
      return;
    }
    
    this.configured = true;
    try {
      localStorage.removeItem('batches');
    } catch {
      // Ignorer erreurs localStorage
    }
    
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
      
      // Gérer les erreurs spécifiques de manière appropriée
      if (error === 'invalid_user_credentials') {
        // Identifiants invalides - c'est une erreur utilisateur normale, pas une erreur système
        console.warn('Identifiants invalides lors de la connexion');
      } else if (error === 'session_expired') {
        // Session expirée - c'est normal, pas une erreur critique
        console.debug('Session expirée détectée lors du callback OAuth');
      } else {
        // Autres erreurs OAuth
        console.error('Erreur OAuth:', error, errorDescription);
      }
      
      // Nettoyer l'URL des paramètres d'erreur
      window.history.replaceState({}, document.title, window.location.pathname);
      this.emitAuthenticated(false);
      return;
    }
    
    // Vérifier d'abord s'il y a des tokens en cache qui pourraient être invalides
    // Cela évite de garder des sessions expirées en mémoire
    this.validateExistingTokens();
    
    // Utiliser loadDiscoveryDocumentAndTryLogin qui gère automatiquement le callback
    // Cette méthode charge le document ET traite le callback si présent
    this.oauthService.loadDiscoveryDocumentAndTryLogin()
      .then(() => {
        const isAuthenticated = this.oauthService.hasValidAccessToken();
        const initialToken = this.oauthService.getAccessToken();

        // Vérifier à nouveau la validité après le chargement du document
        // pour détecter les sessions Keycloak expirées
        if (initialToken && !this.isTokenValid()) {
          console.warn('Token présent mais invalide détecté au démarrage. Nettoyage automatique.');
          this.cleanupTokens();
          this.emitAuthenticated(false);
          return;
        }

        if (isAuthenticated && initialToken) {
          // Nettoyer l'URL des paramètres OAuth
          if (hasCode || hasState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          
          // Activer le rafraîchissement silencieux (refresh_token flow) pour éviter les déconnexions
          this.oauthService.setupAutomaticSilentRefresh();
          
          // Démarrer la vérification périodique de l'expiration du token
          this.startTokenCheck();
          this.updateAccountContext(initialToken);
        }
        
        this.emitAuthenticated(isAuthenticated);
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
            this.emitAuthenticated(false);
          } else if (error.message.includes('discovery') || error.message.includes('Failed to load')) {
            console.error('Erreur critique : Impossible de charger le document de découverte Keycloak:', error);
            this.cleanupTokens();
            this.emitAuthenticated(false);
          } else {
            // Si c'est juste la tentative de connexion automatique qui échoue, ce n'est pas grave
            // (pas de log nécessaire, c'est normal si pas de session active)
            this.emitAuthenticated(false);
          }
        } else {
          // Si pas de message d'erreur, c'est peut-être juste une absence de session
          this.emitAuthenticated(false);
        }
      });

    // Rafraîchir le statut d'authentification
    this.oauthService.events.subscribe((event: any) => {
      // Si une erreur de token est détectée, nettoyer automatiquement
      if (event.type === 'token_error' || event.type === 'token_refresh_error') {
        console.warn('Erreur de token détectée, nettoyage automatique');
        this.stopTokenCheck();
        this.cleanupTokens();
        this.emitAuthenticated(false);
        this.accountContextService.clear();
        // Utiliser setTimeout pour éviter d'interrompre la navigation en cours
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 0);
        return;
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
        this.emitAuthenticated(this.oauthService.hasValidAccessToken());
        const refreshedToken = this.oauthService.getAccessToken();
        if (refreshedToken) {
          this.updateAccountContext(refreshedToken);
        }
      }
      else if (event.type === 'session_unchanged') {
        // Émis toutes les 3 s par l'iframe OIDC : ignorer si l'état n'a pas changé
        const isValid = this.oauthService.hasValidAccessToken();
        if (isValid === this.isAuthenticatedSubject.value) {
          return;
        }
        this.emitAuthenticated(isValid);
        if (isValid) {
          const sessionToken = this.oauthService.getAccessToken();
          if (sessionToken) {
            this.updateAccountContext(sessionToken);
          }
        } else {
          this.accountContextService.clear();
          this.stopTokenCheck();
        }
      }
      else if (event.type === 'discovery_document_loaded' || 
               event.type === 'session_changed') {
        const isValid = this.oauthService.hasValidAccessToken();
        const stateChanged = this.isAuthenticatedSubject.value !== isValid;
        this.emitAuthenticated(isValid);
        if (isValid) {
          if (stateChanged || !this.tokenCheckInterval) {
            this.oauthService.setupAutomaticSilentRefresh();
            this.startTokenCheck();
          }
          const sessionToken = this.oauthService.getAccessToken();
          if (sessionToken) {
            this.updateAccountContext(sessionToken);
          }
        } else {
          this.accountContextService.clear();
          this.stopTokenCheck();
        }
      }
      else if (event.type === 'logout') {
        this.stopTokenCheck();
        this.emitAuthenticated(false);
        this.accountContextService.clear();
      }
      // Mettre à jour le statut d'authentification pour les autres événements sans ré-émission inutile
      else {
        const isValid = this.oauthService.hasValidAccessToken();
        if (this.isAuthenticatedSubject.value === isValid) {
          return;
        }
        this.emitAuthenticated(isValid);
        if (isValid) {
          const currentToken = this.oauthService.getAccessToken();
          if (currentToken) {
            this.updateAccountContext(currentToken);
          }
        } else {
          this.accountContextService.clear();
          this.stopTokenCheck();
        }
      }
    });
  }

  /**
   * Valide les tokens existants dans le stockage local
   * Nettoie automatiquement les tokens invalides ou expirés
   */
  private validateExistingTokens(): void {
    try {
      const token = this.oauthService.getAccessToken();
      if (token) {
        // Vérifier si le token est valide avant de continuer
        if (!this.isTokenValid()) {
          console.debug('Token invalide détecté au démarrage. Nettoyage automatique.');
          this.cleanupTokens();
          this.emitAuthenticated(false);
        }
      }
    } catch (error) {
      // En cas d'erreur, nettoyer les tokens pour être sûr
      console.debug('Erreur lors de la validation des tokens. Nettoyage préventif.', error);
      this.cleanupTokens();
      this.emitAuthenticated(false);
    }
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
    
    // N'enregistrer les écouteurs DOM qu'une seule fois
    if (!this.visibilityListenersBound) {
      this.visibilityListenersBound = true;
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.isAuthenticatedSubject.value) {
          setTimeout(() => {
            this.checkTokenExpiration();
          }, 1000);
        }
      });

      window.addEventListener('focus', () => {
        if (this.isAuthenticatedSubject.value) {
          setTimeout(() => {
            this.checkTokenExpiration();
          }, 1000);
        }
      });
    }
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
        this.emitAuthenticated(false);
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
        this.emitAuthenticated(false);
        this.accountContextService.clear();
        // Utiliser setTimeout pour éviter d'interrompre la navigation en cours
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 0);
        return;
      }
      
      // Si le token est valide selon l'expiration, vérifier aussi avec OAuthService
      if (currentTime < expirationTime) {
        const isValid = this.oauthService.hasValidAccessToken();
        if (!isValid) {
          // Le token n'est pas valide selon OAuthService mais n'est pas expiré selon l'exp
          // Cela peut arriver si la session Keycloak a expiré côté serveur
          console.warn('Token présent mais session Keycloak invalide. Déconnexion automatique.');
          this.stopTokenCheck();
          this.cleanupTokens();
          this.emitAuthenticated(false);
          this.accountContextService.clear();
          // Utiliser setTimeout pour éviter d'interrompre la navigation en cours
          setTimeout(() => {
            this.router.navigate(['/']);
          }, 0);
        } else {
          // Token valide, s'assurer que le statut est correct
          this.emitAuthenticated(true);
        }
      } else {
        // Token expiré selon l'exp, nettoyer même si OAuthService ne l'a pas encore détecté
        console.warn('Token expiré détecté. Déconnexion automatique.');
        this.stopTokenCheck();
        this.cleanupTokens();
        this.emitAuthenticated(false);
        this.accountContextService.clear();
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 0);
      }
    } catch (e) {
      // Si on ne peut pas décoder le token, il est invalide
      console.warn('Token invalide détecté (impossible de décoder). Déconnexion automatique.');
      this.stopTokenCheck();
      this.cleanupTokens();
      this.emitAuthenticated(false);
      this.accountContextService.clear();
      // Utiliser setTimeout pour éviter d'interrompre la navigation en cours
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 0);
    }
  }

  private cleanupTokens() {
    // Arrêter la vérification périodique
    this.stopTokenCheck();
    
    // Nettoyer les tokens localement de manière exhaustive
    // Nettoyer localStorage
    const oauthKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('oauth') || 
      key.startsWith('angular-oauth2-oidc') ||
      key.includes('keycloak') ||
      key.includes('access_token') ||
      key.includes('id_token') ||
      key.includes('refresh_token')
    );
    oauthKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.debug('Erreur lors du nettoyage de localStorage:', e);
      }
    });
    try {
      localStorage.removeItem('batches');
    } catch {
      // Ignorer erreurs localStorage
    }
    
    // Nettoyer sessionStorage
    const oauthSessionKeys = Object.keys(sessionStorage).filter(key => 
      key.startsWith('oauth') || 
      key.startsWith('angular-oauth2-oidc') ||
      key.includes('keycloak') ||
      key.includes('access_token') ||
      key.includes('id_token') ||
      key.includes('refresh_token')
    );
    oauthSessionKeys.forEach(key => {
      try {
        sessionStorage.removeItem(key);
      } catch (e) {
        console.debug('Erreur lors du nettoyage de sessionStorage:', e);
      }
    });
    
    // Vérifier si le token est encore valide avant de tenter le logout Keycloak
    // Cela évite les erreurs "session_expired" dans les logs Keycloak
    try {
      const idToken = this.oauthService.getIdToken();
      const accessToken = this.oauthService.getAccessToken();
      
      // Ne tenter le logout Keycloak que si on a un token valide ET que la session n'est pas expirée
      if (idToken && accessToken && this.oauthService.hasValidAccessToken() && this.isTokenValid()) {
        // Tenter le logout Keycloak avec un timeout pour éviter de bloquer
        const logoutPromise = Promise.resolve(this.oauthService.logOut(false));
        Promise.race([
          logoutPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]).catch((error) => {
          // Ignorer les erreurs de timeout ou autres erreurs de logout
          console.debug('Logout Keycloak ignoré (timeout ou session expirée):', error);
        });
      } else {
        // Pas de token valide, session probablement déjà expirée
        // Ne pas appeler Keycloak pour éviter les erreurs dans les logs
        console.debug('Session déjà expirée, nettoyage local uniquement');
      }
    } catch (error) {
      // Ignorer les erreurs de logout (session probablement expirée)
      console.debug('Erreur lors du logout Keycloak (ignorée):', error);
    }
    
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
    
    // Nettoyer l'état local immédiatement
    this.emitAuthenticated(false);
    this.accountContextService.clear();
    
    // Nettoyer les clés OAuth du localStorage et sessionStorage
    const oauthKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('oauth') || key.startsWith('angular-oauth2-oidc')
    );
    oauthKeys.forEach(key => localStorage.removeItem(key));
    try {
      localStorage.removeItem('batches');
    } catch {
      // Ignorer erreurs localStorage
    }
    
    const oauthSessionKeys = Object.keys(sessionStorage).filter(key => 
      key.startsWith('oauth') || key.startsWith('angular-oauth2-oidc')
    );
    oauthSessionKeys.forEach(key => sessionStorage.removeItem(key));
    
    // Essayer de déconnecter de Keycloak si un token est disponible et valide
    // Utiliser un iframe pour faire le logout en arrière-plan sans redirection
    // Cela évite les erreurs de validation Keycloak avec post_logout_redirect_uri
    try {
      const idToken = this.oauthService.getIdToken();
      const accessToken = this.oauthService.getAccessToken();
      
      // Ne tenter le logout Keycloak que si on a un token valide
      // Cela évite les erreurs "session_expired" dans les logs Keycloak
      if (idToken && accessToken && this.oauthService.hasValidAccessToken()) {
        // Construire l'URL de logout avec id_token_hint uniquement (sans post_logout_redirect_uri)
        const issuer = authConfig.issuer;
        const idTokenHint = encodeURIComponent(idToken);
        const logoutUrl = `${issuer}/protocol/openid-connect/logout?id_token_hint=${idTokenHint}`;
        
        // Utiliser un iframe invisible pour faire le logout en arrière-plan
        // Cela évite les problèmes de validation Keycloak
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.src = logoutUrl;
        document.body.appendChild(iframe);
        
        // Supprimer l'iframe après un court délai
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch (e) {
            // Ignorer si l'iframe a déjà été supprimé
          }
        }, 1000);
      } else {
        // Pas de token valide, session probablement déjà expirée
        // Ne pas appeler Keycloak pour éviter les erreurs dans les logs
        console.debug('Session déjà expirée, logout Keycloak ignoré');
      }
    } catch (error) {
      // Ignorer les erreurs de logout Keycloak (session peut être déjà expirée)
      console.debug('Logout Keycloak ignoré (session probablement expirée):', error);
    }
    
    // Rediriger vers la page d'accueil si on n'a pas été redirigé par Keycloak
    this.router.navigate(['/']);
  }

  public isAuthenticated(): Observable<boolean> {
    // Ne pas appeler checkTokenExpiration() ici car cela peut causer des effets de bord
    // (redirection) qui interrompent la navigation. La vérification périodique s'en charge.
    // On vérifie juste si le token est valide sans déclencher de redirection
    const token = this.oauthService.getAccessToken();
    if (token && this.isTokenValid()) {
      this.emitAuthenticated(true);
    }
    return this.isAuthenticatedSubject.asObservable().pipe(distinctUntilChanged());
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

  public getCurrentUserId(): string | null {
    const claims: any = this.oauthService.getIdentityClaims();
    if (claims && typeof claims.sub === 'string' && claims.sub.trim().length > 0) {
      return claims.sub.trim();
    }
    const token = this.oauthService.getAccessToken();
    if (!token) {
      return null;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (typeof payload?.sub === 'string' && payload.sub.trim().length > 0) {
        return payload.sub.trim();
      }
    } catch {
      // Ignorer si le token n'est pas décodable
    }
    return null;
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
      this.accountContextService.clear();
    }
  }

  private updateAccountContextWithToken(token: string): void {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      const realmRoles: string[] = payload.realm_access?.roles || [];
      const clientRoles: string[] = payload.resource_access?.['frontend-client']?.roles || [];
      const combinedRoles = [...realmRoles, ...clientRoles];

      let accountType: 'ORGANIZATION' | 'COLLABORATOR' | null = null;
      if (combinedRoles.includes('ORGANIZATION')) {
        accountType = 'ORGANIZATION';
      } else if (combinedRoles.includes('COLLABORATOR')) {
        accountType = 'COLLABORATOR';
      }

      let organizationEmail: string | null = null;
      const attributes = payload.attributes || {};
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
      this.accountContextService.clear();
    }
  }
}
