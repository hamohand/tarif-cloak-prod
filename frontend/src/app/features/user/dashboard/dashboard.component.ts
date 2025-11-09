import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, UserUsageStats, UserQuota, Organization } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

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

      <!-- Quota -->
      <div class="quota-card" *ngIf="quota || loadingQuota">
        <h3>📈 Mon Quota Mensuel</h3>
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
                  @if (quota.personalUsage !== undefined) {
                    <p class="quota-usage">Mon utilisation personnelle: {{ quota.personalUsage }} requêtes</p>
                  }
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
                    @if (quota.personalUsage !== undefined) {
                      <span class="quota-usage-text">• Mon utilisation: {{ quota.personalUsage }} requêtes</span>
                    }
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
        <h3>📊 Mes Statistiques</h3>
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
              <input type="date" id="startDate" [(ngModel)]="startDate" (change)="loadStats()" />
            </div>
            <div class="filter-group">
              <label for="endDate">Date de fin:</label>
              <input type="date" id="endDate" [(ngModel)]="endDate" (change)="loadStats()" />
            </div>
            <button class="btn btn-secondary" (click)="resetFilters()">Réinitialiser</button>
          </div>

          <!-- Graphique d'utilisation récente -->
          @if (stats.recentUsage && stats.recentUsage.length > 0) {
            <div class="chart-section">
              <h4>📊 Évolution de Mon Utilisation</h4>
              <div class="chart-wrapper">
                <canvas #usageChart></canvas>
              </div>
            </div>
          }

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

      <!-- Message d'erreur -->
      @if (errorMessage) {
        <div class="error-message">{{ errorMessage }}</div>
      }
    </div>
  `,
  styles: [`
    .dashboard-container {
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

    .user-info-card,
    .organization-card,
    .quota-card,
    .stats-card {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .org-details p,
    .user-info-card p {
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
      background: white;
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
      background: #f8f9fa;
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
      background: white;
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
  `]
})
export class UserDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private userService = inject(UserService);
  private authService = inject(AuthService);

  @ViewChild('quotaChart', { static: false }) quotaChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('usageChart', { static: false }) usageChartRef!: ElementRef<HTMLCanvasElement>;

  userInfo: any;
  organization: Organization | null = null;
  quota: UserQuota | null = null;
  stats: UserUsageStats | null = null;

  loadingOrg = false;
  loadingQuota = false;
  loadingStats = false;
  errorMessage = '';

  startDate = '';
  endDate = '';

  private quotaChart: Chart | null = null;
  private usageChart: Chart | null = null;

  ngOnInit() {
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
        // Mettre à jour le graphique du quota
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
    const startDate = this.startDate || undefined;
    const endDate = this.endDate || undefined;
    this.userService.getMyUsageStats(startDate, endDate).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.loadingStats = false;
        // Mettre à jour le graphique d'utilisation
        setTimeout(() => {
          this.updateUsageChart();
        }, 100);
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du chargement des statistiques: ' + (err.error?.message || err.message);
        this.loadingStats = false;
      }
    });
  }

  ngAfterViewInit() {
    // Les graphiques seront créés après le chargement des données
  }

  ngOnDestroy() {
    // Détruire les graphiques pour éviter les fuites mémoire
    if (this.quotaChart) {
      this.quotaChart.destroy();
    }
    if (this.usageChart) {
      this.usageChart.destroy();
    }
  }

  updateQuotaChart() {
    if (!this.quota || !this.quota.hasOrganization || this.quota.isUnlimited || !this.quotaChartRef) {
      return;
    }

    const used = this.quota.currentUsage || 0;
    const total = this.quota.monthlyQuota || 1;
    const remaining = Math.max(0, total - used);
    const percentage = this.quota.percentageUsed || 0;

    // Déterminer les couleurs selon le pourcentage
    let usedColor = 'rgba(46, 204, 113, 0.8)'; // Vert
    if (percentage >= 100) {
      usedColor = 'rgba(231, 76, 60, 0.8)'; // Rouge
    } else if (percentage >= 80) {
      usedColor = 'rgba(243, 156, 18, 0.8)'; // Orange
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
          backgroundColor: [
            usedColor,
            'rgba(189, 195, 199, 0.3)'
          ],
          borderColor: [
            usedColor,
            'rgba(189, 195, 199, 0.5)'
          ],
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
              font: {
                size: 12
              }
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

    this.quotaChart = new Chart(this.quotaChartRef.nativeElement, config);
  }

  updateUsageChart() {
    if (!this.stats || !this.stats.recentUsage || this.stats.recentUsage.length === 0 || !this.usageChartRef) {
      return;
    }

    // Prendre les 10 dernières utilisations et les trier par date
    const recentUsage = [...this.stats.recentUsage]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-10);

    const labels = recentUsage.map(usage => {
      const date = new Date(usage.timestamp);
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    });

    const costData = recentUsage.map(usage => usage.costUsd || 0);
    const tokensData = recentUsage.map(usage => usage.tokensUsed || 0);

    if (this.usageChart) {
      this.usageChart.destroy();
    }

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Coût (USD)',
            data: costData,
            borderColor: 'rgba(52, 152, 219, 1)',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            tension: 0.4,
            fill: true,
            yAxisID: 'y'
          },
          {
            label: 'Tokens',
            data: tokensData,
            borderColor: 'rgba(46, 204, 113, 1)',
            backgroundColor: 'rgba(46, 204, 113, 0.1)',
            tension: 0.4,
            fill: true,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              padding: 15,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                if (label.includes('Coût')) {
                  return `${label}: ${this.formatCurrency(value)}`;
                } else {
                  return `${label}: ${this.formatNumber(value)}`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Date'
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Coût (USD)'
            },
            ticks: {
              callback: (value) => {
                return '$' + Number(value).toFixed(6);
              }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Tokens'
            },
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    };

    this.usageChart = new Chart(this.usageChartRef.nativeElement, config);
  }

  resetFilters() {
    this.startDate = '';
    this.endDate = '';
    this.loadStats();
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(amount);
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
}

