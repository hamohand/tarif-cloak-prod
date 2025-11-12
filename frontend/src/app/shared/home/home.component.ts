import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="home-container">
      <h1>Bienvenue sur Enclume-Numérique</h1>
      <p>Votre solution complète pour la conformité tarifaire.</p>

      <div class="features primary" *ngIf="isCollaboratorAccount$ | async; else restrictedAccess">
        <div class="feature-card">
          <a [routerLink]="['/recherche']" class="cta-button">
            Accéder à Tariff - recherche
          </a>
        </div>
        <div class="feature-card">
          <a [routerLink]="['/recherche','searchListLots']" class="cta-button">
            Accéder à Tariff - multi-recherche
          </a>
        </div>
      </div>

      <ng-template #restrictedAccess>
        <div class="features primary" *ngIf="isOrganizationAccount$ | async; else guestAccess">
          <div class="feature-card advise">
            <h3>👥 Gestion d'organisation</h3>
            <p>Utilisez l'espace <strong>Mon organisation</strong> pour inviter vos collaborateurs et suivre les statistiques globales.</p>
            <a [routerLink]="['/organization/account']" class="cta-button secondary">
              Ouvrir l'espace organisation
            </a>
          </div>
        </div>
      </ng-template>

      <ng-template #guestAccess>
        <div class="features primary">
          <div class="feature-card advise">
            <h3>🔑 Connexion requise</h3>
            <p>Connectez-vous ou créez un compte organisation pour accéder aux outils Tariff.</p>
            <a [routerLink]="['/auth/login']" class="cta-button secondary">
              Se connecter
            </a>
            <a [routerLink]="['/pricing']" class="cta-button ghost">
              Découvrir les plans tarifaires
            </a>
          </div>
        </div>
      </ng-template>

      <div class="features secondary">
        <div class="feature-card">
          <h3>🔐 Sécurité</h3>
          <p>Authentification et gestion fine des rôles.</p>
        </div>
        <div class="feature-card">
          <h3>⚡ Performance</h3>
          <p>Moteur de recherche optimisé pour la réglementation douanière.</p>
        </div>
        <div class="feature-card">
          <h3>📱 Responsive</h3>
          <p>Une interface adaptée à tous les usages.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .home-container {
      text-align: center;
      padding: 2rem;
    }

    h1 {
      color: #2c3e50;
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }

    p {
      font-size: 1.2rem;
      color: #7f8c8d;
      margin-bottom: 3rem;
    }

    .features {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-bottom: 3rem;
      flex-wrap: wrap;
    }

    .features.primary {
      margin-top: 2rem;
    }

    .features.secondary {
      margin-top: 1rem;
    }

    .feature-card {
      background: rgb(220, 220, 220);
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      width: 220px;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      align-items: center;
    }

    .feature-card h3 {
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    .feature-card.advise {
      background: linear-gradient(135deg, #1f2937, #111827);
      color: #f9fafb;
      text-align: left;
    }

    .feature-card.advise h3 {
      color: #facc15;
      margin-bottom: 0.5rem;
    }

    .cta-button {
      background-color: #3498db;
      color: white;
      padding: 1rem 2rem;
      font-size: 1.1rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.3s;
      text-decoration: none;
      display: inline-block;
    }

    .cta-button:hover {
      background-color: #2980b9;
    }

    .cta-button.secondary {
      background-color: #facc15;
      color: #1f2937;
      font-weight: 600;
    }

    .cta-button.secondary:hover {
      background-color: #fbbf24;
    }

    .cta-button.ghost {
      background-color: transparent;
      color: #facc15;
      border: 2px solid #facc15;
    }

    .cta-button.ghost:hover {
      background-color: rgba(250, 204, 21, 0.1);
    }

    @media (max-width: 768px) {
      .feature-card {
        width: 100%;
      }
    }
  `]
})
export class HomeComponent {
  private authService = inject(AuthService);

  isAuthenticated$ = this.authService.isAuthenticated();
  isOrganizationAccount$ = this.authService.isOrganizationAccount();
  isCollaboratorAccount$ = this.authService.isCollaboratorAccount();
}
