import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { RegisterService } from '../../../core/services/register.service';
import { PricingPlanService, PricingPlan } from '../../../core/services/pricing-plan.service';
import { MarketProfileService, MarketProfile } from '../../../core/services/market-profile.service';
import { CurrencyService, MarketCode } from '../../../core/services/currency.service';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { take } from 'rxjs/operators';

interface CountryOption {
  code: string;
  name: string;
  dialCode: string;
}

const EU_AND_INTL_COUNTRIES: CountryOption[] = [
  { code: 'FR', name: 'France', dialCode: '+33' },
  { code: 'BE', name: 'Belgique', dialCode: '+32' },
  { code: 'DE', name: 'Allemagne', dialCode: '+49' },
  { code: 'ES', name: 'Espagne', dialCode: '+34' },
  { code: 'IT', name: 'Italie', dialCode: '+39' },
  { code: 'NL', name: 'Pays-Bas', dialCode: '+31' },
  { code: 'PT', name: 'Portugal', dialCode: '+351' },
  { code: 'LU', name: 'Luxembourg', dialCode: '+352' },
  { code: 'AT', name: 'Autriche', dialCode: '+43' },
  { code: 'IE', name: 'Irlande', dialCode: '+353' },
  { code: 'PL', name: 'Pologne', dialCode: '+48' },
  { code: 'GR', name: 'Grèce', dialCode: '+30' },
  { code: 'SE', name: 'Suède', dialCode: '+46' },
  { code: 'DK', name: 'Danemark', dialCode: '+45' },
  { code: 'FI', name: 'Finlande', dialCode: '+358' },
  { code: 'CZ', name: 'Tchéquie', dialCode: '+420' },
  { code: 'RO', name: 'Roumanie', dialCode: '+40' },
  { code: 'HU', name: 'Hongrie', dialCode: '+36' },
  { code: 'BG', name: 'Bulgarie', dialCode: '+359' },
  { code: 'HR', name: 'Croatie', dialCode: '+385' },
  { code: 'SK', name: 'Slovaquie', dialCode: '+421' },
  { code: 'SI', name: 'Slovénie', dialCode: '+386' },
  { code: 'LT', name: 'Lituanie', dialCode: '+370' },
  { code: 'LV', name: 'Lettonie', dialCode: '+371' },
  { code: 'EE', name: 'Estonie', dialCode: '+372' },
  { code: 'CY', name: 'Chypre', dialCode: '+357' },
  { code: 'MT', name: 'Malte', dialCode: '+356' },
  { code: 'CH', name: 'Suisse', dialCode: '+41' },
  { code: 'GB', name: 'Royaume-Uni', dialCode: '+44' },
  { code: 'TN', name: 'Tunisie', dialCode: '+216' },
  { code: 'MA', name: 'Maroc', dialCode: '+212' },
  { code: 'TR', name: 'Turquie', dialCode: '+90' }
];

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  template: `
    <div class="register-container">
      <div class="register-card">
        <h2>Créer un compte organisation</h2>
        <p>Décodage et comparaison gratuits en illimité (DZ · UE), essai de recherche assistée offert et gestion de vos collaborateurs.</p>

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="register-form">
          <div class="form-section">
            <h3>Profil de facturation &amp; marché</h3>
            <div class="market-switcher" role="group" aria-label="Zone de facturation">
              <button type="button"
                      class="market-btn"
                      [class.active]="currentMarket === 'DZ'"
                      (click)="selectMarket('DZ')">
                <span class="market-title">🇩🇿 Algérie — Dinars (DA)</span>
                <span class="market-sub">CIB / Edahabia ou virement sur facture</span>
              </button>
              <button type="button"
                      class="market-btn"
                      [class.active]="currentMarket === 'DEFAULT'"
                      (click)="selectMarket('DEFAULT')">
                <span class="market-title">🇪🇺 Europe &amp; International — Euros (€)</span>
                <span class="market-sub">Carte bancaire ou prélèvement SEPA</span>
              </button>
            </div>
            <small class="form-hint">Toutes les nomenclatures (DZ ↔ UE) sont incluses quel que soit votre pays de facturation.</small>
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
              <label for="organizationActivityDomain">Domaine d'activité *</label>
              <select
                id="organizationActivityDomain"
                formControlName="organizationActivityDomain"
                class="form-control"
                [class.error]="isFieldInvalid('organizationActivityDomain')">
                <option value="">Sélectionner votre secteur d'activité</option>
                <option value="Sociétés de négoce international (Trading Companies)">Sociétés de négoce international (Trading Companies)</option>
                <option value="Sociétés de transport et logistique">Sociétés de transport et logistique</option>
                <option value="Sociétés de transit et de commissionnaire en douane">Sociétés de transit et de commissionnaire en douane</option>
                <option value="Sociétés industrielles exportatrices">Sociétés industrielles exportatrices</option>
                <option value="Sociétés d'importation et de distribution">Sociétés d'importation et de distribution</option>
                <option value="Sociétés de conseil en commerce international">Sociétés de conseil en commerce international</option>
                <option value="Entreprises d'emballage et de conditionnement pour l'export">Entreprises d'emballage et de conditionnement pour l'export</option>
                <option value="Autre">Autre</option>
              </select>
              <div class="error-message" *ngIf="isFieldInvalid('organizationActivityDomain')">
                {{ getErrorMessage('organizationActivityDomain') }}
              </div>
            </div>

            <div class="form-group">
              <label for="organizationAddress">Adresse ou ville (facultatif)</label>
              <textarea
                id="organizationAddress"
                rows="2"
                formControlName="organizationAddress"
                class="form-control"
                [class.error]="isFieldInvalid('organizationAddress')"
                placeholder="Ville, quartier ou adresse complète (facultatif)"></textarea>
              <div class="error-message" *ngIf="isFieldInvalid('organizationAddress')">
                {{ getErrorMessage('organizationAddress') }}
              </div>
            </div>

            <div class="form-row">
              <div class="form-group half-width">
                <label for="organizationCountry">Pays de l'entreprise *</label>
                @if (currentMarket === 'DZ') {
                  <input
                    id="organizationCountry"
                    type="text"
                    readonly
                    value="Algérie (DZ)"
                    class="form-control">
                } @else {
                  <select
                    id="organizationCountry"
                    formControlName="organizationCountry"
                    (change)="onCountryChange()"
                    class="form-control"
                    [class.error]="isFieldInvalid('organizationCountry')">
                    @for (country of euCountries; track country.code) {
                      <option [value]="country.code">{{ country.name }} ({{ country.code }})</option>
                    }
                  </select>
                }
                <div class="error-message" *ngIf="isFieldInvalid('organizationCountry')">
                  {{ getErrorMessage('organizationCountry') }}
                </div>
                <small class="form-hint">Détermine la devise et les modalités de facturation.</small>
              </div>

              <div class="form-group half-width">
                <label for="organizationPhone">Téléphone (indicatif international) *</label>
                <input
                  id="organizationPhone"
                  type="tel"
                  formControlName="organizationPhone"
                  class="form-control"
                  [class.error]="isFieldInvalid('organizationPhone')"
                  [placeholder]="selectedDialCode + ' 123456789'">
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
              <div class="password-wrapper">
                <input
                  id="organizationPassword"
                  [type]="showPassword ? 'text' : 'password'"
                  formControlName="organizationPassword"
                  class="form-control"
                  [class.error]="isFieldInvalid('organizationPassword')"
                  (focus)="onPasswordFieldFirstFocus()">
                <button type="button" class="password-toggle" (click)="showPassword = !showPassword" [attr.aria-label]="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'">
                  <svg *ngIf="!showPassword" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <svg *ngIf="showPassword" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                </button>
              </div>
              <div class="error-message" *ngIf="isFieldInvalid('organizationPassword')">
                {{ getErrorMessage('organizationPassword') }}
              </div>
              <small class="form-hint">Ce mot de passe sera utilisé pour vous connecter à l'espace organisation.</small>
            </div>

            <div class="form-group">
              <label for="organizationConfirmPassword">Confirmer le mot de passe *</label>
              <div class="password-wrapper">
                <input
                  id="organizationConfirmPassword"
                  [type]="showConfirmPassword ? 'text' : 'password'"
                  formControlName="organizationConfirmPassword"
                  class="form-control"
                  [class.error]="isFieldInvalid('organizationConfirmPassword')">
                <button type="button" class="password-toggle" (click)="showConfirmPassword = !showConfirmPassword" [attr.aria-label]="showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'">
                  <svg *ngIf="!showConfirmPassword" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <svg *ngIf="showConfirmPassword" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                </button>
              </div>
              <div class="error-message" *ngIf="isFieldInvalid('organizationConfirmPassword')">
                {{ getErrorMessage('organizationConfirmPassword') }}
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-group">
              <div class="pricing-info-bar">
                @if (selectedPlan) {
                  <strong>Plan sélectionné : {{ selectedPlan.name }}</strong>
                  @if (selectedPlan.pricePerMonth && selectedPlan.pricePerMonth > 0) {
                    — {{ selectedPlan.pricePerMonth | number:'1.0-2' }} {{ formatPlanCurrency(selectedPlan) }}/mois (décodage &amp; comparaison illimités inclus)
                  } @else {
                    — Décodage &amp; Comparaison illimités + {{ selectedPlan.monthlyQuota | number }} crédits offerts
                  }
                } @else {
                  Vous bénéficierez automatiquement de l'accès illimité au décodage et à la comparaison, plus votre essai de recherche assistée.
                }
              </div>
            </div>
            <label class="consent-row" for="marketingConsent">
              <input id="marketingConsent" type="checkbox" formControlName="marketingConsent">
              <span>J'accepte de recevoir les mises à jour réglementaires (nomenclatures DZ / UE) et les évolutions du service TCI.</span>
            </label>
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
      min-height: 64px;
    }

    .consent-row {
      display: flex;
      align-items: flex-start;
      gap: 0.65rem;
      margin-top: 1rem;
      font-weight: 500;
      font-size: 0.88rem;
      color: var(--neu-text-muted);
      cursor: pointer;
    }

    .consent-row input[type="checkbox"] {
      margin-top: 0.2rem;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      accent-color: var(--neu-accent);
    }

    .market-switcher {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 0.85rem;
      margin-bottom: 0.65rem;
    }

    .market-btn {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.2rem;
      padding: 0.85rem 1rem;
      border-radius: var(--neu-radius-inner);
      border: 2px solid transparent;
      background: var(--neu-bg);
      box-shadow: var(--neu-extruded-sm);
      cursor: pointer;
      text-align: left;
      transition: all 0.2s ease;
    }

    .market-btn.active {
      border-color: var(--neu-accent);
      box-shadow: var(--neu-inset);
    }

    .market-title {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 0.95rem;
      color: var(--neu-text-primary);
    }

    .market-sub {
      font-size: 0.8rem;
      color: var(--neu-text-muted);
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
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private registerService = inject(RegisterService);
  private route = inject(ActivatedRoute);
  private pricingPlanService = inject(PricingPlanService);
  private marketProfileService = inject(MarketProfileService);
  private currencyService = inject(CurrencyService);

  isLoading = false;
  errorMessage = '';
  successMessage = '';
  showPassword = false;
  showConfirmPassword = false;
  pricingPlans: PricingPlan[] = [];
  loadingPlans = false;
  marketProfiles: MarketProfile[] = [];
  loadingProfiles = false;
  selectedMarketProfile: MarketProfile | null = null;
  currentMarket: MarketCode = this.currencyService.getSelectedMarket();
  selectedDialCode = '+33';
  readonly euCountries = EU_AND_INTL_COUNTRIES;
  private passwordFieldFirstFocus = false;
  private preselectedPlanId: number | null = null;

  get selectedPlan(): PricingPlan | undefined {
    const id = this.registerForm.get('pricingPlanId')?.value;
    return this.pricingPlans.find(p => p.id === id);
  }

  registerForm: FormGroup = this.fb.group({
    marketVersion: [this.currentMarket, [Validators.required]],
    organizationName: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(255)]],
    organizationEmail: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    organizationAddress: ['', [Validators.maxLength(512)]],
    organizationActivityDomain: ['', [Validators.required]],
    organizationCountry: [this.currentMarket === 'DZ' ? 'DZ' : 'FR', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
    organizationPhone: [this.currentMarket === 'DZ' ? '+213 ' : '+33 ', [Validators.required, Validators.pattern(/^[+0-9\s().-]{5,32}$/)]],
    organizationPassword: ['', [Validators.required, Validators.minLength(8)]],
    organizationConfirmPassword: ['', [Validators.required]],
    marketingConsent: [false],
    pricingPlanId: [null]
  }, {
    validators: [this.organizationPasswordMatchValidator]
  });

  ngOnInit() {
    this.route.queryParams.pipe(take(1)).subscribe((params: any) => {
      const qMarket = (params['market'] || '').toString().toUpperCase();
      if (qMarket === 'DZ' || qMarket === 'DEFAULT') {
        this.currentMarket = qMarket;
        this.currencyService.setSelectedMarket(qMarket);
      }
      if (params['planId']) {
        const parsed = +params['planId'];
        if (!Number.isNaN(parsed) && parsed > 0) {
          this.preselectedPlanId = parsed;
        }
      }
      this.applyMarketSelection(this.currentMarket, true);
    });
  }

  selectMarket(market: MarketCode) {
    if (this.currentMarket === market) {
      return;
    }
    this.preselectedPlanId = null;
    this.applyMarketSelection(market, false);
  }

  onCountryChange() {
    if (this.currentMarket === 'DZ') {
      this.selectedDialCode = '+213';
      return;
    }
    const countryCode = (this.registerForm.get('organizationCountry')?.value || 'FR').toUpperCase();
    const match = this.euCountries.find(c => c.code === countryCode);
    this.selectedDialCode = match?.dialCode || '+33';
    this.applyPhonePrefix(this.selectedDialCode);
  }

  formatPlanCurrency(plan: PricingPlan): string {
    return this.currencyService.getSymbolForCurrency(
      plan.currency || (this.currentMarket === 'DZ' ? 'DZD' : 'EUR')
    );
  }

  private applyMarketSelection(market: MarketCode, keepPreselectedPlan: boolean) {
    this.currentMarket = market;
    this.currencyService.setSelectedMarket(market);

    const countryCode = market === 'DZ' ? 'DZ' : 'FR';
    this.selectedDialCode = market === 'DZ' ? '+213' : '+33';

    this.registerForm.patchValue({
      marketVersion: market,
      organizationCountry: countryCode,
      pricingPlanId: keepPreselectedPlan ? this.preselectedPlanId : null
    }, { emitEvent: false });
    this.applyPhonePrefix(this.selectedDialCode);

    this.marketProfileService.getMarketProfileByVersion(market).subscribe({
      next: (profile) => {
        this.selectedMarketProfile = profile;
        this.marketProfiles = [profile];
      },
      error: (err) => {
        console.debug('Profil de marché non chargé (fallback local actif):', err);
      }
    });

    this.loadPricingPlans(market);
  }

  private applyPhonePrefix(dialCode: string) {
    const ctrl = this.registerForm.get('organizationPhone');
    const currentVal = (ctrl?.value || '').toString().trim();
    if (!currentVal || /^\+\d{1,4}$/.test(currentVal)) {
      ctrl?.setValue(`${dialCode} `, { emitEvent: false });
    }
  }

  loadPricingPlans(marketVersion?: string) {
    this.loadingPlans = true;
    const planMarketVersion = marketVersion || this.currentMarket || 'DEFAULT';

    this.pricingPlanService.getActivePricingPlans(planMarketVersion).subscribe({
      next: (plans) => {
        this.pricingPlans = plans;
        this.loadingPlans = false;

        if (this.preselectedPlanId && plans.some(plan => plan.id === this.preselectedPlanId)) {
          this.registerForm.patchValue({ pricingPlanId: this.preselectedPlanId });
          return;
        }

        const betaPlan = plans.find(plan => plan.name === 'Bêta Testeur' || plan.name === 'Invité');
        const freePlan = plans.find(plan => (plan.pricePerMonth === 0 || plan.pricePerMonth == null) && plan.name === 'Essai gratuit')
          || plans.find(plan => plan.pricePerMonth === 0);
        const target = betaPlan || freePlan;
        if (target) {
          this.registerForm.patchValue({ pricingPlanId: target.id });
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement des plans tarifaires:', err);
        this.loadingPlans = false;
      }
    });
  }

  onPasswordFieldFirstFocus() {
    if (!this.passwordFieldFirstFocus) {
      this.passwordFieldFirstFocus = true;
      const passwordControl = this.registerForm.get('organizationPassword');
      if (passwordControl && passwordControl.value) {
        passwordControl.setValue('');
      }
    }
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

    const currentMarketVersion = formValue.marketVersion || environment.marketVersion || null;
    const payload = {
      username: organizationEmail,
      email: organizationEmail,
      password: organizationPassword,
      firstName: formValue.organizationName || '',
      lastName: '',
      organizationName: formValue.organizationName,
      organizationEmail,
      organizationAddress: (formValue.organizationAddress || '').trim(),
      organizationActivityDomain: formValue.organizationActivityDomain || null,
      organizationCountry,
      organizationPhone: formValue.organizationPhone,
      organizationPassword,
      pricingPlanId: formValue.pricingPlanId || null,
      marketVersion: currentMarketVersion,
      marketingConsent: !!formValue.marketingConsent
    };

    this.registerService.registerUser(payload).subscribe({
      next: (response) => {
        this.isLoading = false;
        const orgEmail = response.organizationEmail || organizationEmail;
        this.successMessage = response.message || `Un email de confirmation a été envoyé à ${orgEmail}.`;
        this.registerForm.reset({
          marketVersion: this.currentMarket,
          organizationCountry: this.currentMarket === 'DZ' ? 'DZ' : 'FR',
          organizationPhone: `${this.currentMarket === 'DZ' ? '+213' : '+33'} `,
          organizationActivityDomain: '',
          marketingConsent: false,
          pricingPlanId: null
        });
        this.preselectedPlanId = null;
        this.loadPricingPlans(this.currentMarket);
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
