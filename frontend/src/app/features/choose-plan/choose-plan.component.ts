import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PricingPlanService, PricingPlan } from '../../core/services/pricing-plan.service';
import { PaymentService } from '../../core/services/payment.service';
import { OrganizationAccountService } from '../../core/services/organization-account.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-choose-plan',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="choose-plan-page">
      <div class="choose-plan-container">
        <h1 class="choose-plan-title">Votre période d'essai est terminée</h1>
        <p class="choose-plan-subtitle">Choisissez un plan pour continuer à utiliser TCI.</p>

        @if (loading) {
          <div class="loading">Chargement des plans...</div>
        } @else if (error) {
          <div class="error-message">{{ error }}</div>
        } @else {
          @if (currentPlanId) {
            <div class="renew-section">
              <h2>Renouveler votre plan actuel</h2>
              <button class="btn btn-renew" (click)="renewCurrentPlan()" [disabled] ="checkoutLoading">
                {{ checkoutLoading ? 'Redirection...' : 'Renouveler ' + (currentPlanName || 'votre plan') }}
              </button>
            </div>
            <div class="separator">
              <span>ou choisissez un autre plan</span>
            </div>
          }

          <div class="plans-grid">
            @for (plan of paidPlans; track plan.id) {
              <div class="plan-card">
                <h3 class="plan-name">{{ plan.name }}</h3>
                @if (plan.description) {
                  <p class="plan-description">{{ plan.description }}</p>
                }
                <div class="plan-price">
                  @if (plan.pricePerMonth != null) {
                    <span class="price-amount">{{ plan.pricePerMonth | number:'1.2-2' }}</span>
                    <span class="price-currency">{{ plan.currency || 'DZD' }}</span>
                    <span class="price-period">/mois</span>
                  }
                </div>
                @if (plan.monthlyQuota) {
                  <p class="plan-quota">{{ plan.monthlyQuota | number }} crédits/mois</p>
                }
                @if (plan.features) {
                  <ul class="plan-features">
                    @for (feature of plan.features.split(','); track $index) {
                      <li>{{ feature.trim() }}</li>
                    }
                  </ul>
                }
                <button class="btn btn-subscribe" (click)="subscribe(plan)" [disabled]="checkoutLoading">
                  {{ checkoutLoading ? 'Redirection...' : 'Souscrire' }}
                </button>
              </div>
            }
          </div>
        }
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

    .choose-plan-page {
      min-height: 100vh;
      background: var(--neu-bg);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 3rem 1rem;
    }
    .choose-plan-container {
      max-width: 900px;
      width: 100%;
    }
    .choose-plan-title {
      font-family: var(--font-display);
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--neu-text-heading);
      text-align: center;
      margin-bottom: 0.5rem;
    }
    .choose-plan-subtitle {
      text-align: center;
      color: var(--neu-text-muted);
      margin-bottom: 2rem;
    }
    .loading, .error-message {
      text-align: center;
      padding: 2rem;
      color: var(--neu-text-muted);
    }
    .error-message { color: var(--neu-accent-danger); }

    /* Renew section as inset container */
    .renew-section {
      text-align: center;
      padding: 1.75rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border-radius: var(--neu-radius-inner);
      margin-bottom: 1.5rem;
    }
    .renew-section h2 {
      font-family: var(--font-display);
      font-size: 1.1rem;
      margin-bottom: 1rem;
      color: var(--neu-accent);
    }
    .separator {
      text-align: center;
      color: var(--neu-text-muted);
      margin: 1.5rem 0;
      position: relative;
      font-size: 0.9rem;
    }
    .separator::before, .separator::after {
      content: '';
      display: inline-block;
      width: 35%;
      height: 2px;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      vertical-align: middle;
      margin: 0 0.75rem;
      border-radius: 1px;
    }
    .plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1.5rem;
    }

    /* Plan cards — extruded with hover lift */
    .plan-card {
      background: var(--neu-card-violet, linear-gradient(145deg, #EAE8F8, #DDDAF0));
      box-shadow: var(--neu-extruded);
      border-radius: var(--neu-radius-container);
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .plan-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--neu-extruded-hover);
      background: var(--neu-card-violet-hover, linear-gradient(145deg, #EFECFB, #E2E0F4));
    }
    .plan-name {
      font-family: var(--font-display);
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--neu-text-heading);
      margin: 0;
    }
    .plan-description {
      font-size: 0.875rem;
      color: var(--neu-text-muted);
      margin: 0;
    }
    .plan-price {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--neu-accent);
    }
    .price-amount {
      color: var(--neu-accent);
    }
    .price-currency, .price-period {
      font-size: 0.875rem;
      font-weight: 400;
      color: var(--neu-text-muted);
    }
    .plan-quota {
      font-size: 0.875rem;
      color: var(--neu-text-primary);
      margin: 0;
      padding: 0.5rem 0.75rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border-radius: var(--neu-radius-inner);
      text-align: center;
    }
    .plan-features {
      list-style: none;
      padding: 0;
      margin: 0;
      font-size: 0.8rem;
      color: var(--neu-text-muted);
    }
    .plan-features li::before {
      content: '\\2713  ';
      color: var(--neu-accent-secondary);
      font-weight: 700;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: var(--neu-radius-inner);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      min-height: 44px;
    }
    .btn:focus-visible {
      outline: 2px solid var(--neu-accent);
      outline-offset: 2px;
    }
    .btn:disabled {
      background: var(--neu-bg);
      color: var(--neu-text-muted);
      box-shadow: var(--neu-inset);
      cursor: not-allowed;
    }
    .btn-renew {
      background: var(--neu-accent);
      color: white;
      font-size: 1rem;
      box-shadow: var(--neu-extruded-sm);
    }
    .btn-renew:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: var(--neu-extruded-hover);
    }
    .btn-subscribe {
      background: var(--neu-accent);
      color: white;
      margin-top: auto;
      box-shadow: var(--neu-extruded-sm);
    }
    .btn-subscribe:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: var(--neu-extruded-hover);
    }

    @media (max-width: 768px) {
      .choose-plan-page {
        padding: 2rem 1rem;
      }
      .plans-grid {
        grid-template-columns: 1fr;
      }
      .separator::before, .separator::after {
        width: 25%;
      }
    }
  `]
})
export class ChoosePlanComponent implements OnInit {
  private pricingPlanService = inject(PricingPlanService);
  private paymentService = inject(PaymentService);
  private orgAccountService = inject(OrganizationAccountService);
  private router = inject(Router);

  paidPlans: PricingPlan[] = [];
  currentPlanId: number | null = null;
  currentPlanName: string | null = null;
  loading = true;
  checkoutLoading = false;
  error: string | null = null;

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    this.loading = true;
    this.orgAccountService.getMyOrganization().subscribe({
      next: org => {
        if (org.pricingPlanId) {
          this.pricingPlanService.getActivePricingPlans(environment.marketVersion).subscribe({
            next: plans => {
              this.paidPlans = plans.filter(p => p.pricePerMonth != null && p.pricePerMonth > 0);
              const current = plans.find(p => p.id === org.pricingPlanId);
              if (current && current.pricePerMonth != null && current.pricePerMonth > 0) {
                this.currentPlanId = current.id;
                this.currentPlanName = current.name;
              }
              this.loading = false;
            },
            error: () => { this.loadPlansOnly(); }
          });
        } else {
          this.loadPlansOnly();
        }
      },
      error: () => { this.loadPlansOnly(); }
    });
  }

  private loadPlansOnly() {
    this.pricingPlanService.getActivePricingPlans(environment.marketVersion).subscribe({
      next: plans => {
        this.paidPlans = plans.filter(p => p.pricePerMonth != null && p.pricePerMonth > 0);
        this.loading = false;
      },
      error: err => {
        this.error = 'Impossible de charger les plans. Veuillez réessayer.';
        this.loading = false;
      }
    });
  }

  renewCurrentPlan() {
    if (!this.currentPlanId) return;
    this.subscribe({ id: this.currentPlanId } as PricingPlan);
  }

  subscribe(plan: PricingPlan) {
    this.checkoutLoading = true;
    this.paymentService.createCheckout({ pricingPlanId: plan.id }).subscribe({
      next: session => {
        if (session.url) {
          window.location.href = session.url;
        } else {
          this.checkoutLoading = false;
          this.error = 'Impossible de créer la session de paiement.';
        }
      },
      error: () => {
        this.checkoutLoading = false;
        this.error = 'Erreur lors de la création du paiement. Veuillez réessayer.';
      }
    });
  }
}
