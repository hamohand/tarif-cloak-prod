import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { AdminService, PendingRegistration } from '../../../core/services/admin.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-pending-registrations',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="pending-registrations-container">
      <h2>⏳ Utilisateurs en attente d'inscription</h2>

      @if (loading) {
        <p>Chargement...</p>
      } @else if (pendingRegistrations.length === 0) {
        <p class="empty-message">Aucun utilisateur en attente d'inscription.</p>
      } @else {
        <div class="registrations-table-container">
          <table class="registrations-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Utilisateur</th>
                <th>Email</th>
                <th>Organisation</th>
                <th>Email Organisation</th>
                <th>Pays</th>
                <th>Expire le</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (registration of pendingRegistrations; track registration.id) {
                <tr [class.expired]="isExpired(registration)">
                  <td>{{ registration.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td>
                    <strong>{{ registration.firstName }} {{ registration.lastName }}</strong><br>
                    <small>@{{ registration.username }}</small>
                  </td>
                  <td>{{ registration.email }}</td>
                  <td>{{ registration.organizationName }}</td>
                  <td>{{ registration.organizationEmail }}</td>
                  <td>{{ registration.organizationCountry }}</td>
                  <td [class.expired-date]="isExpired(registration)">
                    {{ registration.expiresAt | date:'dd/MM/yyyy HH:mm' }}
                  </td>
                  <td>
                    @if (isExpired(registration)) {
                      <span class="badge badge-danger">Expiré</span>
                    } @else {
                      <span class="badge badge-warning">En attente</span>
                    }
                  </td>
                  <td>
                    <button class="btn-delete" (click)="deleteRegistration(registration.id)" title="Supprimer">
                      🗑️
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        
        <div class="stats-bar">
          <p>
            <strong>Total :</strong> {{ pendingRegistrations.length }} inscription(s) en attente
            @if (expiredCount > 0) {
              | <span class="expired-count">{{ expiredCount }} expirée(s)</span>
            }
          </p>
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

    .pending-registrations-container {
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
      background: var(--neu-bg);
      min-height: 100vh;
    }

    h2 {
      color: var(--neu-text-heading);
      margin-bottom: 2rem;
      font-size: 1.8rem;
      font-family: var(--font-display);
    }

    .empty-message {
      text-align: center;
      padding: 3rem;
      color: var(--neu-text-muted);
      font-size: 1.1rem;
      background: var(--neu-bg);
      border-radius: var(--neu-radius-container);
      box-shadow: var(--neu-extruded);
    }

    .registrations-table-container {
      overflow-x: auto;
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      border-radius: var(--neu-radius-container);
      box-shadow: var(--neu-extruded);
      padding: 1rem;
    }

    .registrations-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0 0.5rem;
    }

    .registrations-table th {
      padding: 0.75rem 1rem;
      text-align: left;
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--neu-text-muted);
      background: transparent;
    }

    .registrations-table td {
      padding: 0.75rem 1rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-extruded-sm);
      color: var(--neu-text-primary);
    }

    .registrations-table td:first-child {
      border-radius: var(--neu-radius-inner) 0 0 var(--neu-radius-inner);
    }

    .registrations-table td:last-child {
      border-radius: 0 var(--neu-radius-inner) var(--neu-radius-inner) 0;
    }

    .registrations-table tbody tr:hover td {
      box-shadow: var(--neu-extruded);
    }

    .registrations-table tbody tr.expired td {
      opacity: 0.6;
    }

    .badge {
      display: inline-block;
      padding: 0.375rem 0.875rem;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      box-shadow: var(--neu-extruded-sm);
    }

    .badge-warning {
      background: var(--neu-bg);
      color: var(--neu-accent-warning);
    }

    .badge-danger {
      background: var(--neu-accent-danger);
      color: white;
    }

    .expired-date {
      color: var(--neu-accent-danger);
      font-weight: 600;
    }

    .stats-bar {
      margin-top: 1.5rem;
      padding: 1rem 1.5rem;
      background: var(--neu-bg);
      border-radius: var(--neu-radius-container);
      text-align: center;
      box-shadow: var(--neu-inset);
      color: var(--neu-text-primary);
    }

    .expired-count {
      color: var(--neu-accent-danger);
      font-weight: 600;
    }

    small {
      color: var(--neu-text-muted);
      font-size: 0.85rem;
    }

    .btn-delete {
      background: var(--neu-bg);
      border: none;
      cursor: pointer;
      font-size: 1.1rem;
      padding: 0.5rem 0.75rem;
      border-radius: var(--neu-radius-inner);
      box-shadow: var(--neu-extruded-sm);
      min-width: 44px;
      min-height: 44px;
      transition: box-shadow 0.2s ease;
    }

    .btn-delete:hover {
      box-shadow: var(--neu-extruded);
    }

    .btn-delete:active {
      box-shadow: var(--neu-inset);
    }

    @media (max-width: 768px) {
      .pending-registrations-container {
        padding: 1rem;
      }

      .registrations-table-container {
        padding: 0.5rem;
      }

      .registrations-table th,
      .registrations-table td {
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
      }
    }

    @media (max-width: 1024px) {
      .registrations-table-container {
        overflow-x: auto;
      }
    }
  `]
})
export class PendingRegistrationsComponent implements OnInit {
  private adminService = inject(AdminService);
  private notificationService = inject(NotificationService);

  pendingRegistrations: PendingRegistration[] = [];
  loading = false;

  get expiredCount(): number {
    return this.pendingRegistrations.filter(r => this.isExpired(r)).length;
  }

  ngOnInit() {
    this.loadPendingRegistrations();
  }

  loadPendingRegistrations() {
    this.loading = true;
    this.adminService.getPendingRegistrations().subscribe({
      next: (registrations) => {
        this.pendingRegistrations = registrations;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des inscriptions en attente:', err);
        this.notificationService.error('Erreur lors du chargement des inscriptions en attente');
        this.loading = false;
      }
    });
  }

  isExpired(registration: PendingRegistration): boolean {
    const expiresAt = new Date(registration.expiresAt);
    return expiresAt < new Date();
  }

  deleteRegistration(id: number) {
    if (!confirm('Supprimer cette inscription en attente ?')) return;
    this.adminService.deletePendingRegistration(id).subscribe({
      next: () => {
        this.pendingRegistrations = this.pendingRegistrations.filter(r => r.id !== id);
        this.notificationService.success('Inscription supprimée');
      },
      error: (err) => {
        console.error('Erreur suppression:', err);
        this.notificationService.error('Erreur lors de la suppression');
      }
    });
  }
}

