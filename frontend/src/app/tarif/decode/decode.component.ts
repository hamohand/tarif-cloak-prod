import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OAuthService } from 'angular-oauth2-oidc';
import { DecodeResult, SearchService } from '../services/search.service';
import { SearchStateService } from '../services/search-state.service';

@Component({
  selector: 'app-decode',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="decode-container">
      <div class="free-badge-row">
        <span class="free-pill">Décodage SQL officiel · 100 % gratuit &amp; sans crédit</span>
      </div>

      <div class="search-form">
        <input
          type="text"
          [(ngModel)]="codeInput"
          placeholder="Ex : 08, 0808, 080810"
          class="search-input"
          (keydown.enter)="decode()"
          maxlength="20"
        />
        <button
          type="button"
          (click)="decode()"
          class="search-button"
          [disabled]="isLoading || !codeInput.trim()"
        >
          {{ isLoading ? 'Décodage...' : 'Décoder' }}
        </button>
      </div>

      <p class="hint">Saisissez 2 chiffres (chapitre), 4 chiffres (position) ou 6 chiffres (code HS international).</p>

      @if (isLoading) {
        <div class="loading">Extraction officielle depuis la nomenclature...</div>
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
              <div class="level-content">
                <span class="level-desc">{{ result.section.description }}</span>
                @if (result.section.note) {
                  <p class="level-note">{{ result.section.note }}</p>
                }
              </div>
            </div>

            <div class="level level-chapitre">
              <span class="level-label">Chapitre</span>
              <span class="level-code">{{ result.chapitre.code }}</span>
              <div class="level-content">
                <span class="level-desc">{{ result.chapitre.description }}</span>
                @if (result.chapitre.note) {
                  <p class="level-note">{{ result.chapitre.note }}</p>
                }
              </div>
            </div>

            @if (result.position4) {
              <div class="level level-position4">
                <span class="level-label">Position 4</span>
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
                @if (result.niveau === 'POSITION6') { Code HS complet }
              </h4>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Description</th>
                    </tr>
                  </thead>
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
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .decode-container {
      padding: 20px 8px;
      max-width: 960px;
      margin: 0 auto;
      animation: fadeIn 0.35s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .free-badge-row { margin-bottom: 14px; }

    .free-pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.32);
      color: #34D399;
      font-size: 0.78rem;
      font-weight: 700;
    }

    .search-form {
      display: flex;
      margin-bottom: 10px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      overflow: hidden;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .search-form:focus-within {
      border-color: #3B82F6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
    }

    .search-input {
      flex: 1;
      padding: 15px 18px;
      min-height: 48px;
      font-size: 18px;
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      border: none;
      outline: none;
      letter-spacing: 0.04em;
      background: transparent;
      color: #F8FAFC;
    }

    .search-input::placeholder {
      color: #64748B;
      font-size: 15px;
      letter-spacing: normal;
      font-family: var(--font-sans, system-ui, sans-serif);
    }

    .search-button {
      padding: 15px 28px;
      min-height: 48px;
      font-size: 15px;
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      background: #3B82F6;
      color: #F8FAFC;
      border: none;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }

    .search-button:hover:not(:disabled) { background: #2563EB; }
    .search-button:disabled { opacity: 0.45; cursor: not-allowed; }

    .hint { color: #94A3B8; font-size: 0.85rem; margin: 0 0 22px; }

    .loading { margin: 26px 0; text-align: center; color: #60A5FA; font-weight: 600; }

    .error {
      margin: 18px 0;
      color: #FCA5A5;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 14px 18px;
      border-radius: 10px;
    }

    .results {
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 20px;
    }

    .results h3 {
      margin: 0 0 16px;
      color: #F8FAFC;
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-size: 1.2rem;
    }

    .code-badge {
      display: inline-block;
      margin-left: 6px;
      padding: 3px 10px;
      border-radius: 8px;
      background: rgba(59, 130, 246, 0.16);
      border: 1px solid rgba(59, 130, 246, 0.35);
      color: #60A5FA;
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 1rem;
    }

    .hierarchy { display: flex; flex-direction: column; gap: 10px; margin-bottom: 22px; }

    .level {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 10px;
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .level-section { border-left: 3px solid #3B82F6; }
    .level-chapitre { border-left: 3px solid #10B981; margin-left: 14px; }
    .level-position4 { border-left: 3px solid #F59E0B; margin-left: 28px; }

    .level-label {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #94A3B8;
      min-width: 74px;
      padding-top: 2px;
    }

    .level-code {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-weight: 700;
      font-size: 0.96rem;
      color: #F8FAFC;
      min-width: 52px;
    }

    .level-content { display: flex; flex-direction: column; gap: 4px; }
    .level-desc { color: #E2E8F0; font-size: 0.94rem; line-height: 1.4; }
    .level-note { margin: 0; color: #94A3B8; font-size: 0.82rem; line-height: 1.4; }

    .subpositions h4 { color: #F8FAFC; font-size: 1rem; margin: 0 0 12px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th {
      padding: 10px 14px;
      text-align: left;
      color: #94A3B8;
      font-size: 0.74rem;
      text-transform: uppercase;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    td {
      padding: 11px 14px;
      color: #CBD5E1;
      font-size: 0.9rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }
    .code-cell {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-weight: 700;
      color: #60A5FA;
      white-space: nowrap;
    }

    @media (max-width: 720px) {
      .search-form { flex-direction: column; }
      .search-button { border-radius: 0 0 12px 12px; }
      .level { flex-direction: column; gap: 4px; }
      .level-chapitre, .level-position4 { margin-left: 0; }
    }
  `]
})
export class DecodeComponent implements OnInit {
  codeInput: string = '';
  result: DecodeResult | null = null;
  isLoading: boolean = false;
  error: string | null = null;
  zone: string = 'DZ';

  private searchService = inject(SearchService);
  private oauthService = inject(OAuthService);
  private state = inject(SearchStateService);

  ngOnInit(): void {
    this.codeInput = this.state.decodeInput;
    this.result = this.state.decodeResult;
  }

  decode(): void {
    const trimmed = this.codeInput.trim();
    if (!trimmed) {
      this.error = 'Veuillez saisir un code HS.';
      return;
    }

    const normalized = trimmed.replace(/[^0-9]/g, '');
    if (normalized.length !== 2 && normalized.length !== 4 && normalized.length !== 6) {
      this.error = 'Le code doit contenir 2, 4 ou 6 chiffres (ex : 08, 0808, 080810).';
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.result = null;

    this.searchService.decodeCode(trimmed, this.zone).subscribe({
      next: (res) => {
        this.result = res;
        this.state.decodeInput = this.codeInput;
        this.state.decodeResult = res;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err.message || 'Une erreur est survenue.';
        if (err.status === 401 && this.oauthService.hasValidAccessToken()) {
          this.oauthService.logOut();
        }
        this.isLoading = false;
      }
    });
  }
}
