import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="register-container">
      <div class="register-card">
        <h2>Création de compte désactivée</h2>
        <p>
          Cette instance locale <strong>TCI Box Algérie</strong> est réservée aux comptes créés par l'administrateur de votre organisation.
        </p>
        <div class="form-actions" style="margin-top: 1.5rem;">
          <a routerLink="/auth/login" class="btn btn-primary" style="display: inline-block; text-decoration: none;">
            Se connecter
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ── Neumorphism Register ── */

    :host {
      --neu-bg: #E0E5EC;
      --neu-extruded: 8px 8px 16px rgba(163,177,198,0.6), -8px -8px 16px rgba(255,255,255,0.5);
      --neu-extruded-sm: 4px 4px 8px rgba(163,177,198,0.6), -4px -4px 8px rgba(255,255,255,0.5);
      --neu-inset: inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5);
      --neu-inset-deep: inset 8px 8px 14px rgba(163,177,198,0.7), inset -8px -8px 14px rgba(255,255,255,0.6);
      --neu-radius-container: 32px;
      --neu-radius-button: 16px;
      --neu-radius-inner: 12px;
      --neu-accent: #6C63FF;
      --neu-accent-hover: #5A52E0;
      --neu-accent-danger: #E53E3E;
      --neu-accent-secondary: #38B2AC;
      --neu-text-primary: #3D4852;
      --neu-text-muted: #6B7280;
      --font-display: 'Poppins', 'Segoe UI', system-ui, sans-serif;
    }

    .register-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      padding: 2rem;
      background: var(--neu-bg);
    }

    .register-card {
      background: var(--neu-card-violet, linear-gradient(145deg, #EAE8F8, #DDDAF0));
      padding: 2.5rem;
      border-radius: var(--neu-radius-container);
      box-shadow: var(--neu-extruded);
      border: none;
      width: 100%;
      max-width: 720px;
    }

    h2 {
      font-family: var(--font-display);
      color: var(--neu-text-primary);
      margin-bottom: 0.5rem;
      text-align: center;
      font-size: 1.6rem;
      font-weight: 700;
    }

    p {
      color: var(--neu-text-muted);
      margin-bottom: 2rem;
      text-align: center;
      font-size: 0.95rem;
    }

    .register-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .form-section {
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border: none;
      border-radius: var(--neu-radius-button);
      padding: 1.5rem;
    }

    .form-section h3 {
      margin: 0 0 1rem 0;
      font-family: var(--font-display);
      color: var(--neu-text-primary);
      font-size: 1.15rem;
      font-weight: 600;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    .form-row {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .half-width {
      flex: 1 1 240px;
    }

    label {
      font-weight: 600;
      color: var(--neu-text-primary);
      font-size: 0.9rem;
    }

    .form-control {
      padding: 0.75rem 1rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 1rem;
      color: var(--neu-text-primary);
      min-height: 44px;
      transition: box-shadow 0.25s ease, outline 0.25s ease;
    }

    .form-control::placeholder {
      color: var(--neu-text-muted);
      opacity: 0.7;
    }

    .form-control:focus {
      box-shadow: var(--neu-inset-deep);
      outline: 2px solid var(--neu-accent);
      outline-offset: 2px;
    }

    .form-control.error {
      outline: 2px solid var(--neu-accent-danger);
      outline-offset: 0;
    }

    .form-control.error:focus {
      outline: 2px solid var(--neu-accent-danger);
      outline-offset: 2px;
      box-shadow: var(--neu-inset-deep);
    }

    .form-control[readonly] {
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      opacity: 0.7;
      cursor: not-allowed;
      color: var(--neu-text-muted);
    }

    .form-control[readonly]:focus {
      box-shadow: var(--neu-inset);
      outline: none;
    }

    select.form-control {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 1rem center;
      padding-right: 2.5rem;
    }

    textarea.form-control {
      resize: vertical;
      min-height: 80px;
    }

    .error-message {
      color: var(--neu-accent-danger);
      font-size: 0.85rem;
      margin-top: -0.25rem;
      font-weight: 500;
    }

    .success-message {
      color: var(--neu-accent-secondary);
      font-size: 0.95rem;
      text-align: center;
      font-weight: 600;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border-radius: var(--neu-radius-inner);
      padding: 1rem;
    }

    .form-hint {
      color: var(--neu-text-muted);
      font-size: 0.82rem;
    }

    .pricing-info-bar {
      text-align: center;
      padding: 0.85rem 1rem;
      margin-bottom: 0;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border: none;
      border-radius: var(--neu-radius-inner);
      color: var(--neu-text-muted);
      font-size: 0.9rem;
      font-style: italic;
      display: block;
      width: 100%;
      box-sizing: border-box;
    }

    .pricing-plan-select {
      background: var(--neu-bg) !important;
      box-shadow: var(--neu-inset) !important;
      color: var(--neu-text-primary) !important;
      min-height: 44px !important;
      padding: 0.5rem 1rem !important;
      line-height: 1.5 !important;
      border: none !important;
      border-radius: var(--neu-radius-inner) !important;
      font-size: 1rem !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .pricing-plan-select option {
      background: var(--neu-bg) !important;
      color: var(--neu-text-primary) !important;
      padding: 0.5rem !important;
    }

    .pricing-plan-select:focus {
      box-shadow: var(--neu-inset-deep) !important;
      outline: 2px solid var(--neu-accent) !important;
      outline-offset: 2px !important;
    }

    .form-actions {
      text-align: center;
      margin-top: 0.5rem;
    }

    .btn {
      padding: 0.85rem 1.5rem;
      border: none;
      border-radius: var(--neu-radius-button);
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      min-height: 44px;
      transition: box-shadow 0.25s ease, background-color 0.25s ease, transform 0.15s ease;
    }

    .btn-primary {
      background-color: var(--neu-accent);
      color: #ffffff;
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-primary:hover:not(:disabled) {
      background-color: var(--neu-accent-hover);
      box-shadow: 2px 2px 4px rgba(163,177,198,0.6), -2px -2px 4px rgba(255,255,255,0.5);
      transform: translateY(1px);
    }

    .btn-primary:active:not(:disabled) {
      box-shadow: var(--neu-inset);
      transform: translateY(2px);
    }

    .btn-primary:disabled {
      background-color: var(--neu-bg);
      color: var(--neu-text-muted);
      box-shadow: var(--neu-extruded-sm);
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-secondary,
    .btn-cancel {
      background: var(--neu-bg);
      color: var(--neu-text-primary);
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-secondary:hover,
    .btn-cancel:hover {
      box-shadow: 2px 2px 4px rgba(163,177,198,0.6), -2px -2px 4px rgba(255,255,255,0.5);
      transform: translateY(1px);
    }

    .btn-secondary:active,
    .btn-cancel:active {
      box-shadow: var(--neu-inset);
      transform: translateY(2px);
    }

    .form-footer {
      text-align: center;
      margin-top: 0.5rem;
    }

    .form-footer p {
      color: var(--neu-text-muted);
      margin-bottom: 0;
    }

    .form-footer a {
      color: var(--neu-accent);
      text-decoration: none;
      font-weight: 600;
    }

    .form-footer a:hover {
      text-decoration: underline;
      color: var(--neu-accent-hover);
    }

    .password-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .password-wrapper .form-control {
      flex: 1;
      padding-right: 3rem;
    }

    .password-toggle {
      position: absolute;
      right: 0.75rem;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--neu-text-muted);
      display: flex;
      align-items: center;
      padding: 0;
      transition: color 0.2s ease;
    }

    .password-toggle:hover {
      color: var(--neu-accent);
    }

    .loading-plans {
      color: var(--neu-text-muted);
      font-size: 0.9rem;
      font-style: italic;
      padding: 0.5rem 0;
    }

    /* ── Responsive <768px ── */

    @media (max-width: 767px) {
      .register-container {
        padding: 1rem;
        min-height: auto;
      }

      .register-card {
        padding: 1.5rem;
        border-radius: 24px;
      }

      h2 {
        font-size: 1.3rem;
      }

      .form-section {
        padding: 1rem;
        border-radius: 12px;
      }

      .form-row {
        flex-direction: column;
        gap: 0;
      }

      .half-width {
        flex: 1 1 100%;
      }

      .btn {
        min-height: 48px;
        font-size: 1.05rem;
      }

      .form-control {
        min-height: 48px;
      }
    }
  `]
})
export class RegisterComponent {}
