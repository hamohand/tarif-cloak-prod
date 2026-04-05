import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuoteRequestService, QuoteRequestDto } from '../../core/services/quote-request.service';
import { OrganizationAccountService, OrganizationInfo } from '../../core/services/organization-account.service';
import { QuoteRequestFormComponent } from '../pricing/quote-request-form.component';

@Component({
  selector: 'app-quote-requests',
  standalone: true,
  imports: [CommonModule, QuoteRequestFormComponent],
  template: `
    <div class="quote-requests-container">
      <div class="header">
        <h2>Mes demandes de devis</h2>
        <button class="btn btn-primary" (click)="openNewRequest()" *ngIf="organization">
          Nouvelle demande
        </button>
      </div>

      @if (loading) {
        <div class="loading">Chargement des demandes...</div>
      } @else if (error) {
        <div class="error">{{ error }}</div>
      } @else if (quoteRequests.length === 0) {
        <div class="empty-state">
          <p>Aucune demande de devis pour le moment.</p>
          <button class="btn btn-primary" (click)="openNewRequest()" *ngIf="organization">
            Créer une demande
          </button>
        </div>
      } @else {
        <div class="quote-requests-list">
          @for (request of quoteRequests; track request.id) {
            <div class="quote-request-card" [class]="'status-' + request.status.toLowerCase()">
              <div class="card-header">
                <div>
                  <h3>Demande #{{ request.id }}</h3>
                  <p class="date">Créée le {{ formatDate(request.createdAt) }}</p>
                </div>
                <span class="status-badge" [class]="'status-' + request.status.toLowerCase()">
                  {{ getStatusLabel(request.status) }}
                </span>
              </div>

              <div class="card-body">
                <div class="info-row">
                  <strong>Contact :</strong>
                  <span>{{ request.contactName }} ({{ request.contactEmail }})</span>
                </div>
                @if (request.message) {
                  <div class="message-section">
                    <strong>Message :</strong>
                    <p>{{ request.message }}</p>
                  </div>
                }
                @if (request.adminNotes) {
                  <div class="admin-notes-section">
                    <strong>Notes de l'administrateur :</strong>
                    <p>{{ request.adminNotes }}</p>
                  </div>
                }
                @if (request.respondedAt) {
                  <div class="info-row">
                    <strong>Réponse le :</strong>
                    <span>{{ formatDate(request.respondedAt) }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>

    <app-quote-request-form
      [showForm]="showQuoteForm"
      (formClosed)="closeQuoteForm()"
      (quoteSubmitted)="onQuoteSubmitted()">
    </app-quote-request-form>
  `,
  styles: [`
    /* ── Neumorphism tokens ── */
    :host {
      --neu-bg: var(--neu-bg, #E0E5EC);
      --neu-extruded: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      --neu-extruded-sm: var(--neu-extruded-sm, 4px 4px 8px rgba(163,177,198,0.6), -4px -4px 8px rgba(255,255,255,0.5));
      --neu-extruded-hover: var(--neu-extruded-hover, 12px 12px 20px rgba(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6));
      --neu-inset: var(--neu-inset, inset 4px 4px 8px rgba(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.5));
      --neu-inset-sm: var(--neu-inset-sm, inset 2px 2px 4px rgba(163,177,198,0.5), inset -2px -2px 4px rgba(255,255,255,0.4));
      --neu-accent: var(--neu-accent, #6C63FF);
      --neu-accent-secondary: var(--neu-accent-secondary, #36B37E);
      --neu-accent-danger: var(--neu-accent-danger, #E5484D);
      --neu-accent-warning: var(--neu-accent-warning, #E8912D);
      --neu-accent-info: var(--neu-accent-info, #38bdf8);
      --neu-text-primary: var(--neu-text-primary, #3D4852);
      --neu-text-muted: var(--neu-text-muted, #6B7280);
      --neu-text-heading: var(--neu-text-heading, #2D3748);
      --neu-radius-container: var(--neu-radius-container, 32px);
      --neu-radius-inner: var(--neu-radius-inner, 12px);
      --font-display: var(--font-display, 'Inter', sans-serif);
      display: block;
      background: var(--neu-bg);
    }

    .quote-requests-container {
      padding: 2rem;
      max-width: 1000px;
      margin: 0 auto;
      background: var(--neu-bg);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .header h2 {
      color: var(--neu-text-heading);
      font-family: var(--font-display);
      margin: 0;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      min-height: 44px;
    }

    .btn-primary {
      background: var(--neu-accent);
      color: #fff;
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-primary:hover {
      box-shadow: var(--neu-extruded-hover);
    }

    .btn-primary:active {
      box-shadow: var(--neu-inset);
    }

    .loading, .error {
      text-align: center;
      padding: 2rem;
      font-size: 1.2rem;
      color: var(--neu-text-muted);
    }

    .error {
      color: var(--neu-accent-danger);
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border-radius: var(--neu-radius-container);
    }

    .empty-state p {
      color: var(--neu-text-muted);
      margin-bottom: 1.5rem;
      font-size: 1.1rem;
    }

    .quote-requests-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    /* ── Quote request cards with accent left strip ── */
    .quote-request-card {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      box-shadow: var(--neu-extruded);
      border-radius: var(--neu-radius-container);
      padding: 1.5rem 1.5rem 1.5rem 2rem;
      position: relative;
      overflow: hidden;
      transition: box-shadow 0.3s ease, background 0.3s ease;
    }

    .quote-request-card::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 5px;
      background: var(--neu-text-muted);
      border-radius: var(--neu-radius-container) 0 0 var(--neu-radius-container);
    }

    .quote-request-card:hover {
      background: var(--neu-card-bg-hover, linear-gradient(145deg, #EDF0F5, #DCE1E8));
      box-shadow: var(--neu-extruded-hover);
    }

    .quote-request-card.status-pending::before {
      background: var(--neu-accent-warning);
    }

    .quote-request-card.status-in_review::before {
      background: var(--neu-accent-info);
    }

    .quote-request-card.status-responded::before {
      background: var(--neu-accent-secondary);
    }

    .quote-request-card.status-closed::before {
      background: var(--neu-text-muted);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
      padding-bottom: 1rem;
    }

    .card-header h3 {
      margin: 0 0 0.5rem 0;
      color: var(--neu-text-heading);
      font-family: var(--font-display);
      font-size: 1.3rem;
    }

    .date {
      color: var(--neu-text-muted);
      font-size: 0.9rem;
      margin: 0;
    }

    /* ── Status badges (extruded-sm pills) ── */
    .status-badge {
      padding: 0.5rem 1rem;
      border-radius: 999px;
      font-size: 0.875rem;
      font-weight: 600;
      text-transform: uppercase;
      background: var(--neu-bg);
      box-shadow: var(--neu-extruded-sm);
    }

    .status-badge.status-pending {
      color: var(--neu-accent-warning);
    }

    .status-badge.status-in_review {
      color: var(--neu-accent-info);
    }

    .status-badge.status-responded {
      color: var(--neu-accent-secondary);
    }

    .status-badge.status-closed {
      color: var(--neu-text-muted);
    }

    .card-body {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .info-row {
      display: flex;
      gap: 1rem;
    }

    .info-row strong {
      color: var(--neu-text-heading);
      min-width: 120px;
    }

    .info-row span {
      color: var(--neu-text-muted);
    }

    .message-section, .admin-notes-section {
      padding: 1rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset-sm);
      border-radius: var(--neu-radius-inner);
    }

    .message-section strong, .admin-notes-section strong {
      display: block;
      color: var(--neu-text-heading);
      margin-bottom: 0.5rem;
    }

    .message-section p, .admin-notes-section p {
      color: var(--neu-text-muted);
      margin: 0;
      white-space: pre-wrap;
    }

    @media (max-width: 768px) {
      .quote-requests-container {
        padding: 1rem;
      }

      .header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .card-header {
        flex-direction: column;
        gap: 1rem;
      }

      .info-row {
        flex-direction: column;
        gap: 0.5rem;
      }

      .info-row strong {
        min-width: auto;
      }

      .quote-request-card {
        border-radius: 20px;
      }
    }
  `]
})
export class QuoteRequestsComponent implements OnInit {
  private quoteRequestService = inject(QuoteRequestService);
  private organizationAccountService = inject(OrganizationAccountService);

