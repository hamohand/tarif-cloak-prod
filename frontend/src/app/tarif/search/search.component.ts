import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchService } from '../services/search.service';
import { SearchStateService, SearchResultItem } from '../services/search-state.service';
import { OAuthService } from 'angular-oauth2-oidc';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, retry } from 'rxjs/operators';

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
          placeholder="Entrez une désignation ou une description (accepte plusieurs langues)"
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
      background: var(--neu-bg-dark, #0D1421);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: var(--neu-radius-inner, 8px);
      overflow: hidden;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .search-form:focus-within {
      border-color: var(--neu-accent, #F59E0B);
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
    }

    .search-input {
      flex: 1;
      padding: 16px 20px;
      min-height: 44px;
      font-size: 16px;
      border: none;
      outline: none;
      background: transparent;
      color: var(--neu-text-primary, #3D4852);
    }

    .search-input::placeholder { color: var(--neu-text-muted, #6B7280); }

    .search-button {
      padding: 16px 32px;
      min-height: 44px;
      font-size: 15px;
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      background: var(--neu-accent, #F59E0B);
      color: #070B14;
      border: none;
      font-weight: 700;
      border-radius: 0 var(--neu-radius-inner, 8px) var(--neu-radius-inner, 8px) 0;
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.3);
      transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
      cursor: pointer;
      white-space: nowrap;
    }

    .search-button:hover:not(:disabled) {
      background: var(--neu-accent-hover, #D97706);
      box-shadow: 0 0 24px rgba(245, 158, 11, 0.45);
      transform: translateY(-1px);
    }

    .search-button:active:not(:disabled) {
      background: var(--neu-accent-hover, #D97706);
      transform: translateY(1px);
      box-shadow: none;
    }

    .search-button:disabled {
      background: rgba(255, 255, 255, 0.05);
      color: var(--neu-text-muted, #64748B);
      box-shadow: none;
      cursor: not-allowed;
      opacity: 0.5;
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
      margin: 30px 0;
      color: var(--neu-accent-danger, #EF4444);
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.25);
      padding: 16px 20px;
      border-radius: var(--neu-radius-inner, 8px);
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
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
      font-size: 1.3rem;
      font-weight: 600;
    }

    .no-results {
      text-align: center;
      color: var(--neu-text-muted, #6B7280);
      font-style: italic;
      margin-top: 20px;
    }

    .result-card {
      margin-bottom: 24px;
      padding: 20px 24px;
      background: var(--neu-card-bg, #111827);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: var(--neu-radius-container, 14px);
      box-shadow: var(--neu-extruded);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .result-card:hover {
      border-color: rgba(245, 158, 11, 0.2);
      box-shadow: var(--neu-extruded-hover);
    }

    .level {
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding: 14px 18px;
      border-radius: var(--neu-radius-inner, 12px);
      margin-bottom: 14px;
      border: none;
    }

    .level-position4 {
      background: var(--neu-bg-dark, #0D1421);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-left: 3px solid var(--neu-accent, #F59E0B);
    }

    .level-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--neu-text-muted, #6B7280);
      min-width: 70px;
    }

    .level-code {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-weight: 600;
      font-size: 1rem;
      color: var(--neu-accent, #F59E0B);
      min-width: 60px;
    }

    .level-desc {
      color: var(--neu-text-primary, #3D4852);
      font-size: 0.95rem;
      line-height: 1.4;
    }

    h4 {
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
      font-size: 0.95rem;
      font-weight: 600;
      margin: 14px 0 8px;
      padding-bottom: 5px;
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0 0.5rem;
      background: transparent;
      margin-bottom: 4px;
    }

    th {
      padding: 10px 16px;
      text-align: left;
      background: rgba(255, 255, 255, 0.03);
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
      font-weight: 600;
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      color: var(--neu-text-muted, #64748B);
      text-transform: uppercase;
      font-size: 0.72rem;
      letter-spacing: 0.8px;
    }

    td {
      padding: 11px 16px;
      text-align: left;
      background: transparent;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }

    td:first-child { border-radius: 0; }
    td:last-child { border-radius: 0; }

    tbody tr:hover td { background: rgba(245, 158, 11, 0.04); }
    tbody tr.highlighted td {
      background: rgba(245, 158, 11, 0.06);
      border-left: 2px solid var(--neu-accent, #F59E0B);
    }

    .code-cell {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-weight: 600;
      color: var(--neu-accent-secondary, #3B82F6);
      font-size: 0.9rem;
      white-space: nowrap;
    }

    .code-cell.p10 { color: var(--neu-accent, #F59E0B); }

    .justif {
      font-style: italic;
      color: var(--neu-text-muted, #6B7280);
      font-size: 0.85rem;
    }

    .titre-row td {
      background: transparent;
      border-bottom: none;
      padding: 4px 16px 2px;
    }
    .titre-row:hover td { background: transparent; }

    .titres-cell { padding: 6px 16px 2px !important; }

    .titre-p10 {
      font-style: italic;
      color: var(--neu-text-muted, #64748B);
      font-size: 0.85rem;
      padding: 2px 0 1px 10px;
      border-left: 2px solid rgba(245, 158, 11, 0.4);
    }

    @media (max-width: 768px) {
      .search-container { padding: 20px 12px; }
      .search-form { flex-direction: column; }
      .search-button { border-radius: 0 0 var(--neu-radius-inner, 12px) var(--neu-radius-inner, 12px); }
      .result-card { padding: 16px; border-radius: 20px; }
      .level { flex-direction: column; gap: 4px; }
    }

    @media (max-width: 1024px) {
      .search-container { padding: 30px 16px; }
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

        // Filtrer les résultats sans code valide (évite les appels decode?code= vides)
        const validResults = results.filter((r: any) => {
          const code = (r.code || '').replace(/\s/g, '');
          return code.length > 0;
        });

        if (validResults.length === 0) {
          this.error = 'L\'IA n\'a retourné aucun code valide. Veuillez reformuler votre recherche.';
          this.isLoading = false;
          return;
        }

        const decodeObservables = validResults.map((r: any) => {
          const aiCode = (r.code || '').replace(/\s/g, '');
          const justification: string | null = r.justification ?? null;
          // Pour positions10 : décoder le code6 parent pour avoir tous les P10 sous lui
          const codeToDecode = this.endpoint === 'positions10' && aiCode.length >= 6
            ? aiCode.substring(0, 6)
            : aiCode;

          const decode$ = this.endpoint === 'positions10'
            ? this.searchService.decodeP10Code(codeToDecode, true)
            : this.searchService.decodeCode(codeToDecode, true);

          return decode$.pipe(
            retry(1),
            catchError(() => of(null)),
            map(decoded => {
              if (!decoded || (!decoded.position4 && (!decoded.positions6 || decoded.positions6.length === 0))) {
                return null;
              }
              return { decoded, justification, aiCode } as SearchResultItem;
            })
          );
        });

        forkJoin(decodeObservables).subscribe({
          next: (items: any[]) => {
            const valid = items.filter(i => i != null) as SearchResultItem[];
            if (valid.length === 0) {
              this.error = 'Le décodage des codes retournés a échoué. Veuillez réessayer.';
              this.isLoading = false;
              return;
            }
            this.groupedResults = this.buildGrouped(valid);
            this.saveState(valid);
            this.isLoading = false;
          },
          error: () => {
            this.error = 'Erreur lors du décodage des résultats. Veuillez réessayer.';
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
