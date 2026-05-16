import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { PricingPlanService, PricingPlan } from '../../core/services/pricing-plan.service';
import { environment } from '../../../environments/environment';
import { QuoteRequestFormComponent } from './quote-request-form.component';
import { AuthService } from '../../core/services/auth.service';
import { CurrencyService } from '../../core/services/currency.service';
import { OrganizationAccountService } from '../../core/services/organization-account.service';
import { AccountContextService } from '../../core/services/account-context.service';
import { AsyncPipe } from '@angular/common';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-pricing-plans',
  standalone: true,
  imports: [CommonModule, RouterLink, QuoteRequestFormComponent, AsyncPipe],
  template: `
    <div class="pricing-container">
      <div class="pricing-header">
        <h1>Choisissez votre plan tarifaire</h1>
        <p>Sélectionnez le plan qui correspond le mieux à vos besoins
            <span class="quote-badge">💼 Devis personnalisé possible après inscription.</span>
          </p>
        @if (isAuthenticated) {
          <div class="quote-notice">
            💼 <strong>Vous pouvez demander un devis personnalisé</strong> adapté à vos besoins spécifiques.
          </div>
        }
      </div>

      @if (loading) {
        <div class="loading">Chargement des plans tarifaires...</div>
      } @else if (error) {
        <div class="error">{{ error }}</div>
      } @else {
        <div class="pricing-info-bar">
          Possibilité de changer de plan tarifaire et demande de devis personnalisé à tout moment.
        </div>

        <div class="credits-note">
          <h4>Coût en crédits par prestation</h4>
          <div class="credits-table">
            <div class="credit-row">
              <span class="credit-label">Recherche HS-code</span>
              <span class="credit-value">10 crédits</span>
            </div>
            <div class="credit-row">
              <span class="credit-label">Recherche Position10</span>
              <span class="credit-value">15 crédits</span>
            </div>
            <div class="credit-row">
              <span class="credit-label">Décodage inverse HS</span>
              <span class="credit-value">2 crédits</span>
            </div>
            <div class="credit-row">
              <span class="credit-label">Décodage inverse P10</span>
              <span class="credit-value">5 crédits</span>
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
                    @if (currencySymbol$ | async; as symbol) {
                      <span class="currency">{{ symbol }}</span>
                    } @else {
                      <span class="currency">{{ getCurrencySymbol(plan.currency) }}</span>
                    }
                    <span class="amount">{{ plan.pricePerMonth }}</span>
                    <span class="period">/mois</span>
                  }
                } @else if (plan.pricePerRequest !== null && plan.pricePerRequest !== undefined) {
                  @if (currencySymbol$ | async; as symbol) {
                    <span class="currency">{{ symbol }}</span>
                  } @else {
                    <span class="currency">{{ getCurrencySymbol(plan.currency) }}</span>
                  }
                  <span class="amount">{{ plan.pricePerRequest }}</span>
                  <span class="period">/crédit</span>
                } @else if (plan.pricePerYear !== null && plan.pricePerYear !== undefined) {
                  @if (currencySymbol$ | async; as symbol) {
                    <span class="currency">{{ symbol }}</span>
                  } @else {
                    <span class="currency">{{ getCurrencySymbol(plan.currency) }}</span>
                  }
                  <span class="amount">{{ plan.pricePerYear }}</span>
                  <span class="period">/an</span>
                } @else {
                  <span class="amount">Gratuit</span>
                }
              </div>
              @if (plan.description) {
                <p class="description">{{ plan.description }}</p>
              }
              <div class="quota">
                @if (plan.trialPeriodDays) {
                  <strong>Valable {{ plan.trialPeriodDays }} jours</strong>
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
                    @for (feature of parseFeatures(plan.features); track feature) {
                      <li>{{ feature }}</li>
                    }
                  </ul>
                </div>
              }
              <a [routerLink]="['/auth/register']" [queryParams]="{ planId: plan.id }" class="btn btn-primary">
                Choisir ce plan
              </a>
            </div>
          }
        </div>
      }

      <div class="pricing-footer">
        <p>Tarifs de lancement valables jusqu'au 30/06/2026.</p>
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
  loading = true;
  error = '';
  showQuoteForm = false;
  isAuthenticated = false;
  currencySymbol$ = this.currencyService.getCurrencySymbol();

  ngOnInit() {
    // Précharger la devise pour qu'elle soit disponible immédiatement
    this.currencySymbol$.subscribe({
      next: (symbol) => {
        console.log('✅ PricingPlansComponent: Symbole de devise chargé:', symbol);
      },
      error: (err) => {
        console.error('❌ PricingPlansComponent: Erreur lors du chargement de la devise:', err);
      }
    });
    
    // Vérifier si l'utilisateur est authentifié
    this.authService.isAuthenticated().subscribe((isAuth: boolean) => {
      this.isAuthenticated = isAuth;
      
      // Si l'utilisateur est authentifié et qu'il s'agit d'une organisation avec un essai terminé, rediriger
      if (isAuth) {
        this.accountContextService.isOrganizationAccount$.pipe(
          switchMap(isOrg => {
            if (isOrg) {
              // Vérifier si l'essai est définitivement terminé
              return this.organizationAccountService.getMyOrganization();
            }
            return of(null);
          })
        ).subscribe({
          next: (org) => {
            if (org?.trialPermanentlyExpired) {
              // Rediriger vers la page de sélection de plan de l'organisation
              this.router.navigate(['/organization/stats']);
            }
          },
          error: (err) => {
            // Ignorer les erreurs (utilisateur peut ne pas être une organisation)
            console.debug('PricingPlansComponent: Pas une organisation ou erreur:', err);
          }
        });
      }
    });
    
    this.loadPricingPlans();
  }

  loadPricingPlans() {
    this.loading = true;
    this.error = '';
    // Le service récupère automatiquement marketVersion depuis l'environnement si non fourni
    this.pricingPlanService.getActivePricingPlans().subscribe({
      next: (plans) => {
        // Si une organisation avec un essai terminé accède à cette page, filtrer les plans gratuits et d'essai
        if (this.isAuthenticated) {
          this.accountContextService.isOrganizationAccount$.pipe(
            switchMap(isOrg => {
              if (isOrg) {
                return this.organizationAccountService.getMyOrganization();
              }
              return of(null);
            })
          ).subscribe({
            next: (org) => {
              if (org?.trialPermanentlyExpired) {
                // Filtrer les plans d'essai et les plans gratuits
                this.plans = plans.filter(plan => {
                  // Exclure les plans d'essai
                  if (plan.trialPeriodDays && plan.trialPeriodDays > 0) {
                    return false;
                  }
                  // Exclure les plans gratuits
                  const isFree = (plan.pricePerMonth === null || plan.pricePerMonth === undefined || plan.pricePerMonth === 0) 
                    && (plan.pricePerRequest === null || plan.pricePerRequest === undefined);
                  return !isFree;
                });
              } else {
                this.plans = plans;
              }
              this.loading = false;
              if (this.plans.length === 0) {
                this.error = 'Aucun plan tarifaire disponible pour le moment.';
              }
            },
            error: () => {
              // Pas une organisation ou erreur, afficher tous les plans
              this.plans = plans;
              this.loading = false;
              if (this.plans.length === 0) {
                this.error = 'Aucun plan tarifaire disponible pour le moment.';
              }
            }
          });
        } else {
          // Utilisateur non authentifié, afficher tous les plans
          this.plans = plans;
          this.loading = false;
          if (this.plans.length === 0) {
            this.error = 'Aucun plan tarifaire disponible pour le moment.';
          }
        }
        console.log('✅ Plans reçus:', this.plans.length, this.plans);
        console.log('✅ Market versions des plans reçus:', this.plans.map(p => ({ name: p.name, marketVersion: p.marketVersion })));
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des plans tarifaires: ' + (err.error?.message || err.message || 'Erreur inconnue');
        this.loading = false;
        console.error('Erreur:', err);
      }
    });
  }

  getCurrencySymbol(currency?: string): string {
    if (!currency) {
      // Si pas de devise fournie, utiliser la devise du marché depuis le service
      // Note: Cette méthode est synchrone, donc on ne peut pas utiliser l'Observable ici
      // Le template utilisera currencySymbol$ qui est asynchrone
      return '€'; // Par défaut EUR (fallback)
    }
    const currencyMap: { [key: string]: string } = {
      'EUR': '€',
      'DZD': 'DA',
      'USD': '$',
      'GBP': '£',
      'JPY': '¥',
      'CNY': '¥',
      'CHF': 'CHF',
      'CAD': 'C$',
      'AUD': 'A$',
      'MAD': 'DH'
    };
    return currencyMap[currency.toUpperCase()] || currency;
  }

  parseFeatures(features: string): string[] {
    try {
      // Essayer de parser comme JSON
      const parsed = JSON.parse(features);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      // Si ce n'est pas du JSON, traiter comme texte séparé par des lignes
      return features.split('\n').filter(f => f.trim().length > 0);
    }
    return [];
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

