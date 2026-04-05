import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, UserUsageStats, UserQuota, Organization } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-container">
      <h2>📊 Mon Tableau de Bord</h2>

      <!-- Informations utilisateur -->
      <div class="user-info-card">
        <h3>👤 Informations</h3>
        <p><strong>Nom d'utilisateur:</strong> {{ userInfo?.preferred_username || 'N/A' }}</p>
        <p><strong>Email:</strong> {{ userInfo?.email || 'N/A' }}</p>
      </div>

      <!-- Organisation -->
      <div class="organization-card" *ngIf="organization || loadingOrg">
        <h3>🏢 Mon Organisation</h3>
        @if (loadingOrg) {
          <p>Chargement...</p>
        } @else if (organization) {
          <div class="org-details">
            <p><strong>Nom:</strong> {{ organization.name }}</p>
            @if (organization.email) {
              <p><strong>Email:</strong> {{ organization.email }}</p>
            }
            <p><strong>Créée le:</strong> {{ formatDate(organization.createdAt) }}</p>
          </div>
        } @else {
          <p class="no-org-message">Vous n'êtes associé à aucune organisation.</p>
        }
      </div>


      <!-- Utilisation Organisation Ce Mois -->
      <div class="quota-card" *ngIf="quota || loadingQuota">
        <h3>📊 Utilisation Organisation Ce Mois</h3>
        @if (loadingQuota) {
          <p>Chargement...</p>
        } @else if (quota) {
          @if (!quota.hasOrganization) {
            <p class="no-org-message">{{ quota.message }}</p>
          } @else {
            <div class="org-usage-details">
              <div class="org-usage-stats">
                <div class="org-usage-item">
                  <span class="org-usage-label">Crédits ce mois :</span>
                  <span class="org-usage-value">{{ quota.currentUsage || 0 }}</span>
                </div>
                <div class="org-usage-item">
                  <span class="org-usage-label">Quota mensuel :</span>
                  <span class="org-usage-value">
                    @if (quota.isUnlimited) {
                      Illimité
                    } @else {
                      {{ quota.monthlyQuota || 'Non défini' }} crédits
                    }
                  </span>
                </div>
                @if (!quota.isUnlimited && quota.monthlyQuota) {
                  <div class="org-usage-item">
                    <span class="org-usage-label">Crédits restants :</span>
                    <span class="org-usage-value" [class.quota-warning]="getOrgPercentage() >= 80" [class.quota-danger]="getOrgPercentage() >= 100">
                      {{ Math.max(0, quota.monthlyQuota - (quota.currentUsage || 0)) }}
                    </span>
                  </div>
                  <div class="org-usage-item">
                    <span class="org-usage-label">Pourcentage utilisé :</span>
                    <span class="org-usage-value" [class.quota-warning]="getOrgPercentage() >= 80" [class.quota-danger]="getOrgPercentage() >= 100">
                      {{ getOrgPercentage().toFixed(1) }}%
                    </span>
                  </div>
                }
              </div>
              @if (!quota.isUnlimited && quota.monthlyQuota && getOrgPercentage() >= 100) {
                <p class="quota-exceeded-message">❌ Merci pour votre participation. Veuillez contacter l'administrateur si vous souhaitez continuer à tester.</p>
              }
            </div>
          }
        }
      </div>

      <!-- Statistiques d'utilisation -->
      <div class="stats-card" *ngIf="stats || loadingStats">
        <h3>📊 Mes Statistiques</h3>
        @if (loadingStats) {
          <p>Chargement...</p>
        } @else if (stats) {
          <div class="stats-grid">
            <div class="stat-item">
              <h4>📈 Total Crédits</h4>
              <p class="stat-value">{{ stats.totalRequests }}</p>
            </div>
          </div>

          <!-- Utilisations récentes -->
          @if (stats.recentUsage && stats.recentUsage.length > 0) {
            <div class="recent-usage">
              <h4>🔍 Utilisations Récentes</h4>
              <table class="usage-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Endpoint</th>
                    <th>Recherche</th>
                    @if (isAdmin()) {
                      <th>Tokens</th>
                    }
                    <th>Coût</th>
                  </tr>
                </thead>
                <tbody>
                  @for (usage of stats.recentUsage; track usage.id) {
                    <tr>
                      <td>{{ formatDate(usage.timestamp) }}</td>
                      <td>{{ usage.endpoint }}</td>
                      <td class="search-term">{{ truncateSearchTerm(usage.searchTerm) }}</td>
                      @if (isAdmin()) {
                        <td>{{ formatNumber(usage.tokensUsed) }}</td>
                      }
                      <td>{{ formatCurrency(usage.costUsd || 0) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="empty-message">Aucune utilisation récente.</p>
          }
        }
      </div>

      <!-- Message d'erreur -->
      @if (errorMessage) {
        <div class="error-message">{{ errorMessage }}</div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      background: var(--neu-bg, #E0E5EC);
      min-height: 100vh;
    }

    .dashboard-container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    h2 {
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display);
      margin-bottom: 2rem;
    }

    h3 {
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display);
      margin-top: 0;
      margin-bottom: 1rem;
    }

    .user-info-card,
    .organization-card,
    .quota-card,
    .stats-card {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      border-radius: var(--neu-radius-container, 32px);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
    }

    .org-details p,
    .user-info-card p {
      margin: 0.5rem 0;
      color: var(--neu-text-primary, #3D4852);
    }

    .no-org-message {
      color: var(--neu-text-muted, #6B7280);
      font-style: italic;
    }

    .quota-details {
      margin-top: 1rem;
    }

    .quota-unlimited {
      padding: 1rem;
      background: var(--neu-bg, #E0E5EC);
      border-radius: 16px;
      box-shadow: var(--neu-inset-sm, inset 4px 4px 6px rgba(163,177,198,0.5), inset -4px -4px 6px rgba(255,255,255,0.4));
    }

    .quota-status {
      font-weight: 600;
      color: var(--neu-accent-secondary, #38B2AC);
      margin: 0.5rem 0;
    }

    .quota-limited {
      padding: 1rem;
    }

    .quota-progress {
      margin: 1rem 0;
    }

    .quota-progress-bar {
      width: 100%;
      height: 30px;
      background: var(--neu-bg, #E0E5EC);
      border-radius: 15px;
      overflow: hidden;
      margin-bottom: 0.5rem;
      box-shadow: var(--neu-inset-sm, inset 4px 4px 6px rgba(163,177,198,0.5), inset -4px -4px 6px rgba(255,255,255,0.4));
    }

    .quota-progress-fill {
      height: 100%;
      background: var(--neu-accent-secondary, #38B2AC);
      transition: width 0.3s ease;
      border-radius: 15px;
    }

    .quota-progress-fill.quota-warning {
      background: var(--neu-accent-warning, #ED8936);
    }

    .quota-progress-fill.quota-danger {
      background: var(--neu-accent-danger, #E53E3E);
    }

    .quota-text {
      text-align: center;
      font-weight: 600;
      color: var(--neu-text-heading, #2D3748);
      margin: 0.5rem 0;
    }

    .quota-remaining {
      text-align: center;
      margin-top: 0.5rem;
    }

    .quota-remaining-text {
      color: var(--neu-accent-warning, #ED8936);
      font-weight: 600;
    }

    .quota-exceeded {
      color: var(--neu-accent-danger, #E53E3E);
      font-weight: 600;
    }

    .quota-usage {
      color: var(--neu-text-muted, #6B7280);
      margin: 0.5rem 0;
    }

    .quota-usage-info {
      text-align: center;
      margin: 0.5rem 0;
      font-size: 0.9rem;
    }

    .quota-usage-text {
      color: var(--neu-text-muted, #6B7280);
      margin: 0 0.5rem;
    }

    .org-usage-details {
      margin-top: 1rem;
    }

    .org-usage-stats {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .org-usage-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      min-height: 44px;
      background: var(--neu-bg, #E0E5EC);
      border-radius: 16px;
      box-shadow: var(--neu-inset-sm, inset 4px 4px 6px rgba(163,177,198,0.5), inset -4px -4px 6px rgba(255,255,255,0.4));
    }

    .org-usage-label {
      font-weight: 500;
      color: var(--neu-text-muted, #6B7280);
    }

    .org-usage-value {
      font-weight: 600;
      font-size: 1.1rem;
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display);
    }

    .org-usage-value.quota-warning {
      color: var(--neu-accent-warning, #ED8936);
    }

    .org-usage-value.quota-danger {
      color: var(--neu-accent-danger, #E53E3E);
    }

    .quota-exceeded-message {
      margin-top: 1rem;
      padding: 0.75rem;
      background: var(--neu-bg, #E0E5EC);
      border-radius: 16px;
      box-shadow: var(--neu-inset-sm, inset 4px 4px 6px rgba(163,177,198,0.5), inset -4px -4px 6px rgba(255,255,255,0.4));
      color: var(--neu-accent-danger, #E53E3E);
      font-weight: 600;
      text-align: center;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 1.5rem 0;
    }

    .stat-item {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      padding: 1rem;
      border-radius: var(--neu-radius-container, 32px);
      text-align: center;
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      min-height: 44px;
    }

    .stat-item h4 {
      margin: 0 0 0.5rem 0;
      color: var(--neu-text-muted, #6B7280);
      font-size: 0.9rem;
      font-family: var(--font-display);
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--neu-accent, #6C63FF);
      font-family: var(--font-display);
      margin: 0;
    }

    .filters {
      display: flex;
      gap: 1rem;
      align-items: flex-end;
      margin: 1.5rem 0;
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .filter-group label {
      font-weight: 600;
      color: var(--neu-text-heading, #2D3748);
      font-size: 0.9rem;
    }

    .filter-group input {
      padding: 0.65rem 0.75rem;
      border: none;
      border-radius: 12px;
      background: var(--neu-bg, #E0E5EC);
      color: var(--neu-text-primary, #3D4852);
      box-shadow: var(--neu-inset, inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5));
      min-height: 44px;
    }

    .filter-group input:focus {
      outline: none;
      box-shadow: var(--neu-inset-deep, inset 8px 8px 14px rgba(163,177,198,0.7), inset -8px -8px 14px rgba(255,255,255,0.6)), 0 0 0 2px var(--neu-accent, #6C63FF);
    }

    .recent-usage {
      margin-top: 2rem;
    }

    .recent-usage h4 {
      margin-bottom: 1rem;
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display);
    }

    .usage-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0 0.5rem;
    }

    .usage-table th {
      padding: 0.75rem 1rem;
      text-align: left;
      font-weight: 600;
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display);
      background: transparent;
    }

    .usage-table td {
      padding: 0.75rem 1rem;
      color: var(--neu-text-primary, #3D4852);
      background: var(--neu-bg, #E0E5EC);
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.5), -5px -5px 10px rgba(255,255,255,0.4));
    }

    .usage-table td:first-child {
      border-radius: 16px 0 0 16px;
    }

    .usage-table td:last-child {
      border-radius: 0 16px 16px 0;
    }

    .search-term {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn {
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.25s ease;
      min-height: 44px;
    }

    .btn-secondary {
      background: var(--neu-bg, #E0E5EC);
      color: var(--neu-accent, #6C63FF);
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.5), -5px -5px 10px rgba(255,255,255,0.4));
    }

    .btn-secondary:hover {
      box-shadow: 7px 7px 14px rgba(163,177,198,0.6), -7px -7px 14px rgba(255,255,255,0.5);
    }

    .btn-secondary:active {
      box-shadow: var(--neu-inset-sm, inset 4px 4px 6px rgba(163,177,198,0.5), inset -4px -4px 6px rgba(255,255,255,0.4));
    }

    .empty-message {
      color: var(--neu-text-muted, #6B7280);
      font-style: italic;
      text-align: center;
      padding: 2rem;
    }

    .error-message {
      background: var(--neu-bg, #E0E5EC);
      color: var(--neu-accent-danger, #E53E3E);
      padding: 1rem;
      border-radius: 16px;
      margin-top: 1rem;
      box-shadow: var(--neu-inset-sm, inset 4px 4px 6px rgba(163,177,198,0.5), inset -4px -4px 6px rgba(255,255,255,0.4));
    }

    .chart-section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      border-radius: var(--neu-radius-container, 32px);
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
    }

    .chart-section h4 {
      margin: 0 0 1rem 0;
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display);
    }

    .chart-wrapper {
      position: relative;
      height: 300px;
    }

    .quota-chart-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 1rem 0;
      height: 200px;
    }

    .quota-chart-wrapper canvas {
      max-width: 200px;
      max-height: 200px;
    }

    .pricing-plan-card {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      border-radius: var(--neu-radius-container, 32px);
      padding: 2rem;
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      margin-bottom: 2rem;
    }

    .pricing-plan-card h3 {
      margin-top: 0;
      margin-bottom: 1.5rem;
      color: var(--neu-text-heading, #2D3748);
    }

    .current-plan {
      margin-bottom: 2rem;
      padding: 1rem;
      background: var(--neu-bg, #E0E5EC);
      border-radius: 16px;
      box-shadow: var(--neu-inset-sm, inset 4px 4px 6px rgba(163,177,198,0.5), inset -4px -4px 6px rgba(255,255,255,0.4));
    }

    .plan-info p {
      margin: 0.5rem 0;
      color: var(--neu-text-primary, #3D4852);
    }

    .no-plan-message, .no-plans-message {
      color: var(--neu-text-muted, #6B7280);
      font-style: italic;
    }

    .change-plan-section {
      margin-top: 2rem;
      padding-top: 2rem;
    }

    .change-plan-section h4 {
      margin-bottom: 1rem;
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display);
    }

    .plan-select {
      width: 100%;
      padding: 0.75rem;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      margin-bottom: 1rem;
      background: var(--neu-bg, #E0E5EC);
      color: var(--neu-text-primary, #3D4852);
      box-shadow: var(--neu-inset, inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5));
      min-height: 44px;
    }

    .plan-select option {
      background: var(--neu-bg, #E0E5EC);
      color: var(--neu-text-primary, #3D4852);
    }

    .plan-select:focus {
      outline: none;
      box-shadow: var(--neu-inset-deep, inset 8px 8px 14px rgba(163,177,198,0.7), inset -8px -8px 14px rgba(255,255,255,0.6)), 0 0 0 2px var(--neu-accent, #6C63FF);
    }

    .view-all-plans-link {
      display: block;
      margin-top: 1rem;
      text-align: center;
      color: var(--neu-accent, #6C63FF);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
    }

    .view-all-plans-link:hover {
      text-decoration: underline;
      color: var(--neu-accent-secondary, #38B2AC);
    }

    @media (max-width: 768px) {
      .dashboard-container {
        padding: 1rem;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .usage-table {
        font-size: 0.85rem;
      }
    }
  `]
})
export class UserDashboardComponent implements OnInit {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private currencyService = inject(CurrencyService);

  private currentCurrencyCode = 'EUR'; // Par défaut, sera mis à jour dans ngOnInit
  private currentCurrencySymbol = '€'; // Par défaut, sera mis à jour dans ngOnInit

  // Exposer Math pour le template
  Math = Math;

  userInfo: any;
  organization: Organization | null = null;
  quota: UserQuota | null = null;
  stats: UserUsageStats | null = null;

  loadingOrg = false;
  loadingQuota = false;
  loadingStats = false;
  errorMessage = '';

  ngOnInit() {
    // Charger la devise du marché
    this.currencyService.getCurrencyCode().pipe(take(1)).subscribe({
      next: (code) => {
        this.currentCurrencyCode = code;
        this.currentCurrencySymbol = this.currencyService.getSymbolForCurrency(code);
      },
      error: (err) => {
        console.error('Erreur lors du chargement de la devise:', err);
      }
    });
    
    this.userInfo = this.authService.getUserInfo();
    this.loadOrganization();
    this.loadQuota();
    this.loadStats();
  }

  loadOrganization() {
    this.loadingOrg = true;
    this.errorMessage = '';
    this.userService.getMyOrganization().subscribe({
      next: (org) => {
        this.organization = org;
        this.loadingOrg = false;
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du chargement de l\'organisation: ' + (err.error?.message || err.message);
        this.loadingOrg = false;
      }
    });
  }

  loadQuota() {
    this.loadingQuota = true;
    this.userService.getMyQuota().subscribe({
      next: (quota) => {
        this.quota = quota;
        this.loadingQuota = false;
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du chargement du quota: ' + (err.error?.message || err.message);
        this.loadingQuota = false;
      }
    });
  }

  loadStats() {
    this.loadingStats = true;
    this.errorMessage = '';
    this.userService.getMyUsageStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.loadingStats = false;
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du chargement des statistiques: ' + (err.error?.message || err.message);
        this.loadingStats = false;
      }
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  formatCurrency(amount: number): string {
    if (amount == null || isNaN(amount)) return '0.00';
    
    // Utiliser la devise du marché stockée dans currentCurrencyCode
    // Pour DZD et MAD, le symbole est placé après le montant
    if (this.currentCurrencyCode === 'DZD' || this.currentCurrencyCode === 'MAD') {
      return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${this.currentCurrencySymbol}`;
    }
    
    // Pour les autres devises, utiliser Intl.NumberFormat ou le symbole avant
    try {
      return new Intl.NumberFormat('fr-FR', { 
        style: 'currency', 
        currency: this.currentCurrencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (e) {
      // Si la devise n'est pas supportée par Intl, utiliser le symbole manuellement
      return `${this.currentCurrencySymbol}${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('fr-FR').format(num);
  }

  truncateSearchTerm(term: string): string {
    if (term.length > 50) {
      return term.substring(0, 47) + '...';
    }
    return term;
  }

  getOrgPercentage(): number {
    if (!this.quota || !this.quota.currentUsage || !this.quota.monthlyQuota) {
      return 0;
    }
    return (this.quota.currentUsage / this.quota.monthlyQuota) * 100;
  }

  isAdmin(): boolean {
    return this.authService.hasRole('ADMIN');
  }
}

