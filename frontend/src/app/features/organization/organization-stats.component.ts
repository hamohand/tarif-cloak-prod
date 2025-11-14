import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService, UserUsageStats, UserQuota, Organization } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { PricingPlanService, PricingPlan } from '../../core/services/pricing-plan.service';
import { NotificationService } from '../../core/services/notification.service';
import { OrganizationAccountService, OrganizationUsageLog } from '../../core/services/organization-account.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-organization-stats',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="stats-container">
      <h2>📊 Statistiques Globales de l'Organisation</h2>

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
        }
      </div>

      <!-- Plan tarifaire -->
      @if (organization) {
        <div class="pricing-plan-card">
          <h3>💳 Plan Tarifaire</h3>
          @if (loadingPlans) {
            <p>Chargement...</p>
          } @else if (pricingPlans.length > 0) {
            <div class="current-plan">
              @if (currentPlan) {
                <div class="plan-info">
                  <p><strong>Plan actuel:</strong> {{ currentPlan.name }}</p>
                  <p><strong>Prix:</strong> 
                    @if (currentPlan.pricePerMonth !== null && currentPlan.pricePerMonth !== undefined) {
                      @if (currentPlan.pricePerMonth === 0) {
                        Gratuit
                      } @else {
                        {{ currentPlan.pricePerMonth }} €/mois
                      }
                    } @else if (currentPlan.pricePerRequest !== null && currentPlan.pricePerRequest !== undefined) {
                      {{ currentPlan.pricePerRequest }} €/requête
                    } @else {
                      Gratuit
                    }
                  </p>
                  @if (currentPlan.trialPeriodDays) {
                    <p><strong>Période d'essai:</strong> Valable {{ currentPlan.trialPeriodDays }} jours</p>
                  } @else if (currentPlan.monthlyQuota) {
                    <p><strong>Quota:</strong> {{ currentPlan.monthlyQuota | number }} requêtes/mois</p>
                  } @else if (currentPlan.pricePerRequest !== null && currentPlan.pricePerRequest !== undefined) {
                    <p><strong>Quota:</strong> Facturation à la requête</p>
                  } @else {
                    <p><strong>Quota:</strong> Illimité</p>
                  }
                </div>
              } @else {
                <p class="no-plan-message">Aucun plan tarifaire sélectionné</p>
              }
            </div>
            <div class="change-plan-section">
              <h4>Changer de plan</h4>
              <select [(ngModel)]="selectedPlanId" class="plan-select">
                <option [value]="null">Aucun plan (gratuit)</option>
                @for (plan of pricingPlans; track plan.id) {
                  <option [value]="plan.id" [selected]="plan.id === organization.pricingPlanId">
                    {{ plan.name }} - 
                    @if (plan.pricePerMonth !== null && plan.pricePerMonth !== undefined) {
                      @if (plan.pricePerMonth === 0) {
                        Gratuit
                      } @else {
                        {{ plan.pricePerMonth }} €/mois
                      }
                    } @else if (plan.pricePerRequest !== null && plan.pricePerRequest !== undefined) {
                      {{ plan.pricePerRequest }} €/requête
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
              <button 
                class="btn btn-primary" 
                (click)="changePricingPlan()"
                [disabled]="isChangingPlan || selectedPlanId === organization.pricingPlanId">
                @if (isChangingPlan) {
                  <span>Changement en cours...</span>
                } @else {
                  <span>Changer de plan</span>
                }
              </button>
              <a routerLink="/pricing" class="view-all-plans-link">Voir tous les plans tarifaires</a>
            </div>
          } @else {
            <p class="no-plans-message">Aucun plan tarifaire disponible</p>
          }
        </div>
      }

      <!-- Quota organisation -->
      <div class="quota-card" *ngIf="quota || loadingQuota">
        <h3>📈 Utilisation Organisation Ce Mois</h3>
        @if (loadingQuota) {
          <p>Chargement...</p>
        } @else if (quota) {
          @if (!quota.hasOrganization) {
            <p class="no-org-message">{{ quota.message }}</p>
          } @else {
            <div class="quota-details">
              @if (quota.isUnlimited) {
                <div class="quota-unlimited">
                  <p class="quota-status">✅ Quota illimité</p>
                  <p class="quota-usage">Utilisation organisation ce mois: {{ quota.currentUsage || 0 }} requêtes</p>
                </div>
              } @else {
                <!-- Graphique circulaire du quota -->
                <div class="quota-chart-wrapper">
                  <canvas #quotaChart></canvas>
                </div>
                <div class="quota-limited">
                  <div class="quota-progress">
                    <div class="quota-progress-bar">
                      <div class="quota-progress-fill" [style.width.%]="quota.percentageUsed || 0" 
                           [class.quota-warning]="(quota.percentageUsed || 0) >= 80"
                           [class.quota-danger]="(quota.percentageUsed || 0) >= 100">
                      </div>
                    </div>
                    <p class="quota-text">
                      {{ quota.currentUsage || 0 }} / {{ quota.monthlyQuota }} requêtes
                      ({{ (quota.percentageUsed || 0).toFixed(1) }}%)
                    </p>
                  </div>
                  <p class="quota-usage-info">
                    <span class="quota-usage-text">Utilisation de l'organisation: {{ quota.currentUsage || 0 }} requêtes</span>
                  </p>
                  <p class="quota-remaining">
                    @if ((quota.remaining || 0) >= 0) {
                      <span class="quota-remaining-text">⚠️ {{ quota.remaining }} requêtes restantes</span>
                    } @else {
                      <span class="quota-exceeded">❌ Quota dépassé!</span>
                    }
                  </p>
                </div>
              }
            </div>
          }
        }
      </div>

      <!-- Statistiques d'utilisation -->
      <div class="stats-card" *ngIf="stats || loadingStats">
        <h3>📊 Statistiques Globales</h3>
        @if (loadingStats) {
          <p>Chargement...</p>
        } @else if (stats) {
          <div class="stats-grid">
            <div class="stat-item">
              <h4>📈 Total Requêtes</h4>
              <p class="stat-value">{{ stats.totalRequests }}</p>
            </div>
            <div class="stat-item">
              <h4>💰 Coût Total</h4>
              <p class="stat-value">{{ formatCurrency(stats.totalCostUsd) }}</p>
            </div>
            <div class="stat-item">
              <h4>🔢 Tokens Total</h4>
              <p class="stat-value">{{ formatNumber(stats.totalTokens) }}</p>
            </div>
            <div class="stat-item">
              <h4>📅 Requêtes ce mois</h4>
              <p class="stat-value">{{ stats.monthlyRequests }}</p>
            </div>
          </div>

          <!-- Filtres -->
          <div class="filters">
            <div class="filter-group">
              <label for="startDate">Date de début:</label>
              <input type="date" id="startDate" [(ngModel)]="startDate" (change)="onFilterChange()" />
            </div>
            <div class="filter-group">
              <label for="endDate">Date de fin:</label>
              <input type="date" id="endDate" [(ngModel)]="endDate" (change)="onFilterChange()" />
            </div>
            <button class="btn btn-secondary" (click)="resetFilters()">Réinitialiser</button>
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
                    <th>Tokens</th>
                    <th>Coût</th>
                  </tr>
                </thead>
                <tbody>
                  @for (usage of stats.recentUsage; track usage.id) {
                    <tr>
                      <td>{{ formatDate(usage.timestamp) }}</td>
                      <td>{{ usage.endpoint }}</td>
                      <td class="search-term">{{ truncateSearchTerm(usage.searchTerm) }}</td>
                      <td>{{ formatNumber(usage.tokensUsed) }}</td>
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

      <!-- Liste de toutes les requêtes de l'organisation -->
      <div class="usage-logs-card" *ngIf="organizationUsageLogs || loadingUsageLogs">
        <h3>📋 Toutes les Requêtes de l'Organisation</h3>
        @if (loadingUsageLogs) {
          <p>Chargement...</p>
        } @else if (organizationUsageLogs && organizationUsageLogs.usageLogs.length > 0) {
          <div class="usage-logs-info">
            <p><strong>Période:</strong> {{ formatDate(organizationUsageLogs.startDate) }} - {{ formatDate(organizationUsageLogs.endDate) }}</p>
            <p><strong>Total:</strong> {{ organizationUsageLogs.totalRequests }} requête(s)</p>
          </div>
          <table class="usage-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Collaborateur</th>
                <th>Endpoint</th>
                <th>Recherche</th>
                <th>Tokens</th>
                <th>Coût tokens</th>
                <th>Coût total</th>
              </tr>
            </thead>
            <tbody>
              @for (log of organizationUsageLogs.usageLogs; track log.id) {
                <tr>
                  <td>{{ formatDate(log.timestamp) }}</td>
                  <td><strong>{{ log.collaboratorName }}</strong></td>
                  <td>{{ log.endpoint }}</td>
                  <td class="search-term">{{ truncateSearchTerm(log.searchTerm) }}</td>
                  <td>{{ formatNumber(log.tokensUsed || 0) }}</td>
                  <td>{{ formatCost(log.tokenCostUsd || 0) }} €</td>
                  <td><strong>{{ formatCost(log.totalCostUsd || 0) }} €</strong></td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="empty-message">Aucune requête pour cette période.</p>
        }
      </div>

      <!-- Message d'erreur -->
      @if (errorMessage) {
        <div class="error-message">{{ errorMessage }}</div>
      }
    </div>
  `,
  styles: [`
    .stats-container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    h2 {
      color: #2c3e50;
      margin-bottom: 2rem;
    }

    h3 {
      color: #2c3e50;
      margin-top: 0;
      margin-bottom: 1rem;
    }

    .organization-card,
    .quota-card,
    .stats-card {
      background: #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .org-details p,
    .organization-card p {
      margin: 0.5rem 0;
      color: #555;
    }

    .no-org-message {
      color: #888;
      font-style: italic;
    }

    .quota-details {
      margin-top: 1rem;
    }

    .quota-unlimited {
      padding: 1rem;
      background: #e8f5e9;
      border-radius: 4px;
    }

    .quota-status {
      font-weight: 600;
      color: #2e7d32;
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
      background: #e0e0e0;
      border-radius: 15px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .quota-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4caf50, #8bc34a);
      transition: width 0.3s ease;
    }

    .quota-progress-fill.quota-warning {
      background: linear-gradient(90deg, #ff9800, #ffc107);
    }

    .quota-progress-fill.quota-danger {
      background: linear-gradient(90deg, #f44336, #ef5350);
    }

    .quota-text {
      text-align: center;
      font-weight: 600;
      color: #2c3e50;
      margin: 0.5rem 0;
    }

    .quota-remaining {
      text-align: center;
      margin-top: 0.5rem;
    }

    .quota-remaining-text {
      color: #ff9800;
      font-weight: 600;
    }

    .quota-exceeded {
      color: #f44336;
      font-weight: 600;
    }

    .quota-usage {
      color: #666;
      margin: 0.5rem 0;
    }

    .quota-usage-info {
      text-align: center;
      margin: 0.5rem 0;
      font-size: 0.9rem;
    }

    .quota-usage-text {
      color: #666;
      margin: 0 0.5rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 1.5rem 0;
    }

    .stat-item {
      background: #d0d0d0;
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .stat-item h4 {
      margin: 0 0 0.5rem 0;
      color: #666;
      font-size: 0.9rem;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 600;
      color: #2c3e50;
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
      color: #2c3e50;
      font-size: 0.9rem;
    }

    .filter-group input {
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
    }

    .recent-usage {
      margin-top: 2rem;
    }

    .recent-usage h4 {
      margin-bottom: 1rem;
    }

    .usage-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 4px;
      overflow: hidden;
    }

    .usage-table th,
    .usage-table td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }

    .usage-table th {
      background: #d5d5d5;
      font-weight: 600;
      color: #2c3e50;
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
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
    }

    .btn-primary {
      background: #3498db;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #2980b9;
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #95a5a6;
      color: white;
    }

    .btn-secondary:hover {
      background: #7f8c8d;
    }

    .empty-message {
      color: #888;
      font-style: italic;
      text-align: center;
      padding: 2rem;
    }

    .error-message {
      background: #e74c3c;
      color: white;
      padding: 1rem;
      border-radius: 4px;
      margin-top: 1rem;
    }

    .chart-section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: #e0e0e0;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .chart-section h4 {
      margin: 0 0 1rem 0;
      color: #2c3e50;
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
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
    }

    .pricing-plan-card h3 {
      margin-top: 0;
      margin-bottom: 1.5rem;
      color: #2c3e50;
    }

    .current-plan {
      margin-bottom: 2rem;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 8px;
    }

    .plan-info p {
      margin: 0.5rem 0;
      color: #2c3e50;
    }

    .no-plan-message, .no-plans-message {
      color: #7f8c8d;
      font-style: italic;
    }

    .change-plan-section {
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 2px solid #e1e8ed;
    }

    .change-plan-section h4 {
      margin-bottom: 1rem;
      color: #2c3e50;
    }

    .plan-select {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #e1e8ed;
      border-radius: 6px;
      font-size: 1rem;
      margin-bottom: 1rem;
      background: white;
    }

    .plan-select:focus {
      outline: none;
      border-color: #3498db;
    }

    .view-all-plans-link {
      display: block;
      margin-top: 1rem;
      text-align: center;
      color: #3498db;
      text-decoration: none;
      font-size: 0.9rem;
    }

    .view-all-plans-link:hover {
      text-decoration: underline;
    }

    .usage-logs-card {
      background: #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .usage-logs-info {
      margin-bottom: 1rem;
      padding: 0.75rem;
      background: #f8f9fa;
      border-radius: 4px;
    }

    .usage-logs-info p {
      margin: 0.25rem 0;
      color: #555;
    }
  `]
})
export class OrganizationStatsComponent implements OnInit {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private pricingPlanService = inject(PricingPlanService);
  private notificationService = inject(NotificationService);
  private organizationAccountService = inject(OrganizationAccountService);

  organization: Organization | null = null;
  quota: UserQuota | null = null;
  stats: UserUsageStats | null = null;
  organizationUsageLogs: any = null;

  loadingOrg = false;
  loadingQuota = false;
  loadingStats = false;
  loadingUsageLogs = false;
  errorMessage = '';

  startDate = '';
  endDate = '';

  // Plans tarifaires
  pricingPlans: PricingPlan[] = [];
  currentPlan: PricingPlan | null = null;
  selectedPlanId: number | null = null;
  loadingPlans = false;
  isChangingPlan = false;

  private quotaChart: Chart | null = null;

  ngOnInit() {
    this.loadOrganization();
    this.loadQuota();
    this.loadPricingPlans();
    // Charger les logs d'utilisation qui recalculeront automatiquement les stats
    this.loadOrganizationUsageLogs();
  }

  loadOrganization() {
    this.loadingOrg = true;
    this.errorMessage = '';
    this.userService.getMyOrganization().subscribe({
      next: (org) => {
        this.organization = org;
        this.selectedPlanId = org?.pricingPlanId || null;
        this.loadingOrg = false;
        if (org?.pricingPlanId) {
          this.updateCurrentPlan(org.pricingPlanId);
        } else {
          this.currentPlan = null;
        }
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du chargement de l\'organisation: ' + (err.error?.message || err.message);
        this.loadingOrg = false;
      }
    });
  }

  loadPricingPlans() {
    this.loadingPlans = true;
    this.pricingPlanService.getActivePricingPlans().subscribe({
      next: (plans) => {
        this.pricingPlans = plans;
        this.loadingPlans = false;
        if (this.organization?.pricingPlanId) {
          this.updateCurrentPlan(this.organization.pricingPlanId);
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement des plans tarifaires:', err);
        this.loadingPlans = false;
      }
    });
  }

  updateCurrentPlan(planId: number) {
    const plan = this.pricingPlans.find(p => p.id === planId);
    this.currentPlan = plan || null;
  }

  changePricingPlan() {
    if (this.isChangingPlan || !this.organization) {
      return;
    }

    this.isChangingPlan = true;
    this.errorMessage = '';

    this.pricingPlanService.changeMyOrganizationPricingPlan(this.selectedPlanId).subscribe({
      next: (updatedOrg) => {
        this.organization = updatedOrg;
        this.updateCurrentPlan(updatedOrg.pricingPlanId || 0);
        this.isChangingPlan = false;
        this.notificationService.success('Plan tarifaire changé avec succès');
        this.loadQuota();
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du changement de plan: ' + (err.error?.message || err.message);
        this.isChangingPlan = false;
        this.notificationService.error('Erreur lors du changement de plan');
      }
    });
  }

  loadQuota() {
    this.loadingQuota = true;
    this.userService.getMyQuota().subscribe({
      next: (quota) => {
        this.quota = quota;
        this.loadingQuota = false;
        setTimeout(() => {
          this.updateQuotaChart();
        }, 100);
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
    // Pour les statistiques de l'organisation, on calcule à partir des logs d'utilisation
    // qui sont déjà chargés dans loadOrganizationUsageLogs()
    // On recalcule les stats à partir des logs existants
    this.calculateStatsFromLogs();
    this.loadingStats = false;
  }

  private calculateStatsFromLogs() {
    if (!this.organizationUsageLogs || !this.organizationUsageLogs.usageLogs) {
      this.stats = {
        totalRequests: 0,
        totalCostUsd: 0,
        totalTokens: 0,
        monthlyRequests: 0,
        recentUsage: []
      };
      return;
    }

    const logs: OrganizationUsageLog[] = this.organizationUsageLogs.usageLogs;
    
    // Calculer les statistiques globales
    const totalRequests = logs.length;
    const totalCostUsd = logs.reduce((sum: number, log: OrganizationUsageLog) => sum + (log.totalCostUsd || 0), 0);
    const totalTokens = logs.reduce((sum: number, log: OrganizationUsageLog) => sum + (log.tokensUsed || 0), 0);
    
    // Calculer les requêtes du mois en cours
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRequests = logs.filter((log: OrganizationUsageLog) => {
      const logDate = new Date(log.timestamp);
      return logDate >= startOfMonth;
    }).length;

    // Utilisations récentes (10 dernières)
    const recentUsage = logs
      .slice()
      .sort((a: OrganizationUsageLog, b: OrganizationUsageLog) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
      .map((log: OrganizationUsageLog) => ({
        id: log.id,
        endpoint: log.endpoint,
        searchTerm: log.searchTerm,
        tokensUsed: log.tokensUsed || 0,
        costUsd: log.totalCostUsd || 0,
        timestamp: log.timestamp
      }));

    this.stats = {
      totalRequests,
      totalCostUsd,
      totalTokens,
      monthlyRequests,
      recentUsage
    };
  }

  loadOrganizationUsageLogs() {
    this.loadingUsageLogs = true;
    const startDate = this.startDate || undefined;
    const endDate = this.endDate || undefined;
    this.organizationAccountService.getOrganizationUsageLogs(startDate, endDate).subscribe({
      next: (logs) => {
        this.organizationUsageLogs = logs;
        this.loadingUsageLogs = false;
        // Recalculer les statistiques après le chargement des logs
        this.calculateStatsFromLogs();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des logs d\'utilisation de l\'organisation:', err);
        this.loadingUsageLogs = false;
        // Réinitialiser les stats en cas d'erreur
        this.calculateStatsFromLogs();
      }
    });
  }

  updateQuotaChart() {
    if (!this.quota || !this.quota.hasOrganization || this.quota.isUnlimited) {
      return;
    }

    const used = this.quota.currentUsage || 0;
    const total = this.quota.monthlyQuota || 1;
    const remaining = Math.max(0, total - used);
    const percentage = this.quota.percentageUsed || 0;

    let usedColor = 'rgba(46, 204, 113, 0.8)';
    if (percentage >= 100) {
      usedColor = 'rgba(231, 76, 60, 0.8)';
    } else if (percentage >= 80) {
      usedColor = 'rgba(243, 156, 18, 0.8)';
    }

    if (this.quotaChart) {
      this.quotaChart.destroy();
    }

    const config: ChartConfiguration = {
      type: 'doughnut',
      data: {
        labels: ['Utilisé', 'Restant'],
        datasets: [{
          data: [used, remaining],
          backgroundColor: [usedColor, 'rgba(189, 195, 199, 0.3)'],
          borderColor: [usedColor, 'rgba(189, 195, 199, 0.5)'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              font: { size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = used + remaining;
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                return `${label}: ${value} requêtes (${percentage}%)`;
              }
            }
          }
        }
      }
    };

    // Note: quotaChartRef would need to be added with @ViewChild
    // For now, we'll skip the chart rendering
  }

  onFilterChange() {
    // Recharger les logs d'utilisation qui recalculeront automatiquement les stats
    this.loadOrganizationUsageLogs();
  }

  resetFilters() {
    this.startDate = '';
    this.endDate = '';
    // Recharger les logs d'utilisation qui recalculeront automatiquement les stats
    this.loadOrganizationUsageLogs();
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  formatCurrency(amount: number): string {
    if (amount == null || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  }

  formatCost(amount: number): string {
    if (amount == null || isNaN(amount)) return '0.00000';
    return new Intl.NumberFormat('fr-FR', { 
      minimumFractionDigits: 5, 
      maximumFractionDigits: 5 
    }).format(amount);
  }

  formatNumber(num: number): string {
    if (num == null || isNaN(num)) return '0';
    return new Intl.NumberFormat('fr-FR').format(num);
  }

  truncateSearchTerm(term: string): string {
    if (term.length > 50) {
      return term.substring(0, 47) + '...';
    }
    return term;
  }
}

