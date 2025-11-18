import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { RegisterService } from '../../../core/services/register.service';
import { PricingPlanService, PricingPlan } from '../../../core/services/pricing-plan.service';
import { MarketProfileService, MarketProfile } from '../../../core/services/market-profile.service';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  template: `
    <div class="register-container">
      <div class="register-card">
        <h2>Créer un compte organisation</h2>
        <p>Ce compte administrateur gérera l'ensemble de vos collaborateurs.</p>

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="register-form">
          <div class="form-section">
            <h3>Profil de marché</h3>
            <div class="form-group">
              <label for="marketVersion">Sélectionner votre marché *</label>
              <ng-container *ngIf="loadingProfiles; else profilesLoaded">
                <div class="loading-plans">Chargement des profils...</div>
              </ng-container>
              <ng-template #profilesLoaded>
                <select id="marketVersion" formControlName="marketVersion" class="form-control" (change)="onMarketProfileChange()">
                  <option [value]="null">Sélectionner un marché</option>
                  <option *ngFor="let profile of marketProfiles" [value]="profile.marketVersion">
                    {{ profile.countryName }} ({{ profile.currencyCode }})
                  </option>
                </select>
                <small class="form-hint">Le profil sélectionné pré-remplira automatiquement certains champs.</small>
              </ng-template>
            </div>
          </div>

          <div class="form-section">
            <h3>Informations de l'organisation</h3>

            <div class="form-group">
              <label for="organizationName">Nom de l'organisation *</label>
              <input
                id="organizationName"
                type="text"
                formControlName="organizationName"
                class="form-control"
                [class.error]="isFieldInvalid('organizationName')"
                placeholder="Ex: Enclume Numérique">
              <div class="error-message" *ngIf="isFieldInvalid('organizationName')">
                {{ getErrorMessage('organizationName') }}
              </div>
            </div>

            <div class="form-group">
              <label for="organizationEmail">Email de l'organisation *</label>
              <input
                id="organizationEmail"
                type="email"
                formControlName="organizationEmail"
                class="form-control"
                [class.error]="isFieldInvalid('organizationEmail')"
                placeholder="contact@mon-entreprise.com">
              <div class="error-message" *ngIf="isFieldInvalid('organizationEmail')">
                {{ getErrorMessage('organizationEmail') }}
              </div>
              <small class="form-hint">Cet email servira d'identifiant pour accéder à l'espace organisation.</small>
            </div>

            <div class="form-group">
              <label for="organizationAddress">Adresse complète *</label>
              <textarea
                id="organizationAddress"
                rows="3"
                formControlName="organizationAddress"
                class="form-control"
                [class.error]="isFieldInvalid('organizationAddress')"
                placeholder="Numéro, rue, code postal, ville {{ selectedMarketProfile?.countryName }}"></textarea>
              <div class="error-message" *ngIf="isFieldInvalid('organizationAddress')">
                {{ getErrorMessage('organizationAddress') }}
              </div>
            </div>

            <div class="form-row">
              <div class="form-group half-width">
                <label for="organizationCountry">Pays (code ISO) *</label>
                <input
                  id="organizationCountry"
                  type="text"
                  readonly
                  maxlength="2"
                  formControlName="organizationCountry"
                  class="form-control"
                  [class.error]="isFieldInvalid('organizationCountry')"
                  placeholder="DZ">
                <div class="error-message" *ngIf="isFieldInvalid('organizationCountry')">
                  {{ getErrorMessage('organizationCountry') }}
                </div>
                <small class="form-hint">Code pays ISO à 2 lettres.</small>
              </div>

              <div class="form-group half-width">
                <label for="organizationPhone">Téléphone (indicatif international) *</label>
                <input
                  id="organizationPhone"
                  type="tel"
                  formControlName="organizationPhone"
                  class="form-control"
                  [class.error]="isFieldInvalid('organizationPhone')"
                  placeholder="{{ selectedMarketProfile?.phonePrefix }} 123456789">
                <div class="error-message" *ngIf="isFieldInvalid('organizationPhone')">
                  {{ getErrorMessage('organizationPhone') }}
                </div>
                <small class="form-hint">Format international recommandé (ex : +33123456789).</small>
              </div>
            </div>
          </div>

          <div class="form-section">
            <h3>Authentification du compte organisation</h3>

            <div class="form-group">
              <label for="organizationPassword">Mot de passe *</label>
              <input
                id="organizationPassword"
                type="password"
                formControlName="organizationPassword"
                class="form-control"
                [class.error]="isFieldInvalid('organizationPassword')">
              <div class="error-message" *ngIf="isFieldInvalid('organizationPassword')">
                {{ getErrorMessage('organizationPassword') }}
              </div>
              <small class="form-hint">Ce mot de passe sera utilisé pour vous connecter à l'espace organisation.</small>
            </div>

            <div class="form-group">
              <label for="organizationConfirmPassword">Confirmer le mot de passe *</label>
              <input
                id="organizationConfirmPassword"
                type="password"
                formControlName="organizationConfirmPassword"
                class="form-control"
                [class.error]="isFieldInvalid('organizationConfirmPassword')">
              <div class="error-message" *ngIf="isFieldInvalid('organizationConfirmPassword')">
                {{ getErrorMessage('organizationConfirmPassword') }}
              </div>
            </div>
          </div>

          <div class="form-section">
            <h3>Plan tarifaire</h3>
            <div class="form-group">
              <label for="pricingPlanId">Sélectionner un plan</label>
              <ng-container *ngIf="loadingPlans; else plansLoaded">
                <div class="loading-plans">Chargement des plans...</div>
              </ng-container>
              <ng-template #plansLoaded>
                <select id="pricingPlanId" formControlName="pricingPlanId" class="form-control">
                  <option [value]="null">Plan gratuit (limité)</option>
                  <option *ngFor="let plan of pricingPlans" [value]="plan.id">
                    {{ plan.name }} -
                    <ng-container *ngIf="plan.pricePerMonth !== null; else pricePerRequest">
                      <ng-container *ngIf="plan.pricePerMonth === 0; else paidPlan">
                        Gratuit
                      </ng-container>
                      <ng-template #paidPlan>{{ plan.pricePerMonth }} €/mois</ng-template>
                    </ng-container>
                    <ng-template #pricePerRequest>
                      <ng-container *ngIf="plan.pricePerRequest !== null; else unlimited">
                        {{ plan.pricePerRequest }} €/requête
                      </ng-container>
                      <ng-template #unlimited>Quota illimité</ng-template>
                    </ng-template>
                    <ng-container *ngIf="plan.monthlyQuota">
                      ({{ plan.monthlyQuota | number }} requêtes/mois)
                    </ng-container>
                    <ng-container *ngIf="!plan.monthlyQuota && plan.trialPeriodDays">
                      ({{ plan.trialPeriodDays }} jours d'essai)
                    </ng-container>
                  </option>
                </select>
                <small class="form-hint">
                  <a routerLink="/pricing" target="_blank">Voir le détail des plans</a>
                </small>
              </ng-template>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" [disabled]="registerForm.invalid || isLoading">
              <ng-container *ngIf="isLoading; else createAccount">
                Création en cours...
              </ng-container>
              <ng-template #createAccount>
                Créer mon compte organisation
              </ng-template>
            </button>
          </div>

          <div class="form-footer">
            <p>Déjà administrateur ? <a routerLink="/auth/login">Se connecter</a></p>
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
      max-width: 680px;
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
      gap: 1.5rem;
    }

    .form-section {
      border: 1px solid #e1e8ed;
      border-radius: 10px;
      padding: 1.5rem;
      background: #fafbfc;
    }

    .form-section h3 {
      margin: 0 0 1rem 0;
      color: #2c3e50;
      font-size: 1.2rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
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
      margin-top: -0.25rem;
    }

    .success-message {
      color: #27ae60;
      font-size: 0.95rem;
      text-align: center;
      font-weight: 600;
    }

    .form-hint {
      color: #95a5a6;
      font-size: 0.85rem;
    }

    .form-actions {
      text-align: center;
      margin-top: 0.5rem;
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
      margin-top: 0.5rem;
    }

    .form-footer a {
      color: #3498db;
      text-decoration: none;
    }

    .form-footer a:hover {
      text-decoration: underline;
    }
  `]
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private registerService = inject(RegisterService);
  private route = inject(ActivatedRoute);
  private pricingPlanService = inject(PricingPlanService);
  private marketProfileService = inject(MarketProfileService);

  isLoading = false;
  errorMessage = '';
  successMessage = '';
  pricingPlans: PricingPlan[] = [];
  loadingPlans = false;
  marketProfiles: MarketProfile[] = [];
  loadingProfiles = false;
  selectedMarketProfile: MarketProfile | null = null;

  registerForm: FormGroup = this.fb.group({
    marketVersion: [null, [Validators.required]],
    organizationName: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(255)]],
    organizationEmail: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    organizationAddress: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(512)]],
    organizationCountry: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
    organizationPhone: ['', [Validators.required, Validators.pattern(/^[+0-9\s().-]{5,32}$/)]],
    organizationPassword: ['', [Validators.required, Validators.minLength(8)]],
    organizationConfirmPassword: ['', [Validators.required]],
    pricingPlanId: [null]
  }, {
    validators: [this.organizationPasswordMatchValidator]
  });

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const planId = params['planId'];
      if (planId) {
        this.registerForm.patchValue({ pricingPlanId: +planId });
      }
    });

    this.loadMarketProfiles();
  }

  loadMarketProfiles() {
    this.loadingProfiles = true;
    this.marketProfileService.getActiveMarketProfiles().subscribe({
      next: (profiles) => {
        this.marketProfiles = profiles;
        this.loadingProfiles = false;
        console.log('Profils de marché chargés:', this.marketProfiles);
      },
      error: (err) => {
        console.error('Erreur lors du chargement des profils de marché:', err);
        this.loadingProfiles = false;
      }
    });
  }

  onMarketProfileChange() {
    const marketVersion = this.registerForm.get('marketVersion')?.value;
    if (!marketVersion) {
      this.selectedMarketProfile = null;
      return;
    }

    const profile = this.marketProfiles.find(p => p.marketVersion === marketVersion);
    if (profile) {
      this.selectedMarketProfile = profile;
      // Pré-remplir les champs avec les valeurs du profil
      this.registerForm.patchValue({
        organizationCountry: profile.countryCodeIsoAlpha2,
        organizationPhone: profile.phonePrefix + ' '
      }, { emitEvent: false });
      
      // Charger les plans tarifaires pour ce marché
      this.loadPricingPlans(marketVersion);
    }
  }

  loadPricingPlans(marketVersion?: string) {
    this.loadingPlans = true;
    const marketVersionToUse = marketVersion || (this.registerForm.get('marketVersion')?.value);
    
    // Utiliser marketVersion si disponible, sinon utiliser environment.marketVersion
    const planMarketVersion = marketVersionToUse || (environment as any).marketVersion || undefined;
    
    this.pricingPlanService.getActivePricingPlans(planMarketVersion).subscribe({
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

  organizationPasswordMatchValidator(form: FormGroup) {
    const password = form.get('organizationPassword');
    const confirmPassword = form.get('organizationConfirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { organizationPasswordMismatch: true };
    }

    if (confirmPassword?.hasError('passwordMismatch')) {
      const errors = { ...confirmPassword.errors };
      delete errors['passwordMismatch'];
      confirmPassword.setErrors(Object.keys(errors).length > 0 ? errors : null);
    }
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
      if (field.errors['pattern']) {
        if (fieldName === 'organizationCountry') {
          return 'Le pays doit être un code ISO à 2 lettres (ex : FR)';
        }
        if (fieldName === 'organizationPhone') {
          return 'Le numéro doit être au format international (ex : +33123456789)';
        }
      }
      if (field.errors['passwordMismatch']) {
        return 'Les mots de passe ne correspondent pas';
      }
    }

    return '';
  }

  onSubmit() {
    if (this.registerForm.invalid) {
      Object.values(this.registerForm.controls).forEach(control => control.markAsTouched());
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formValue = this.registerForm.value;
    const organizationEmail = (formValue.organizationEmail || '').toLowerCase();
    const organizationCountry = (formValue.organizationCountry || '').toUpperCase();
    const organizationPassword = formValue.organizationPassword || '';

    const payload = {
      username: organizationEmail,
      email: organizationEmail,
      password: organizationPassword,
      firstName: formValue.organizationName || '',
      lastName: '',
      organizationName: formValue.organizationName,
      organizationEmail,
      organizationAddress: formValue.organizationAddress,
      organizationCountry,
      organizationPhone: formValue.organizationPhone,
      organizationPassword,
      pricingPlanId: formValue.pricingPlanId || null,
      marketVersion: formValue.marketVersion || null
    };

    this.registerService.registerUser(payload).subscribe({
      next: (response) => {
        this.isLoading = false;
        const orgEmail = response.organizationEmail || organizationEmail;
        this.successMessage = response.message || `Un email de confirmation a été envoyé à ${orgEmail}.`;
        this.registerForm.reset({ pricingPlanId: null });
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = this.handleError(error);
      }
    });
  }

  private handleError(error: any): string {
    if (error.status === 409) {
      return 'Un compte existe déjà avec cet email.';
    } else if (error.status === 400) {
      return error.error?.error || 'Données invalides. Vérifiez les informations saisies.';
    } else if (error.status === 0) {
      return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
    } else {
      return 'Une erreur est survenue lors de la création du compte organisation.';
    }
  }
}
