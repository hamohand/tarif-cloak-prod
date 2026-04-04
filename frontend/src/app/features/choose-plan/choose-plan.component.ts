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
    .choose-plan-page {
      min-height: 100vh;
      background: #f8fafc;
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
      font-size: 1.75rem;
      font-weight: 700;
      color: #1e293b;
      text-align: center;
      margin-bottom: 0.5rem;
    }
    .choose-plan-subtitle {
      text-align: center;
      color: #64748b;
      margin-bottom: 2rem;
    }
    .loading, .error-message {
      text-align: center;
      padding: 2rem;
      color: #64748b;
    }
    .error-message { color: #ef4444; }
    .renew-section {
      text-align: center;
      padding: 1.5rem;
      background: #eff6ff;
      border-radius: 12px;
      margin-bottom: 1.5rem;
    }
    .renew-section h2 {
      font-size: 1.1rem;
      margin-bottom: 1rem;
      color: #1e40af;
    }
    .separator {
      text-align: center;
      color: #94a3b8;
      margin: 1.5rem 0;
      position: relative;
    }
    .separator::before, .separator::after {
      content: '';
      display: inline-block;
      width: 40%;
      height: 1px;
      background: #e2e8f0;
      vertical-align: middle;
      margin: 0 0.5rem;
    }
    .plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 1.5rem;
    }
    .plan-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .plan-name {
      font-size: 1.1rem;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
    }
    .plan-description {
      font-size: 0.875rem;
      color: #64748b;
      margin: 0;
    }
    .plan-price {
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f172a;
    }
    .price-currency, .price-period {
      font-size: 0.875rem;
      font-weight: 400;
      color: #64748b;
    }
    .plan-quota {
      font-size: 0.875rem;
      color: #475569;
      margin: 0;
    }
    .plan-features {
      list-style: none;
      padding: 0;
      margin: 0;
      font-size: 0.8rem;
      color: #64748b;
    }
    .plan-features li::before { content: '✓ '; color: #22c55e; }
    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-renew {
      background: #1d4ed8;
      color: white;
      font-size: 1rem;
    }
    .btn-subscribe {
      background: #0f172a;
      color: white;
      margin-top: auto;
    }
    .btn:hover:not(:disabled) { opacity: 0.85; }
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
