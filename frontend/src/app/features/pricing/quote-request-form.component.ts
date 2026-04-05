import { Component, EventEmitter, Input, Output, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { QuoteRequestService, CreateQuoteRequestDto } from '../../core/services/quote-request.service';

@Component({
  selector: 'app-quote-request-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="quote-form-container" *ngIf="showForm">
      <div class="quote-form-card">
        <div class="quote-form-header">
          <h2>Demander un devis personnalisé</h2>
          <button class="close-btn" (click)="close()" aria-label="Fermer">×</button>
        </div>

        <form [formGroup]="quoteForm" (ngSubmit)="onSubmit()" class="quote-form">
          <div class="form-group">
            <label for="contactName">Nom du contact *</label>
            <input
              id="contactName"
              type="text"
              formControlName="contactName"
              class="form-control"
              [class.error]="isFieldInvalid('contactName')"
              placeholder="Votre nom complet">
            <div class="error-message" *ngIf="isFieldInvalid('contactName')">
              {{ getErrorMessage('contactName') }}
            </div>
          </div>

          <div class="form-group">
            <label for="contactEmail">Email du contact *</label>
            <input
              id="contactEmail"
              type="email"
              formControlName="contactEmail"
              class="form-control"
              [class.error]="isFieldInvalid('contactEmail')"
              placeholder="votre.email@exemple.com">
            <div class="error-message" *ngIf="isFieldInvalid('contactEmail')">
              {{ getErrorMessage('contactEmail') }}
            </div>
          </div>

          <div class="form-group">
            <label for="message">Message (optionnel)</label>
            <textarea
              id="message"
              rows="5"
              formControlName="message"
              class="form-control"
              placeholder="Décrivez vos besoins spécifiques, le volume de requêtes attendu, ou toute autre information pertinente pour votre devis personnalisé..."></textarea>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" (click)="close()">
              Annuler
            </button>
            <button type="submit" class="btn btn-primary" [disabled]="quoteForm.invalid || isSubmitting">
              <span *ngIf="isSubmitting">Envoi en cours...</span>
              <span *ngIf="!isSubmitting">Envoyer la demande</span>
            </button>
          </div>

          <div class="error-message" *ngIf="errorMessage">
            {{ errorMessage }}
          </div>

          <div class="success-message" *ngIf="successMessage">
            {{ successMessage }}
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --neu-bg: var(--neu-bg, #E0E5EC);
      --neu-extruded: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      --neu-extruded-hover: var(--neu-extruded-hover, 12px 12px 20px rgba(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6));
      --neu-extruded-sm: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.5), -5px -5px 10px rgba(255,255,255,0.4));
      --neu-inset: var(--neu-inset, inset 4px 4px 8px rgba(163,177,198,0.5), inset -4px -4px 8px rgba(255,255,255,0.4));
      --neu-inset-deep: var(--neu-inset-deep, inset 6px 6px 12px rgba(163,177,198,0.6), inset -6px -6px 12px rgba(255,255,255,0.5));
      --neu-radius-container: var(--neu-radius-container, 32px);
      --neu-radius-inner: var(--neu-radius-inner, 12px);
      --neu-accent: var(--neu-accent, #6C63FF);
      --neu-accent-secondary: var(--neu-accent-secondary, #38B2AC);
      --neu-accent-danger: var(--neu-accent-danger, #E53E3E);
      --neu-text-primary: var(--neu-text-primary, #3D4852);
      --neu-text-muted: var(--neu-text-muted, #6B7280);
      --neu-text-heading: var(--neu-text-heading, #2D3748);
      --font-display: var(--font-display, 'Plus Jakarta Sans', sans-serif);
    }

    .quote-form-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(163, 177, 198, 0.4);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      padding: 1rem;
    }

    .quote-form-card {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      border-radius: var(--neu-radius-container);
      box-shadow: var(--neu-extruded-hover);
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
    }

    .quote-form-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem 2rem;
    }

    .quote-form-header h2 {
      margin: 0;
      color: var(--neu-text-heading);
      font-family: var(--font-display);
      font-size: 1.5rem;
    }

    .close-btn {
      background: var(--neu-bg);
      border: none;
      font-size: 1.5rem;
      color: var(--neu-text-muted);
      cursor: pointer;
      padding: 0;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      box-shadow: var(--neu-extruded-sm);
      transition: all 0.2s;
    }

    .close-btn:hover {
      box-shadow: var(--neu-inset);
      color: var(--neu-text-heading);
    }

    .close-btn:focus-visible {
      outline: 2px solid var(--neu-accent);
      outline-offset: 2px;
    }

    .quote-form {
      padding: 1.5rem 2rem 2rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    label {
      display: block;
      margin-bottom: 0.5rem;
      color: var(--neu-text-primary);
      font-weight: 500;
    }

    .form-control {
      width: 100%;
      padding: 0.75rem 1rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 1rem;
      color: var(--neu-text-primary);
      transition: box-shadow 0.3s;
      box-sizing: border-box;
      min-height: 44px;
    }

    .form-control:focus {
      outline: none;
      box-shadow: var(--neu-inset-deep), 0 0 0 2px rgba(108, 99, 255, 0.3);
    }

    .form-control.error {
      box-shadow: var(--neu-inset-deep), 0 0 0 2px rgba(229, 62, 62, 0.3);
    }

    .form-control::placeholder {
      color: var(--neu-text-muted);
      opacity: 0.6;
    }

    textarea.form-control {
      resize: vertical;
      font-family: inherit;
    }

    .error-message {
      color: var(--neu-accent-danger);
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    .success-message {
      color: var(--neu-accent-secondary);
      font-size: 0.95rem;
      padding: 1rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border-radius: var(--neu-radius-inner);
      margin-top: 1rem;
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 2rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      min-height: 44px;
    }

    .btn:focus-visible {
      outline: 2px solid var(--neu-accent);
      outline-offset: 2px;
    }

    .btn-primary {
      background: var(--neu-accent);
      color: white;
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: var(--neu-extruded-hover);
    }

    .btn-primary:disabled {
      background: var(--neu-bg);
      color: var(--neu-text-muted);
      box-shadow: var(--neu-inset);
      cursor: not-allowed;
      transform: none;
    }

    .btn-secondary {
      background: var(--neu-bg);
      color: var(--neu-accent);
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-secondary:hover {
      transform: translateY(-1px);
      box-shadow: var(--neu-extruded-hover);
    }

    @media (max-width: 768px) {
      .quote-form-card {
        max-width: 100%;
        margin: 0;
        border-radius: var(--neu-radius-inner);
        max-height: 100vh;
      }

      .form-actions {
        flex-direction: column;
      }

      .btn {
        width: 100%;
      }
    }
  `]
})
export class QuoteRequestFormComponent implements OnInit {
  @Input() showForm = false;
  @Output() formClosed = new EventEmitter<void>();
  @Output() quoteSubmitted = new EventEmitter<void>();

  private quoteRequestService = inject(QuoteRequestService);
  private fb = inject(FormBuilder);

  quoteForm!: FormGroup;
  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit() {
    this.quoteForm = this.fb.group({
      contactName: ['', [Validators.required, Validators.minLength(2)]],
      contactEmail: ['', [Validators.required, Validators.email]],
      message: ['']
    });

    // L'organizationId sera récupéré automatiquement côté backend depuis le token
    // Plus besoin de le charger ici
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.quoteForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getErrorMessage(fieldName: string): string {
    const field = this.quoteForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) {
      return 'Ce champ est requis';
    }
    if (field.errors['email']) {
      return 'Email invalide';
    }
    if (field.errors['minlength']) {
      return `Minimum ${field.errors['minlength'].requiredLength} caractères`;
    }
    return 'Champ invalide';
  }

  onSubmit() {
    if (this.quoteForm.invalid) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    // organizationId sera récupéré automatiquement côté backend depuis le token
    const dto: CreateQuoteRequestDto = {
      contactName: this.quoteForm.value.contactName,
      contactEmail: this.quoteForm.value.contactEmail,
      message: this.quoteForm.value.message || undefined
    };

    this.quoteRequestService.createQuoteRequest(dto).subscribe({
      next: () => {
        this.successMessage = 'Votre demande de devis a été envoyée avec succès. Nous vous contacterons bientôt.';
        this.quoteForm.reset();
        this.quoteSubmitted.emit();
        // Fermer automatiquement après 3 secondes
        setTimeout(() => {
          this.close();
        }, 3000);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Erreur lors de l\'envoi de la demande. Veuillez réessayer.';
        this.isSubmitting = false;
        console.error('Erreur lors de la création de la demande de devis:', err);
      }
    });
  }

  close() {
    this.showForm = false;
    this.formClosed.emit();
    this.quoteForm.reset();
    this.errorMessage = '';
    this.successMessage = '';
  }
}

