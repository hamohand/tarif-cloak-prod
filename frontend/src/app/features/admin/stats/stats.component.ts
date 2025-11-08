import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, UsageStats, OrganizationStats, UserStats, UsageLog, Organization } from '../../../core/services/admin.service';
import { FormsModule } from '@angular/forms';

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
            <select id="organizationId" [ngModel]="selectedOrganizationId" (ngModelChange)="onOrganizationChange($event)">
              <option [ngValue]="null">Toutes</option>
              <option *ngFor="let org of organizations" [ngValue]="org.id">{{ org.name }}</option>
            </select>
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
          <h4>📈 Requêtes Total</h4>
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
          <table class="stats-table">
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Requêtes</th>
                <th>Coût (USD)</th>
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
          <table class="stats-table">
            <thead>
              <tr>
                <th>Utilisateur ID</th>
                <th>Requêtes</th>
                <th>Coût (USD)</th>
                <th>Tokens</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let user of statsByUser">
                <td>{{ truncateUserId(user.keycloakUserId) }}</td>
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
                <th>Utilisateur</th>
                <th>Endpoint</th>
                <th>Terme de recherche</th>
                <th>Coût (USD)</th>
                <th>Tokens</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let usage of recentUsage">
                <td>{{ formatDate(usage.timestamp) }}</td>
                <td>{{ truncateUserId(usage.keycloakUserId) }}</td>
                <td>{{ usage.endpoint }}</td>
                <td>{{ usage.searchTerm }}</td>
                <td>{{ formatCurrency(usage.costUsd || 0) }}</td>
                <td>{{ usage.tokensUsed }}</td>
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
        <p>Erreur lors du chargement des statistiques: {{ error }}</p>
      </div>
    </div>
  `,
  styles: [`
    .stats-container {
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    h2 {
      color: #2c3e50;
      margin-bottom: 2rem;
    }

    h3 {
      color: #34495e;
      margin-top: 0;
      margin-bottom: 1rem;
    }

    .filters-card {
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
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
      color: #555;
    }

    .filter-group input,
    .filter-group select {
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
    }

    .btn-reset {
      padding: 0.5rem 1rem;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }

    .btn-reset:hover {
      background: #5a6268;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: #f5f5f5;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }

    .stat-card h4 {
      color: #2c3e50;
      margin-bottom: 0.5rem;
      font-size: 1rem;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: #3498db;
      margin: 0;
    }

    .section-card {
      background: #f5f5f5;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }

    .stats-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
    }

    .stats-table th {
      background: #f8f9fa;
      padding: 0.75rem;
      text-align: left;
      font-weight: 600;
      color: #2c3e50;
      border-bottom: 2px solid #dee2e6;
    }

    .stats-table td {
      padding: 0.75rem;
      border-bottom: 1px solid #dee2e6;
    }

    .stats-table tr:hover {
      background: #f8f9fa;
    }

    .no-data {
      color: #6c757d;
      font-style: italic;
      margin-top: 1rem;
    }

    .loading {
      text-align: center;
      padding: 2rem;
      color: #3498db;
    }

    .error {
      background: #f8d7da;
      color: #721c24;
      padding: 1rem;
      border-radius: 4px;
      margin-top: 1rem;
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
        padding: 0.5rem;
      }
    }
  `]
})
export class StatsComponent implements OnInit {
  private adminService = inject(AdminService);

  stats: UsageStats | null = null;
  organizations: Organization[] = [];
  selectedOrganizationId: number | null = null;
  startDate: string = '';
  endDate: string = '';
  loading = false;
  error: string | null = null;

  ngOnInit() {
    this.loadOrganizations();
    this.loadStats();
  }

  loadOrganizations() {
    this.adminService.getOrganizations().subscribe({
      next: (orgs) => {
        this.organizations = orgs;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des organisations:', err);
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
      },
      error: (err) => {
        this.error = err.message || 'Une erreur est survenue';
        this.loading = false;
        console.error('Erreur lors du chargement des statistiques:', err);
      }
    });
  }

  resetFilters() {
    this.selectedOrganizationId = null;
    this.startDate = '';
    this.endDate = '';
    this.loadStats();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 6,
      maximumFractionDigits: 6
    }).format(value);
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
}

