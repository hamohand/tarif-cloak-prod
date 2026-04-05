import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertService, QuotaAlert } from '../../../core/services/alert.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="alerts-container">
      <div class="alerts-header">
        <h2>🔔 Mes Alertes de Quota</h2>
        @if (alerts.length > 0) {
          <button class="btn btn-secondary" (click)="markAllAsRead()">Marquer tout comme lu</button>
        }
      </div>

      @if (loading) {
        <p>Chargement des alertes...</p>
      } @else if (alerts.length === 0) {
        <div class="no-alerts">
          <p>✅ Aucune alerte active</p>
          <p class="subtitle">La consommation de votre organisation est dans les limites normales par rapport à votre quota.</p>
        </div>
      } @else {
        <div class="alerts-list">
          @for (alert of alerts; track alert.id) {
            <div class="alert-card" [class]="getAlertClass(alert.alertType)" [class.read]="alert.isRead">
              <div class="alert-header">
                <div class="alert-icon">{{ getAlertIcon(alert.alertType) }}</div>
                <div class="alert-title">
                  <h3>{{ alert.organizationName }}</h3>
                  <p class="alert-date">{{ formatDate(alert.createdAt) }}</p>
                </div>
                @if (!alert.isRead) {
                  <button class="btn-mark-read" (click)="markAsRead(alert.id)">✓ Marquer comme lu</button>
                }
              </div>
              <div class="alert-body">
                <p class="alert-message">{{ alert.message }}</p>
                <div class="alert-details">
                  <div class="detail-item">
                    <span class="label">Consommation de l'organisation:</span>
                    <span class="value">{{ alert.currentUsage }} / {{ alert.monthlyQuota || '∞' }} crédits</span>
                  </div>
                  <div class="detail-item">
                    <span class="label">Pourcentage utilisé:</span>
                    <span class="value" [class]="getPercentageClass(alert.percentageUsed)">
                      {{ alert.percentageUsed.toFixed(1) }}%
                    </span>
                  </div>
                </div>
                <p class="alert-note">💡 Note: Cette alerte concerne la consommation totale de votre organisation (somme de tous les crédits consommés par tous les collaborateurs) par rapport au quota défini par votre plan tarifaire.</p>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      background: var(--neu-bg, #E0E5EC);
      min-height: calc(100vh - 60px);
    }

    .alerts-container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .alerts-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .alerts-header h2 {
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display);
      margin: 0;
    }

    .no-alerts {
      text-align: center;
      padding: 4rem 2rem;
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      border-radius: var(--neu-radius-container, 32px);
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
    }

    .no-alerts p {
      font-size: 1.2rem;
      color: var(--neu-text-primary, #3D4852);
      margin: 0.5rem 0;
    }

    .no-alerts .subtitle {
      color: var(--neu-text-muted, #6B7280);
      font-size: 1rem;
    }

    .alerts-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .alert-card {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      border-radius: var(--neu-radius-container, 32px);
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      padding: 1.5rem;
      padding-left: 2rem;
      position: relative;
      overflow: hidden;
      transition: transform 0.2s ease-in-out, box-shadow 0.2s ease, background 0.2s ease;
    }

    .alert-card::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 5px;
      border-radius: 32px 0 0 32px;
    }

    .alert-card:hover {
      transform: translateY(-2px);
      background: var(--neu-card-bg-hover, linear-gradient(145deg, #EDF0F5, #DCE1E8));
      box-shadow: 12px 12px 20px rgba(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6);
    }

    .alert-card.read {
      opacity: 0.7;
    }

    .alert-card.warning::before {
      background: var(--neu-accent-warning, #ED8936);
    }

    .alert-card.critical::before {
      background: var(--neu-accent-danger, #E53E3E);
    }

    .alert-card.exceeded::before {
      background: #C53030;
    }

    .alert-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .alert-icon {
      font-size: 1.5rem;
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--neu-bg, #E0E5EC);
      box-shadow: var(--neu-inset-deep, inset 8px 8px 14px rgba(163,177,198,0.7), inset -8px -8px 14px rgba(255,255,255,0.6));
      flex-shrink: 0;
    }

    .alert-title {
      flex: 1;
      min-width: 0;
    }

    .alert-title h3 {
      margin: 0;
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display);
      font-size: 1.2rem;
    }

    .alert-date {
      margin: 0.25rem 0 0 0;
      color: var(--neu-text-muted, #6B7280);
      font-size: 0.9rem;
    }

    .alert-body {
      margin-top: 1rem;
    }

    .alert-message {
      font-size: 1rem;
      color: var(--neu-text-primary, #3D4852);
      margin: 0 0 1rem 0;
      line-height: 1.5;
    }

    .alert-note {
      font-size: 0.85rem;
      color: var(--neu-text-muted, #6B7280);
      margin: 1rem 0 0 0;
      padding: 0.75rem;
      background: var(--neu-bg, #E0E5EC);
      border-radius: 16px;
      box-shadow: var(--neu-inset-sm, inset 4px 4px 6px rgba(163,177,198,0.5), inset -4px -4px 6px rgba(255,255,255,0.4));
      font-style: italic;
    }

    .alert-details {
      display: flex;
      gap: 2rem;
      flex-wrap: wrap;
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .detail-item .label {
      font-size: 0.85rem;
      color: var(--neu-text-muted, #6B7280);
      font-weight: 600;
    }

    .detail-item .value {
      font-size: 1.1rem;
      color: var(--neu-text-heading, #2D3748);
      font-weight: 700;
      font-family: var(--font-display);
    }

    .detail-item .value.warning {
      color: var(--neu-accent-warning, #ED8936);
    }

    .detail-item .value.critical {
      color: var(--neu-accent-danger, #E53E3E);
    }

    .detail-item .value.exceeded {
      color: #C53030;
    }

    .btn {
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.25s ease;
      min-height: 44px;
    }

    .btn-secondary {
      background: var(--neu-bg, #E0E5EC);
      color: var(--neu-accent, #6C63FF);
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.5), -5px -5px 10px rgba(255,255,255,0.4));
    }

    .btn-secondary:hover {
      box-shadow: 7px 7px 14px rgba(163,177,198,0.6), -7px -7px 14px rgba(255,255,255,0.5);
    }

    .btn-secondary:active {
      box-shadow: var(--neu-inset-sm, inset 4px 4px 6px rgba(163,177,198,0.5), inset -4px -4px 6px rgba(255,255,255,0.4));
    }

    .btn-mark-read {
      padding: 0.4rem 0.8rem;
      background: var(--neu-accent, #6C63FF);
      color: #fff;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      min-height: 44px;
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.5), -5px -5px 10px rgba(255,255,255,0.4));
      transition: all 0.25s ease;
    }

    .btn-mark-read:hover {
      box-shadow: 7px 7px 14px rgba(163,177,198,0.6), -7px -7px 14px rgba(255,255,255,0.5);
    }

    .btn-mark-read:active {
      box-shadow: var(--neu-inset-sm, inset 4px 4px 6px rgba(163,177,198,0.5), inset -4px -4px 6px rgba(255,255,255,0.4));
    }

    @media (max-width: 768px) {
      .alerts-container {
        padding: 1rem;
      }

      .alert-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .alert-details {
        flex-direction: column;
        gap: 1rem;
      }
    }
  `]
})
export class AlertsComponent implements OnInit, OnDestroy {
  private alertService = inject(AlertService);

  alerts: QuotaAlert[] = [];
  loading = false;
  private refreshSubscription?: Subscription;

  ngOnInit() {
    this.loadAlerts();
    // Rafraîchir les alertes toutes les 30 secondes
    this.refreshSubscription = interval(30000).subscribe(() => {
      this.loadAlerts();
    });
  }

  ngOnDestroy() {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  loadAlerts() {
    this.loading = true;
    this.alertService.getMyAlerts().subscribe({
      next: (alerts) => {
        this.alerts = alerts;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des alertes:', err);
        this.loading = false;
      }
    });
  }

  markAsRead(alertId: number) {
    this.alertService.markAlertAsRead(alertId).subscribe({
      next: () => {
        // Mettre à jour l'alerte localement
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
          alert.isRead = true;
        }
      },
      error: (err) => {
        console.error('Erreur lors du marquage de l\'alerte:', err);
      }
    });
  }

  markAllAsRead() {
    this.alertService.markAllMyAlertsAsRead().subscribe({
      next: () => {
        // Marquer toutes les alertes comme lues localement
        this.alerts.forEach(alert => alert.isRead = true);
      },
      error: (err) => {
        console.error('Erreur lors du marquage de toutes les alertes:', err);
      }
    });
  }

  getAlertClass(alertType: string): string {
    return alertType.toLowerCase();
  }

  getAlertIcon(alertType: string): string {
    switch (alertType) {
      case 'WARNING':
        return '🟡';
      case 'CRITICAL':
        return '🔴';
      case 'EXCEEDED':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  }

  getPercentageClass(percentage: number): string {
    if (percentage >= 100) {
      return 'exceeded';
    } else if (percentage >= 80) {
      return 'warning';
    }
    return '';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

