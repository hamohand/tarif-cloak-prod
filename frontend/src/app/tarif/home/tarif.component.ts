import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="container">
      <header>
        <h1>Universal Customs Tariff for International Trade</h1>
        <h2>Harmonised System : HS Code</h2>
        <h3>Recherche multilingue - Multilingual search - 多语言搜索 - بحث متعدد اللغات</h3>
      </header>

      <!-- Barre principale -->
      <nav class="main-nav">
        <a routerLink="search"          (click)="section='hs'"     [class.active]="section === 'hs'">HS-code</a>
        <a routerLink="search-position10" (click)="section='p10'"  [class.active]="section === 'p10'">Position-10</a>
        <a routerLink="searchListLots"  (click)="section='listes'" [class.active]="section === 'listes'">Listes</a>
      </nav>

      <!-- Sous-navigation selon la section active -->
      <nav class="sub-nav">
        @if (section === 'hs') {
          <a routerLink="search"  routerLinkActive="active">HS-code</a>
          <a routerLink="decode"  routerLinkActive="active">Décoder un code HS</a>
        }
        @if (section === 'p10') {
          <a routerLink="search"          routerLinkActive="active">HS-code</a>
          <a routerLink="decode"          routerLinkActive="active">Décoder un code HS</a>
          <a routerLink="search-position10" routerLinkActive="active">Position10</a>
          <a routerLink="decode-p10"      routerLinkActive="active">Décoder un code P10</a>
        }
        @if (section === 'listes') {
          <a routerLink="searchListLots"  routerLinkActive="active">Recherche par liste</a>
          <a routerLink="batch-search"    routerLinkActive="active">Recherche par lots</a>
        }
      </nav>

      <main>
        <router-outlet></router-outlet>
      </main>

      <footer>
        <p>&copy; 2025 Enclume-Numérique</p>
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

    /* Sous-navigation */
    .sub-nav {
      display: flex;
      gap: 4px;
      padding: 6px 8px 0 8px;
      border: 2px solid hsl(210, 15%, 75%);
      border-radius: 0 8px 0 0;
      background: hsl(210, 15%, 93%);
      margin-bottom: 2px;
      border-bottom: 2px solid hsl(210, 15%, 80%);
      min-height: 42px;
    }

    .sub-nav a {
      padding: 8px 18px;
      text-decoration: none;
      color: hsl(210, 10%, 45%);
      border-radius: 6px 6px 0 0;
      border: 1px solid transparent;
      border-bottom: none;
      font-size: 0.88rem;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
      position: relative;
      bottom: -2px;
    }

    .sub-nav a:hover {
      background: hsl(210, 20%, 88%);
      color: hsl(210, 100%, 35%);
    }

    .sub-nav a.active {
      background: #e8e8e8;
      color: hsl(210, 100%, 35%);
      border-color: hsl(210, 15%, 80%);
      font-weight: 600;
    }
  `]
})
export class TarifComponent implements OnInit {
  section: 'hs' | 'p10' | 'listes' = 'hs';

  constructor(private _router: Router) {}

  ngOnInit(): void {
    this.detectSection(this._router.url);
    this._router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => this.detectSection(e.urlAfterRedirects));
  }

  private detectSection(url: string): void {
    if (url.includes('search-position10') || url.includes('decode-p10')) {
      this.section = 'p10';
    } else if (url.includes('searchListLots') || url.includes('batch-search')) {
      this.section = 'listes';
    } else if (url.includes('search') || url.includes('decode')) {
      if (this.section === 'listes') this.section = 'hs';
    }
  }
}
