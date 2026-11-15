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
        <div class="trust-pill">
          <span class="trust-dot"></span>
          100 % Nomenclature Officielle — Zéro code inventé
        </div>
        <h1>Nomenclature Douanière &amp; Recherche Tarifaire</h1>
        <p class="subtitle">
          Système Harmonisé (HS-06), Tarif National Algérien (P10 · DD, TVA, UQN, FAP) &amp; Nomenclature Combinée UE 2026 (NC8 · TDC) · Saisie multilingue
        </p>

        <div class="zone-switcher" role="group" aria-label="Zone tarifaire active">
          <button
            type="button"
            class="zone-pill-btn"
            [class.active]="(state.selectedZone$ | async) !== 'EU'"
            (click)="state.setZone('DZ')">
            <span class="zone-code">DZ</span> Algérie · P10 (DGD)
          </button>
          <button
            type="button"
            class="zone-pill-btn eu"
            [class.active]="(state.selectedZone$ | async) === 'EU'"
            (click)="state.setZone('EU')">
            <span class="zone-code">UE</span> Union Européenne · NC8 (TDC 2026)
          </button>
        </div>
      </header>

      <nav class="mode-nav" aria-label="Modes de recherche et décodage">
        <div class="mode-card">
          <span class="mode-label">Recherche par désignation (IA)</span>
          <div class="mode-links">
            <a routerLink="search-position10" routerLinkActive="active">
              {{ (state.selectedZone$ | async) === 'EU' ? 'NC8 Europe (UE)' : 'Position-10 (DZ)' }}
              <span class="badge-cost">{{ (isAuthenticated$ | async) ? '15 cr' : '2 essais gratuits' }}</span>
            </a>
            <a routerLink="search" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
              HS-06 International
              <span class="badge-cost">{{ (isAuthenticated$ | async) ? '10 cr' : 'Essai gratuit' }}</span>
            </a>
            @if ((isAuthenticated$ | async) && !isBetaMode) {
              <a routerLink="searchListLots" routerLinkActive="active">
                Liste CSV/Excel
              </a>
              <a routerLink="batch-search" routerLinkActive="active">
                Batch asynchrone
              </a>
            }
          </div>
        </div>

        <div class="mode-card">
          <span class="mode-label">Décodage officiel par code (SQL)</span>
          <div class="mode-links">
            <a routerLink="decode-p10"
               routerLinkActive="route-match"
               #rlaDecode="routerLinkActive"
               [class.active]="rlaDecode.isActive && !(state.compareMode$ | async)"
               (click)="state.compareMode = false">
              Code P10 / NC8 complet
              <span class="badge-free">Gratuit</span>
            </a>
            <a routerLink="decode" routerLinkActive="active">
              Code HS 2-6 chiffres
              <span class="badge-free">Gratuit</span>
            </a>
            <button type="button"
                    class="mode-action-btn"
                    [class.active]="rlaDecode.isActive && (state.compareMode$ | async) === true"
                    (click)="openComparator()">
              ⇄ Comparateur DZ ↔ UE
              <span class="badge-free">Gratuit</span>
            </button>
          </div>
        </div>
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
      max-width: 1180px;
      margin: 0 auto;
      padding: 28px 20px 36px;
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - 64px);
    }

    .tarif-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .trust-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 5px 14px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34D399;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      margin-bottom: 12px;
    }

    .trust-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10B981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.75);
    }

    .tarif-header h1 {
      margin: 0 0 8px;
      color: #F8FAFC;
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-size: 1.85rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .subtitle {
      margin: 0 0 16px;
      color: #94A3B8;
      font-size: 0.95rem;
    }

    .zone-switcher {
      display: inline-flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      padding: 5px;
      border-radius: 12px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.09);
    }

    .zone-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 9px;
      border: 1px solid transparent;
      background: transparent;
      color: #94A3B8;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .zone-pill-btn:hover {
      color: #F8FAFC;
      background: rgba(255, 255, 255, 0.04);
    }

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
      font-size: 0.72rem;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 5px;
      background: rgba(255, 255, 255, 0.08);
    }

    .mode-nav {
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }

    .mode-card {
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: border-color 0.2s ease;
    }

    .mode-card:has(.active) {
      border-color: rgba(245, 158, 11, 0.4);
      background: linear-gradient(145deg, rgba(17, 24, 39, 0.98), rgba(13, 20, 33, 0.98));
    }

    .mode-label {
      font-size: 0.84rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94A3B8;
    }

    .mode-card:has(.active) .mode-label {
      color: #F59E0B;
    }

    .mode-links {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .mode-links a,
    .mode-action-btn {
      padding: 9px 15px;
      min-height: 40px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      border-radius: 10px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #CBD5E1;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .mode-links a:hover,
    .mode-action-btn:hover {
      border-color: rgba(245, 158, 11, 0.45);
      color: #F8FAFC;
    }

    .mode-links a.active,
    .mode-action-btn.active {
      background: rgba(245, 158, 11, 0.14);
      border-color: rgba(245, 158, 11, 0.55);
      color: #FCD34D;
    }

    .badge-cost {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.07);
      color: #94A3B8;
      white-space: nowrap;
    }

    .mode-links a.active .badge-cost {
      background: rgba(245, 158, 11, 0.22);
      color: #FCD34D;
    }

    .badge-free {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.16);
      color: #34D399;
      border: 1px solid rgba(16, 185, 129, 0.3);
      white-space: nowrap;
    }

    .tarif-main {
      flex-grow: 1;
    }

    .tarif-footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      text-align: center;
      color: #64748B;
      font-size: 0.84rem;
    }

    @media (max-width: 820px) {
      .tarif-shell { padding: 16px 12px 24px; }
      .mode-nav { grid-template-columns: 1fr; }
      .tarif-header h1 { font-size: 1.45rem; }
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
