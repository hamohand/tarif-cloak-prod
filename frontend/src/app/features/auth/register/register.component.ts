import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { RegisterService } from '../../../core/services/register.service';
import { PricingPlanService, PricingPlan } from '../../../core/services/pricing-plan.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  template: `
    <div class="register-container">
      <div class="register-card">
        <h2>Créer un compte</h2>
        <p>Rejoignez notre plateforme SaaS</p>

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="register-form">
          <div class="form-group">
            <label for="username">Nom d'utilisateur *</label>
            <input
              type="text"
              id="username"
              formControlName="username"
              class="form-control"
              [class.error]="isFieldInvalid('username')">
            @if (isFieldInvalid('username')) {
              <div class="error-message">
                {{ getErrorMessage('username') }}
              </div>
            }
          </div>

          <div class="form-group">
            <label for="email">Email *</label>
            <input
              type="email"
              id="email"
              formControlName="email"
              class="form-control"
              [class.error]="isFieldInvalid('email')">
            @if (isFieldInvalid('email')) {
              <div class="error-message">
                {{ getErrorMessage('email') }}
              </div>
            }
          </div>

          <div class="form-group">
            <label for="firstName">Prénom *</label>
            <input
              type="text"
              id="firstName"
              formControlName="firstName"
              class="form-control"
              [class.error]="isFieldInvalid('firstName')">
            @if (isFieldInvalid('firstName')) {
              <div class="error-message">
                {{ getErrorMessage('firstName') }}
              </div>
            }
          </div>

          <div class="form-group">
            <label for="lastName">Nom *</label>
            <input
              type="text"
              id="lastName"
              formControlName="lastName"
              class="form-control"
              [class.error]="isFieldInvalid('lastName')">
            @if (isFieldInvalid('lastName')) {
              <div class="error-message">
                {{ getErrorMessage('lastName') }}
              </div>
            }
          </div>

          <div class="form-group">
            <label for="password">Mot de passe *</label>
            <input
              type="password"
              id="password"
              formControlName="password"
              class="form-control"
              [class.error]="isFieldInvalid('password')">
            @if (isFieldInvalid('password')) {
              <div class="error-message">
                {{ getErrorMessage('password') }}
              </div>
            }
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirmer le mot de passe *</label>
            <input
              type="password"
              id="confirmPassword"
              formControlName="confirmPassword"
              class="form-control"
              [class.error]="isFieldInvalid('confirmPassword')">
            @if (isFieldInvalid('confirmPassword')) {
              <div class="error-message">
                {{ getErrorMessage('confirmPassword') }}
              </div>
            }
          </div>

          <div class="form-section-divider">
            <h3>Informations de l'organisation</h3>
          </div>

          <div class="form-group">
            <label for="organizationName">Nom de l'organisation *</label>
            <input
              type="text"
              id="organizationName"
              formControlName="organizationName"
              class="form-control"
              [class.error]="isFieldInvalid('organizationName')"
              placeholder="Ex: Mon Entreprise">
            @if (isFieldInvalid('organizationName')) {
              <div class="error-message">
                {{ getErrorMessage('organizationName') }}
              </div>
            }
          </div>

          <div class="form-group">
            <label for="organizationEmail">Email de l'organisation *</label>
            <input
              type="email"
              id="organizationEmail"
              formControlName="organizationEmail"
              class="form-control"
              [class.error]="isFieldInvalid('organizationEmail')"
              placeholder="contact@mon-entreprise.com">
            @if (isFieldInvalid('organizationEmail')) {
              <div class="error-message">
                {{ getErrorMessage('organizationEmail') }}
              </div>
            }
            <small class="form-hint">Un email de confirmation sera envoyé à cette adresse pour valider l'inscription</small>
          </div>

          <div class="form-section-divider">
            <h3>Plan tarifaire</h3>
          </div>

          <div class="form-group">
            <label for="pricingPlanId">Sélectionner un plan tarifaire (optionnel)</label>
            @if (loadingPlans) {
              <div class="loading-plans">Chargement des plans...</div>
            } @else if (pricingPlans.length > 0) {
              <select
                id="pricingPlanId"
                formControlName="pricingPlanId"
                class="form-control">
                <option [value]="null">Aucun plan (gratuit)</option>
                @for (plan of pricingPlans; track plan.id) {
                  <option [value]="plan.id">
                    {{ plan.name }} - 
                    @if (plan.pricePerMonth !== null && plan.pricePerMonth !== undefined) {
                      @if (plan.pricePerMonth === 0) {
                        Gratuit
                      } @else {
                        \${{ plan.pricePerMonth }}/mois
                      }
                    } @else if (plan.pricePerRequest !== null && plan.pricePerRequest !== undefined) {
                      \${{ plan.pricePerRequest }}/requête
                    } @else {
                      Gratuit
                    }
                    @if (plan.trialPeriodDays) {
                      ({{ plan.trialPeriodDays }} jours)
                    } @else if (plan.monthlyQuota) {
                      ({{ plan.monthlyQuota | number }} requêtes/mois)
                    } @else if (plan.pricePerRequest !== null && plan.pricePerRequest !== undefined) {
                      (Facturation à la requête)
                    } @else {
                      (Quota illimité)
                    }
                  </option>
                }
              </select>
              <small class="form-hint">
                <a routerLink="/pricing" target="_blank">Voir tous les plans tarifaires</a>
              </small>
            } @else {
              <div class="no-plans">
                <p>Aucun plan tarifaire disponible. <a routerLink="/pricing">Voir les plans</a></p>
              </div>
            }
          </div>

          <div class="form-actions">
            <button
              type="submit"
              class="btn btn-primary"
              [disabled]="registerForm.invalid || isLoading">
              @if (isLoading) {
                <span>Création en cours...</span>
              }
              @if (!isLoading) {
                <span>Créer mon compte</span>
              }
            </button>
          </div>

          <div class="form-footer">
            <p>Déjà un compte ? <a routerLink="/auth/login">Se connecter</a></p>
          </div>

          @if (errorMessage) {
            <div class="error-message">
              {{ errorMessage }}
            </div>
          }

          @if (successMessage) {
            <div class="success-message">
              {{ successMessage }}
            </div>
          }
        </form>
      </div>
    </div>
  `,
  styles: [`
    .register-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      padding: 2rem;
    }

    .register-card {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 600px;
    }

    h2 {
      color: #2c3e50;
      margin-bottom: 0.5rem;
      text-align: center;
    }

    p {
      color: #7f8c8d;
      margin-bottom: 2rem;
      text-align: center;
    }

    .register-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
    }

    label {
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #2c3e50;
    }

    .form-control {
      padding: 0.75rem;
      border: 2px solid #e1e8ed;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.3s;
    }

    .form-control:focus {
      outline: none;
      border-color: #3498db;
    }

    .form-control.error {
      border-color: #e74c3c;
    }

    .error-message {
      color: #e74c3c;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    .success-message {
      color: #27ae60;
      font-size: 0.875rem;
      margin-top: 0.25rem;
      text-align: center;
    }

    .form-actions {
      margin-top: 1rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
      width: 100%;
      transition: background-color 0.3s;
    }

    .btn-primary {
      background-color: #3498db;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background-color: #2980b9;
    }

    .btn-primary:disabled {
      background-color: #bdc3c7;
      cursor: not-allowed;
    }

    .form-footer {
      text-align: center;
      margin-top: 1rem;
    }

    .form-footer a {
      color: #3498db;
      text-decoration: none;
    }

    .form-footer a:hover {
      text-decoration: underline;
    }

    .form-section-divider {
      margin: 2rem 0 1rem 0;
      padding-top: 1.5rem;
      border-top: 2px solid #e1e8ed;
    }

    .form-section-divider h3 {
      color: #2c3e50;
      font-size: 1.1rem;
      margin: 0 0 1rem 0;
      font-weight: 600;
    }

    .form-hint {
      color: #7f8c8d;
      font-size: 0.875rem;
      margin-top: 0.25rem;
      display: block;
    }

    .form-hint a {
      color: #3498db;
      text-decoration: none;
    }

    .form-hint a:hover {
      text-decoration: underline;
    }

    .loading-plans, .no-plans {
      padding: 1rem;
      text-align: center;
      color: #7f8c8d;
    }

    .no-plans a {
      color: #3498db;
      text-decoration: none;
    }

    .no-plans a:hover {
      text-decoration: underline;
    }
  `]
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private registerService = inject(RegisterService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private pricingPlanService = inject(PricingPlanService);

  isLoading = false;
  errorMessage = '';
  successMessage = '';
  pricingPlans: PricingPlan[] = [];
  loadingPlans = false;

  registerForm: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
    organizationName: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(255)]],
    organizationEmail: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    pricingPlanId: [null]
  }, {
    validators: this.passwordMatchValidator
  });

  ngOnInit() {
    // Récupérer le planId depuis les query params si présent
    this.route.queryParams.subscribe(params => {
      const planId = params['planId'];
      if (planId) {
        this.registerForm.patchValue({ pricingPlanId: +planId });
      }
    });

    // Charger les plans tarifaires
    this.loadPricingPlans();
  }

  loadPricingPlans() {
    this.loadingPlans = true;
    this.pricingPlanService.getActivePricingPlans().subscribe({
      next: (plans) => {
        this.pricingPlans = plans;
        this.loadingPlans = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des plans tarifaires:', err);
        this.loadingPlans = false;
      }
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    confirmPassword?.setErrors(null);
    return null;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getErrorMessage(fieldName: string): string {
    const field = this.registerForm.get(fieldName);

    if (field?.errors) {
      if (field.errors['required']) {
        return 'Ce champ est requis';
      }
      if (field.errors['email']) {
        return 'Email invalide';
      }
      if (field.errors['minlength']) {
        const requiredLength = field.errors['minlength'].requiredLength;
        return `Minimum ${requiredLength} caractères requis`;
      }
      if (field.errors['maxlength']) {
        const maxLength = field.errors['maxlength'].requiredLength;
        return `Maximum ${maxLength} caractères autorisés`;
      }
      if (field.errors['passwordMismatch']) {
        return 'Les mots de passe ne correspondent pas';
      }
    }

    return '';
  }

  onSubmit() {
    if (this.registerForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const userData = this.registerForm.value;

      this.registerService.registerUser({
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: userData.password,
        organizationName: userData.organizationName,
        organizationEmail: userData.organizationEmail,
        pricingPlanId: userData.pricingPlanId || null
      }).subscribe({
        next: (response) => {
          this.isLoading = false;
          const orgEmail = response.organizationEmail || userData.organizationEmail;
          this.successMessage = response.message || `Un email de confirmation a été envoyé à ${orgEmail}. Veuillez vérifier votre boîte de réception et cliquer sur le lien de confirmation pour finaliser votre inscription.`;
          // Réinitialiser le formulaire
          this.registerForm.reset();
          // Ne pas rediriger automatiquement, l'utilisateur doit confirmer par email
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = this.handleError(error);
        }
      });
    } else {
      // Marquer tous les champs comme touchés pour afficher les erreurs
      Object.keys(this.registerForm.controls).forEach(key => {
        const control = this.registerForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  private handleError(error: any): string {
    if (error.status === 409) {
      return 'Ce nom d\'utilisateur ou cet email existe déjà';
    } else if (error.status === 400) {
      return 'Données de formulaire invalides';
    } else if (error.status === 0) {
      return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
    } else {
      return 'Une erreur est survenue lors de la création du compte';
    }
  }
}
