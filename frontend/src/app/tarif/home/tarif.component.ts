import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule, AsyncPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { SearchStateService } from '../services/search-state.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-tarif-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, AsyncPipe],
  template: `
    <div class="tarif-shell">
      <header class="tarif-header">
        <div class="header-copy">
          <span class="header-kicker">
            <span class="trust-dot"></span>
            Nomenclature officielle · DGD &amp; EUR-Lex
          </span>
          <h1>Nomenclature Douanière &amp; Recherche Tarifaire</h1>
          <p class="subtitle">
            Algérie (P10 · DD, TVA, UQN, FAP) &amp; Union Européenne (NC8 2026 · TDC) — recherche, décodage et alignement HS6.
          </p>
        </div>

        <div class="zone-switcher" role="group" aria-label="Zone tarifaire active">
          <button
            type="button"
            class="zone-pill-btn"
            [class.active]="(state.selectedZone$ | async) !== 'EU'"
            (click)="state.setZone('DZ')">
            <span class="zone-code">DZ</span> Algérie · P10
          </button>
          <button
            type="button"
            class="zone-pill-btn eu"
            [class.active]="(state.selectedZone$ | async) === 'EU'"
            (click)="state.setZone('EU')">
            <span class="zone-code">UE</span> Europe · NC8
          </button>
        </div>
      </header>

      <nav class="workspace-nav" aria-label="Modes de recherche et décodage">
        <a routerLink="search-position10" routerLinkActive="active" class="nav-pill">
          <span>Recherche {{ (state.selectedZone$ | async) === 'EU' ? 'NC8 (UE)' : 'P10 (DZ)' }}</span>
          <span class="badge-cost">{{ (isAuthenticated$ | async) ? '15 cr' : '1 essai' }}</span>
        </a>

        <a routerLink="search" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-pill">
          <span>HS-06 International</span>
          <span class="badge-cost">{{ (isAuthenticated$ | async) ? '10 cr' : 'Essai' }}</span>
        </a>

        @if ((isAuthenticated$ | async) && !isBetaMode) {
          <a routerLink="searchListLots" routerLinkActive="active" class="nav-pill">
            <span>Liste CSV</span>
          </a>
          <a routerLink="batch-search" routerLinkActive="active" class="nav-pill">
            <span>Batch</span>
          </a>
        }

        <span class="nav-sep" aria-hidden="true"></span>

        <a routerLink="decode-p10"
           routerLinkActive="route-match"
           #rlaDecode="routerLinkActive"
           class="nav-pill"
           [class.active]="rlaDecode.isActive && !(state.compareMode$ | async)"
           (click)="state.compareMode = false">
          <span>Décodeur par code</span>
          <span class="badge-free">{{ (isAuthenticated$ | async) ? 'Gratuit' : 'Aperçu · 3/j' }}</span>
        </a>

        <button type="button"
                class="nav-pill compare-pill"
                [class.active]="rlaDecode.isActive && (state.compareMode$ | async) === true"
                (click)="openComparator()">
          <span>⇄ Comparateur DZ ↔ UE</span>
          <span class="badge-free">{{ (isAuthenticated$ | async) ? 'Gratuit' : 'Aperçu · 3/j' }}</span>
        </button>
      </nav>

      <main class="tarif-main">
        <router-outlet></router-outlet>
      </main>

      <footer class="tarif-footer">
        <p>&copy; 2025-2026 Enclume-Numérique — Données officielles DGD / EUR-Lex (NC 2026) / OMD</p>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--neu-bg, #070B14);
      color: #E2E8F0;
    }

    .tarif-shell {
      max-width: 1140px;
      margin: 0 auto;
      padding: 20px 20px 32px;
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - 64px);
    }

    .tarif-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 16px;
      text-align: left;
    }

    .header-copy {
      flex: 1 1 520px;
    }

    .header-kicker {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-family: var(--font-sans, 'Inter', sans-serif);
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #34D399;
      margin-bottom: 6px;
    }

    .trust-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10B981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.75);
    }

    .tarif-header h1 {
      margin: 0 0 6px;
      color: #F8FAFC;
      font-family: var(--font-serif, 'Source Serif 4', Georgia, serif);
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.015em;
    }

    .subtitle {
      margin: 0;
      font-family: var(--font-sans, 'Inter', sans-serif);
      color: #94A3B8;
      font-size: 0.9rem;
      font-weight: 400;
      line-height: 1.45;
    }

    .zone-switcher {
      display: inline-flex;
      gap: 4px;
      padding: 4px;
      border-radius: 10px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.09);
      flex-shrink: 0;
    }

    .zone-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 13px;
      border-radius: 7px;
      border: 1px solid transparent;
      background: transparent;
      color: #94A3B8;
      font-size: 0.83rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .zone-pill-btn:hover { color: #F8FAFC; background: rgba(255, 255, 255, 0.04); }

    .zone-pill-btn.active {
      background: rgba(245, 158, 11, 0.16);
      border-color: rgba(245, 158, 11, 0.45);
      color: #FCD34D;
    }

    .zone-pill-btn.eu.active {
      background: rgba(59, 130, 246, 0.16);
      border-color: rgba(59, 130, 246, 0.45);
      color: #93C5FD;
    }

    .zone-code {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.7rem;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
    }

    .workspace-nav {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 10px;
      margin-bottom: 18px;
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
    }

    .nav-pill {
      padding: 7px 12px;
      min-height: 36px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 0.85rem;
      font-weight: 600;
      border-radius: 8px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.07);
      color: #CBD5E1;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .nav-pill:hover {
      border-color: rgba(245, 158, 11, 0.45);
      color: #F8FAFC;
    }

    .nav-pill.active {
      background: rgba(245, 158, 11, 0.14);
      border-color: rgba(245, 158, 11, 0.5);
      color: #FCD34D;
    }

    .nav-pill.compare-pill.active {
      background: rgba(59, 130, 246, 0.15);
      border-color: rgba(59, 130, 246, 0.5);
      color: #93C5FD;
    }

    .nav-sep {
      width: 1px;
      height: 22px;
      background: rgba(255, 255, 255, 0.1);
      margin: 0 2px;
    }

    .badge-cost {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.07);
      color: #94A3B8;
    }

    .nav-pill.active .badge-cost {
      background: rgba(245, 158, 11, 0.22);
      color: #FCD34D;
    }

    .badge-free {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.16);
      color: #34D399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .tarif-main { flex-grow: 1; }

    .tarif-footer {
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      text-align: center;
      color: #64748B;
      font-size: 0.82rem;
    }

    @media (max-width: 820px) {
      .tarif-shell { padding: 14px 12px 24px; }
      .tarif-header h1 { font-size: 1.45rem; }
      .nav-sep { display: none; }
    }
  `]
})
export class TarifComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  public state = inject(SearchStateService);
  isAuthenticated$ = this.authService.isAuthenticated();
  isBetaMode = environment.betaMode === true;

  openComparator(): void {
    this.state.compareMode = true;
    this.router.navigate(['/recherche/decode-p10']);
  }
}
