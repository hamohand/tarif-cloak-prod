// features/auth/login/login.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="login-container">
      <div class="login-card">
        <h2>Connexion</h2>
        <p>Connectez-vous pour accéder à votre espace</p>

        @if (errorMessage) {
          <div class="error-message">{{ errorMessage }}</div>
        }

        <button 
          (click)="login()" 
          class="login-button"
          [disabled]="isLoading || !isReady">
          @if (isLoading) {
            Chargement...
          } @else {
            Se connecter
          }
        </button>

        <div class="login-footer">
          <p>Pas encore de compte ?</p>
          <button 
            (click)="goToRegister()" 
            class="register-button">
            Créer un compte
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 70vh;
    }

    .login-card {
      background: white;
      padding: 3rem;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 400px;
      width: 100%;
    }

    h2 {
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    p {
      color: #7f8c8d;
      margin-bottom: 2rem;
    }

    .login-button {
      background-color: #3498db;
      color: white;
      padding: 1rem 2rem;
      font-size: 1rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      width: 100%;
      transition: background-color 0.3s;
    }

    .login-button:hover:not(:disabled) {
      background-color: #2980b9;
    }

    .login-button:disabled {
      background-color: #95a5a6;
      cursor: not-allowed;
      opacity: 0.6;
    }

    .error-message {
      background-color: #fee;
      color: #c33;
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      border: 1px solid #fcc;
    }

    .login-footer {
      margin-top: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      align-items: center;
    }

    .register-button {
      background-color: transparent;
      color: #3498db;
      padding: 0.75rem 1.5rem;
      font-size: 0.95rem;
      border: 2px solid #3498db;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.3s;
      text-decoration: none;
      display: inline-block;
    }

    .register-button:hover {
      background-color: #3498db;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(52, 152, 219, 0.3);
    }
  `]
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private oauthService = inject(OAuthService);
  private router = inject(Router);
  
  isLoading = false;
  isReady = false;
  errorMessage = '';

  ngOnInit() {
    // Vérifier les erreurs OAuth dans l'URL
    this.checkOAuthErrors();
    // Vérifier si le document de découverte est chargé
    this.checkReady();
  }

  private checkOAuthErrors() {
    // Vérifier les paramètres d'erreur dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const error = urlParams.get('error') || hashParams.get('error');
    const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
    
    if (error) {
      // Nettoyer l'URL des paramètres d'erreur
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Afficher un message d'erreur approprié selon le type d'erreur
      if (error === 'invalid_user_credentials') {
        this.errorMessage = 'Identifiants incorrects. Veuillez vérifier votre email et votre mot de passe.';
      } else if (error === 'session_expired') {
        this.errorMessage = 'Votre session a expiré. Veuillez vous reconnecter.';
      } else if (error === 'access_denied') {
        this.errorMessage = 'Accès refusé. Vous n\'avez pas les permissions nécessaires.';
      } else {
        // Message générique pour les autres erreurs
        const description = errorDescription || 'Une erreur est survenue lors de la connexion.';
        this.errorMessage = description;
      }
    }
  }

  private async checkReady() {
    try {
      // Vérifier si le document de découverte est déjà chargé
      if (this.oauthService.discoveryDocumentLoaded) {
        this.isReady = true;
        return;
      }

      // Attendre que le document de découverte soit chargé
      this.isLoading = true;
      await this.oauthService.loadDiscoveryDocument();
      this.isReady = true;
      this.isLoading = false;
    } catch (error: any) {
      console.error('Erreur lors du chargement du document de découverte:', error);
      this.errorMessage = 'Impossible de se connecter à Keycloak. Veuillez réessayer plus tard.';
      this.isLoading = false;
      this.isReady = false;
    }
  }

  login() {
    if (!this.isReady || this.isLoading) {
      console.warn('Le document de découverte n\'est pas encore chargé');
      return;
    }

    try {
      this.errorMessage = '';
      this.authService.login();
    } catch (error: any) {
      console.error('Erreur lors de la connexion:', error);
      this.errorMessage = 'Une erreur est survenue lors de la connexion. Veuillez réessayer.';
    }
  }

  goToRegister() {
    this.router.navigate(['/auth/register']);
  }
}
