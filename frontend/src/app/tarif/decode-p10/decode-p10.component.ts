import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchService, DecodeResult } from '../services/search.service';
import { SearchStateService } from '../services/search-state.service';
import { OAuthService } from 'angular-oauth2-oidc';

@Component({
  selector: 'app-decode-p10',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="decode-container">
      <div class="search-form">
        <input
          type="text"
          [(ngModel)]="codeInput"
          placeholder="Ex : 08, 0808, 080810, 0808101000"
          class="search-input"
          (keydown.enter)="decode()"
          maxlength="10"
        />
        <button
          (click)="decode()"
          class="search-button"
          [disabled]="isLoading || !codeInput"
        >
          {{ isLoading ? 'Recherche...' : 'Décoder' }}
        </button>
      </div>

      <p class="hint">Saisissez 2 chiffres (chapitre), 4 (position), 6 (code HS) ou 10 chiffres (code P10 complet).</p>

      @if (isLoading) {
        <div class="loading">Recherche en cours...</div>
      }

      @if (error) {
        <div class="error">{{ error }}</div>
      }

      @if (result && !isLoading) {
        <div class="results">
          <h3>Hiérarchie du code <span class="code-badge">{{ result.codeRecherche }}</span></h3>

          <div class="hierarchy">
            <div class="level level-section">
              <span class="level-label">Section</span>
              <span class="level-code">{{ result.section.code }}</span>
              <span class="level-desc">{{ result.section.description }}</span>
            </div>

            <div class="level level-chapitre">
              <span class="level-label">Chapitre</span>
              <span class="level-code">{{ result.chapitre.code }}</span>
              <span class="level-desc">{{ result.chapitre.description }}</span>
            </div>

            @if (result.position4) {
              <div class="level level-position4">
                <span class="level-label">Position</span>
                <span class="level-code">{{ result.position4.code }}</span>
                <span class="level-desc">{{ result.position4.description }}</span>
              </div>
            }
          </div>

          @if (result.positions6 && result.positions6.length > 0) {
            <div class="subpositions">
              <h4>
                @if (result.niveau === 'CHAPITRE') { Positions sous ce chapitre }
                @if (result.niveau === 'POSITION4') { Codes HS sous cette position }
                @if (result.niveau === 'POSITION6' || result.niveau === 'POSITION10') { Code HS }
              </h4>
              <table>
                <thead><tr><th>Code</th><th>Description</th></tr></thead>
                <tbody>
                  @for (item of result.positions6; track item.code) {
                    <tr>
                      <td class="code-cell">{{ item.code }}</td>
                      <td>{{ item.description }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @if (result.positions10 && result.positions10.length > 0) {
            <div class="subpositions">
              @if (result.niveau === 'POSITION10' && result.titresPosition10 && result.titresPosition10.length > 0) {
                <div class="titres-p10">
                  @for (titre of result.titresPosition10; track titre; let i = $index) {
                    <div class="titre-p10" [style.padding-left]="(i * 12) + 'px'">{{ titre }}</div>
                  }
                </div>
              }
              <h4>
                @if (result.niveau === 'POSITION6') { Codes P10 sous ce code HS }
                @if (result.niveau === 'POSITION10') { Code P10 complet }
              </h4>
              <table>
                <thead><tr><th>Code P10</th><th>Description</th></tr></thead>
                <tbody>
                  @for (item of result.positions10; track item.code; let i = $index) {
                    @if (result.niveau === 'POSITION6') {
                      @let delta = getTitreDelta(i);
                      @if (delta.length > 0) {
                        <tr class="titre-row">
                          <td colspan="2" class="titres-cell">
                            @for (titre of delta; track titre) {
                              <div class="titre-p10">{{ titre }}</div>
                            }
                          </td>
                        </tr>
                      }
                    }
                    <tr>
                      <td class="code-cell p10">{{ item.code }}</td>
                      <td>{{ item.description }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .decode-container {
      padding: 40px 20px;
      max-width: 900px;
      margin: 0 auto;
      animation: fadeIn 0.5s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .search-form {
      display: flex;
      margin-bottom: 10px;
      background: var(--neu-bg, #E0E5EC);
      box-shadow: var(--neu-inset, inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5));
      border-radius: var(--neu-radius-inner, 12px);
      overflow: hidden;
      border: none;
      transition: box-shadow 0.3s ease;
    }

    .search-form:focus-within {
      box-shadow: var(--neu-inset-deep, inset 8px 8px 14px rgba(163,177,198,0.7), inset -8px -8px 14px rgba(255,255,255,0.6)),
                  0 0 0 3px rgba(108,99,255,0.25);
    }

    .search-input {
      flex: 1;
      padding: 16px 20px;
      min-height: 44px;
      font-size: 20px;
      font-family: 'Courier New', monospace;
      border: none;
      outline: none;
      letter-spacing: 2px;
      background: transparent;
      color: var(--neu-text-primary, #3D4852);
    }

    .search-input::placeholder {
      color: var(--neu-text-muted, #6B7280);
      font-size: 16px;
      letter-spacing: normal;
      font-family: 'Segoe UI', sans-serif;
    }

    .search-button {
      padding: 16px 32px;
      min-height: 44px;
      font-size: 16px;
      background: var(--neu-accent-secondary, #2DD4BF);
      color: var(--neu-text-heading, #2D3748);
      border: none;
      font-weight: 600;
      letter-spacing: 0.5px;
      border-radius: var(--neu-radius-inner, 12px);
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
      transition: box-shadow 0.3s ease, transform 0.15s ease;
      cursor: pointer;
    }

    .search-button:hover:not(:disabled) {
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      transform: translateY(-1px);
    }

    .search-button:active:not(:disabled) {
      box-shadow: var(--neu-inset, inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5));
      transform: translateY(0);
    }

    .search-button:disabled {
      background: var(--neu-bg, #E0E5EC);
      color: var(--neu-text-muted, #6B7280);
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
      cursor: not-allowed;
      opacity: 0.7;
    }

    .hint {
      color: var(--neu-text-muted, #6B7280);
      font-size: 0.85rem;
      margin-bottom: 24px;
      padding-left: 4px;
    }

    .loading {
      margin: 30px 0;
      text-align: center;
      color: var(--neu-accent, #6C63FF);
      font-size: 1.1rem;
      font-weight: 500;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .error {
      margin: 20px 0;
      color: #c0392b;
      background: var(--neu-bg, #E0E5EC);
      padding: 16px 20px;
      border-radius: var(--neu-radius-inner, 12px);
      box-shadow: var(--neu-inset, inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5));
    }

    .results { margin-top: 20px; animation: slideUp 0.4s ease; }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .results h3 {
      margin-bottom: 20px;
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
      font-size: 1.3rem;
      font-weight: 600;
    }

    .code-badge {
      display: inline-block;
      background: var(--neu-accent, #6C63FF);
      color: white;
      padding: 4px 14px;
      border-radius: var(--neu-radius-inner, 12px);
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
      font-family: 'Courier New', monospace;
      font-size: 1.1rem;
      letter-spacing: 1px;
    }

    .hierarchy {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }

    .level {
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding: 14px 18px;
      border-radius: var(--neu-radius-inner, 12px);
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
      border: none;
      transition: background 0.3s ease;
    }

    .level:hover {
      background: var(--neu-card-bg-hover, linear-gradient(145deg, #EDF0F5, #DCE1E8));
    }

    .level-section { border-left: 4px solid var(--neu-accent, #6C63FF); }
    .level-chapitre { border-left: 4px solid var(--neu-accent-secondary, #38B2AC); margin-left: 16px; }
    .level-position4 { border-left: 4px solid #F6AD55; margin-left: 32px; }

    .level-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--neu-text-muted, #6B7280);
      min-width: 70px;
    }

    .level-code {
      font-family: 'Courier New', monospace;
      font-weight: 700;
      font-size: 1rem;
      color: var(--neu-text-heading, #2D3748);
      min-width: 60px;
    }

    .level-desc { color: var(--neu-text-primary, #3D4852); font-size: 0.95rem; line-height: 1.4; }

    .subpositions { margin-top: 20px; }

    .subpositions h4 {
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 12px;
      padding-bottom: 6px;
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0 0.5rem;
      background: transparent;
      margin-bottom: 20px;
    }

    th {
      padding: 12px 16px;
      text-align: left;
      background: var(--neu-bg, #E0E5EC);
      font-weight: 600;
      color: var(--neu-text-heading, #2D3748);
      text-transform: uppercase;
      font-size: 0.82rem;
      letter-spacing: 0.5px;
    }

    td {
      padding: 12px 16px;
      text-align: left;
      background: var(--neu-bg, #E0E5EC);
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
    }

    td:first-child { border-radius: var(--neu-radius-inner, 12px) 0 0 var(--neu-radius-inner, 12px); }
    td:last-child { border-radius: 0 var(--neu-radius-inner, 12px) var(--neu-radius-inner, 12px) 0; }

    tbody tr:hover td { opacity: 0.85; }

    .code-cell {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      color: var(--neu-accent-secondary, #38B2AC);
      font-size: 0.95rem;
    }

    .code-cell.p10 { color: var(--neu-accent, #6C63FF); }

    .titres-p10 {
      margin-bottom: 10px;
      border-left: 3px solid var(--neu-accent, #6C63FF);
      padding-left: 8px;
    }

    .titre-row td {
      background: var(--neu-bg, #E0E5EC);
      box-shadow: none;
      padding: 4px 16px 2px;
    }
    .titre-row:hover td { opacity: 1; }
    .titres-cell { padding: 6px 16px 2px !important; }

    .titre-p10 {
      font-style: italic;
      color: var(--neu-text-muted, #6B7280);
      font-size: 0.88rem;
      padding: 2px 0 1px 8px;
      border-left: 3px solid var(--neu-accent, #6C63FF);
    }

    @media (max-width: 768px) {
      .decode-container { padding: 20px 12px; }
      .search-form { flex-direction: column; }
      .search-button { border-radius: 0 0 var(--neu-radius-inner, 12px) var(--neu-radius-inner, 12px); }
      .level { flex-direction: column; gap: 4px; }
      .level-chapitre { margin-left: 0; }
      .level-position4 { margin-left: 0; }
    }

    @media (max-width: 1024px) {
      .decode-container { padding: 30px 16px; }
    }
  `]
})
export class DecodeP10Component implements OnInit {
  codeInput: string = '';
  result: DecodeResult | null = null;
  isLoading: boolean = false;
  error: string | null = null;

  private searchService = inject(SearchService);
  private oauthService = inject(OAuthService);
  private state = inject(SearchStateService);

  ngOnInit(): void {
    this.codeInput = this.state.decodeP10Input;
    this.result = this.state.decodeP10Result;
  }

  /** Retourne les titres ayant changé par rapport au code P10 précédent (pour POSITION6). */
  getTitreDelta(index: number): string[] {
    if (!this.result?.titresParPosition10 || !this.result.positions10) return [];
    const code = this.result.positions10[index].code;
    const current = this.result.titresParPosition10[code] ?? [];
    if (index === 0) return current;
    const prevCode = this.result.positions10[index - 1].code;
    const prev = this.result.titresParPosition10[prevCode] ?? [];
    let i = 0;
    while (i < Math.min(current.length, prev.length) && current[i] === prev[i]) i++;
    return current.slice(i);
  }

  decode(): void {
    if (!this.oauthService.hasValidAccessToken()) {
      this.error = 'Vous devez être connecté pour effectuer une recherche.';
      return;
    }

    if (!this.codeInput) {
      this.error = 'Veuillez saisir un code.';
      return;
    }

    const normalized = this.codeInput.replace(/[^0-9]/g, '');
    if (normalized.length !== 2 && normalized.length !== 4 && normalized.length !== 6 && normalized.length !== 10) {
      this.error = 'Le code doit contenir 2, 4, 6 ou 10 chiffres.';
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.result = null;

    this.searchService.decodeP10Code(this.codeInput).subscribe({
      next: (res) => {
        this.result = res;
        this.state.decodeP10Input = this.codeInput;
        this.state.decodeP10Result = res;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err.message || 'Une erreur est survenue.';
        if (err.status === 401) this.oauthService.logOut();
        this.isLoading = false;
      }
    });
  }
}
