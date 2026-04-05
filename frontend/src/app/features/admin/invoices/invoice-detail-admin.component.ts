import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InvoiceService, Invoice, UpdateInvoiceStatusRequest } from '../../../core/services/invoice.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-invoice-detail-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="invoice-detail-container">
      <div class="invoice-header">
        <button class="btn btn-back" (click)="goBack()">← Retour</button>
        <h2>Facture {{ invoice?.invoiceNumber }} (Admin)</h2>
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
              @if (invoice.organizationEmail) {
                <div class="info-item">
                  <label>Email :</label>
                  <span>{{ invoice.organizationEmail }}</span>
                </div>
              }
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
                <select [(ngModel)]="invoice.status" (change)="updateStatus()" class="status-select">
                  <option value="DRAFT">Brouillon</option>
                  <option value="PENDING">En attente</option>
                  <option value="PAID">Payée</option>
                  <option value="OVERDUE">En retard</option>
                  <option value="CANCELLED">Annulée</option>
                </select>
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
          <div class="invoice-notes-card">
            <h3>Notes</h3>
            <textarea [(ngModel)]="invoice.notes" (blur)="updateStatus()" 
                      placeholder="Ajouter des notes..." class="notes-textarea"></textarea>
          </div>

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

    .invoice-detail-container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
      background: var(--neu-bg);
      min-height: 100vh;
    }

    .invoice-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
      background: var(--neu-bg);
      padding: 1.5rem 2rem;
      border-radius: var(--neu-radius-container);
      box-shadow: var(--neu-extruded);
    }

    .invoice-header h2 {
      margin: 0;
      color: var(--neu-text-heading);
      font-family: var(--font-display);
    }

    .btn-back {
      background: var(--neu-bg);
      color: var(--neu-text-muted);
      border: none;
      padding: 0.625rem 1.25rem;
      border-radius: var(--neu-radius-inner);
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 600;
      box-shadow: var(--neu-extruded-sm);
      min-height: 44px;
      transition: box-shadow 0.2s ease;
    }

    .btn-back:hover {
      box-shadow: var(--neu-extruded);
    }

    .btn-back:active {
      box-shadow: var(--neu-inset);
    }

    .loading, .error {
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

    .invoice-content {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .invoice-info-card, .invoice-items-card, .invoice-stats-card, .invoice-total-card, .invoice-notes-card {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      padding: 1.5rem 2rem;
      border-radius: var(--neu-radius-container);
      box-shadow: var(--neu-extruded);
    }

    .invoice-info-card h3, .invoice-items-card h3, .invoice-stats-card h3, .invoice-notes-card h3 {
      margin-top: 0;
      color: var(--neu-text-heading);
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
      color: var(--neu-text-muted);
      font-size: 0.875rem;
    }

    .info-item span {
      color: var(--neu-text-primary);
    }

    .status-select {
      padding: 0.625rem 0.75rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 1rem;
      cursor: pointer;
      color: var(--neu-text-primary);
      min-height: 44px;
      transition: box-shadow 0.2s ease;
    }

    .status-select:focus {
      outline: none;
      box-shadow: var(--neu-inset-deep), 0 0 0 2px var(--neu-accent);
    }

    .items-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0 0.5rem;
      margin-top: 1rem;
    }

    .items-table th {
      padding: 0.75rem 1rem;
      text-align: left;
      font-weight: 600;
      color: var(--neu-text-muted);
      background: transparent;
    }

    .items-table td {
      padding: 0.75rem 1rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-extruded-sm);
      color: var(--neu-text-primary);
    }

    .items-table td:first-child {
      border-radius: var(--neu-radius-inner) 0 0 var(--neu-radius-inner);
    }

    .items-table td:last-child {
      border-radius: 0 var(--neu-radius-inner) var(--neu-radius-inner) 0;
    }

    .items-table tr:hover td {
      box-shadow: var(--neu-extruded);
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
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      padding: 1rem;
      border-radius: var(--neu-radius-inner);
      box-shadow: var(--neu-extruded-sm);
    }

    .stat-item label {
      font-weight: 600;
      color: var(--neu-text-muted);
      font-size: 0.875rem;
    }

    .stat-item span {
      color: var(--neu-accent);
      font-size: 1.25rem;
      font-family: var(--font-display);
    }

    .invoice-total-card {
      margin-top: 1rem;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
    }

    .total-row label {
      font-weight: 600;
      color: var(--neu-text-primary);
    }

    .total-row span {
      color: var(--neu-text-primary);
    }

    .total-final {
      font-size: 1.25rem;
      font-weight: 600;
      margin-top: 0.5rem;
      padding-top: 1rem;
      color: var(--neu-accent);
    }

    .total-final label,
    .total-final span {
      color: var(--neu-accent);
    }

    .notes-textarea {
      width: 100%;
      min-height: 100px;
      padding: 0.75rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 1rem;
      font-family: inherit;
      resize: vertical;
      color: var(--neu-text-primary);
      transition: box-shadow 0.2s ease;
    }

    .notes-textarea:focus {
      outline: none;
      box-shadow: var(--neu-inset-deep), 0 0 0 2px var(--neu-accent);
    }

    .invoice-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: var(--neu-radius-inner);
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      min-height: 44px;
      transition: box-shadow 0.2s ease;
    }

    .btn-primary {
      background: var(--neu-accent);
      color: white;
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-primary:hover {
      box-shadow: var(--neu-extruded);
    }

    .btn-primary:active {
      box-shadow: var(--neu-inset);
    }

    @media (max-width: 768px) {
      .invoice-detail-container {
        padding: 1rem;
      }

      .invoice-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .info-grid {
        grid-template-columns: 1fr;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class InvoiceDetailAdminComponent implements OnInit {
  invoiceService = inject(InvoiceService);
  notificationService = inject(NotificationService);
  route = inject(ActivatedRoute);
  router = inject(Router);

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

    this.invoiceService.getInvoice(id).subscribe({
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

  updateStatus() {
    if (!this.invoice) return;

    const request: UpdateInvoiceStatusRequest = {
      status: this.invoice.status,
      notes: this.invoice.notes || undefined
    };

    this.invoiceService.updateInvoiceStatus(this.invoice.id, request).subscribe({
      next: (updatedInvoice) => {
        this.invoice = updatedInvoice;
        this.notificationService.success('Facture mise à jour avec succès');
      },
      error: (err) => {
        console.error('Erreur lors de la mise à jour de la facture:', err);
        this.notificationService.error('Erreur lors de la mise à jour de la facture');
        // Recharger la facture pour restaurer l'état précédent
        this.loadInvoice(this.invoice!.id);
      }
    });
  }

  downloadPdf() {
    if (!this.invoice) return;

    this.invoiceService.downloadInvoicePdfAdmin(this.invoice.id).subscribe({
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
    this.router.navigate(['/admin/invoices']);
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

