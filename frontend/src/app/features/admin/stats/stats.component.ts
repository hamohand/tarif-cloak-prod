import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, UsageStats, OrganizationStats, UserStats, UsageLog, Organization } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { take } from 'rxjs/operators';

Chart.register(...registerables);

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="stats-container">
      <h2>📊 Statistiques d'Utilisation</h2>

      <!-- Filtres -->
      <div class="filters-card">
        <h3>Filtres</h3>
        <div class="filters">
          <div class="filter-group">
            <label for="organizationId">Organisation:</label>
            <select id="organizationId" [ngModel]="selectedOrganizationId" (ngModelChange)="onOrganizationChange($event)" [disabled]="organizationsLoading">
              <option [ngValue]="null">Toutes</option>
              <option *ngFor="let org of organizations" [ngValue]="org.id">{{ org.name }}</option>
            </select>
            <span *ngIf="organizationsLoading" class="loading-text">Chargement...</span>
          </div>
          <div class="filter-group">
            <label for="startDate">Date de début:</label>
            <input type="date" id="startDate" [(ngModel)]="startDate" (change)="loadStats()" />
          </div>
          <div class="filter-group">
            <label for="endDate">Date de fin:</label>
            <input type="date" id="endDate" [(ngModel)]="endDate" (change)="loadStats()" />
          </div>
          <button class="btn-reset" (click)="resetFilters()">Réinitialiser</button>
        </div>
      </div>

      <!-- Statistiques globales -->
      <div class="stats-grid">
        <div class="stat-card">
          <h4>📈 Crédits Total</h4>
          <p class="stat-value">{{ stats?.totalRequests || 0 }}</p>
        </div>
        <div class="stat-card">
          <h4>💰 Coût Total</h4>
          <p class="stat-value">{{ formatCurrency(stats?.totalCostUsd || 0) }}</p>
        </div>
        <div class="stat-card">
          <h4>🔢 Tokens Total</h4>
          <p class="stat-value">{{ formatNumber(stats?.totalTokens || 0) }}</p>
        </div>
      </div>

      <!-- Statistiques par entreprise -->
      <div class="section-card">
        <h3>🏢 Par Entreprise</h3>
        <div *ngIf="statsByOrganization.length > 0; else noOrgStats">
          <!-- Graphiques -->
          <div class="charts-container">
            <div class="chart-wrapper">
              <h4>Crédits par Organisation</h4>
              <canvas #requestsChart></canvas>
            </div>
            <div class="chart-wrapper">
              <h4>Coûts par Organisation</h4>
              <canvas #costsChart></canvas>
            </div>
          </div>
          <!-- Tableau -->
          <table class="stats-table">
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Crédits</th>
                <th>Coût (€)</th>
                <th>Tokens</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let org of statsByOrganization">
                <td>{{ org.organizationName }}</td>
                <td>{{ org.requestCount }}</td>
                <td>{{ formatCurrency(org.totalCostUsd) }}</td>
                <td>{{ formatNumber(org.totalTokens) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ng-template #noOrgStats>
          <p class="no-data">Aucune statistique disponible pour les entreprises.</p>
        </ng-template>
      </div>

      <!-- Statistiques par utilisateur -->
      <div class="section-card">
        <h3>👤 Par Utilisateur</h3>
        <div *ngIf="statsByUser.length > 0; else noUserStats">
          <!-- Graphique Top Utilisateurs -->
          <div class="chart-wrapper">
            <h4>Top 10 Utilisateurs (par requêtes)</h4>
            <canvas #usersChart></canvas>
          </div>
          <!-- Tableau -->
          <table class="stats-table">
            <thead>
              <tr>
                <th>Utilisateur ID</th>
                <th>Nom d'utilisateur</th>
                <th>Crédits</th>
                <th>Coût (€)</th>
                <th>Tokens</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let user of statsByUser">
                <td>{{ truncateUserId(user.keycloakUserId) }}</td>
                <td><strong>{{ user.username || 'N/A' }}</strong></td>
                <td>{{ user.requestCount }}</td>
                <td>{{ formatCurrency(user.totalCostUsd) }}</td>
                <td>{{ formatNumber(user.totalTokens) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ng-template #noUserStats>
          <p class="no-data">Aucune statistique disponible pour les utilisateurs.</p>
        </ng-template>
      </div>

      <!-- Utilisations récentes -->
      <div class="section-card">
        <h3>🕐 Utilisations Récentes</h3>
        <div *ngIf="recentUsage.length > 0; else noRecentUsage">
          <table class="stats-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Utilisateur ID</th>
                <th>Nom d'utilisateur</th>
                <th>Endpoint</th>
                <th>Terme de recherche</th>
                <th>Coût (€)</th>
                @if (isAdmin()) {
                      <th>Tokens</th>
                    }
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let usage of recentUsage">
                <td>{{ formatDate(usage.timestamp) }}</td>
                <td>{{ truncateUserId(usage.keycloakUserId) }}</td>
                <td><strong>{{ usage.username || 'N/A' }}</strong></td>
                <td>{{ usage.endpoint }}</td>
                <td>{{ usage.searchTerm }}</td>
                <td>{{ formatCurrency(usage.costUsd || 0) }}</td>
                @if (isAdmin()) {
                    <td>{{ formatNumber(usage.tokensUsed) }}</td>
                  }
              </tr>
            </tbody>
          </table>
        </div>
        <ng-template #noRecentUsage>
          <p class="no-data">Aucune utilisation récente.</p>
        </ng-template>
      </div>

      <!-- Message de chargement -->
      <div *ngIf="loading" class="loading">
        <p>Chargement des statistiques...</p>
      </div>

      <!-- Message d'erreur -->
      <div *ngIf="error" class="error">
        <p>{{ error }}</p>
      </div>

      <!-- Message d'erreur pour les organisations -->
      <div *ngIf="organizationsError" class="error">
        <p>⚠️ {{ organizationsError }}</p>
      </div>

      <!-- Message d'information sur les organisations -->
      <div *ngIf="organizations.length === 0 && !organizationsLoading && !organizationsError" class="info">
        <p>⚠️ Aucune organisation trouvée. Créez des organisations depuis la page "Organisations".</p>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --neu-bg: var(--neu-bg, #E0E5EC);
      --neu-extruded: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      --neu-extruded-sm: var(--neu-extruded-sm, 4px 4px 8px rgba(163,177,198,0.6), -4px -4px 8px rgba(255,255,255,0.5));
      --neu-extruded-hover: var(--neu-extruded-hover, 12px 12px 20px rgba(163,177,198,0.6), -12px -12px 20px rgba(255,255,255,0.5));
      --neu-inset: var(--neu-inset, inset 4px 4px 8px rgba(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.5));
      --neu-inset-deep: var(--neu-inset-deep, inset 6px 6px 12px rgba(163,177,198,0.6), inset -6px -6px 12px rgba(255,255,255,0.5));
      --neu-radius-container: var(--neu-radius-container, 32px);
      --neu-radius-inner: var(--neu-radius-inner, 12px);
      --neu-accent: var(--neu-accent, #6C63FF);
      --neu-accent-secondary: var(--neu-accent-secondary, #38B2AC);
      --neu-accent-danger: var(--neu-accent-danger, #E53E3E);
      --neu-accent-warning: var(--neu-accent-warning, #ED8936);
      --neu-text-primary: var(--neu-text-primary, #3D4852);
      --neu-text-muted: var(--neu-text-muted, #6B7280);
      --neu-text-heading: var(--neu-text-heading, #2D3748);
      --font-display: var(--font-display, 'Inter', sans-serif);
    }

    .stats-container {
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
      background: var(--neu-bg);
      min-height: 100vh;
    }

    h2 {
      color: var(--neu-text-heading);
      margin-bottom: 2rem;
      font-family: var(--font-display);
    }

    h3 {
      color: var(--neu-text-heading);
      margin-top: 0;
      margin-bottom: 1rem;
      font-family: var(--font-display);
    }

    .filters-card {
      background: var(--neu-bg);
      padding: 1.5rem;
      border-radius: var(--neu-radius-container);
      margin-bottom: 2rem;
      box-shadow: var(--neu-inset);
    }

    .filters {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      align-items: end;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .filter-group label {
      font-weight: 500;
      color: var(--neu-text-muted);
    }

    .filter-group input,
    .filter-group select {
      padding: 0.625rem 0.75rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 1rem;
      color: var(--neu-text-primary);
      min-height: 44px;
      transition: box-shadow 0.2s ease;
    }

    .filter-group input:focus,
    .filter-group select:focus {
      outline: none;
      box-shadow: var(--neu-inset-deep), 0 0 0 2px var(--neu-accent);
    }

    .filter-group select[disabled] {
      background: var(--neu-bg);
      opacity: 0.5;
      cursor: not-allowed;
    }

    .loading-text {
      font-size: 0.875rem;
      color: var(--neu-text-muted);
      margin-left: 0.5rem;
    }

    .btn-reset {
      padding: 0.625rem 1.25rem;
      background: var(--neu-bg);
      color: var(--neu-text-muted);
      border: none;
      border-radius: var(--neu-radius-inner);
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      box-shadow: var(--neu-extruded-sm);
      min-height: 44px;
      transition: box-shadow 0.2s ease;
    }

    .btn-reset:hover {
      box-shadow: var(--neu-extruded);
    }

    .btn-reset:active {
      box-shadow: var(--neu-inset);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      padding: 1.5rem;
      border-radius: var(--neu-radius-container);
      box-shadow: var(--neu-extruded);
      text-align: center;
    }

    .stat-card h4 {
      color: var(--neu-text-muted);
      margin-bottom: 0.5rem;
      font-size: 1rem;
      font-family: var(--font-display);
    }

    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: var(--neu-accent);
      margin: 0;
      font-family: var(--font-display);
    }

    .section-card {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      padding: 1.5rem;
      border-radius: var(--neu-radius-container);
      box-shadow: var(--neu-extruded);
      margin-bottom: 2rem;
    }

    .charts-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 2rem;
      margin-bottom: 2rem;
    }

    .chart-wrapper {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      padding: 1.5rem;
      border-radius: var(--neu-radius-container);
      box-shadow: var(--neu-extruded);
    }

    .chart-wrapper h4 {
      margin: 0 0 1rem 0;
      color: var(--neu-text-heading);
      font-size: 1.1rem;
      font-family: var(--font-display);
    }

    .chart-wrapper canvas {
      max-height: 300px;
    }

    .stats-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0 0.5rem;
      margin-top: 1rem;
    }

    .stats-table th {
      padding: 0.75rem 1rem;
      text-align: left;
      font-weight: 600;
      color: var(--neu-text-muted);
      background: transparent;
    }

    .stats-table td {
      padding: 0.75rem 1rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-extruded-sm);
      color: var(--neu-text-primary);
    }

    .stats-table td:first-child {
      border-radius: var(--neu-radius-inner) 0 0 var(--neu-radius-inner);
    }

    .stats-table td:last-child {
      border-radius: 0 var(--neu-radius-inner) var(--neu-radius-inner) 0;
    }

    .stats-table tr:hover td {
      box-shadow: var(--neu-extruded);
    }

    .no-data {
      color: var(--neu-text-muted);
      font-style: italic;
      margin-top: 1rem;
    }

    .loading {
      text-align: center;
      padding: 2rem;
      color: var(--neu-accent);
    }

    .error {
      background: var(--neu-bg);
      color: var(--neu-accent-danger);
      padding: 1rem 1.5rem;
      border-radius: var(--neu-radius-inner);
      margin-top: 1rem;
      box-shadow: var(--neu-extruded-sm);
    }

    .info {
      background: var(--neu-bg);
      color: var(--neu-accent);
      padding: 1rem 1.5rem;
      border-radius: var(--neu-radius-inner);
      margin-top: 1rem;
      box-shadow: var(--neu-extruded-sm);
    }

    @media (max-width: 768px) {
      .stats-container {
        padding: 1rem;
      }

      .filters {
        flex-direction: column;
      }

      .filter-group {
        width: 100%;
      }

      .stats-table {
        font-size: 0.9rem;
      }

      .stats-table th,
      .stats-table td {
        padding: 0.5rem 0.75rem;
      }

      .charts-container {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 1024px) {
      .charts-container {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class StatsComponent implements OnInit, AfterViewInit, OnDestroy {
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private currencyService = inject(CurrencyService);
  
  private currentCurrencyCode = 'EUR'; // Par défaut, sera mis à jour dans ngOnInit
  private currentCurrencySymbol = '€'; // Par défaut, sera mis à jour dans ngOnInit

  @ViewChild('requestsChart', { static: false }) requestsChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('costsChart', { static: false }) costsChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('usersChart', { static: false }) usersChartRef!: ElementRef<HTMLCanvasElement>;

  stats: UsageStats | null = null;
  organizations: Organization[] = [];
  selectedOrganizationId: number | null = null;
  startDate: string = '';
  endDate: string = '';
  loading = false;
  error: string | null = null;
  organizationsError: string | null = null;
  organizationsLoading = false;

  private requestsChart: Chart | null = null;
  private costsChart: Chart | null = null;
  private usersChart: Chart | null = null;

  ngOnInit() {
    // Charger la devise du marché
    this.currencyService.getCurrencyCode().pipe(take(1)).subscribe({
      next: (code: string) => {
        this.currentCurrencyCode = code;
        this.currentCurrencySymbol = this.currencyService.getSymbolForCurrency(code);
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement de la devise:', err);
      }
    });
    
    this.loadOrganizations();
    this.loadStats();
  }

  ngAfterViewInit() {
    // Les graphiques seront créés après le chargement des données
  }

  ngOnDestroy() {
    // Détruire les graphiques pour éviter les fuites mémoire
    if (this.requestsChart) {
      this.requestsChart.destroy();
    }
    if (this.costsChart) {
      this.costsChart.destroy();
    }
    if (this.usersChart) {
      this.usersChart.destroy();
    }
  }

  loadOrganizations() {
    this.organizationsLoading = true;
    this.organizationsError = null;
    
    this.adminService.getOrganizations().subscribe({
      next: (orgs) => {
        console.log('Organisations chargées:', orgs);
        this.organizations = orgs || [];
        this.organizationsLoading = false;
        if (this.organizations.length === 0) {
          console.warn('Aucune organisation trouvée. Vérifiez que vous avez le rôle ADMIN et que des organisations existent.');
          this.organizationsError = 'Aucune organisation trouvée. Vérifiez que vous avez le rôle ADMIN et que des organisations existent dans la base de données.';
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement des organisations:', err);
        this.organizationsLoading = false;
        this.organizations = [];
        
        // Déterminer le message d'erreur approprié
        if (err.status === 403) {
          this.organizationsError = 'Accès refusé. Vous devez avoir le rôle ADMIN pour voir les organisations.';
          console.error('Accès refusé. Vérifiez que vous avez le rôle ADMIN.');
        } else if (err.status === 401) {
          this.organizationsError = 'Non authentifié. Veuillez vous reconnecter.';
          console.error('Non authentifié. Vérifiez votre token JWT.');
        } else if (err.status === 0) {
          this.organizationsError = 'Impossible de se connecter au backend. Vérifiez que le backend est démarré.';
          console.error('Impossible de se connecter au backend. Vérifiez que le backend est démarré.');
        } else {
          this.organizationsError = `Erreur lors du chargement des organisations: ${err.message || err.statusText || 'Erreur inconnue'}`;
        }
      }
    });
  }

  onOrganizationChange(value: number | null) {
    // S'assurer que null est bien traité comme null et non comme chaîne
    this.selectedOrganizationId = value;
    this.loadStats();
  }

  loadStats() {
    this.loading = true;
    this.error = null;

    // Convertir null en undefined pour éviter qu'il soit envoyé comme chaîne "null"
    const orgId = (this.selectedOrganizationId !== null && this.selectedOrganizationId !== undefined) 
      ? this.selectedOrganizationId 
      : undefined;
    const start = (this.startDate && this.startDate.trim() !== '') ? this.startDate : undefined;
    const end = (this.endDate && this.endDate.trim() !== '') ? this.endDate : undefined;

    this.adminService.getUsageStats(orgId, start, end).subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
        // Mettre à jour les graphiques après le chargement des données
        setTimeout(() => {
          this.updateCharts();
        }, 100);
      },
      error: (err) => {
        this.error = err.message || 'Une erreur est survenue';
        this.loading = false;
        console.error('Erreur lors du chargement des statistiques:', err);
      }
    });
  }

  updateCharts() {
    if (this.stats) {
      this.createOrganizationCharts();
      this.createUsersChart();
    }
  }

  createOrganizationCharts() {
    const orgStats = this.statsByOrganization;
    if (orgStats.length === 0 || !this.requestsChartRef || !this.costsChartRef) {
      return;
    }

    const labels = orgStats.map(org => org.organizationName);
    const requestData = orgStats.map(org => org.requestCount);
    const costData = orgStats.map(org => org.totalCostUsd);

    // Graphique des requêtes
    if (this.requestsChart) {
      this.requestsChart.destroy();
    }
    const requestsConfig: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Requêtes',
          data: requestData,
          backgroundColor: 'rgba(52, 152, 219, 0.6)',
          borderColor: 'rgba(52, 152, 219, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    };
    this.requestsChart = new Chart(this.requestsChartRef.nativeElement, requestsConfig);

    // Graphique des coûts
    if (this.costsChart) {
      this.costsChart.destroy();
    }
    const costsConfig: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Coût (€)',
          data: costData,
          backgroundColor: 'rgba(46, 204, 113, 0.6)',
          borderColor: 'rgba(46, 204, 113, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                if (value === null || value === undefined) {
                  return 'Coût: 0,000000 €';
                }
                return `Coût: ${this.formatCurrency(value)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => {
                return Number(value).toFixed(6) + ' €';
              }
            }
          }
        }
      }
    };
    this.costsChart = new Chart(this.costsChartRef.nativeElement, costsConfig);
  }

  createUsersChart() {
    const userStats = this.statsByUser;
    if (userStats.length === 0 || !this.usersChartRef) {
      return;
    }

    // Prendre les top 10 utilisateurs
    const topUsers = userStats
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10);

    const labels = topUsers.map(user => this.truncateUserId(user.keycloakUserId));
    const requestData = topUsers.map(user => user.requestCount);

    if (this.usersChart) {
      this.usersChart.destroy();
    }
    const usersConfig: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Requêtes',
          data: requestData,
          backgroundColor: 'rgba(155, 89, 182, 0.6)',
          borderColor: 'rgba(155, 89, 182, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        indexAxis: 'y', // Graphique horizontal
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: false
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    };
    this.usersChart = new Chart(this.usersChartRef.nativeElement, usersConfig);
  }

  resetFilters() {
    this.selectedOrganizationId = null;
    this.startDate = '';
    this.endDate = '';
    this.loadStats();
  }

  formatCurrency(value: number): string {
    if (value == null || isNaN(value)) return '0.00';
    
    // Utiliser la devise du marché stockée dans currentCurrencyCode
    // Pour DZD et MAD, le symbole est placé après le montant
    if (this.currentCurrencyCode === 'DZD' || this.currentCurrencyCode === 'MAD') {
      return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${this.currentCurrencySymbol}`;
    }
    
    // Pour les autres devises, utiliser Intl.NumberFormat ou le symbole avant
    try {
      return new Intl.NumberFormat('fr-FR', { 
        style: 'currency', 
        currency: this.currentCurrencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    } catch (e) {
      // Si la devise n'est pas supportée par Intl, utiliser le symbole manuellement
      return `${this.currentCurrencySymbol}${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  truncateUserId(userId: string): string {
    if (userId.length > 20) {
      return userId.substring(0, 20) + '...';
    }
    return userId;
  }

  // Getters sécurisés pour éviter les erreurs TypeScript
  get statsByOrganization(): OrganizationStats[] {
    return this.stats?.statsByOrganization || [];
  }

  get statsByUser(): UserStats[] {
    return this.stats?.statsByUser || [];
  }

  get recentUsage(): UsageLog[] {
    return this.stats?.recentUsage || [];
  }

  isAdmin(): boolean {
    return this.authService.hasRole('ADMIN');
  }
}

