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
      background-color: hsl(220, 15%, 92%);
      min-height: 100vh;
      font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: hsl(210, 10%, 25%);
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 30px;
      background-color: #e8e8e8;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      min-height: calc(100vh - 60px);
      display: flex;
      flex-direction: column;
    }

    header h1 {
      text-align: center;
      color: hsl(210, 100%, 35%);
      font-weight: 700;
      margin-bottom: 5px;
    }

    h2 {
      text-align: center;
      margin-bottom: 15px;
      color: hsl(210, 100%, 35%);
      font-weight: 500;
    }

    h3 {
      text-align: center;
      color: hsl(210, 100%, 35%);
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
      border-top: 1px solid hsl(210, 15%, 90%);
      padding-top: 15px;
      text-align: center;
      color: hsl(210, 10%, 60%);
      font-size: 0.85rem;
    }

    /* Barre principale */
    .main-nav {
      display: flex;
      gap: 6px;
      margin: 16px 0 0 0;
      padding-bottom: 0;
    }

    .main-nav a {
      padding: 10px 28px;
      font-size: 0.95rem;
      font-weight: 600;
      border: 2px solid hsl(210, 15%, 75%);
      border-bottom: none;
      border-radius: 8px 8px 0 0;
      background: hsl(210, 15%, 87%);
      color: hsl(210, 10%, 45%);
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s, color 0.15s;
      position: relative;
      bottom: -2px;
    }

    .main-nav a:hover {
      background: hsl(210, 20%, 82%);
      color: hsl(210, 100%, 30%);
    }

    .main-nav a.active {
      background: hsl(210, 100%, 35%);
      color: white;
      border-color: hsl(210, 100%, 35%);
      z-index: 1;
    }

  `]
})
export class TarifComponent {}
