import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PricingPlanService, PricingPlan } from '../../core/services/pricing-plan.service';
import { environment } from '../../../environments/environment';
import { QuoteRequestFormComponent } from './quote-request-form.component';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-pricing-plans',
  standalone: true,
  imports: [CommonModule, RouterLink, QuoteRequestFormComponent],
  template: `
    <div class="pricing-container">
      <div class="pricing-header">
        <h1>Choisissez votre plan tarifaire</h1>
        <p>Sélectionnez le plan qui correspond le mieux à vos besoins</p>
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
        <div class="pricing-plans-grid">
          @for (plan of plans; track plan.id) {
            <div class="pricing-plan-card" [class.featured]="plan.displayOrder === 2">
              @if (plan.displayOrder === 2) {
                <div class="popular-badge">Populaire</div>
              }
              <h3>{{ plan.name }}</h3>
              <div class="price">
                @if (plan.pricePerMonth !== null && plan.pricePerMonth !== undefined) {
                  @if (plan.pricePerMonth === 0) {
                    <span class="amount">Gratuit</span>
                  } @else {
                    <span class="currency">{{ getCurrencySymbol(plan.currency) }}</span>
                    <span class="amount">{{ plan.pricePerMonth }}</span>
                    <span class="period">/mois</span>
                  }
                } @else if (plan.pricePerRequest !== null && plan.pricePerRequest !== undefined) {
                  <span class="currency">{{ getCurrencySymbol(plan.currency) }}</span>
                  <span class="amount">{{ plan.pricePerRequest }}</span>
                  <span class="period">/requête</span>
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
                  <strong>{{ plan.monthlyQuota | number }} requêtes/mois</strong>
                } @else if (plan.pricePerRequest !== null && plan.pricePerRequest !== undefined) {
                  <strong>Facturation à la requête</strong>
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
        <p>Vous pouvez changer de plan à tout moment après votre inscription.</p>
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
    .pricing-container {
      padding: 3rem 2rem;
      max-width: 1200px;
      margin: 0 auto;
      min-height: calc(100vh - 200px);
    }

    .pricing-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .pricing-header h1 {
      font-size: 2.5rem;
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    .pricing-header p {
      font-size: 1.2rem;
      color: #7f8c8d;
    }

    .quote-notice {
      margin-top: 1.5rem;
      padding: 1rem 1.5rem;
      background: linear-gradient(135deg, rgba(250, 204, 21, 0.15) 0%, rgba(250, 204, 21, 0.05) 100%);
      border: 2px solid rgba(250, 204, 21, 0.4);
      border-radius: 12px;
      color: #1f2937;
      font-size: 1rem;
      display: inline-block;
      box-shadow: 0 4px 12px rgba(250, 204, 21, 0.2);
    }

    .quote-notice strong {
      color: #facc15;
      font-weight: 700;
    }

    .pricing-plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin-bottom: 3rem;
    }

    .pricing-plan-card {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      position: relative;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .pricing-plan-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    }

    .pricing-plan-card.featured {
      border: 3px solid #3498db;
      transform: scale(1.05);
    }

    .popular-badge {
      position: absolute;
      top: -15px;
      right: 20px;
      background: #3498db;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 600;
    }

    .pricing-plan-card h3 {
      font-size: 1.8rem;
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    .price {
      margin: 1.5rem 0;
      display: flex;
      align-items: baseline;
      justify-content: center;
    }

    .currency {
      font-size: 1.5rem;
      color: #7f8c8d;
      margin-right: 0.25rem;
    }

    .amount {
      font-size: 3rem;
      font-weight: 700;
      color: #2c3e50;
    }

    .period {
      font-size: 1.2rem;
      color: #7f8c8d;
      margin-left: 0.25rem;
    }

    .description {
      color: #7f8c8d;
      margin-bottom: 1rem;
      text-align: center;
    }

    .quota {
      text-align: center;
      margin: 1.5rem 0;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 8px;
      color: #2c3e50;
    }

    .features {
      margin: 1.5rem 0;
    }

    .features h4 {
      font-size: 1.1rem;
      color: #2c3e50;
      margin-bottom: 0.5rem;
    }

    .features ul {
      list-style: none;
      padding: 0;
    }

    .features li {
      padding: 0.5rem 0;
      color: #7f8c8d;
      border-bottom: 1px solid #ecf0f1;
    }

    .features li:last-child {
      border-bottom: none;
    }

    .features li:before {
      content: "✓ ";
      color: #27ae60;
      font-weight: bold;
      margin-right: 0.5rem;
    }

    .btn {
      width: 100%;
      padding: 1rem;
      border: none;
      border-radius: 8px;
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      text-decoration: none;
      display: block;
      text-align: center;
      margin-top: 1.5rem;
    }

    .btn-primary {
      background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
      color: white;
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, #2980b9 0%, #1f6391 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
    }

    .pricing-footer {
      text-align: center;
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #ecf0f1;
    }

    .pricing-footer p {
      color: #7f8c8d;
      margin-bottom: 1rem;
    }

    .footer-actions {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      align-items: center;
    }

    .btn-secondary {
      background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
      color: white;
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .btn-secondary:hover {
      background: linear-gradient(135deg, #7f8c8d 0%, #6c7a7a 100%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(149, 165, 166, 0.3);
    }

    .link {
      color: #3498db;
      text-decoration: none;
      font-weight: 600;
    }

    .link:hover {
      text-decoration: underline;
    }

    .loading, .error {
      text-align: center;
      padding: 2rem;
      font-size: 1.2rem;
    }

    .error {
      color: #e74c3c;
    }

    @media (max-width: 768px) {
      .pricing-plans-grid {
        grid-template-columns: 1fr;
      }

      .pricing-plan-card.featured {
        transform: scale(1);
      }
    }
  `]
})
export class PricingPlansComponent implements OnInit {
  private pricingPlanService = inject(PricingPlanService);
  private authService = inject(AuthService);

