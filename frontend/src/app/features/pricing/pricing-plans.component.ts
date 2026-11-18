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
import { PaymentService, PaymentProvidersStatus } from '../../core/services/payment.service';
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
          <span class="market-sub">{{ providersStatus.chargilyConfigured ? 'Paiement CIB / Edahabia & virement sur facture' : 'Règlement par virement bancaire sur facture (DA)' }}</span>
        </button>
        <button type="button"
                class="market-btn"
                [class.active]="selectedMarket === 'DEFAULT'"
                (click)="selectMarket('DEFAULT')">
          <span class="market-title">🇪🇺 Europe &amp; International · Euro (€ HT)</span>
          <span class="market-sub">{{ providersStatus.stripeConfigured ? 'Carte bancaire, SEPA & virement sur facture' : 'Règlement par virement bancaire sur facture (€ HT)' }}</span>
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
        <section class="sovereign-box-card" aria-label="Déploiement Souverain sur Site">
          <div class="sovereign-box-info">
            <span class="sovereign-badge">
              {{ selectedMarket === 'DZ' ? 'Conformité Loi 18-07 &amp; Loi 25-11 (Algérie)' : 'Infrastructure privée · Sur site' }}
            </span>
            <h3>🏢 Déploiement Souverain sur Site — Box Locale (On-Premise)</h3>
            <p class="sovereign-desc">
              @if (selectedMarket === 'DZ') {
                Déployez l'ensemble de la plateforme (base réglementaire P10/NC8, authentification et moteur IA dédié) directement sur un boîtier local dans votre réseau d'entreprise, sans aucun transfert de données vers l'extérieur.
              } @else {
                Déployez TCI sur votre infrastructure interne privée avec moteur IA local dédié pour vos exigences de confidentialité industrielle et douanière, sans appel vers des API cloud externes.
              }
            </p>
            <div class="sovereign-highlights">
              <span>🔒 Zéro donnée hors site</span>
              <span>⚡ IA locale dédiée</span>
              <span>📄 Licence annuelle sur devis</span>
            </div>
          </div>
          <div class="sovereign-box-action">
            <button type="button" class="btn btn-primary" (click)="openSovereignBoxQuoteForm()">
              Demander un devis déploiement local
            </button>
          </div>
        </section>
      }

      <div class="pricing-footer">
        <p>
          @if (selectedMarket === 'DZ') {
            Facturation en Dinars Algériens (DA) · {{ providersStatus.chargilyConfigured ? 'Règlement par carte CIB / Edahabia (Chargily) ou par virement bancaire annuel sur facture.' : 'Règlement par virement bancaire sur facture.' }}
          } @else {
            Tarifs en Euros HT (€) · {{ providersStatus.stripeConfigured ? 'Règlement sécurisé par carte bancaire ou prélèvement SEPA (Stripe), ou sur facture annuelle pour les grands comptes.' : 'Règlement sur facture par virement bancaire (SEPA / SWIFT) après validation de votre demande.' }}
          }
        </p>
        <div class="footer-actions">
          <button class="btn btn-secondary" (click)="openQuoteRequestForm()">
            Demander un devis personnalisé
          </button>
          <a routerLink="/auth/login" class="link">Déjà un compte ? Connectez-vous</a>
        </div>
      </div>
    </div>

    <app-quote-request-form
      [showForm]="showQuoteForm"
      [modalTitle]="quoteModalTitle"
      [submitLabel]="quoteSubmitLabel"
      [defaultMessage]="quoteDefaultMessage"
      (formClosed)="closeQuoteForm()"
      (quoteSubmitted)="onQuoteSubmitted()">
    </app-quote-request-form>
  `,
  styles: [`
    :host {
      display: block;
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
      color: #94A3B8;
    }

    .quote-badge {
      color: var(--neu-accent);
      font-weight: 600;
    }

    .quote-notice {
      margin-top: 1.5rem;
      padding: 1rem 1.5rem;
      background: var(--neu-card-bg);
      border: 1px solid rgba(255, 255, 255, 0.08);
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
      background: var(--neu-card-bg);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: var(--neu-inset);
      border-radius: var(--neu-radius-inner);
    }

    .credits-note h4 {
      color: #94A3B8;
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
      background: var(--neu-bg-dark);
      border: 1px solid rgba(255, 255, 255, 0.06);
      box-shadow: var(--neu-extruded-sm);
    }

    .credit-label {
      color: var(--neu-text-primary);
      font-size: 0.9rem;
    }

    .credit-value {
      font-weight: 700;
      color: var(--neu-accent-light);
      font-size: 0.9rem;
      white-space: nowrap;
      margin-left: 1rem;
    }

    .credit-value.free {
      color: var(--neu-accent-tertiary);
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
      border: 2px solid rgba(255, 255, 255, 0.08);
      background: var(--neu-card-bg);
      box-shadow: var(--neu-extruded-sm);
      cursor: pointer;
      text-align: left;
      transition: all 0.2s ease;
    }

    .market-btn.active {
      border-color: var(--neu-accent);
      background: var(--neu-card-bg-hover);
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
      color: #94A3B8;
    }

    .year-price {
      text-align: center;
      margin: -0.5rem 0 0.75rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--neu-accent-light);
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
      background: var(--neu-card-bg);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: var(--neu-inset);
      border-radius: var(--neu-radius-inner);
      color: #94A3B8;
      font-size: 0.9rem;
      font-style: italic;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }

    .pricing-plan-card {
      background: linear-gradient(155deg, #131B2E, #0D1424);
      border: 1px solid rgba(139, 92, 246, 0.32);
      border-top: 4px solid #8B5CF6;
      border-radius: var(--neu-radius-container);
      padding: 2rem;
      box-shadow: var(--neu-extruded);
      position: relative;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      min-height: auto;
      height: auto;
    }

    .pricing-plan-card:nth-child(4n+2) {
      background: linear-gradient(155deg, #0E1D2B, #0A1520);
      border-color: rgba(14, 165, 233, 0.32);
      border-top-color: #0EA5E9;
    }

    .pricing-plan-card:nth-child(4n+3) {
      background: linear-gradient(155deg, #0D201D, #091715);
      border-color: rgba(16, 185, 129, 0.34);
      border-top-color: #10B981;
    }

    .pricing-plan-card:nth-child(4n+4) {
      background: linear-gradient(155deg, #1E180C, #141008);
      border-color: rgba(245, 158, 11, 0.38);
      border-top-color: #F59E0B;
    }

    .pricing-plan-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--neu-extruded-hover);
    }

    .pricing-plan-card h3 {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: #F8FAFC;
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
      color: #CBD5E1;
      margin-right: 0.25rem;
      font-family: var(--font-display);
    }

    .amount {
      font-family: var(--font-display);
      font-size: 2.5rem;
      font-weight: 700;
      color: #FCD34D;
    }

    .period {
      font-size: 1rem;
      color: #CBD5E1;
      margin-left: 0.25rem;
    }

    .description {
      color: #CBD5E1;
      margin-bottom: 0.75rem;
      text-align: center;
      font-size: 0.9rem;
    }

    .quota {
      text-align: center;
      margin: 1rem 0;
      padding: 0.75rem;
      background: rgba(7, 11, 20, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: var(--neu-inset);
      border-radius: var(--neu-radius-inner);
      color: #F8FAFC;
    }

    .features {
      margin: 1rem 0;
    }

    .features h4 {
      font-size: 1rem;
      color: #F1F5F9;
      margin-bottom: 0.5rem;
    }

    .features ul {
      list-style: none;
      padding: 0;
    }

    .features li {
      padding: 0.4rem 0;
      color: #E2E8F0;
      font-size: 0.9rem;
    }

    .features li:before {
      content: "\\2713  ";
      color: #10B981;
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
      color: #94A3B8;
      margin-bottom: 1rem;
    }

    .footer-actions {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      align-items: center;
    }

    .btn-secondary {
      background: var(--neu-card-bg);
      color: #FCD34D;
      padding: 0.75rem 1.5rem;
      border: 1px solid rgba(245, 158, 11, 0.45);
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
      background: var(--neu-card-bg-hover);
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
      color: #94A3B8;
    }

    .error {
      color: var(--neu-accent-danger);
    }

    .sovereign-box-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 2rem;
      margin: 2.5rem auto 1rem;
      padding: 2rem 2.25rem;
      border-radius: var(--neu-radius-container);
      background: linear-gradient(145deg, #111B2E, #0B1322);
      border: 1px solid rgba(245, 158, 11, 0.32);
      border-left: 5px solid #F59E0B;
      box-shadow: var(--neu-extruded);
    }

    .sovereign-box-info {
      flex: 1;
      text-align: left;
    }

    .sovereign-badge {
      display: inline-block;
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #FCD34D;
      background: rgba(245, 158, 11, 0.14);
      border: 1px solid rgba(245, 158, 11, 0.32);
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      margin-bottom: 0.65rem;
    }

    .sovereign-box-card h3 {
      font-family: var(--font-display);
      font-size: 1.35rem;
      color: #F8FAFC;
      margin: 0 0 0.6rem;
    }

    .sovereign-desc {
      color: #CBD5E1;
      font-size: 0.96rem;
      line-height: 1.55;
      margin: 0 0 0.9rem;
    }

    .sovereign-highlights {
      display: flex;
      flex-wrap: wrap;
      gap: 0.85rem 1.4rem;
      font-size: 0.88rem;
      font-weight: 600;
      color: #F1F5F9;
    }

    .sovereign-box-action {
      flex-shrink: 0;
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

      .sovereign-box-card {
        flex-direction: column;
        align-items: stretch;
        padding: 1.5rem;
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
  private paymentService = inject(PaymentService);
  private router = inject(Router);

  plans: PricingPlan[] = [];
  selectedMarket: MarketCode = this.currencyService.getSelectedMarket();
  providersStatus: PaymentProvidersStatus = { chargilyConfigured: true, stripeConfigured: false };
  loading = true;
  error = '';
  showQuoteForm = false;
  quoteModalTitle = 'Demander un devis personnalisé';
  quoteSubmitLabel = 'Envoyer la demande';
  quoteDefaultMessage = '';
  isAuthenticated = false;

  ngOnInit() {
    this.paymentService.getProvidersStatus().subscribe(status => {
      this.providersStatus = status;
    });
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
    this.quoteModalTitle = 'Demander un devis personnalisé';
    this.quoteSubmitLabel = 'Envoyer la demande';
    this.quoteDefaultMessage = '';
    this.showQuoteForm = true;
  }

  openSovereignBoxQuoteForm() {
    this.quoteModalTitle = 'Étude — Déploiement Souverain sur Site (Box Locale)';
    this.quoteSubmitLabel = 'Demander à être recontacté';
    this.quoteDefaultMessage = this.selectedMarket === 'DZ'
      ? 'Bonjour,\nNous souhaitons recevoir une proposition pour un déploiement souverain sur site (Box Locale Algérie — conformité Loi 18-07 / 25-11).\nNombre estimé d\'utilisateurs : '
      : 'Bonjour,\nNous souhaitons recevoir une proposition pour un déploiement On-Premise sur notre infrastructure interne.\nNombre estimé d\'utilisateurs : ';
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

