import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchService, DecodeResult } from '../services/search.service';
import { OAuthService } from 'angular-oauth2-oidc';

@Component({
  selector: 'app-decode',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="decode-container">
      <div class="search-form">
        <input
          type="text"
          [(ngModel)]="codeInput"
          placeholder="Ex : 08, 0808, 080810, 87031010"
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

      <p class="hint">Saisissez 2 chiffres (chapitre), 4 chiffres (position), 6 chiffres (sous-position HS) ou 8 chiffres (code national).</p>

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
            <!-- Section -->
            <div class="level level-section">
              <span class="level-label">Section</span>
              <span class="level-code">{{ result.section.code }}</span>
              <span class="level-desc">{{ result.section.description }}</span>
            </div>

            <!-- Chapitre -->
            <div class="level level-chapitre">
              <span class="level-label">Chapitre</span>
              <span class="level-code">{{ result.chapitre.code }}</span>
              <span class="level-desc">{{ result.chapitre.description }}</span>
            </div>

            <!-- Position 4 (si disponible) -->
            @if (result.position4) {
              <div class="level level-position4">
                <span class="level-label">Position</span>
                <span class="level-code">{{ result.position4.code }}</span>
                <span class="level-desc">{{ result.position4.description }}</span>
              </div>
            }

            <!-- Sous-position 6 (uniquement pour niveau POSITION8) -->
            @if (result.niveau === 'POSITION8' && result.positions6?.length) {
              <div class="level level-position6">
                <span class="level-label">Sous-pos.</span>
                <span class="level-code">{{ result.positions6[0].code }}</span>
                <span class="level-desc">{{ result.positions6[0].description }}</span>
              </div>
            }
          </div>

          <!-- Liste des sous-positions (niveaux CHAPITRE, POSITION4, POSITION6) -->
          @if (result.positions6 && result.positions6.length > 0 && result.niveau !== 'POSITION8') {
            <div class="subpositions">
              <h4>
                @if (result.niveau === 'CHAPITRE') { Positions sous ce chapitre }
                @if (result.niveau === 'POSITION4') { Codes HS sous cette position }
                @if (result.niveau === 'POSITION6') { Code HS 6 chiffres }
              </h4>
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
          }

          <!-- Codes à 8 chiffres (enfants de POSITION6, ou code exact de POSITION8) -->
          @if (result.positions8 && result.positions8.length > 0) {
            <div class="subpositions">
              <h4>
                @if (result.niveau === 'POSITION6') { Subdivisions nationales (8 chiffres) }
                @if (result.niveau === 'POSITION8') { Code national complet (8 chiffres) }
              </h4>
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of result.positions8; track item.code) {
                    <tr>
                      <td class="code-cell code-cell-8">{{ item.code }}</td>
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
      border-color: #3498db;
      box-shadow: 0 12px 32px rgba(52, 152, 219, 0.2);
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
      background: linear-gradient(135deg, #27ae60 0%, #219a52 100%);
      color: white;
      border: none;
      font-weight: 600;
      letter-spacing: 0.5px;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .search-button:hover:not(:disabled) {
      background: linear-gradient(135deg, #219a52 0%, #1a7a40 100%);
      box-shadow: 0 4px 16px rgba(39, 174, 96, 0.4);
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
      color: #27ae60;
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
      box-shadow: 0 4px 12px rgba(231, 76, 60, 0.15);
    }

    .results {
      margin-top: 20px;
      animation: slideUp 0.4s ease;
    }

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
      background: #27ae60;
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

    .level-section {
      background: #eaf4fb;
      border-left-color: #2980b9;
    }

    .level-chapitre {
      background: #eafaf1;
      border-left-color: #27ae60;
      margin-left: 16px;
    }

    .level-position4 {
      background: #fef9e7;
      border-left-color: #f39c12;
      margin-left: 32px;
    }

    .level-position6 {
      background: #fdf2e9;
      border-left-color: #e67e22;
      margin-left: 48px;
    }

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

    .level-desc {
      color: #34495e;
      font-size: 0.95rem;
      line-height: 1.4;
    }

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
    }

    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #ecf0f1;
    }

    th {
      background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
      font-weight: 600;
      color: white;
      text-transform: uppercase;
      font-size: 0.82rem;
      letter-spacing: 0.5px;
    }

    tbody tr:hover {
      background: #eafaf1;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .code-cell {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      color: #27ae60;
      font-size: 0.95rem;
    }

    .code-cell-8 {
      color: #e67e22;
    }
  `]
})
export class DecodeComponent {
  codeInput: string = '';
  result: DecodeResult | null = null;
  isLoading: boolean = false;
  error: string | null = null;

  private searchService = inject(SearchService);
  private oauthService = inject(OAuthService);

  decode(): void {
    if (!this.oauthService.hasValidAccessToken()) {
      this.error = 'Vous devez être connecté pour effectuer une recherche.';
      return;
    }

    if (!this.codeInput) {
      this.error = 'Veuillez saisir un code HS.';
      return;
    }

    // Validation locale : 2, 4, 6 ou 8 chiffres après normalisation
    const normalized = this.codeInput.replace(/[^0-9]/g, '');
    if (![2, 4, 6, 8].includes(normalized.length)) {
      this.error = 'Le code doit contenir 2, 4, 6 ou 8 chiffres (ex: 08, 0808, 080810, 87031010).';
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.result = null;

    this.searchService.decodeCode(this.codeInput).subscribe({
      next: (res) => {
        this.result = res;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err.message || 'Une erreur est survenue.';
        if (err.status === 401) {
          this.oauthService.logOut();
        }
        this.isLoading = false;
      }
    });
  }
}
