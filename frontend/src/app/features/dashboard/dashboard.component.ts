import { Component, OnInit, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { JsonPipe, AsyncPipe, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, JsonPipe, AsyncPipe, RouterLink],
  template: `
    <div class="dashboard-container" *ngIf="!(isOrganizationAccount | async); else organizationNotice">
      <h2>Tableau de bord</h2>

      <div class="user-info-card">
        <h3>Informations utilisateur</h3>
        Prénom Nom : {{ userInfo.name }}<br>
        Username : {{ userInfo.username }}<br>
        Email : {{ userInfo.email}}
        <pre>{{ userInfo | json }}</pre>
      </div>

      <div class="stats-container">
        <div class="stat-card">
          <h4>📈 Projets</h4>
          <p>5 projets actifs</p>
        </div>

        <div class="stat-card">
          <h4>👥 Utilisateurs</h4>
          <p>12 membres</p>
        </div>

        <div class="stat-card">
          <h4>✅ Tâches</h4>
          <p>24 tâches terminées</p>
        </div>
      </div>
    </div>

    <ng-template #organizationNotice>
      <div class="organization-notice">
        <h2>Compte organisation</h2>
        <p>Vous êtes connecté avec le compte de l'organisation. Utilisez la page <a routerLink="/organization/account">Mon organisation</a> pour gérer vos collaborateurs, suivre les statistiques globales et gérer votre plan tarifaire.</p>
      </div>
    </ng-template>
  `,
  styles: [`
    :host {
      display: block;
      background: var(--neu-bg, #E0E5EC);
      min-height: 100vh;
    }

    .dashboard-container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    h2 {
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display);
      margin-bottom: 2rem;
    }

    .user-info-card {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      padding: 1.5rem;
      border-radius: var(--neu-radius-container, 32px);
      margin-bottom: 2rem;
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
    }

    .user-info-card h3 {
      margin-top: 0;
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display);
    }

    .user-info-card p,
    .user-info-card br {
      color: var(--neu-text-primary, #3D4852);
    }

    pre {
      background: var(--neu-bg, #E0E5EC);
      padding: 1rem;
      border-radius: 16px;
      overflow-x: auto;
      box-shadow: var(--neu-inset, inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5));
      color: var(--neu-text-primary, #3D4852);
      font-size: 0.85rem;
    }

    .stats-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-top: 2rem;
    }

    .stat-card {
      background: var(--neu-card-teal, linear-gradient(145deg, #E2F2F0, #D4EAE7));
      padding: 1.5rem;
      border-radius: var(--neu-radius-container, 32px);
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      text-align: center;
      min-height: 44px;
      transition: box-shadow 0.25s ease, background 0.25s ease;
    }

    .stat-card:hover {
      background: var(--neu-card-teal-hover, linear-gradient(145deg, #E9F6F4, #DAF0ED));
      box-shadow: 12px 12px 20px rgba(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6);
    }

    .stat-card h4 {
      color: var(--neu-text-muted, #6B7280);
      margin-bottom: 0.5rem;
      font-family: var(--font-display);
    }

    .stat-card p {
      font-family: var(--font-display);
      color: var(--neu-accent, #6C63FF);
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0;
    }

    .organization-notice {
      padding: 3rem;
      margin: 2rem;
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      color: var(--neu-text-primary, #3D4852);
      border-radius: var(--neu-radius-container, 32px);
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      text-align: center;
    }

    .organization-notice h2 {
      color: var(--neu-text-heading, #2D3748);
    }

    .organization-notice p {
      color: var(--neu-text-primary, #3D4852);
    }

    .organization-notice a {
      color: var(--neu-accent, #6C63FF);
      font-weight: 600;
      text-decoration: underline;
    }

    .organization-notice a:hover {
      color: var(--neu-accent-secondary, #38B2AC);
    }

    @media (max-width: 768px) {
      .dashboard-container {
        padding: 1rem;
      }

      .stats-container {
        grid-template-columns: 1fr;
      }

      .organization-notice {
        margin: 1rem;
        padding: 1.5rem;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  userInfo: any;
  isOrganizationAccount = this.authService.isOrganizationAccount();

  ngOnInit() {
    this.userInfo = this.authService.getUserInfo();
  }
}
