import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { InvoiceService, Invoice } from '../../../core/services/invoice.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="invoices-container">
      <div class="invoices-header">
        <h2>Mes Factures</h2>
        <p class="subtitle">Consultez vos factures et téléchargez-les en PDF</p>
      </div>

      @if (loading) {
        <div class="loading">
          <p>Chargement des factures...</p>
        </div>
      } @else if (error) {
        <div class="error">
          <p>❌ {{ error }}</p>
        </div>
      } @else if (invoices.length === 0) {
        <div class="no-invoices">
          <p>📄 Aucune facture disponible pour le moment.</p>
        </div>
      } @else {
        <div class="invoices-table-wrapper">
          <table class="invoices-table">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Période</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Date d'échéance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (invoice of invoices; track invoice.id) {
                <tr>
                  <td>
                    <strong>{{ invoice.invoiceNumber }}</strong>
                  </td>
                  <td>
                    {{ formatDate(invoice.periodStart) }} - {{ formatDate(invoice.periodEnd) }}
                  </td>
                  <td>
                    <strong>{{ formatCurrency(invoice.totalAmount) }}</strong>
                  </td>
                  <td>
                    <span class="status-badge" [class]="invoiceService.getStatusClass(invoice.status)">
                      {{ invoiceService.getStatusText(invoice.status) }}
                    </span>
                  </td>
                  <td>
                    {{ formatDate(invoice.dueDate) }}
                  </td>
                  <td>
                    <button class="btn btn-primary" (click)="viewInvoice(invoice.id)">
                      Voir
                    </button>
                    <button class="btn btn-secondary" (click)="downloadPdf(invoice)">
                      📥 PDF
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .invoices-container {
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
      background: #e8e8e8;
      min-height: 100vh;
    }

    .invoices-header {
      margin-bottom: 2rem;
      background: #e0e0e0;
      padding: 1.5rem;
      border-radius: 8px;
    }

    .invoices-header h2 {
      margin: 0 0 0.5rem 0;
      color: #2c3e50;
    }

    .subtitle {
      color: #666;
      margin: 0;
    }

    .loading, .error, .no-invoices {
      text-align: center;
      padding: 3rem;
      background: #e0e0e0;
      border-radius: 8px;
      margin-top: 2rem;
    }

    .error {
      background: #ffe0e0;
      color: #d32f2f;
    }

    .no-invoices {
      background: #e0e0e0;
      color: #666;
    }

    .invoices-table-wrapper {
      background: #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 2rem;
    }

    .invoices-table {
      width: 100%;
      border-collapse: collapse;
    }

    .invoices-table th {
      background: #d5d5d5;
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      color: #2c3e50;
      border-bottom: 2px solid #bbb;
    }

    .invoices-table td {
      padding: 1rem;
      border-bottom: 1px solid #ccc;
      background: #e0e0e0;
    }

    .invoices-table tr:hover td {
      background: #d5d5d5;
    }

    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .status-draft {
      background: #e0e0e0;
      color: #666;
    }

    .status-pending {
      background: #fff3cd;
      color: #856404;
    }

    .status-paid {
      background: #d4edda;
      color: #155724;
    }

    .status-overdue {
      background: #f8d7da;
      color: #721c24;
    }

    .status-cancelled {
      background: #e0e0e0;
      color: #666;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      margin-right: 0.5rem;
      transition: background-color 0.2s;
    }

    .btn-primary {
      background: #007bff;
      color: white;
    }

    .btn-primary:hover {
      background: #0056b3;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-secondary:hover {
      background: #545b62;
    }
  `]
})
export class InvoicesComponent implements OnInit {
  invoiceService = inject(InvoiceService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  invoices: Invoice[] = [];
  loading = false;
  error: string | null = null;

  ngOnInit() {
    this.loadInvoices();
  }

  loadInvoices() {
    this.loading = true;
    this.error = null;

    this.invoiceService.getMyInvoices().subscribe({
      next: (invoices) => {
        this.invoices = invoices || [];
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

  viewInvoice(id: number) {
    this.router.navigate(['/invoices', id]);
  }

  downloadPdf(invoice: Invoice) {
    this.invoiceService.downloadInvoicePdf(invoice.id).subscribe({
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

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
}

