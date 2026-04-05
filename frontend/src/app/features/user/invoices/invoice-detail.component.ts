import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InvoiceService, Invoice } from '../../../core/services/invoice.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="invoice-detail-container">
      <div class="invoice-header">
        <button class="btn btn-back" (click)="goBack()">← Retour</button>
        <h2>Facture {{ invoice?.invoiceNumber }}</h2>
      </div>

      @if (loading) {
        <div class="loading">
          <p>Chargement de la facture...</p>
        </div>
      } @else if (error) {
        <div class="error">
          <p>❌ {{ error }}</p>
        </div>
      } @else if (invoice) {
        <div class="invoice-content">
          <!-- Informations de la facture -->
          <div class="invoice-info-card">
            <h3>Informations de la facture</h3>
            <div class="info-grid">
              <div class="info-item">
                <label>Numéro de facture :</label>
                <span>{{ invoice.invoiceNumber }}</span>
              </div>
              <div class="info-item">
                <label>Organisation :</label>
                <span>{{ invoice.organizationName }}</span>
              </div>
              <div class="info-item">
                <label>Période :</label>
                <span>{{ formatDate(invoice.periodStart) }} - {{ formatDate(invoice.periodEnd) }}</span>
              </div>
              <div class="info-item">
                <label>Date de facturation :</label>
                <span>{{ formatDateTime(invoice.createdAt) }}</span>
              </div>
              <div class="info-item">
                <label>Date d'échéance :</label>
                <span>{{ formatDate(invoice.dueDate) }}</span>
              </div>
              <div class="info-item">
                <label>Statut :</label>
                <span class="status-badge" [class]="invoiceService.getStatusClass(invoice.status)">
                  {{ invoiceService.getStatusText(invoice.status) }}
                </span>
              </div>
              @if (invoice.paidAt) {
                <div class="info-item">
                  <label>Date de paiement :</label>
                  <span>{{ formatDateTime(invoice.paidAt) }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Lignes de facture -->
          <div class="invoice-items-card">
            <h3>Détails de la facture</h3>
            @if (invoice.items && invoice.items.length > 0) {
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Quantité</th>
                    <th>Prix unitaire</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of invoice.items; track item.id) {
                    <tr>
                      <td>{{ item.description }}</td>
                      <td class="text-center">{{ item.quantity }}</td>
                      <td class="text-right">{{ formatCurrency(item.unitPrice) }}</td>
                      <td class="text-right"><strong>{{ formatCurrency(item.totalPrice) }}</strong></td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p>Aucune ligne de facture disponible.</p>
            }
          </div>

          <!-- Statistiques d'utilisation -->
          @if (invoice.totalRequests !== undefined || invoice.totalTokens !== undefined) {
            <div class="invoice-stats-card">
              <h3>Statistiques d'utilisation</h3>
              <div class="stats-grid">
                @if (invoice.totalRequests !== undefined) {
                  <div class="stat-item">
                    <label>Nombre de crédits :</label>
                    <span>{{ formatNumber(invoice.totalRequests) }}</span>
                  </div>
                }
                @if (invoice.totalTokens !== undefined) {
                  <div class="stat-item">
                    <label>Tokens utilisés :</label>
                    <span>{{ formatNumber(invoice.totalTokens) }}</span>
                  </div>
                }
                @if (invoice.totalCostUsd !== undefined) {
                  <div class="stat-item">
                    <label>Coût total :</label>
                    <span>{{ formatCurrency(invoice.totalCostUsd) }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Total -->
          <div class="invoice-total-card">
            <div class="total-row">
              <label>Total HT :</label>
              <span>{{ formatCurrency(invoice.totalAmount) }}</span>
            </div>
            <div class="total-row">
              <label>TVA (0%) :</label>
              <span>{{ formatCurrency(0) }}</span>
            </div>
            <div class="total-row total-final">
              <label>Total TTC :</label>
              <span>{{ formatCurrency(invoice.totalAmount) }}</span>
            </div>
          </div>

          <!-- Notes -->
          @if (invoice.notes) {
            <div class="invoice-notes-card">
              <h3>Notes</h3>
              <p>{{ invoice.notes }}</p>
            </div>
          }

          <!-- Actions -->
          <div class="invoice-actions">
            <button class="btn btn-primary" (click)="downloadPdf()">
              📥 Télécharger le PDF
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      background: var(--neu-bg, #E0E5EC);
      min-height: 100vh;
    }

    .invoice-detail-container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .invoice-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
      background: var(--neu-bg, #E0E5EC);
      padding: 1.5rem;
      border-radius: var(--neu-radius-container, 32px);
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
    }

    .invoice-header h2 {
      margin: 0;
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display);
    }

    .btn-back {
      background: var(--neu-bg, #E0E5EC);
      color: var(--neu-accent, #6C63FF);
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 12px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 600;
      min-height: 44px;
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.5), -5px -5px 10px rgba(255,255,255,0.4));
      transition: all 0.25s ease;
    }

    .btn-back:hover {
      box-shadow: 7px 7px 14px rgba(163,177,198,0.6), -7px -7px 14px rgba(255,255,255,0.5);
    }

    .btn-back:active {
      box-shadow: var(--neu-inset-sm, inset 4px 4px 6px rgba(163,177,198,0.5), inset -4px -4px 6px rgba(255,255,255,0.4));
    }

    .loading, .error {
      text-align: center;
      padding: 3rem;
      background: var(--neu-bg, #E0E5EC);
      border-radius: var(--neu-radius-container, 32px);
      margin-top: 2rem;
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      color: var(--neu-text-primary, #3D4852);
    }

    .error {
      color: var(--neu-accent-danger, #E53E3E);
    }

    .invoice-content {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .invoice-info-card,
    .invoice-items-card,
    .invoice-stats-card,
    .invoice-total-card,
    .invoice-notes-card {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      padding: 1.5rem;
      border-radius: var(--neu-radius-container, 32px);
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
    }

    .invoice-info-card h3,
    .invoice-items-card h3,
    .invoice-stats-card h3,
    .invoice-notes-card h3 {
      margin-top: 0;
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display);
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .info-item label {
      font-weight: 600;
      color: var(--neu-text-muted, #6B7280);
      font-size: 0.875rem;
    }

    .info-item span {
      color: var(--neu-text-primary, #3D4852);
    }

    .status-badge {
      display: inline-block;
      padding: 0.3rem 0.85rem;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
      background: var(--neu-bg, #E0E5EC);
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.5), -5px -5px 10px rgba(255,255,255,0.4));
    }

    .status-draft {
      color: var(--neu-text-muted, #6B7280);
    }

    .status-pending {
      color: var(--neu-accent-warning, #ED8936);
    }

    .status-paid {
      color: var(--neu-accent-secondary, #38B2AC);
    }

    .status-overdue {
      color: var(--neu-accent-danger, #E53E3E);
    }

    .status-cancelled {
      color: var(--neu-text-muted, #6B7280);
    }

    .items-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0 0.5rem;
      margin-top: 1rem;
    }

    .items-table th {
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display);
      background: transparent;
    }

    .items-table td {
      padding: 1rem;
      background: var(--neu-bg, #E0E5EC);
      color: var(--neu-text-primary, #3D4852);
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.5), -5px -5px 10px rgba(255,255,255,0.4));
    }

    .items-table td:first-child {
      border-radius: 16px 0 0 16px;
    }

    .items-table td:last-child {
      border-radius: 0 16px 16px 0;
    }

    .text-center {
      text-align: center;
    }

    .text-right {
      text-align: right;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 1rem;
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      border-radius: var(--neu-radius-container, 32px);
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      text-align: center;
    }

    .stat-item label {
      font-weight: 600;
      color: var(--neu-text-muted, #6B7280);
      font-size: 0.875rem;
    }

    .stat-item span {
      color: var(--neu-accent, #6C63FF);
      font-size: 1.25rem;
      font-family: var(--font-display);
      font-weight: 700;
    }

    .invoice-total-card {
      margin-top: 1rem;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
    }

    .total-row + .total-row {
      margin-top: 0.25rem;
    }

    .total-row label {
      font-weight: 600;
      color: var(--neu-text-heading, #2D3748);
    }

    .total-row span {
      color: var(--neu-text-primary, #3D4852);
      font-family: var(--font-display);
    }

    .total-final {
      font-size: 1.25rem;
      font-weight: 700;
      margin-top: 0.75rem;
      padding-top: 1rem;
      background: var(--neu-bg, #E0E5EC);
      border-radius: 16px;
      padding: 1rem;
      box-shadow: var(--neu-inset-sm, inset 4px 4px 6px rgba(163,177,198,0.5), inset -4px -4px 6px rgba(255,255,255,0.4));
    }

    .total-final span {
      color: var(--neu-accent, #6C63FF);
    }

    .invoice-notes-card p {
      margin: 0;
      color: var(--neu-text-muted, #6B7280);
      white-space: pre-wrap;
    }

    .invoice-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.25s ease;
      min-height: 44px;
    }

    .btn-primary {
      background: var(--neu-accent, #6C63FF);
      color: #fff;
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.5), -5px -5px 10px rgba(255,255,255,0.4));
    }

    .btn-primary:hover {
      box-shadow: 7px 7px 14px rgba(163,177,198,0.6), -7px -7px 14px rgba(255,255,255,0.5);
    }

    .btn-primary:active {
      box-shadow: var(--neu-inset-sm, inset 4px 4px 6px rgba(163,177,198,0.5), inset -4px -4px 6px rgba(255,255,255,0.4));
    }

    @media (max-width: 768px) {
      .invoice-detail-container {
        padding: 1rem;
      }

      .info-grid {
        grid-template-columns: 1fr;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .invoice-header {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `]
})
export class InvoiceDetailComponent implements OnInit {
  invoiceService = inject(InvoiceService);
  private notificationService = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  invoice: Invoice | null = null;
  loading = false;
  error: string | null = null;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadInvoice(parseInt(id, 10));
    }
  }

  loadInvoice(id: number) {
    this.loading = true;
    this.error = null;

    this.invoiceService.getMyInvoice(id).subscribe({
      next: (invoice) => {
        this.invoice = invoice;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement de la facture:', err);
        this.error = 'Erreur lors du chargement de la facture. Veuillez réessayer.';
        this.loading = false;
        this.notificationService.error('Erreur lors du chargement de la facture');
      }
    });
  }

  downloadPdf() {
    if (!this.invoice) return;

    this.invoiceService.downloadInvoicePdf(this.invoice.id).subscribe({
      next: (blob) => {
        const filename = `facture_${this.invoice!.invoiceNumber}.pdf`;
        this.invoiceService.downloadFile(blob, filename);
        this.notificationService.success('Facture téléchargée avec succès');
      },
      error: (err) => {
        console.error('Erreur lors du téléchargement du PDF:', err);
        this.notificationService.error('Erreur lors du téléchargement du PDF');
      }
    });
  }

  goBack() {
    this.router.navigate(['/invoices']);
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

  formatNumber(value: number): string {
    return new Intl.NumberFormat('fr-FR').format(value);
  }
}

