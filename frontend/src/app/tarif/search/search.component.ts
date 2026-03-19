import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchService } from '../services/search.service';
import { SearchStateService, SearchResultItem } from '../services/search-state.service';
import { OAuthService } from 'angular-oauth2-oidc';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface GroupedP10 {
  code: string;
  description: string;
  justification: string | null;
  titres: string[] | null; // titres ayant changé par rapport au code P10 précédent
}

interface GroupedP6 {
  code: string;
  description: string;
  justification: string | null; // pour mode positions6
  codes10: GroupedP10[];
}

interface GroupedP4 {
  code: string;
  description: string;
  codes6: GroupedP6[];
}

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

      @if (error) {
        <div class="error">{{ error }}</div>
      }

      @if (groupedResults && !isLoading) {
        <div class="results">
          <h3>Résultat de la recherche</h3>

          @if (groupedResults.length === 0) {
            <p class="no-results">Aucun résultat n'a été trouvé.</p>
          }

          @for (g4 of groupedResults; track g4.code) {
            <div class="result-card">

              <!-- Position 4 -->
              <div class="level level-position4">
                <span class="level-label">Position</span>
                <span class="level-code">{{ g4.code }}</span>
                <span class="level-desc">{{ g4.description }}</span>
              </div>

              <!-- Pour chaque code6 sous ce code4 -->
              @for (p6 of g4.codes6; track p6.code) {
                <h4>Code HS</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Description</th>
                      @if (endpoint === 'positions6') { <th>Justification</th> }
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td class="code-cell">{{ p6.code }}</td>
                      <td>{{ p6.description }}</td>
                      @if (endpoint === 'positions6' && p6.justification) {
                        <td class="justif">{{ p6.justification }}</td>
                      }
                    </tr>
                  </tbody>
                </table>

                <!-- Codes P10 sous ce code6 -->
                @if (p6.codes10.length > 0) {
                  <h4>Codes P10 sous ce code HS</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Code P10</th>
                        <th>Description</th>
                        <th>Justification</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (p10 of p6.codes10; track p10.code) {
                        @if (p10.titres && p10.titres.length > 0) {
                          <tr class="titre-row">
                            <td colspan="3" class="titres-cell">
                              @for (titre of p10.titres; track titre) {
                                <div class="titre-p10">{{ titre }}</div>
                              }
                            </td>
                          </tr>
                        }
                        <tr [class.highlighted]="p10.justification">
                          <td class="code-cell p10">{{ p10.code }}</td>
                          <td>{{ p10.description }}</td>
                          <td class="justif">{{ p10.justification }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
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
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      border-radius: 12px;
      overflow: hidden;
      background: white;
      border: 2px solid transparent;
      transition: all 0.3s ease;
    }

    .search-form:focus-within {
      border-color: #3498db;
      box-shadow: 0 12px 32px rgba(52,152,219,0.2);
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
      box-shadow: 0 4px 16px rgba(52,152,219,0.4);
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

    .result-card:last-child { border-bottom: none; }

    .level {
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 8px;
      border-left: 4px solid;
      margin-bottom: 14px;
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
      font-size: 0.95rem;
      font-weight: 600;
      margin: 14px 0 8px;
      padding-bottom: 5px;
      border-bottom: 2px solid #ecf0f1;
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      border-radius: 10px;
      overflow: hidden;
      background: white;
      margin-bottom: 4px;
    }

    th, td {
      padding: 11px 16px;
      text-align: left;
      border-bottom: 1px solid #ecf0f1;
    }

    th {
      background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
      font-weight: 600;
      color: white;
      text-transform: uppercase;
      font-size: 0.8rem;
      letter-spacing: 0.5px;
    }

    tbody tr:hover { background: #fef9e7; }
    tbody tr.highlighted { background: #eafaf1; }
    tbody tr:last-child td { border-bottom: none; }

    .code-cell {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      color: #27ae60;
      font-size: 0.95rem;
      white-space: nowrap;
    }

    .code-cell.p10 { color: #8e44ad; }

    .justif {
      font-style: italic;
      color: #95a5a6;
      font-size: 0.85rem;
    }

    .titre-row td { background: #fefaf0; padding: 4px 16px 2px; border-bottom: none; }
    .titre-row:hover td { background: #fefaf0; }

    .titres-cell { padding: 6px 16px 2px !important; }

    .titre-p10 {
      font-style: italic;
      color: #7f8c8d;
      font-size: 0.88rem;
      padding: 2px 0 1px 8px;
      border-left: 3px solid #f39c12;
    }
  `]
})
export class SearchComponent implements OnInit {
  searchTerm: string = '';
  groupedResults: GroupedP4[] | null = null;
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
      const decoded = this.state.searchDecoded_p10;
      if (decoded) this.groupedResults = this.buildGrouped(decoded);
    } else {
      this.searchTerm = this.state.searchTerm_hs;
      const decoded = this.state.searchDecoded_hs;
      if (decoded) this.groupedResults = this.buildGrouped(decoded);
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
    this.groupedResults = null;

    this.searchService.searchCodes(this.searchTerm, this.endpoint).subscribe({
      next: (results: any[]) => {
        if (!results || results.length === 0) {
          this.groupedResults = [];
          this.isLoading = false;
          this.saveState([]);
          return;
        }

        const decodeObservables = results.map((r: any) => {
          const aiCode = (r.code || '').replace(/\s/g, '');
          const justification: string | null = r.justification ?? null;
          // Pour positions10 : décoder le code6 parent pour avoir tous les P10 sous lui
          const codeToDecode = this.endpoint === 'positions10' && aiCode.length >= 6
            ? aiCode.substring(0, 6)
            : aiCode;

          const decode$ = this.endpoint === 'positions10'
            ? this.searchService.decodeP10Code(codeToDecode)
            : this.searchService.decodeCode(codeToDecode);

          return decode$.pipe(
            catchError(() => of(null)),
            map(decoded => decoded ? { decoded, justification, aiCode } as SearchResultItem : null)
          );
        });

        forkJoin(decodeObservables).subscribe({
          next: (items: any[]) => {
            const valid = items.filter(i => i != null) as SearchResultItem[];
            this.groupedResults = this.buildGrouped(valid);
            this.saveState(valid);
            this.isLoading = false;
          },
          error: () => {
            this.error = 'Erreur lors du décodage des résultats.';
            this.isLoading = false;
          }
        });
      },
      error: (err: any) => {
        if (err.status === 401 || err.status === 403) this.oauthService.logOut();
        this.error = err.message || 'Une erreur est survenue lors de la recherche.';
        this.isLoading = false;
      }
    });
  }

  /** Construit la structure groupée : P4 → P6 → P10, sans doublons. */
  private buildGrouped(items: SearchResultItem[]): GroupedP4[] {
    const mapP4 = new Map<string, GroupedP4>();
    // Pour le calcul du delta de titres : dernier titre connu par groupe P6
    const prevTitlesMap = new Map<string, string[]>();

    for (const item of items) {
      const p4 = item.decoded.position4;
      if (!p4) continue;

      if (!mapP4.has(p4.code)) {
        mapP4.set(p4.code, { code: p4.code, description: p4.description, codes6: [] });
      }
      const group4 = mapP4.get(p4.code)!;

      for (const p6 of (item.decoded.positions6 || [])) {
        let group6 = group4.codes6.find(g => g.code === p6.code);
        if (!group6) {
          const newGroup6: GroupedP6 = {
            code: p6.code,
            description: p6.description,
            justification: null,
            codes10: []
          };
          group4.codes6.push(newGroup6);
          group6 = newGroup6;
        }

        if (this.endpoint === 'positions6') {
          if (!group6!.justification) group6!.justification = item.justification;
        } else {
          for (const p10 of (item.decoded.positions10 || [])) {
            const p10Code = p10.code.replace(/\s/g, '');
            const existing = group6!.codes10.find(g => g.code === p10.code);
            if (!existing) {
              const allTitres = item.decoded.titresParPosition10?.[p10.code] ?? [];
              const prevTitres = prevTitlesMap.get(group6!.code) ?? [];
              const delta = this.titreDelta(allTitres, prevTitres);
              prevTitlesMap.set(group6!.code, allTitres);
              group6!.codes10.push({
                code: p10.code,
                description: p10.description,
                justification: p10Code === item.aiCode ? item.justification : null,
                titres: delta.length > 0 ? delta : null
              });
            } else if (p10Code === item.aiCode && item.justification) {
              existing.justification = item.justification;
            }
          }
        }
      }
    }

    return Array.from(mapP4.values());
  }

  /** Retourne les titres qui ont changé par rapport aux titres précédents. */
  private titreDelta(current: string[], prev: string[]): string[] {
    let i = 0;
    while (i < Math.min(current.length, prev.length) && current[i] === prev[i]) i++;
    return current.slice(i);
  }

  private saveState(decoded: SearchResultItem[]): void {
    if (this.endpoint === 'positions10') {
      this.state.searchTerm_p10 = this.searchTerm;
      this.state.searchDecoded_p10 = decoded;
    } else {
      this.state.searchTerm_hs = this.searchTerm;
      this.state.searchDecoded_hs = decoded;
    }
  }
}
