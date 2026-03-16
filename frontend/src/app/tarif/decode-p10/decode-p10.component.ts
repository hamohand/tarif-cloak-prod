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
              @if (result.titrePosition10) {
                <div class="titre-p10">{{ result.titrePosition10 }}</div>
              }
              <h4>
                @if (result.niveau === 'POSITION6') { Codes P10 sous ce code HS }
                @if (result.niveau === 'POSITION10') { Code P10 complet }
              </h4>
              <table>
                <thead><tr><th>Code P10</th><th>Description</th></tr></thead>
                <tbody>
                  @for (item of result.positions10; track item.code) {
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
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      border-radius: 12px;
      overflow: hidden;
      background: white;
      border: 2px solid transparent;
      transition: all 0.3s ease;
    }

    .search-form:focus-within {
      border-color: #8e44ad;
      box-shadow: 0 12px 32px rgba(142, 68, 173, 0.2);
      transform: translateY(-2px);
    }

    .search-input {
      flex: 1;
      padding: 16px 20px;
      font-size: 20px;
      font-family: 'Courier New', monospace;
      border: none;
      outline: none;
      letter-spacing: 2px;
      background: transparent;
    }

    .search-input::placeholder {
      color: #95a5a6;
      font-size: 16px;
      letter-spacing: normal;
      font-family: 'Segoe UI', sans-serif;
    }

    .search-button {
      padding: 16px 32px;
      font-size: 16px;
      background: linear-gradient(135deg, #8e44ad 0%, #7d3c98 100%);
      color: white;
      border: none;
      font-weight: 600;
      letter-spacing: 0.5px;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .search-button:hover:not(:disabled) {
      background: linear-gradient(135deg, #7d3c98 0%, #6c3483 100%);
      box-shadow: 0 4px 16px rgba(142, 68, 173, 0.4);
      transform: translateY(-2px);
    }

    .search-button:disabled {
      background: linear-gradient(135deg, #bdc3c7 0%, #95a5a6 100%);
      cursor: not-allowed;
      opacity: 0.7;
    }

    .hint {
      color: #7f8c8d;
      font-size: 0.85rem;
      margin-bottom: 24px;
      padding-left: 4px;
    }

    .loading {
      margin: 30px 0;
      text-align: center;
      color: #8e44ad;
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
      background: linear-gradient(135deg, #fadbd8 0%, #f8d7da 100%);
      padding: 16px 20px;
      border-radius: 10px;
      border-left: 4px solid #e74c3c;
    }

    .results { margin-top: 20px; animation: slideUp 0.4s ease; }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .results h3 {
      margin-bottom: 20px;
      color: #2c3e50;
      font-size: 1.3rem;
      font-weight: 600;
    }

    .code-badge {
      display: inline-block;
      background: #8e44ad;
      color: white;
      padding: 2px 10px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 1.1rem;
      letter-spacing: 1px;
    }

    .hierarchy {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 24px;
    }

    .level {
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 8px;
      border-left: 4px solid;
    }

    .level-section   { background: #eaf4fb; border-left-color: #2980b9; }
    .level-chapitre  { background: #eafaf1; border-left-color: #27ae60; margin-left: 16px; }
    .level-position4 { background: #fef9e7; border-left-color: #f39c12; margin-left: 32px; }

    .level-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #7f8c8d;
      min-width: 70px;
    }

    .level-code {
      font-family: 'Courier New', monospace;
      font-weight: 700;
      font-size: 1rem;
      color: #2c3e50;
      min-width: 60px;
    }

    .level-desc { color: #34495e; font-size: 0.95rem; line-height: 1.4; }

    .subpositions { margin-top: 20px; }

    .subpositions h4 {
      color: #2c3e50;
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid #ecf0f1;
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
      border-radius: 10px;
      overflow: hidden;
      background: white;
      margin-bottom: 20px;
    }

    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #ecf0f1; }

    th {
      background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
      font-weight: 600;
      color: white;
      text-transform: uppercase;
      font-size: 0.82rem;
      letter-spacing: 0.5px;
    }

    tbody tr:hover { background: #f5eef8; }
    tbody tr:last-child td { border-bottom: none; }

    .code-cell {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      color: #27ae60;
      font-size: 0.95rem;
    }

    .code-cell.p10 { color: #8e44ad; }

    .titre-p10 {
      font-style: italic;
      color: #7f8c8d;
      font-size: 0.9rem;
      padding: 6px 0 4px 4px;
      border-left: 3px solid #8e44ad;
      margin-bottom: 8px;
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
