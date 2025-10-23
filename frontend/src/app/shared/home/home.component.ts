import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="home-container">
      <h1>Bienvenue sur Enclume-Numérique</h1>
      <p>Votre solution complète</p>

      <div class="features">
        <div class="feature-card">
          <h3>🔐 Sécurité</h3>
          <p>Authentification sécurisée</p>
        </div>

        <div class="feature-card">
          <h3>⚡ Performance</h3>
          <p>Application rapide et réactive</p>
        </div>

        <div class="feature-card">
          <h3>📱 Responsive</h3>
          <p>Compatible avec tous les appareils</p>
        </div>
      </div>

      <button routerLink="/recherche" class="cta-button">
        Accéder à l'application Tariff-recherche
      </button><br><br>
      <button routerLink="recherche/searchListLots" class="cta-button">
        Accéder à l'application Tariff-multi-recherche
      </button>
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

    .feature-card {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      width: 250px;
    }

    .feature-card h3 {
      color: #2c3e50;
      margin-bottom: 1rem;
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
    }

    .cta-button:hover {
      background-color: #2980b9;
    }
  `]
})
export class HomeComponent {}
