import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { PricingPlanService, PricingPlan } from '../../core/services/pricing-plan.service';
import { environment } from '../../../environments/environment';
import { QuoteRequestFormComponent } from './quote-request-form.component';
import { AuthService } from '../../core/services/auth.service';
import { CurrencyService, MarketCode } from '../../core/services/currency.service';
import { OrganizationAccountService } from '../../core/services/organization-account.service';
import { AccountContextService } from '../../core/services/account-context.service';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-pricing-plans',
  standalone: true,
  imports: [CommonModule, RouterLink, QuoteRequestFormComponent],
  template: `
    <div class="pricing-container">
      <div class="pricing-header">
        <h1>Choisissez votre plan tarifaire</h1>
        <p>Mêmes fonctionnalités DZ ↔ UE pour tous · Devise et moyen de paiement adaptés au pays de votre entreprise.
          <span class="quote-badge">💼 Devis personnalisé possible.</span>
        </p>
        @if (isAuthenticated) {
          <div class="quote-notice">
            💼 <strong>Vous pouvez demander un devis personnalisé</strong> adapté à vos besoins spécifiques.
          </div>
        }
      </div>

      <div class="market-switcher" role="group" aria-label="Pays de facturation et devise">
        <button type="button"
                class="market-btn"
                [class.active]="selectedMarket === 'DZ'"
                (click)="selectMarket('DZ')">
          <span class="market-title">🇩🇿 Algérie · Dinar (DA)</span>
          <span class="market-sub">Paiement CIB / Edahabia &amp; virement sur facture</span>
        </button>
        <button type="button"
                class="market-btn"
                [class.active]="selectedMarket === 'DEFAULT'"
                (click)="selectMarket('DEFAULT')">
          <span class="market-title">🇪🇺 Europe &amp; International · Euro (€ HT)</span>
          <span class="market-sub">Carte bancaire &amp; prélèvement SEPA</span>
        </button>
      </div>

      @if (loading) {
        <div class="loading">Chargement des plans tarifaires...</div>
      } @else if (error) {
        <div class="error">{{ error }}</div>
      } @else {
        <div class="pricing-info-bar">
          Possibilité de changer de plan tarifaire ou de demander un devis personnalisé à tout moment.
        </div>

        <div class="credits-note">
          <h4>Barème d'utilisation sur compte connecté</h4>
          <div class="credits-table">
            <div class="credit-row">
              <span class="credit-label">Décodage officiel &amp; Comparaison DZ ↔ UE</span>
              <span class="credit-value free">0 crédit · Illimité</span>
            </div>
            <div class="credit-row">
              <span class="credit-label">Recherche assistée — Racine internationale (HS6)</span>
              <span class="credit-value">10 crédits</span>
            </div>
            <div class="credit-row">
              <span class="credit-label">Recherche assistée — Code national (P10 DZ / NC8 UE)</span>
              <span class="credit-value">15 crédits</span>
            </div>
          </div>
        </div>

        <div class="pricing-plans-grid">
          @for (plan of plans; track plan.id) {
            <div class="pricing-plan-card">
              <h3>{{ plan.name }}</h3>
              <div class="price">
                @if (plan.pricePerMonth !== null && plan.pricePerMonth !== undefined) {
                  @if (plan.pricePerMonth === 0) {
                    <span class="amount">Gratuit</span>
                  } @else {
                    <span class="amount">{{ plan.pricePerMonth | number:'1.0-2' }}</span>
                    <span class="currency">{{ getCurrencySymbol(plan.currency) }}</span>
                    <span class="period">/mois</span>
                  }
                } @else if (plan.pricePerRequest !== null && plan.pricePerRequest !== undefined) {
                  <span class="amount">{{ plan.pricePerRequest | number:'1.0-2' }}</span>
                  <span class="currency">{{ getCurrencySymbol(plan.currency) }}</span>
                  <span class="period">/crédit</span>
                } @else if (plan.pricePerYear !== null && plan.pricePerYear !== undefined) {
                  <span class="amount">{{ plan.pricePerYear | number:'1.0-0' }}</span>
                  <span class="currency">{{ getCurrencySymbol(plan.currency) }}</span>
                  <span class="period">/an</span>
                } @else {
                  <span class="amount">Gratuit</span>
                }
              </div>
              @if (plan.pricePerYear != null && plan.pricePerYear > 0 && plan.pricePerMonth != null && plan.pricePerMonth > 0) {
                <p class="year-price">ou {{ plan.pricePerYear | number:'1.0-0' }} {{ getCurrencySymbol(plan.currency) }}/an (2 mois offerts)</p>
              }
              @if (plan.description) {
                <p class="description">{{ plan.description }}</p>
              }
              <div class="quota">
                @if (plan.trialPeriodDays) {
                  <strong>{{ plan.monthlyQuota | number }} crédits · Valable {{ plan.trialPeriodDays }} jours</strong>
                } @else if (plan.monthlyQuota) {
                  <strong>{{ plan.monthlyQuota | number }} crédits/mois</strong>
                } @else if (plan.pricePerRequest !== null && plan.pricePerRequest !== undefined) {
                  <strong>Facturation au crédit</strong>
                } @else {
                  <strong>Quota illimité</strong>
                }
              </div>
              @if (plan.features) {
                <div class="features">
                  <h4>Fonctionnalités :</h4>
                  <ul>
                    @for (feature of parseFeatures(plan.features); track $index) {
                      <li>{{ feature }}</li>
                    }
                  </ul>
                </div>
              }
              <a [routerLink]="['/auth/register']" [queryParams]="{ planId: plan.id, market: selectedMarket }" class="btn btn-primary">
                Choisir ce plan
              </a>
            </div>
          }
        </div>
      }

      <div class="pricing-footer">
        <p>
          @if (selectedMarket === 'DZ') {
            Facturation en Dinars Algériens (DA) · Règlement par carte CIB / Edahabia (Chargily) ou par virement bancaire annuel sur facture.
          } @else {
            Tarifs en Euros HT (€) · Règlement sécurisé par carte bancaire ou prélèvement SEPA (Stripe), ou sur facture annuelle pour les grands comptes.
          }
        </p>
        <div class="footer-actions">
          <button class="btn btn-secondary" (click)="openQuoteRequestForm()" *ngIf="isAuthenticated">
            Demander un devis personnalisé
          </button>
          <a routerLink="/auth/login" class="link">Déjà un compte ? Connectez-vous</a>
        </div>
      </div>
    </div>

    <app-quote-request-form
      [showForm]="showQuoteForm"
      (formClosed)="closeQuoteForm()"
      (quoteSubmitted)="onQuoteSubmitted()">
    </app-quote-request-form>
  `,
  styles: [`
    :host {
      --neu-bg: var(--neu-bg, #E0E5EC);
      --neu-extruded: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      --neu-extruded-hover: var(--neu-extruded-hover, 12px 12px 20px rgba(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6));
      --neu-extruded-sm: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.5), -5px -5px 10px rgba(255,255,255,0.4));
      --neu-inset: var(--neu-inset, inset 4px 4px 8px rgba(163,177,198,0.5), inset -4px -4px 8px rgba(255,255,255,0.4));
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

    .pricing-container {
      padding: 3rem 2rem;
      max-width: 1200px;
      margin: 0 auto;
      min-height: calc(100vh - 200px);
      background: var(--neu-bg);
    }

    .pricing-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .pricing-header h1 {
      font-family: var(--font-display);
      font-size: 2.5rem;
      color: var(--neu-text-heading);
      margin-bottom: 1rem;
    }

    .pricing-header p {
      font-size: 1.2rem;
      color: var(--neu-text-muted);
    }

    .quote-badge {
      color: var(--neu-accent);
      font-weight: 600;
    }

    .quote-notice {
      margin-top: 1.5rem;
      padding: 1rem 1.5rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border-radius: var(--neu-radius-inner);
      color: var(--neu-text-primary);
      font-size: 1rem;
      display: inline-block;
    }

    .quote-notice strong {
      color: var(--neu-accent);
      font-weight: 700;
    }

    .credits-note {
      max-width: 600px;
      margin: 0 auto 2.5rem;
      padding: 1.25rem 1.5rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border-radius: var(--neu-radius-inner);
    }

    .credits-note h4 {
      color: var(--neu-text-muted);
      font-family: var(--font-display);
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 0 0 0.9rem;
      text-align: center;
    }

    .credits-table {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .credit-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.55rem 0.85rem;
      border-radius: var(--neu-radius-inner);
      background: var(--neu-bg);
      box-shadow: var(--neu-extruded-sm);
    }

    .credit-label {
      color: var(--neu-text-primary);
      font-size: 0.9rem;
    }

    .credit-value {
      font-weight: 700;
      color: var(--neu-accent);
      font-size: 0.9rem;
      white-space: nowrap;
      margin-left: 1rem;
    }

    .credit-value.free {
      color: var(--neu-accent-secondary);
    }

    .market-switcher {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
      max-width: 740px;
      margin: 0 auto 2rem;
    }

    .market-btn {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
      padding: 1rem 1.25rem;
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
      font-size: 1rem;
      color: var(--neu-text-heading);
    }

    .market-sub {
      font-size: 0.82rem;
      color: var(--neu-text-muted);
    }

    .year-price {
      text-align: center;
      margin: -0.5rem 0 0.75rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--neu-accent);
    }

    .pricing-plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin-bottom: 3rem;
    }

    .pricing-info-bar {
      text-align: center;
      padding: 0.85rem 1.25rem;
      margin-bottom: 2rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border-radius: var(--neu-radius-inner);
      color: var(--neu-text-muted);
      font-size: 0.9rem;
      font-style: italic;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }

    .pricing-plan-card {
      background: linear-gradient(145deg, #EDE9FE, #DDD6FE);
      border-top: 4px solid #7C3AED;
      border-radius: var(--neu-radius-container);
      padding: 2rem;
      box-shadow: var(--neu-extruded);
      position: relative;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      min-height: auto;
      height: auto;
    }

    .pricing-plan-card:nth-child(4n+2) {
      background: linear-gradient(145deg, #CFFAFE, #A5F3FC);
      border-top-color: #0891B2;
    }

    .pricing-plan-card:nth-child(4n+3) {
      background: linear-gradient(145deg, #DCFCE7, #BBF7D0);
      border-top-color: #059669;
    }

    .pricing-plan-card:nth-child(4n+4) {
      background: linear-gradient(145deg, #FEF9C3, #FDE68A);
      border-top-color: #D97706;
    }

    .pricing-plan-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--neu-extruded-hover);
    }

    .pricing-plan-card h3 {
      font-family: var(--font-display);
      font-size: 1.5rem;
      color: var(--neu-text-heading);
      margin-bottom: 0.75rem;
    }

    .price {
      margin: 1rem 0;
      display: flex;
      align-items: baseline;
      justify-content: center;
    }

    .currency {
      font-size: 1.3rem;
      color: var(--neu-text-muted);
      margin-right: 0.25rem;
      font-family: var(--font-display);
    }

    .amount {
      font-family: var(--font-display);
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--neu-accent);
    }

    .period {
      font-size: 1rem;
      color: var(--neu-text-muted);
      margin-left: 0.25rem;
    }

    .description {
      color: var(--neu-text-muted);
      margin-bottom: 0.75rem;
      text-align: center;
      font-size: 0.9rem;
    }

    .quota {
      text-align: center;
      margin: 1rem 0;
      padding: 0.75rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border-radius: var(--neu-radius-inner);
      color: var(--neu-text-primary);
    }

    .features {
      margin: 1rem 0;
    }

    .features h4 {
      font-size: 1rem;
      color: var(--neu-text-heading);
      margin-bottom: 0.5rem;
    }

    .features ul {
      list-style: none;
      padding: 0;
    }

    .features li {
      padding: 0.4rem 0;
      color: var(--neu-text-primary);
      font-size: 0.9rem;
    }

    .features li:before {
      content: "\\2713  ";
      color: var(--neu-accent-secondary);
      font-weight: bold;
      margin-right: 0.5rem;
    }

    .btn {
      width: 100%;
      padding: 0.75rem;
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      text-decoration: none;
      display: block;
      text-align: center;
      margin-top: 1rem;
      min-height: 44px;
    }

    .btn:focus-visible {
      outline: 2px solid var(--neu-accent);
      outline-offset: 2px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
      color: white;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.5);
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(79, 70, 229, 0.55);
      background: linear-gradient(135deg, #4338CA 0%, #6D28D9 100%);
    }

    .pricing-footer {
      text-align: center;
      margin-top: 3rem;
      padding-top: 2rem;
    }

    .pricing-footer p {
      color: var(--neu-text-muted);
      margin-bottom: 1rem;
    }

    .footer-actions {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      align-items: center;
    }

    .btn-secondary {
      background: var(--neu-bg);
      color: var(--neu-accent);
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: var(--neu-extruded-sm);
      min-height: 44px;
    }

    .btn-secondary:hover {
      transform: translateY(-1px);
      box-shadow: var(--neu-extruded-hover);
    }

    .btn-secondary:focus-visible {
      outline: 2px solid var(--neu-accent);
      outline-offset: 2px;
    }

    .link {
      color: var(--neu-accent);
      text-decoration: none;
      font-weight: 600;
    }

    .link:hover {
      text-decoration: underline;
    }

    .link:focus-visible {
      outline: 2px solid var(--neu-accent);
      outline-offset: 2px;
    }

    .loading, .error {
      text-align: center;
      padding: 2rem;
      font-size: 1.2rem;
      color: var(--neu-text-muted);
    }

    .error {
      color: var(--neu-accent-danger);
    }

    @media (max-width: 768px) {
      .pricing-container {
        padding: 2rem 1rem;
      }

      .pricing-header h1 {
        font-size: 1.75rem;
      }

      .pricing-plans-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class PricingPlansComponent implements OnInit {
  private pricingPlanService = inject(PricingPlanService);
  private authService = inject(AuthService);
  private currencyService = inject(CurrencyService);
  private organizationAccountService = inject(OrganizationAccountService);
  private accountContextService = inject(AccountContextService);
  private router = inject(Router);

  plans: PricingPlan[] = [];
  selectedMarket: MarketCode = this.currencyService.getSelectedMarket();
  loading = true;
  error = '';
  showQuoteForm = false;
  isAuthenticated = false;

  ngOnInit() {
    this.authService.isAuthenticated().subscribe((isAuth: boolean) => {
      this.isAuthenticated = isAuth;

      if (isAuth) {
        this.accountContextService.isOrganizationAccount$.pipe(
          switchMap(isOrg => isOrg ? this.organizationAccountService.getMyOrganization() : of(null))
        ).subscribe({
          next: (org) => {
            if (org?.trialPermanentlyExpired) {
              this.router.navigate(['/organization/stats']);
              return;
            }
            if (org?.marketVersion) {
              const orgMarket: MarketCode = org.marketVersion.toUpperCase() === 'DZ' ? 'DZ' : 'DEFAULT';
              this.selectedMarket = orgMarket;
              this.currencyService.setSelectedMarket(orgMarket);
            }
            this.loadPricingPlans();
          },
          error: () => {
            this.loadPricingPlans();
          }
        });
      } else {
        this.loadPricingPlans();
      }
    });
  }

  selectMarket(market: MarketCode) {
    if (this.selectedMarket === market) {
      return;
    }
    this.selectedMarket = market;
    this.currencyService.setSelectedMarket(market);
    this.loadPricingPlans();
  }

  loadPricingPlans() {
    this.loading = true;
    this.error = '';
    this.pricingPlanService.getActivePricingPlans(this.selectedMarket).subscribe({
      next: (plans) => {
        this.plans = plans;
        this.loading = false;
        if (this.plans.length === 0) {
          this.error = 'Aucun plan tarifaire disponible pour le moment.';
        }
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des plans tarifaires: ' + (err.error?.message || err.message || 'Erreur inconnue');
        this.loading = false;
      }
    });
  }

  getCurrencySymbol(currency?: string): string {
    return this.currencyService.getSymbolForCurrency(
      currency || (this.selectedMarket === 'DZ' ? 'DZD' : 'EUR')
    );
  }

  parseFeatures(features: string): string[] {
    if (!features) return [];
    const trimmed = features.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(x => String(x).trim()).filter(Boolean);
        }
      } catch {
        // Fallback ci-dessous
      }
    }
    const separator = trimmed.includes('\n') ? /\r?\n/ : /,\s*/;
    return trimmed.split(separator).map(f => f.trim()).filter(f => f.length > 0);
  }

  openQuoteRequestForm() {
    if (!this.isAuthenticated) {
      // Rediriger vers la page de connexion si non authentifié
      // L'utilisateur pourra revenir après connexion
      return;
    }
    this.showQuoteForm = true;
  }

  closeQuoteForm() {
    this.showQuoteForm = false;
  }

  onQuoteSubmitted() {
    // Le formulaire se ferme automatiquement après soumission réussie
    // On pourrait aussi recharger les plans ou afficher un message
  }
}

