import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { InvoiceService, Invoice, GenerateInvoiceRequest, UpdateInvoiceStatusRequest } from '../../../core/services/invoice.service';
import { AdminService, Organization } from '../../../core/services/admin.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-invoices-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="invoices-admin-container">
      <div class="invoices-header">
        <h2>📄 Gestion des Factures (Admin)</h2>
        <p class="subtitle">Gérez toutes les factures et générez de nouvelles factures</p>
      </div>

      <!-- Actions -->
      <div class="actions-bar">
        <button class="btn btn-primary" (click)="showGenerateForm = !showGenerateForm">
          + Générer une facture
        </button>
        <button class="btn btn-secondary" (click)="showGenerateAllForm = !showGenerateAllForm">
          📦 Générer toutes les factures mensuelles
        </button>
      </div>

      <!-- Formulaire de génération de facture -->
      @if (showGenerateForm) {
        <div class="form-card">
          <h3>Générer une facture</h3>
          <form (ngSubmit)="generateInvoice()">
            <div class="form-group">
              <label for="organizationId">Organisation *</label>
              <select id="organizationId" [(ngModel)]="generateRequest.organizationId" name="organizationId" required>
                <option [ngValue]="null">Sélectionner une organisation</option>
                @for (org of organizations; track org.id) {
                  <option [ngValue]="org.id">{{ org.name }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label for="periodStart">Date de début *</label>
              <input type="date" id="periodStart" [(ngModel)]="generateRequest.periodStart" name="periodStart" required />
            </div>
            <div class="form-group">
              <label for="periodEnd">Date de fin *</label>
              <input type="date" id="periodEnd" [(ngModel)]="generateRequest.periodEnd" name="periodEnd" required />
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="generating">Générer</button>
              <button type="button" class="btn btn-secondary" (click)="cancelGenerate()">Annuler</button>
            </div>
          </form>
        </div>
      }

      <!-- Formulaire de génération mensuelle pour toutes les organisations -->
      @if (showGenerateAllForm) {
        <div class="form-card">
          <h3>Générer les factures mensuelles pour toutes les organisations</h3>
          <form (ngSubmit)="generateAllMonthlyInvoices()">
            <div class="form-group">
              <label for="generateYear">Année *</label>
              <input type="number" id="generateYear" [(ngModel)]="generateYear" name="generateYear" 
                     [value]="currentYear" min="2020" max="2100" required />
            </div>
            <div class="form-group">
              <label for="generateMonth">Mois *</label>
              <select id="generateMonth" [(ngModel)]="generateMonth" name="generateMonth" required>
                @for (month of months; track month.value) {
                  <option [ngValue]="month.value">{{ month.label }}</option>
                }
              </select>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="generatingAll">Générer</button>
              <button type="button" class="btn btn-secondary" (click)="cancelGenerateAll()">Annuler</button>
            </div>
          </form>
        </div>
      }

      <!-- Filtres et recherche -->
      <div class="filters-bar">
        <div class="search-group">
          <input type="text" 
                 [(ngModel)]="searchTerm" 
                 (input)="applyFilters()" 
                 placeholder="Rechercher par numéro, organisation..." 
                 class="search-input" />
        </div>
        <div class="filter-group">
          <label for="statusFilter">Statut :</label>
          <select id="statusFilter" [(ngModel)]="statusFilter" (change)="applyFilters()" class="filter-select">
            <option [ngValue]="null">Tous</option>
            <option value="DRAFT">Brouillon</option>
            <option value="PENDING">En attente</option>
            <option value="PAID">Payée</option>
            <option value="OVERDUE">En retard</option>
            <option value="CANCELLED">Annulée</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="organizationFilter">Organisation :</label>
          <select id="organizationFilter" [(ngModel)]="organizationFilter" (change)="applyFilters()" class="filter-select">
            <option [ngValue]="null">Toutes</option>
            @for (org of organizations; track org.id) {
              <option [ngValue]="org.id">{{ org.name }}</option>
            }
          </select>
        </div>
        <div class="filter-group">
          <label for="dateFrom">Du :</label>
          <input type="date" id="dateFrom" [(ngModel)]="dateFrom" (change)="applyFilters()" class="filter-input" />
        </div>
        <div class="filter-group">
          <label for="dateTo">Au :</label>
          <input type="date" id="dateTo" [(ngModel)]="dateTo" (change)="applyFilters()" class="filter-input" />
        </div>
        <div class="actions-group">
          <button class="btn btn-secondary" (click)="resetFilters()">Réinitialiser</button>
          <button class="btn btn-secondary" (click)="exportToCsv()">📊 Export CSV</button>
          <button class="btn btn-secondary" (click)="exportToExcel()">📈 Export Excel</button>
        </div>
      </div>

      <!-- Liste des factures -->
      @if (loading) {
        <div class="loading">
          <p>Chargement des factures...</p>
        </div>
      } @else if (error) {
        <div class="error">
          <p>❌ {{ error }}</p>
        </div>
      } @else if (paginatedInvoices.length === 0) {
        <div class="no-invoices">
          <p>📄 Aucune facture trouvée.</p>
        </div>
      } @else {
        <!-- Informations de pagination -->
        <div class="pagination-info">
          <p>Affichage de {{ getStartIndex() }} à {{ getEndIndex() }} sur {{ filteredInvoices.length }} facture(s)</p>
        </div>

        <!-- Tableau des factures -->
        <div class="invoices-table-wrapper">
          <table class="invoices-table">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Organisation</th>
                <th>Période</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Date de création</th>
                <th>Date d'échéance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (invoice of paginatedInvoices; track invoice.id) {
                <tr>
                  <td>
                    <strong>{{ invoice.invoiceNumber }}</strong>
                  </td>
                  <td>{{ invoice.organizationName }}</td>
                  <td>
                    {{ formatDate(invoice.periodStart) }} - {{ formatDate(invoice.periodEnd) }}
                  </td>
                  <td>
                    <strong>{{ formatCurrency(invoice.totalAmount) }}</strong>
                  </td>
                  <td>
                    <select [(ngModel)]="invoice.status" (change)="updateStatus(invoice)"
                            class="status-select" [class]="'status-select-' + invoice.status.toLowerCase()">
                      <option value="DRAFT">Brouillon</option>
                      <option value="PENDING">En attente</option>
                      <option value="PAID">Payée</option>
                      <option value="OVERDUE">En retard</option>
                      <option value="CANCELLED">Annulée</option>
                    </select>
                  </td>
                  <td>{{ formatDateTime(invoice.createdAt) }}</td>
                  <td>{{ formatDate(invoice.dueDate) }}</td>
                  <td>
                    <button class="btn btn-small btn-primary" (click)="viewInvoice(invoice.id)">
                      Voir
                    </button>
                    <button class="btn btn-small btn-secondary" (click)="downloadPdf(invoice)">
                      📥 PDF
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="pagination">
          <button class="btn btn-secondary" (click)="previousPage()" [disabled]="currentPage === 1">
            ← Précédent
          </button>
          <span class="page-info">
            Page {{ currentPage }} sur {{ totalPages }}
          </span>
          <button class="btn btn-secondary" (click)="nextPage()" [disabled]="currentPage === totalPages">
            Suivant →
          </button>
        </div>
      }
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

    .invoices-admin-container {
      padding: 2rem;
      max-width: 1600px;
      margin: 0 auto;
      background: var(--neu-bg);
      min-height: 100vh;
    }

    .invoices-header {
      margin-bottom: 2rem;
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      padding: 1.5rem 2rem;
      border-radius: var(--neu-radius-container);
      box-shadow: var(--neu-extruded);
    }

    .invoices-header h2 {
      margin: 0 0 0.5rem 0;
      color: var(--neu-text-heading);
      font-family: var(--font-display);
    }

    .subtitle {
      color: var(--neu-text-muted);
      margin: 0;
    }

    .actions-bar {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }

    .form-card {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      padding: 1.5rem 2rem;
      border-radius: var(--neu-radius-container);
      margin-bottom: 2rem;
      box-shadow: var(--neu-extruded);
    }

    .form-card h3 {
      margin-top: 0;
      color: var(--neu-text-heading);
      font-family: var(--font-display);
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: var(--neu-text-primary);
    }

    .form-group input,
    .form-group select {
      width: 100%;
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

    .form-group input:focus,
    .form-group select:focus {
      outline: none;
      box-shadow: var(--neu-inset-deep), 0 0 0 2px var(--neu-accent);
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
    }

    .filters-bar {
      background: var(--neu-bg);
      padding: 1.5rem 2rem;
      border-radius: var(--neu-radius-container);
      margin-bottom: 2rem;
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: flex-end;
      box-shadow: var(--neu-inset);
    }

    .search-group {
      flex: 1;
      min-width: 200px;
    }

    .search-input {
      width: 100%;
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

    .search-input:focus {
      outline: none;
      box-shadow: var(--neu-inset-deep), 0 0 0 2px var(--neu-accent);
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .filter-group label {
      font-weight: 600;
      color: var(--neu-text-muted);
      font-size: 0.875rem;
    }

    .filter-select,
    .filter-input {
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

    .filter-select:focus,
    .filter-input:focus {
      outline: none;
      box-shadow: var(--neu-inset-deep), 0 0 0 2px var(--neu-accent);
    }

    .actions-group {
      display: flex;
      gap: 0.5rem;
    }

    .loading, .error, .no-invoices {
      text-align: center;
      padding: 3rem;
      background: var(--neu-bg);
      border-radius: var(--neu-radius-container);
      margin-top: 2rem;
      box-shadow: var(--neu-extruded);
    }

    .error {
      color: var(--neu-accent-danger);
    }

    .no-invoices {
      color: var(--neu-text-muted);
    }

    .pagination-info {
      margin-bottom: 1rem;
      color: var(--neu-text-muted);
      font-size: 0.875rem;
    }

    .invoices-table-wrapper {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      border-radius: var(--neu-radius-container);
      overflow: hidden;
      margin-bottom: 2rem;
      padding: 1rem;
      box-shadow: var(--neu-extruded);
    }

    .invoices-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0 0.5rem;
    }

    .invoices-table th {
      padding: 0.75rem 1rem;
      text-align: left;
      font-weight: 600;
      color: var(--neu-text-muted);
      background: transparent;
    }

    .invoices-table td {
      padding: 0.75rem 1rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-extruded-sm);
      color: var(--neu-text-primary);
    }

    .invoices-table td:first-child {
      border-radius: var(--neu-radius-inner) 0 0 var(--neu-radius-inner);
    }

    .invoices-table td:last-child {
      border-radius: 0 var(--neu-radius-inner) var(--neu-radius-inner) 0;
    }

    .invoices-table tr:hover td {
      box-shadow: var(--neu-extruded);
    }

    .status-select {
      padding: 0.375rem 0.625rem;
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 0.875rem;
      cursor: pointer;
      min-height: 44px;
      transition: box-shadow 0.2s ease;
    }

    .status-select-draft {
      background: var(--neu-bg);
      color: var(--neu-text-muted);
      box-shadow: var(--neu-extruded-sm);
    }

    .status-select-pending {
      background: #FFF8E1;
      color: #856404;
      box-shadow: var(--neu-extruded-sm);
    }

    .status-select-paid {
      background: #E8F5E9;
      color: #155724;
      box-shadow: var(--neu-extruded-sm);
    }

    .status-select-overdue {
      background: #FFEBEE;
      color: #721c24;
      box-shadow: var(--neu-extruded-sm);
    }

    .status-select-cancelled {
      background: var(--neu-bg);
      color: var(--neu-text-muted);
      box-shadow: var(--neu-extruded-sm);
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      margin-top: 2rem;
    }

    .page-info {
      font-weight: 600;
      color: var(--neu-text-heading);
      font-family: var(--font-display);
    }

    .btn {
      padding: 0.625rem 1.25rem;
      border: none;
      border-radius: var(--neu-radius-inner);
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 600;
      min-height: 44px;
      transition: box-shadow 0.2s ease;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: var(--neu-accent);
      color: white;
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-primary:hover:not(:disabled) {
      box-shadow: var(--neu-extruded);
    }

    .btn-primary:active:not(:disabled) {
      box-shadow: var(--neu-inset);
    }

    .btn-secondary {
      background: var(--neu-bg);
      color: var(--neu-text-muted);
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-secondary:hover:not(:disabled) {
      box-shadow: var(--neu-extruded);
    }

    .btn-secondary:active:not(:disabled) {
      box-shadow: var(--neu-inset);
    }

    .btn-small {
      padding: 0.375rem 0.625rem;
      font-size: 0.75rem;
      margin-right: 0.5rem;
      min-height: 36px;
    }

    @media (max-width: 768px) {
      .invoices-admin-container {
        padding: 1rem;
      }

      .filters-bar {
        flex-direction: column;
        align-items: stretch;
      }

      .actions-bar {
        flex-direction: column;
      }

      .actions-group {
        flex-direction: column;
      }

      .invoices-table-wrapper {
        overflow-x: auto;
      }
    }

    @media (max-width: 1024px) {
      .invoices-table-wrapper {
        overflow-x: auto;
      }
    }
  `]
})
export class InvoicesAdminComponent implements OnInit {
  invoiceService = inject(InvoiceService);
  adminService = inject(AdminService);
  notificationService = inject(NotificationService);
  router = inject(Router);

  invoices: Invoice[] = [];
  filteredInvoices: Invoice[] = [];
  paginatedInvoices: Invoice[] = [];
  organizations: Organization[] = [];
  
  loading = false;
  error: string | null = null;
  
  // Filtres
  searchTerm = '';
  statusFilter: string | null = null;
  organizationFilter: number | null = null;
  dateFrom: string | null = null;
  dateTo: string | null = null;
  
  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  
  // Génération
  showGenerateForm = false;
  showGenerateAllForm = false;
  generating = false;
  generatingAll = false;
  generateRequest: GenerateInvoiceRequest = {
    organizationId: 0,
    periodStart: '',
    periodEnd: ''
  };
  generateYear = new Date().getFullYear();
  generateMonth = new Date().getMonth() + 1;
  currentYear = new Date().getFullYear();
  
  months = [
    { value: 1, label: 'Janvier' },
    { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },
    { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },
    { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Décembre' }
  ];
  

  ngOnInit() {
    this.loadOrganizations();
    this.loadInvoices();
  }

  loadOrganizations() {
    this.adminService.getOrganizations().subscribe({
      next: (orgs) => {
        this.organizations = orgs || [];
      },
      error: (err) => {
        console.error('Erreur lors du chargement des organisations:', err);
        this.notificationService.error('Erreur lors du chargement des organisations');
      }
    });
  }

  loadInvoices() {
    this.loading = true;
    this.error = null;

    this.invoiceService.getAllInvoices().subscribe({
      next: (invoices) => {
        this.invoices = invoices || [];
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des factures:', err);
        this.error = 'Erreur lors du chargement des factures. Veuillez réessayer.';
        this.loading = false;
        this.notificationService.error('Erreur lors du chargement des factures');
      }
    });
  }

  applyFilters() {
    this.filteredInvoices = this.invoices.filter(invoice => {
      // Recherche
      if (this.searchTerm) {
        const searchLower = this.searchTerm.toLowerCase();
        if (!invoice.invoiceNumber.toLowerCase().includes(searchLower) &&
            !invoice.organizationName.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Filtre par statut
      if (this.statusFilter && invoice.status !== this.statusFilter) {
        return false;
      }

      // Filtre par organisation
      if (this.organizationFilter && invoice.organizationId !== this.organizationFilter) {
        return false;
      }

      // Filtre par date
      if (this.dateFrom) {
        const invoiceDate = new Date(invoice.createdAt);
        const fromDate = new Date(this.dateFrom);
        if (invoiceDate < fromDate) {
          return false;
        }
      }

      if (this.dateTo) {
        const invoiceDate = new Date(invoice.createdAt);
        const toDate = new Date(this.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (invoiceDate > toDate) {
          return false;
        }
      }

      return true;
    });

    this.currentPage = 1;
    this.updatePagination();
  }

  resetFilters() {
    this.searchTerm = '';
    this.statusFilter = null;
    this.organizationFilter = null;
    this.dateFrom = null;
    this.dateTo = null;
    this.applyFilters();
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredInvoices.length / this.pageSize);
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedInvoices = this.filteredInvoices.slice(startIndex, endIndex);
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  generateInvoice() {
    if (!this.generateRequest.organizationId || !this.generateRequest.periodStart || !this.generateRequest.periodEnd) {
      this.notificationService.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    this.generating = true;
    this.invoiceService.generateInvoice(this.generateRequest).subscribe({
      next: (invoice) => {
        this.notificationService.success(`Facture ${invoice.invoiceNumber} générée avec succès`);
        this.loadInvoices();
        this.cancelGenerate();
        this.generating = false;
      },
      error: (err) => {
        console.error('Erreur lors de la génération de la facture:', err);
        this.notificationService.error('Erreur lors de la génération de la facture');
        this.generating = false;
      }
    });
  }

  generateAllMonthlyInvoices() {
    this.generatingAll = true;
    this.invoiceService.generateAllMonthlyInvoices(this.generateYear, this.generateMonth).subscribe({
      next: (result) => {
        this.notificationService.success(`${result.count} facture(s) générée(s) avec succès`);
        this.loadInvoices();
        this.cancelGenerateAll();
        this.generatingAll = false;
      },
      error: (err) => {
        console.error('Erreur lors de la génération des factures:', err);
        this.notificationService.error('Erreur lors de la génération des factures');
        this.generatingAll = false;
      }
    });
  }

  cancelGenerate() {
    this.showGenerateForm = false;
    this.generateRequest = {
      organizationId: 0,
      periodStart: '',
      periodEnd: ''
    };
  }

  cancelGenerateAll() {
    this.showGenerateAllForm = false;
    this.generateYear = new Date().getFullYear();
    this.generateMonth = new Date().getMonth() + 1;
  }

  updateStatus(invoice: Invoice) {
    const request: UpdateInvoiceStatusRequest = {
      status: invoice.status,
      notes: invoice.notes || undefined
    };

    this.invoiceService.updateInvoiceStatus(invoice.id, request).subscribe({
      next: (updatedInvoice) => {
        this.notificationService.success(`Statut de la facture ${updatedInvoice.invoiceNumber} mis à jour`);
        this.loadInvoices();
      },
      error: (err) => {
        console.error('Erreur lors de la mise à jour du statut:', err);
        this.notificationService.error('Erreur lors de la mise à jour du statut');
        // Restaurer le statut précédent
        this.loadInvoices();
      }
    });
  }

  viewInvoice(id: number) {
    this.router.navigate(['/admin/invoices', id]);
  }

  downloadPdf(invoice: Invoice) {
    this.invoiceService.downloadInvoicePdfAdmin(invoice.id).subscribe({
      next: (blob) => {
        const filename = `facture_${invoice.invoiceNumber}.pdf`;
        this.invoiceService.downloadFile(blob, filename);
        this.notificationService.success('Facture téléchargée avec succès');
      },
      error: (err) => {
        console.error('Erreur lors du téléchargement du PDF:', err);
        this.notificationService.error('Erreur lors du téléchargement du PDF');
      }
    });
  }

  exportToCsv() {
    const csv = this.convertToCsv(this.filteredInvoices);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const filename = `factures_${new Date().toISOString().split('T')[0]}.csv`;
    this.invoiceService.downloadFile(blob, filename);
    this.notificationService.success('Export CSV réussi');
  }

  exportToExcel() {
    // Pour Excel, nous générons un CSV avec une extension .xlsx
    // Dans une vraie application, vous utiliseriez une bibliothèque comme xlsx
    const csv = this.convertToCsv(this.filteredInvoices);
    const blob = new Blob([csv], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;' });
    const filename = `factures_${new Date().toISOString().split('T')[0]}.xlsx`;
    this.invoiceService.downloadFile(blob, filename);
    this.notificationService.success('Export Excel réussi');
  }

  private convertToCsv(invoices: Invoice[]): string {
    const headers = ['Numéro', 'Organisation', 'Période Début', 'Période Fin', 'Montant', 'Statut', 'Date de création', 'Date d\'échéance'];
    const rows = invoices.map(invoice => [
      invoice.invoiceNumber,
      invoice.organizationName,
      this.formatDate(invoice.periodStart),
      this.formatDate(invoice.periodEnd),
      invoice.totalAmount.toString(),
      this.invoiceService.getStatusText(invoice.status),
      this.formatDateTime(invoice.createdAt),
      this.formatDate(invoice.dueDate)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Ajouter BOM pour UTF-8
    return '\uFEFF' + csvContent;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR');
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  getStartIndex(): number {
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredInvoices.length);
  }
}