  plans: PricingPlan[] = [];
  loading = true;
  error = '';
  showQuoteForm = false;
  isAuthenticated = false;

  ngOnInit() {
    this.loadPricingPlans();
    // Vérifier si l'utilisateur est authentifié
    this.authService.isAuthenticated().subscribe((isAuth: boolean) => {
      this.isAuthenticated = isAuth;
    });
  }

  loadPricingPlans() {
    this.loading = true;
    this.error = '';
    // Utiliser la version de marché depuis l'environnement
    // Vérifier plusieurs façons d'accéder à marketVersion
    let marketVersion: string | undefined = undefined;
    
    // Essayer plusieurs méthodes d'accès
    if ((environment as any).marketVersion) {
      marketVersion = (environment as any).marketVersion;
    } else if ((environment as any)['marketVersion']) {
      marketVersion = (environment as any)['marketVersion'];
    }
    
    // Si toujours undefined, utiliser une valeur par défaut basée sur l'URL ou la configuration
    if (!marketVersion) {
      // En production, détecter depuis l'URL ou utiliser 'DZ' par défaut
      const isProduction = (environment as any).production === true;
      const hostname = window.location.hostname;
      
      // Si on est en production et que marketVersion n'est pas défini, utiliser 'DZ' par défaut
      if (isProduction) {
        marketVersion = 'DZ';
        console.warn('⚠️ marketVersion non trouvé dans environment, utilisation de la valeur par défaut: DZ (production)');
      } else {
        marketVersion = 'DEFAULT';
        console.warn('⚠️ marketVersion non trouvé dans environment, utilisation de la valeur par défaut: DEFAULT (développement)');
      }
    }
    
    console.log('🔍 Market version utilisée:', marketVersion);
    console.log('🔍 Type de marketVersion:', typeof marketVersion);
    console.log('🔍 Environment complet:', environment);
    console.log('🔍 Clés de environment:', Object.keys(environment));
    console.log('🔍 environment.production:', (environment as any).production);
    
    this.pricingPlanService.getActivePricingPlans(marketVersion).subscribe({
      next: (plans) => {
        this.plans = plans;
        this.loading = false;
        console.log('✅ Plans reçus:', plans.length, plans);
        console.log('✅ Market versions des plans reçus:', plans.map(p => ({ name: p.name, marketVersion: p.marketVersion })));
        if (plans.length === 0) {
          this.error = 'Aucun plan tarifaire disponible pour le moment.';
        }
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des plans tarifaires: ' + (err.error?.message || err.message || 'Erreur inconnue');
        this.loading = false;
        console.error('Erreur:', err);
      }
    });
  }

  getCurrencySymbol(currency?: string): string {
    if (!currency) return '€'; // Par défaut EUR
    const currencyMap: { [key: string]: string } = {
      'EUR': '€',
      'DZD': 'DA',
      'USD': '$',
      'GBP': '£'
    };
    return currencyMap[currency] || currency;
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

