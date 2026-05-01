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

      <!-- Navigation : 2 cartes de modes -->
      <nav class="mode-nav">
        <div class="mode-card">
          <span class="mode-label">🔍 Je cherche une position</span>
          <div class="mode-links">
            <a routerLink="search"            routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">
              HScode-06 <span class="credit-cost">10 cr</span>
            </a>
            <a routerLink="search-position10" routerLinkActive="active">
              Position-10 <span class="credit-cost">15 cr</span>
            </a>
          </div>
        </div>
        <div class="mode-card">
          <span class="mode-label">📋 Je cherche une désignation</span>
          <div class="mode-links">
            <a routerLink="decode"     routerLinkActive="active">
              Vérifier un code HS <span class="credit-cost">2 cr</span>
            </a>
            <a routerLink="decode-p10" routerLinkActive="active">
              Vérifier un code P10 <span class="credit-cost">5 cr</span>
            </a>
          </div>
        </div>
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
      background: #EDF0F5;
      border-radius: var(--neu-radius-container, 32px);
      box-shadow: 6px 6px 12px rgba(163,177,198,0.35), -6px -6px 12px rgba(255,255,255,0.7);
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

    /* ── Navigation deux cartes ── */

    .mode-nav {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 20px 0 28px;
    }

    .mode-card {
      background: var(--neu-bg, #E0E5EC);
      border-radius: 20px;
      padding: 20px 24px;
      box-shadow: 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5);
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: box-shadow 0.25s ease;
    }

    /* Carte active = celle qui contient un lien .active */
    .mode-card:has(a.active) {
      box-shadow: inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5);
    }

    .mode-label {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--neu-text-primary, #3D4852);
      font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
      transition: color 0.25s ease;
    }

    .mode-card:has(a.active) .mode-label {
      color: var(--neu-accent-secondary, #2DD4BF);
    }

    .mode-links {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .mode-links a {
      padding: 9px 20px;
      min-height: 40px;
      display: inline-flex;
      align-items: center;
      font-size: 0.9rem;
      font-weight: 600;
      border-radius: 10px;
      background: var(--neu-bg, #E0E5EC);
      box-shadow: 4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.5);
      color: var(--neu-text-muted, #6B7280);
      text-decoration: none;
      transition: box-shadow 0.2s ease, color 0.2s ease;
    }

    .mode-links a:hover {
      color: var(--neu-accent-secondary, #2DD4BF);
    }

    .mode-links a.active {
      box-shadow: inset 4px 4px 8px rgba(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.5);
      color: var(--neu-accent-secondary, #2DD4BF);
      font-weight: 700;
    }

    .credit-cost {
      margin-left: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 20px;
      background: rgba(163,177,198,0.25);
      color: var(--neu-text-muted, #6B7280);
      white-space: nowrap;
    }

    .mode-links a.active .credit-cost {
      background: rgba(45,212,191,0.15);
      color: var(--neu-accent-secondary, #2DD4BF);
    }

    @media (max-width: 768px) {
      .container { padding: 16px; }
      .mode-nav { grid-template-columns: 1fr; gap: 12px; margin: 16px 0 20px; }
      .mode-card { padding: 16px 18px; }
      .mode-links a { padding: 8px 14px; font-size: 0.85rem; }
    }
  `]
})
export class TarifComponent {}
