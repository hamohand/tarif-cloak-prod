import {Component, inject, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchService } from '../services/search.service';
import { SearchStateService, SearchResultItem } from '../services/search-state.service';
import { OAuthService } from 'angular-oauth2-oidc';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search-container">
      <div class="search-form">
        <input
          type="text"
          [(ngModel)]="searchTerm"
          placeholder="Entrez un terme ou une expression de recherche (accepte plusieurs langues)"
          class="search-input"
          (keydown.enter)="search()"
        />
        <button
          (click)="search()"
          class="search-button"
          [disabled]="isLoading || !searchTerm"
        >
          {{ isLoading ? 'Recherche en cours...' : 'Rechercher' }}
        </button>
      </div>

      @if (isLoading) {
        <div class="loading">Recherche en cours...</div>
      }

      @if (error != null) {
        <div class="error">{{ error }}</div>
      }

      @if (decodedResults && !isLoading) {
        <div class="results">
          <h3>Résultat de la recherche</h3>

          @if (decodedResults.length === 0) {
            <p class="no-results">Aucun résultat n'a été trouvé.</p>
          }

          @for (item of decodedResults; track item.decoded.codeRecherche) {
            <div class="result-card">

              <!-- Position 4 -->
              @if (item.decoded.position4) {
                <div class="level level-position4">
                  <span class="level-label">Position</span>
                  <span class="level-code">{{ item.decoded.position4.code }}</span>
                  <span class="level-desc">{{ item.decoded.position4.description }}</span>
                </div>
              }

              <!-- Code HS (positions6) -->
              @if (item.decoded.positions6 && item.decoded.positions6.length > 0) {
                <h4>Code HS</h4>
                <table>
                  <thead><tr><th>Code</th><th>Description</th></tr></thead>
                  <tbody>
                    @for (p6 of item.decoded.positions6; track p6.code) {
                      <tr>
                        <td class="code-cell">{{ p6.code }}</td>
                        <td>{{ p6.description }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }

              <!-- Codes P10 (mode positions10) -->
              @if (item.decoded.positions10 && item.decoded.positions10.length > 0) {
                @if (item.decoded.titrePosition10) {
                  <div class="titre-p10">{{ item.decoded.titrePosition10 }}</div>
                }
                <h4>Codes P10 sous ce code HS</h4>
                <table>
                  <thead><tr><th>Code P10</th><th>Description</th></tr></thead>
                  <tbody>
                    @for (p10 of item.decoded.positions10; track p10.code) {
                      <tr>
                        <td class="code-cell p10">{{ p10.code }}</td>
                        <td>{{ p10.description }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }

              <!-- Justification IA -->
              @if (item.justification) {
                <div class="justification">{{ item.justification }}</div>
              }

            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .search-container {
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
      margin-bottom: 30px;
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
      font-size: 16px;
      border: none;
      outline: none;
      background: transparent;
    }

    .search-input::placeholder { color: #95a5a6; }

    .search-button {
      padding: 16px 32px;
      font-size: 16px;
      background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
      color: white;
      border: none;
      font-weight: 600;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .search-button:hover:not(:disabled) {
      background: linear-gradient(135deg, #2980b9 0%, #21618c 100%);
      box-shadow: 0 4px 16px rgba(52, 152, 219, 0.4);
    }

    .search-button:disabled {
      background: linear-gradient(135deg, #bdc3c7 0%, #95a5a6 100%);
      cursor: not-allowed;
      opacity: 0.7;
    }

    .loading {
      margin: 30px 0;
      text-align: center;
      color: #3498db;
      font-size: 1.1rem;
      font-weight: 500;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .error {
      margin: 30px 0;
      color: #c0392b;
      background: linear-gradient(135deg, #fadbd8 0%, #f8d7da 100%);
      padding: 16px 20px;
      border-radius: 10px;
      border-left: 4px solid #e74c3c;
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

    .no-results {
      text-align: center;
      color: #7f8c8d;
      font-style: italic;
      margin-top: 20px;
    }

    .result-card {
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 2px solid #ecf0f1;
    }

    .result-card:last-child {
      border-bottom: none;
    }

    .level {
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 8px;
      border-left: 4px solid;
      margin-bottom: 16px;
    }

    .level-position4 {
      background: #fef9e7;
      border-left-color: #f39c12;
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

    h4 {
      color: #2c3e50;
      font-size: 1rem;
      font-weight: 600;
      margin: 16px 0 10px;
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
      margin-bottom: 16px;
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

    tbody tr:hover { background: #fef9e7; }
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
      padding: 6px 0 4px 8px;
      border-left: 3px solid #f39c12;
      margin: 12px 0 6px;
    }

    .justification {
      margin-top: 10px;
      font-size: 0.88rem;
      color: #7f8c8d;
      font-style: italic;
      padding: 8px 12px;
      background: #f8f9fa;
      border-radius: 6px;
      border-left: 3px solid #bdc3c7;
    }
  `]
})
export class SearchComponent implements OnInit {
  searchTerm: string = '';
  decodedResults: SearchResultItem[] | null = null;
  isLoading: boolean = false;
  error: string | null = null;
  endpoint: 'positions6' | 'positions10' = 'positions6';

  private searchService = inject(SearchService);
  private oauthService = inject(OAuthService);
  private route = inject(ActivatedRoute);
  private state = inject(SearchStateService);

  ngOnInit(): void {
    const mode = this.route.snapshot.data['mode'];
    if (mode === 'position10') {
      this.endpoint = 'positions10';
      this.searchTerm = this.state.searchTerm_p10;
      this.decodedResults = this.state.searchDecoded_p10;
    } else {
      this.searchTerm = this.state.searchTerm_hs;
      this.decodedResults = this.state.searchDecoded_hs;
    }
  }

  search(): void {
    if (!this.oauthService.hasValidAccessToken()) {
      this.error = 'Vous devez être connecté pour effectuer une recherche.';
      return;
    }
    if (!this.searchTerm) {
      this.error = 'Veuillez entrer un terme de recherche';
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.decodedResults = null;

    this.searchService.searchCodes(this.searchTerm, this.endpoint)
      .subscribe({
        next: (results: any[]) => {
          if (!results || results.length === 0) {
            this.decodedResults = [];
            this.isLoading = false;
            this.saveState([]);
            return;
          }

          // Pour chaque résultat AI, appeler decode pour obtenir la hiérarchie
          const decodeObservables = results.map((r: any) => {
            const rawCode: string = (r.code || '').replace(/\s/g, '');
            const justification: string | null = r.justification ?? null;

            // Pour positions10, décoder le code6 parent pour avoir tous les P10 sous lui
            const codeToDecode = this.endpoint === 'positions10' && rawCode.length >= 6
              ? rawCode.substring(0, 6)
              : rawCode;

            const decode$ = this.endpoint === 'positions10'
              ? this.searchService.decodeP10Code(codeToDecode)
              : this.searchService.decodeCode(codeToDecode);

            return decode$.pipe(
              catchError(() => of(null)),
              map(decoded => ({ decoded, justification }))
            );
          });

          forkJoin(decodeObservables).subscribe({
            next: (items: any[]) => {
              this.decodedResults = items.filter(i => i.decoded != null) as SearchResultItem[];
              this.saveState(results);
              this.isLoading = false;
            },
            error: () => {
              this.error = 'Erreur lors du décodage des résultats.';
              this.isLoading = false;
            }
          });
        },
        error: (err: any) => {
          if (err.status === 401 || err.status === 403) {
            this.oauthService.logOut();
          }
          this.error = err.message || 'Une erreur est survenue lors de la recherche.';
          this.isLoading = false;
        }
      });
  }

  private saveState(raw: any[]): void {
    if (this.endpoint === 'positions10') {
      this.state.searchTerm_p10 = this.searchTerm;
      this.state.searchResults_p10 = raw;
      this.state.searchDecoded_p10 = this.decodedResults;
    } else {
      this.state.searchTerm_hs = this.searchTerm;
      this.state.searchResults_hs = raw;
      this.state.searchDecoded_hs = this.decodedResults;
    }
  }
}
