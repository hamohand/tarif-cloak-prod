import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuoteRequestService, QuoteRequestDto, UpdateQuoteRequestDto } from '../../../core/services/quote-request.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-quote-requests-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="quote-requests-admin-container">
      <h2>💼 Gestion des Demandes de Devis</h2>

      <!-- Filtres -->
      <div class="filters-bar">
        <select [(ngModel)]="selectedStatus" (change)="loadQuoteRequests()" class="filter-select">
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="IN_REVIEW">En cours d'examen</option>
          <option value="RESPONDED">Répondu</option>
          <option value="CLOSED">Fermé</option>
        </select>
        <button class="btn btn-secondary" (click)="loadQuoteRequests()">Actualiser</button>
      </div>

      <!-- Liste des demandes -->
      @if (loading) {
        <div class="loading">Chargement des demandes...</div>
      } @else if (error) {
        <div class="error">{{ error }}</div>
      } @else if (quoteRequests.length === 0) {
        <div class="empty-state">Aucune demande de devis trouvée.</div>
      } @else {
        <div class="quote-requests-list">
          @for (request of quoteRequests; track request.id) {
            <div class="quote-request-card" [class]="'status-' + request.status.toLowerCase()">
              <div class="card-header">
                <div>
                  <h3>Demande #{{ request.id }}</h3>
                  <p class="meta-info">
                    Organisation ID: {{ request.organizationId }} | 
                    Créée le {{ formatDate(request.createdAt) }}
                  </p>
                </div>
                <span class="status-badge" [class]="'status-' + request.status.toLowerCase()">
                  {{ getStatusLabel(request.status) }}
                </span>
              </div>

              <div class="card-body">
                <div class="info-section">
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
                  @if (request.respondedAt) {
                    <div class="info-row">
                      <strong>Répondu le :</strong>
                      <span>{{ formatDate(request.respondedAt) }}</span>
                    </div>
                  }
                </div>

                <!-- Formulaire de mise à jour -->
                <div class="update-section">
                  <h4>Mettre à jour la demande</h4>
                  <form (ngSubmit)="updateRequest(request.id)" class="update-form">
                    <div class="form-group">
                      <label for="status-{{ request.id }}">Statut</label>
                      <select 
                        id="status-{{ request.id }}"
                        [(ngModel)]="requestUpdates[request.id].status" 
                        name="status-{{ request.id }}"
                        class="form-control">
                        <option [value]="undefined">-- Ne pas modifier --</option>
                        <option value="PENDING">En attente</option>
                        <option value="IN_REVIEW">En cours d'examen</option>
                        <option value="RESPONDED">Répondu</option>
                        <option value="CLOSED">Fermé</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="notes-{{ request.id }}">Notes administrateur</label>
                      <textarea 
                        id="notes-{{ request.id }}"
                        [(ngModel)]="requestUpdates[request.id].adminNotes" 
                        name="notes-{{ request.id }}"
                        rows="3"
                        class="form-control"
                        placeholder="Ajouter des notes internes..."></textarea>
                    </div>
                    <div class="form-actions">
                      <button 
                        type="submit" 
                        class="btn btn-primary"
                        [disabled]="isUpdating[request.id]">
                        <span *ngIf="isUpdating[request.id]">Mise à jour...</span>
                        <span *ngIf="!isUpdating[request.id]">Mettre à jour</span>
                      </button>
                    </div>
                  </form>
                  
                  @if (request.adminNotes) {
                    <div class="current-notes">
                      <strong>Notes actuelles :</strong>
                      <p>{{ request.adminNotes }}</p>
                    </div>
                  }
                </div>
              </div>
            </div>
          }
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

    .quote-requests-admin-container {
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

    .filters-bar {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      align-items: center;
      background: var(--neu-bg);
      padding: 1rem 1.5rem;
      border-radius: var(--neu-radius-container);
      box-shadow: var(--neu-inset);
    }

    .filter-select {
      padding: 0.625rem 1rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 1rem;
      color: var(--neu-text-primary);
      min-height: 44px;
      transition: box-shadow 0.2s ease;
    }

    .filter-select:focus {
      outline: none;
      box-shadow: var(--neu-inset-deep), 0 0 0 2px var(--neu-accent);
    }

    .btn {
      padding: 0.625rem 1.25rem;
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      min-height: 44px;
      transition: box-shadow 0.2s ease;
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

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: var(--neu-bg);
      color: var(--neu-text-muted);
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-secondary:hover {
      box-shadow: var(--neu-extruded);
    }

    .btn-secondary:active {
      box-shadow: var(--neu-inset);
    }

    .loading, .error, .empty-state {
      text-align: center;
      padding: 2rem;
      font-size: 1.2rem;
      background: var(--neu-bg);
      border-radius: var(--neu-radius-container);
      box-shadow: var(--neu-extruded);
    }

    .error {
      color: var(--neu-accent-danger);
    }

    .empty-state {
      color: var(--neu-text-muted);
    }

    .quote-requests-list {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .quote-request-card {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      border-radius: var(--neu-radius-container);
      padding: 1.5rem 2rem;
      box-shadow: var(--neu-extruded);
      border-left: 5px solid var(--neu-text-muted);
      transition: box-shadow 0.3s ease, background 0.3s ease;
    }

    .quote-request-card:hover {
      background: var(--neu-card-bg-hover, linear-gradient(145deg, #EDF0F5, #DCE1E8));
      box-shadow: var(--neu-extruded-hover);
    }

    .quote-request-card.status-pending {
      border-left-color: var(--neu-accent-warning);
    }

    .quote-request-card.status-in_review {
      border-left-color: var(--neu-accent);
    }

    .quote-request-card.status-responded {
      border-left-color: var(--neu-accent-secondary);
    }

    .quote-request-card.status-closed {
      border-left-color: var(--neu-text-muted);
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
      font-size: 1.3rem;
      font-family: var(--font-display);
    }

    .meta-info {
      color: var(--neu-text-muted);
      font-size: 0.9rem;
      margin: 0;
    }

    .status-badge {
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
      text-transform: uppercase;
      box-shadow: var(--neu-extruded-sm);
    }

    .status-badge.status-pending {
      background: var(--neu-bg);
      color: var(--neu-accent-warning);
    }

    .status-badge.status-in_review {
      background: var(--neu-bg);
      color: var(--neu-accent);
    }

    .status-badge.status-responded {
      background: var(--neu-bg);
      color: var(--neu-accent-secondary);
    }

    .status-badge.status-closed {
      background: var(--neu-bg);
      color: var(--neu-text-muted);
    }

    .card-body {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .info-section {
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
      min-width: 150px;
    }

    .info-row span {
      color: var(--neu-text-muted);
    }

    .message-section {
      padding: 1rem 1.5rem;
      background: var(--neu-bg);
      border-radius: var(--neu-radius-inner);
      box-shadow: var(--neu-inset);
    }

    .message-section strong {
      display: block;
      color: var(--neu-text-heading);
      margin-bottom: 0.5rem;
    }

    .message-section p {
      color: var(--neu-text-muted);
      margin: 0;
      white-space: pre-wrap;
    }

    .update-section {
      padding: 1.5rem;
      background: var(--neu-bg);
      border-radius: var(--neu-radius-inner);
      box-shadow: var(--neu-inset);
    }

    .update-section h4 {
      margin: 0 0 1rem 0;
      color: var(--neu-text-heading);
      font-family: var(--font-display);
    }

    .update-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-group label {
      font-weight: 500;
      color: var(--neu-text-primary);
    }

    .form-control {
      padding: 0.75rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 1rem;
      color: var(--neu-text-primary);
      min-height: 44px;
      transition: box-shadow 0.2s ease;
    }

    .form-control:focus {
      outline: none;
      box-shadow: var(--neu-inset-deep), 0 0 0 2px var(--neu-accent);
    }

    textarea.form-control {
      resize: vertical;
      font-family: inherit;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
    }

    .current-notes {
      margin-top: 1rem;
      padding: 1rem 1.5rem;
      background: var(--neu-bg);
      border-radius: var(--neu-radius-inner);
      border-left: 4px solid var(--neu-accent);
      box-shadow: var(--neu-extruded-sm);
    }

    .current-notes strong {
      display: block;
      color: var(--neu-text-heading);
      margin-bottom: 0.5rem;
    }

    .current-notes p {
      color: var(--neu-text-muted);
      margin: 0;
      white-space: pre-wrap;
    }

    @media (max-width: 768px) {
      .quote-requests-admin-container {
        padding: 1rem;
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

      .filters-bar {
        flex-direction: column;
        align-items: stretch;
      }
    }

    @media (max-width: 1024px) {
      .quote-request-card {
        padding: 1.25rem 1.5rem;
      }
    }
  `]
})
export class QuoteRequestsAdminComponent implements OnInit {
  private quoteRequestService = inject(QuoteRequestService);
  private notificationService = inject(NotificationService);

  quoteRequests: QuoteRequestDto[] = [];
  loading = true;
  error = '';
  selectedStatus = '';
  requestUpdates: { [key: number]: UpdateQuoteRequestDto } = {};
  isUpdating: { [key: number]: boolean } = {};

  ngOnInit() {
    this.loadQuoteRequests();
  }

  loadQuoteRequests() {
    this.loading = true;
    this.error = '';
    
    const request = this.selectedStatus 
      ? this.quoteRequestService.getQuoteRequestsByStatus(this.selectedStatus)
      : this.quoteRequestService.getAllQuoteRequests();

    request.subscribe({
      next: (requests) => {
        this.quoteRequests = requests;
        // Initialiser les mises à jour pour chaque demande
        requests.forEach(req => {
          if (!this.requestUpdates[req.id]) {
            this.requestUpdates[req.id] = { status: undefined, adminNotes: '' };
          }
        });
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des demandes: ' + (err.error?.message || err.message || 'Erreur inconnue');
        this.loading = false;
        console.error('Erreur:', err);
      }
    });
  }

  updateRequest(id: number) {
    const update = this.requestUpdates[id];
    if (!update.status && !update.adminNotes) {
      this.notificationService.error('Veuillez modifier au moins un champ');
      return;
    }

    this.isUpdating[id] = true;
    
    // Préparer le DTO de mise à jour (ne pas envoyer les champs undefined)
    const updateDto: UpdateQuoteRequestDto = {};
    if (update.status) {
      updateDto.status = update.status as any;
    }
    if (update.adminNotes !== undefined && update.adminNotes.trim() !== '') {
      updateDto.adminNotes = update.adminNotes;
    }

    this.quoteRequestService.updateQuoteRequest(id, updateDto).subscribe({
      next: (updated) => {
        // Mettre à jour la demande dans la liste
        const index = this.quoteRequests.findIndex(r => r.id === id);
        if (index !== -1) {
          this.quoteRequests[index] = updated;
        }
        // Réinitialiser les champs de mise à jour
        this.requestUpdates[id] = { status: undefined, adminNotes: '' };
        this.isUpdating[id] = false;
        this.notificationService.success('Demande mise à jour avec succès');
      },
      error: (err) => {
        this.isUpdating[id] = false;
        this.notificationService.error('Erreur lors de la mise à jour: ' + (err.error?.message || err.message || 'Erreur inconnue'));
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
}

