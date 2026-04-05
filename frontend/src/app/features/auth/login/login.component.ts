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
      <div class="login-background">
        <div class="background-shape shape-1"></div>
        <div class="background-shape shape-2"></div>
        <div class="background-shape shape-3"></div>
      </div>
      
      <div class="login-card">
        <div class="login-header">
          <div class="logo-container">
            <div class="logo-icon">🔐</div>
          </div>
          <h1>Bienvenue</h1>
          <p class="subtitle">Connectez-vous pour accéder à votre espace</p>
        </div>

        @if (errorMessage) {
          <div class="error-message">
            <span class="error-icon">⚠️</span>
            <span class="error-text">{{ errorMessage }}</span>
          </div>
        }

        <div class="login-actions">
          <button 
            (click)="login()" 
            class="login-button"
            [disabled]="isLoading || !isReady"
            [class.loading]="isLoading">
            @if (isLoading) {
              <span class="button-content">
                <span class="spinner"></span>
                <span>Connexion en cours...</span>
              </span>
            } @else {
              <span class="button-content">
                <span class="button-icon">🚀</span>
                <span>Se connecter</span>
              </span>
            }
          </button>
        </div>

        <div class="login-footer">
          <div class="divider">
            <span>ou</span>
          </div>
          <p class="footer-text">Pas encore de compte ?</p>
          <button 
            (click)="goToRegister()" 
            class="register-button">
            <span>Créer un compte</span>
            <span class="arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ── Neumorphism Design System ── */

    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      position: relative;
      padding: 2rem;
      background: var(--neu-bg, #E0E5EC);
      overflow: hidden;
    }

    /* Background shapes hidden — neumorphism uses flat bg */
    .login-background,
    .background-shape {
      display: none;
    }

    .login-card {
      background: var(--neu-card-violet, linear-gradient(145deg, #EAE8F8, #DDDAF0));
      padding: 3.5rem 2.5rem;
      border-radius: var(--neu-radius-container, 32px);
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      text-align: center;
      max-width: 450px;
      width: 100%;
      position: relative;
      z-index: 1;
      animation: slideUp 0.6s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .login-header {
      margin-bottom: 2.5rem;
    }

    .logo-container {
      margin-bottom: 1.5rem;
    }

    .logo-icon {
      font-size: 4rem;
      display: inline-block;
    }

    h1 {
      color: var(--neu-text-primary, #3D4852);
      margin: 0 0 0.5rem 0;
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.5px;
      font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
    }

    .subtitle {
      color: var(--neu-text-muted, #6B7280);
      margin: 0;
      font-size: 1rem;
      font-weight: 400;
    }

    .login-actions {
      margin-bottom: 2rem;
    }

    .login-button {
      background: var(--neu-accent, #6C63FF);
      color: white;
      padding: 1.1rem 2rem;
      font-size: 1.05rem;
      font-weight: 600;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      width: 100%;
      min-height: 44px;
      transition: all 0.3s ease;
      box-shadow: var(--neu-extruded-sm, 4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.4));
      position: relative;
      overflow: hidden;
      font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
    }

    .login-button:focus-visible {
      outline: 2px solid var(--neu-accent, #6C63FF);
      outline-offset: 2px;
    }

    .login-button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: var(--neu-extruded-hover, 6px 6px 12px rgba(163,177,198,0.65), -6px -6px 12px rgba(255,255,255,0.55));
    }

    .login-button:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: var(--neu-inset-sm, inset 3px 3px 6px rgba(163,177,198,0.5), inset -3px -3px 6px rgba(255,255,255,0.4));
    }

    .login-button:disabled {
      background: #A0AEC0;
      cursor: not-allowed;
      opacity: 0.7;
      box-shadow: none;
    }

    .login-button.loading {
      pointer-events: none;
    }

    .button-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
    }

    .button-icon {
      font-size: 1.2rem;
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top-color: var(--neu-accent, #6C63FF);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .error-message {
      background: var(--neu-bg, #E0E5EC);
      color: var(--neu-accent-danger, #E53E3E);
      padding: 1.1rem 1.25rem;
      border-radius: 12px;
      margin-bottom: 1.5rem;
      border: none;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      animation: shake 0.5s ease-in-out;
      box-shadow: var(--neu-inset-sm, inset 3px 3px 6px rgba(163,177,198,0.5), inset -3px -3px 6px rgba(255,255,255,0.4));
    }

    @keyframes shake {
      0%, 100% {
        transform: translateX(0);
      }
      25% {
        transform: translateX(-10px);
      }
      75% {
        transform: translateX(10px);
      }
    }

    .error-icon {
      font-size: 1.25rem;
      flex-shrink: 0;
    }

    .error-text {
      flex: 1;
      text-align: left;
      font-size: 0.95rem;
      line-height: 1.4;
      color: var(--neu-accent-danger, #E53E3E);
    }

    .login-footer {
      margin-top: 2rem;
    }

    .divider {
      position: relative;
      margin: 1.5rem 0;
      text-align: center;
    }

    .divider::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(163,177,198,0.4), transparent);
    }

    .divider span {
      position: relative;
      background: var(--neu-bg, #E0E5EC);
      padding: 0 1rem;
      color: var(--neu-text-muted, #6B7280);
      font-size: 0.9rem;
    }

    .footer-text {
      color: var(--neu-text-muted, #6B7280);
      margin: 1rem 0;
      font-size: 0.95rem;
    }

    .register-button {
      background: var(--neu-bg, #E0E5EC);
      color: var(--neu-accent, #6C63FF);
      padding: 0.9rem 1.75rem;
      font-size: 1rem;
      font-weight: 600;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      min-height: 44px;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      justify-content: center;
      box-shadow: var(--neu-extruded-sm, 4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.4));
      font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
    }

    .register-button:focus-visible {
      outline: 2px solid var(--neu-accent, #6C63FF);
      outline-offset: 2px;
    }

    .register-button:hover {
      transform: translateY(-1px);
      box-shadow: var(--neu-extruded-hover, 6px 6px 12px rgba(163,177,198,0.65), -6px -6px 12px rgba(255,255,255,0.55));
      color: var(--neu-accent, #6C63FF);
    }

    .register-button:active {
      transform: translateY(0);
      box-shadow: var(--neu-inset-sm, inset 3px 3px 6px rgba(163,177,198,0.5), inset -3px -3px 6px rgba(255,255,255,0.4));
    }

    .arrow {
      font-size: 1.2rem;
      transition: transform 0.3s ease;
    }

    .register-button:hover .arrow {
      transform: translateX(4px);
    }

    /* ── Responsive: Tablet & smaller ── */
    @media (max-width: 768px) {
      .login-container {
        padding: 1.5rem;
      }

      .login-card {
        padding: 2.5rem 1.75rem;
        border-radius: 24px;
      }

      h1 {
        font-size: 1.75rem;
      }

      .logo-icon {
        font-size: 3.5rem;
      }

      .login-button,
      .register-button {
        min-height: 48px;
        font-size: 1rem;
      }
    }

    /* ── Responsive: Small phones ── */
    @media (max-width: 480px) {
      .login-container {
        padding: 1rem;
      }

      .login-card {
        padding: 2rem 1.25rem;
        border-radius: 20px;
      }

      h1 {
        font-size: 1.5rem;
      }

      .logo-icon {
        font-size: 3rem;
      }

      .login-button,
      .register-button {
        min-height: 48px;
        padding: 1rem 1.5rem;
      }
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
