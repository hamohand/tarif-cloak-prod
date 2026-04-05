import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="container">
      <header>
        <h1>Universal Tariff for International Trade</h1>
        <h2>Harmonised System - Nomenclature</h2>
        <h3>Recherche multilingue - Multilingual search - 多语言搜索 - بحث متعدد اللغات</h3>
      </header>

      <!-- Navigation : 4 onglets fixes -->
      <nav class="main-nav">
        <a routerLink="search"            routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">HS-code</a>
        <a routerLink="decode"            routerLinkActive="active">Décoder un code HS</a>
        <a routerLink="search-position10" routerLinkActive="active">Position-10</a>
        <a routerLink="decode-p10"        routerLinkActive="active">Décoder un code P10</a>
      </nav>

      <main>
        <router-outlet></router-outlet>
      </main>

      <footer>
        <p>&copy; 2025-2026 Enclume-Numérique</p>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      background: var(--neu-bg, #E0E5EC);
      min-height: 100vh;
      font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: var(--neu-text-primary, #3D4852);
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 30px;
      background: var(--neu-bg, #E0E5EC);
      border-radius: var(--neu-radius-container, 32px);
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      min-height: calc(100vh - 60px);
      display: flex;
      flex-direction: column;
    }

    header h1 {
      text-align: center;
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
      font-weight: 700;
      margin-bottom: 5px;
    }

    h2 {
      text-align: center;
      margin-bottom: 15px;
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
      font-weight: 500;
    }

    h3 {
      text-align: center;
      color: var(--neu-text-muted, #6B7280);
      font-size: 1rem;
      font-weight: 400;
      margin-top: 10px;
    }

    main {
      flex-grow: 1;
      padding-bottom: 20px;
    }

    footer {
      margin-top: 30px;
      padding-top: 15px;
      text-align: center;
      color: var(--neu-text-muted, #6B7280);
      font-size: 0.85rem;
    }

    /* Tab navigation */
    .main-nav {
      display: flex;
      gap: 10px;
      margin: 16px 0 0 0;
      padding: 8px;
      background: var(--neu-bg, #E0E5EC);
      border-radius: var(--neu-radius-inner, 12px);
      flex-wrap: wrap;
    }

    .main-nav a {
      padding: 12px 28px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      font-size: 0.95rem;
      font-weight: 600;
      border: none;
      border-radius: var(--neu-radius-inner, 12px);
      background: var(--neu-bg, #E0E5EC);
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
      color: var(--neu-text-muted, #6B7280);
      cursor: pointer;
      text-decoration: none;
      transition: box-shadow 0.25s ease, color 0.25s ease;
    }

    .main-nav a:hover {
      color: var(--neu-accent-secondary, #2DD4BF);
    }

    .main-nav a.active {
      box-shadow: var(--neu-inset, inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5));
      color: var(--neu-accent-secondary, #2DD4BF);
      font-weight: 700;
    }

    @media (max-width: 768px) {
      .container { padding: 16px; }
      .main-nav { gap: 8px; padding: 6px; }
      .main-nav a { padding: 10px 16px; font-size: 0.85rem; }
    }

    @media (max-width: 1024px) {
      .main-nav { flex-wrap: wrap; }
    }
  `]
})
export class TarifComponent {}