  quoteRequests: QuoteRequestDto[] = [];
  organization: OrganizationInfo | null = null;
  loading = true;
  error = '';
  showQuoteForm = false;

  ngOnInit() {
    this.loadOrganization();
  }

  loadOrganization() {
    this.organizationAccountService.getMyOrganization().subscribe({
      next: (org) => {
        this.organization = org;
        this.loadQuoteRequests();
      },
      error: (err) => {
        console.error('Erreur lors du chargement de l\'organisation:', err);
        this.error = 'Impossible de charger les informations de l\'organisation.';
        this.loading = false;
      }
    });
  }

  loadQuoteRequests() {
    this.loading = true;
    this.error = '';
    // Utiliser le nouvel endpoint qui récupère automatiquement l'organisation depuis le token
    this.quoteRequestService.getMyOrganizationQuoteRequests().subscribe({
      next: (requests) => {
        // Trier par date de création (plus récent en premier)
        this.quoteRequests = requests.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des demandes de devis: ' + (err.error?.message || err.message || 'Erreur inconnue');
        this.loading = false;
        console.error('Erreur:', err);
      }
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  getStatusLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      'PENDING': 'En attente',
      'IN_REVIEW': 'En cours d\'examen',
      'RESPONDED': 'Répondu',
      'CLOSED': 'Fermée'
    };
    return statusMap[status] || status;
  }

  openNewRequest() {
    this.showQuoteForm = true;
  }

  closeQuoteForm() {
    this.showQuoteForm = false;
  }

  onQuoteSubmitted() {
    // Recharger les demandes après soumission
    this.loadQuoteRequests();
  }
}

