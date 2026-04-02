import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-confirm-registration',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="confirm-container">
      <div class="confirm-card">

        <!-- Chargement -->
        @if (isLoading) {
          <div class="step-state">
            <h2>En cours...</h2>
            <div class="spinner"></div>
          </div>
        }

        <!-- Erreur -->
        @if (errorMessage) {
          <div class="error-state">
            <h2>Erreur</h2>
            <div class="error-icon">⚠️</div>
            <p class="error-message">{{ errorMessage }}</p>
            <div class="actions">
              @if (canRetry) {
                <button class="btn btn-secondary" (click)="resetError()">Réessayer</button>
              }
              <button class="btn btn-primary" routerLink="/auth/login">Se connecter</button>
            </div>
          </div>
        }

        <!-- Succès -->
        @if (successMessage) {
          <div class="success-state">
            <h2>Compte confirmé !</h2>
            <div class="success-icon">✓</div>
            <p class="success-message">{{ successMessage }}</p>
            <div class="actions">
              <button class="btn btn-primary" routerLink="/auth/login">
                Se connecter maintenant
              </button>
            </div>
          </div>
        }

        <!-- Token manquant -->
        @if (!token && !isLoading && !errorMessage && !successMessage) {
          <div class="error-state">
            <div class="error-icon">⚠️</div>
            <p class="error-message">Lien d'invitation invalide. Veuillez utiliser le lien reçu par email.</p>
          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    .confirm-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      padding: 2rem;
    }

    .confirm-card {
      background: white;
      padding: 3rem;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 480px;
      text-align: center;
    }

    h2 { color: #2c3e50; margin-bottom: 1rem; }

    .step-state, .error-state, .success-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .intro { color: #7f8c8d; line-height: 1.6; margin: 0; }

    .form-group {
      width: 100%;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-group label { font-weight: 600; color: #2c3e50; font-size: 0.95rem; }

    .otp-input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid #bdc3c7;
      border-radius: 6px;
      font-size: 1.5rem;
      letter-spacing: 0.5rem;
      text-align: center;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.2s;
    }

    .otp-input:focus { border-color: #3498db; }

    .btn-row {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: 100%;
    }

    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin { 100% { transform: rotate(360deg); } }

    .success-icon {
      color: #27ae60;
      background: #d4edda;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      font-weight: bold;
    }

    .error-icon { font-size: 4rem; }

    .error-message { color: #e74c3c; margin: 0.5rem 0; }
    .success-message { color: #27ae60; margin: 0.5rem 0; }

    .actions { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
      transition: background-color 0.2s;
      width: 100%;
    }

    .btn-primary { background-color: #3498db; color: white; }
    .btn-primary:hover:not(:disabled) { background-color: #2980b9; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-secondary { background-color: #95a5a6; color: white; width: auto; }
    .btn-secondary:hover { background-color: #7f8c8d; }

    .btn-link {
      background: none;
      color: #3498db;
      font-size: 0.9rem;
      padding: 0.25rem;
      width: auto;
      text-decoration: underline;
    }
    .btn-link:hover { color: #2980b9; }
  `]
})
export class ConfirmRegistrationComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  token = '';
  // On passe directement à l'étape finale
  step = 3; 
  isLoading = true;
  errorMessage = '';
  successMessage = '';
  canRetry = false;

  ngOnInit() {
    this.token = this.route.snapshot.queryParams['token'] || '';
    if (this.token) {
      // Direct confirmation without OTP
      this.confirmRegistration();
    } else {
      this.isLoading = false;
    }
  }

  confirmRegistration() {
    this.isLoading = true;
    this.errorMessage = '';

    // Envoi de l'OTP vide puiqu'il est optionnel désormais
    const url = `${environment.apiUrl}/auth/confirm-registration?token=${encodeURIComponent(this.token)}`;
    this.http.get(url).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.successMessage = res.message || 'Inscription confirmée avec succès !';
      },
      error: (err) => {
        this.isLoading = false;
        const msg = err.error?.error || '';
        this.errorMessage = msg || 'Lien invalide ou expiré.';
        this.canRetry = false; // Plus d'OTP, on ne peut pas réessayer.
      }
    });
  }

  resetError() {
    this.errorMessage = '';
  }
}
