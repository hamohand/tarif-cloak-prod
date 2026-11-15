import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError, map, retry, switchMap } from 'rxjs/operators';
import { RegulatoryData, SearchService } from '../services/search.service';
import { SearchResultItem, SearchStateService, TariffZone } from '../services/search-state.service';
import { CustomsCardComponent } from '../components/customs-card/customs-card.component';

interface GroupedP10 {
  code: string;
  formattedCode?: string;
  checkDigit?: string;
  description: string;
  justification: string | null;
  titres: string[] | null;
  fullTitres: string[];
  regulatoryData?: RegulatoryData;
  enriched: boolean;
  glossary?: Record<string, string>;
}

interface GroupedP6 {
  code: string;
  description: string;
  justification: string | null;
  codes10: GroupedP10[];
  glossary?: Record<string, string>;
}

interface GroupedP4 {
  code: string;
  description: string;
  justification: string | null;
  codes6: GroupedP6[];
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CustomsCardComponent],
  template: `
    <div class="search-container">
      <!-- Bandeau essai gratuit pour visiteurs non connectés -->
      @if (!isAuthenticated) {
        <div class="guest-banner">
          <div class="guest-banner-info">
            <span class="guest-pill">Essai gratuit sans inscription</span>
            @if ((guestTrialsRemaining$ | async); as rem) {
              <span>Il vous reste <strong>{{ rem }}</strong> recherche{{ rem > 1 ? 's' : '' }} IA aujourd'hui (décodage par code toujours illimité et gratuit).</span>
            } @else if ((guestTrialsRemaining$ | async) === 0) {
              <span>Vos 2 essais IA du jour sont utilisés. Le décodage SQL reste gratuit et illimité.</span>
            } @else {
              <span>2 recherches IA offertes par jour · Décodage SQL officiel gratuit illimité.</span>
            }
          </div>
          <a routerLink="/auth/register" class="guest-cta">Créer un compte gratuit</a>
        </div>
      }

      <div class="search-form">
        <input
          type="text"
          [(ngModel)]="searchTerm"
          [placeholder]="endpoint === 'positions10' && zone === 'EU'
            ? 'Décrivez votre marchandise pour la NC8 UE (ex : Chevaux reproducteurs, Panneaux solaires...)'
            : 'Décrivez votre marchandise (ex : Chevaux pur sang arabe, Canards sauvages, Dattes...)'"
          class="search-input"
          (keydown.enter)="search()"
        />
        <button
          type="button"
          (click)="search()"
          class="search-button"
          [disabled]="isLoading || !searchTerm.trim()"
        >
          {{ isLoading ? 'Analyse en cours...' : 'Rechercher' }}
        </button>
      </div>

      <div class="quick-examples">
        <span class="quick-label">Exemples :</span>
        @for (ex of exampleQueries; track ex) {
          <button type="button" class="example-chip" (click)="searchExample(ex)">{{ ex }}</button>
        }
      </div>

      @if (isLoading) {
        <div class="loading">Analyse de la nomenclature officielle en cours...</div>
      }

      @if (error) {
        <div class="error">
          <p>{{ error }}</p>
          @if (!isAuthenticated) {
            <a routerLink="/auth/register" class="error-cta">Ouvrir un compte gratuit →</a>
          }
        </div>
      }

      @if (groupedResults && !isLoading) {
        <div class="results">
          <h3>Résultats officiels</h3>

          @if (groupedResults.length === 0) {
            <p class="no-results">Aucune position trouvée pour cette désignation. Essayez des termes plus précis.</p>
          }

          @for (g4 of groupedResults; track g4.code) {
            <div class="result-card">
              <div class="level level-position4">
                <span class="level-label">Position 4</span>
                <span class="level-code">{{ g4.code }}</span>
                <span class="level-desc">{{ g4.description }}</span>
              </div>
              @if (g4.justification) {
                <div class="position-justif">{{ g4.justification }}</div>
              }

              @for (p6 of g4.codes6; track p6.code) {
                @if (endpoint === 'positions6') {
                  <app-customs-card
                    [code]="p6.code"
                    [zone]="zone"
                    [description]="p6.description"
                    [position4]="{ code: g4.code, description: g4.description }"
                    [justification]="p6.justification"
                    [highlight]="true"
                    (hs6MatchRequest)="onHs6Match($event)">
                  </app-customs-card>
                } @else {
                  <div class="hs6-subheader">
                    <span class="hs6-tag">HS6 {{ p6.code }}</span>
                    <span class="hs6-desc">{{ p6.description }}</span>
                  </div>
                  @if (p6.justification) {
                    <div class="hs6-justif">{{ p6.justification }}</div>
                  }

                  @let featured = getFeaturedP10(p6);
                  @let siblings = getSiblingP10(p6);

                  <div class="featured-stack">
                    @for (p10 of featured; track p10.code) {
                      <app-customs-card
                        [code]="p10.code"
                        [formattedCode]="p10.formattedCode"
                        [checkDigit]="p10.checkDigit"
                        [zone]="zone"
                        [description]="p10.description"
                        [titles]="p10.fullTitres"
                        [position4]="{ code: g4.code, description: g4.description }"
                        [justification]="p10.justification"
                        [regulatoryData]="p10.regulatoryData"
                        [glossary]="p10.glossary || p6.glossary"
                        [enriched]="p10.enriched"
                        [highlight]="!!p10.justification"
                        (hs6MatchRequest)="onHs6Match($event)">
                      </app-customs-card>
                    }
                  </div>

                  @if (siblings.length > 0) {
                    <details class="siblings-accordion">
                      <summary>
                        Voir les {{ siblings.length }} autre{{ siblings.length > 1 ? 's' : '' }} sous-position{{ siblings.length > 1 ? 's' : '' }} officielle{{ siblings.length > 1 ? 's' : '' }} sous {{ p6.code }}
                      </summary>
                      <div class="siblings-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>{{ zone === 'EU' ? 'Code NC8' : 'Code P10' }}</th>
                              <th>Désignation</th>
                              @if (zone === 'EU') {
                                <th>Droit TDC</th>
                                <th>Unité suppl.</th>
                              } @else {
                                <th>DD / TVA</th>
                                <th>FAP</th>
                              }
                            </tr>
                          </thead>
                          <tbody>
                            @for (p10 of siblings; track p10.code) {
                              @if (p10.titres && p10.titres.length > 0) {
                                <tr class="titre-row">
                                  <td colspan="4" class="titres-cell">
                                    @for (titre of p10.titres; track titre) {
                                      <div class="titre-p10">{{ titre }}</div>
                                    }
                                  </td>
                                </tr>
                              }
                              <tr>
                                <td class="code-cell p10">
                                  {{ p10.formattedCode || p10.code }}
                                  @if (p10.checkDigit) {
                                    <span class="mini-key">{{ p10.checkDigit }}</span>
                                  }
                                </td>
                                <td class="desc-cell">{{ p10.description }}</td>
                                @if (zone === 'EU') {
                                  <td class="tax-cell">{{ formatSiblingDuty(p10.regulatoryData?.dd) }}</td>
                                  <td class="fap-cell">{{ p10.regulatoryData?.uqn || '—' }}</td>
                                } @else {
                                  <td class="tax-cell">
                                    @if (p10.regulatoryData?.dd || p10.regulatoryData?.tva) {
                                      {{ formatSiblingDuty(p10.regulatoryData?.dd) }} / {{ formatSiblingDuty(p10.regulatoryData?.tva) }}
                                    } @else {
                                      —
                                    }
                                  </td>
                                  <td class="fap-cell">
                                    {{ p10.regulatoryData?.fap?.join(', ') || '—' }}
                                  </td>
                                }
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </details>
                  }
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
      padding: 20px 8px;
      max-width: 960px;
      margin: 0 auto;
      animation: fadeIn 0.35s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .guest-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px 16px;
      margin-bottom: 18px;
      border-radius: 12px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.28);
      color: #CBD5E1;
      font-size: 0.88rem;
    }

    .guest-banner-info {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .guest-pill {
      padding: 3px 9px;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.22);
      color: #93C5FD;
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .guest-cta {
      padding: 6px 12px;
      border-radius: 8px;
      background: #F59E0B;
      color: #070B14;
      font-weight: 700;
      font-size: 0.82rem;
      text-decoration: none;
      white-space: nowrap;
    }

    .search-form {
      display: flex;
      margin-bottom: 12px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      overflow: hidden;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .search-form:focus-within {
      border-color: #F59E0B;
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
    }

    .search-input {
      flex: 1;
      padding: 15px 18px;
      min-height: 48px;
      font-size: 16px;
      border: none;
      outline: none;
      background: transparent;
      color: #F8FAFC;
    }

    .search-input::placeholder {
      color: #64748B;
    }

    .search-button {
      padding: 15px 28px;
      min-height: 48px;
      font-size: 15px;
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      background: #F59E0B;
      color: #070B14;
      border: none;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.2s ease;
    }

    .search-button:hover:not(:disabled) { background: #D97706; }
    .search-button:disabled { opacity: 0.45; cursor: not-allowed; }

    .quick-examples {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 24px;
    }

    .quick-label {
      font-size: 0.8rem;
      color: #94A3B8;
      font-weight: 600;
    }

    .example-chip {
      padding: 5px 12px;
      border-radius: 999px;
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #CBD5E1;
      font-size: 0.8rem;
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease;
    }

    .example-chip:hover {
      border-color: rgba(245, 158, 11, 0.5);
      color: #FCD34D;
    }

    .loading {
      margin: 28px 0;
      text-align: center;
      color: #F59E0B;
      font-size: 1rem;
      font-weight: 600;
    }

    .error {
      margin: 24px 0;
      color: #FCA5A5;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 14px 18px;
      border-radius: 10px;
    }

    .error p { margin: 0; }
    .error-cta {
      display: inline-block;
      margin-top: 8px;
      color: #FCD34D;
      font-weight: 700;
      text-decoration: none;
    }

    .results h3 {
      margin: 0 0 18px;
      color: #F8FAFC;
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-size: 1.25rem;
    }

    .no-results {
      text-align: center;
      color: #94A3B8;
      padding: 24px;
      background: #111827;
      border-radius: 12px;
    }

    .result-card {
      margin-bottom: 24px;
      padding: 20px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .level-position4 {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 10px;
      padding: 12px 16px;
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-left: 3px solid #F59E0B;
      border-radius: 10px;
    }

    .level-label {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #94A3B8;
    }

    .level-code {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-weight: 700;
      font-size: 1rem;
      color: #F59E0B;
    }

    .level-desc {
      color: #E2E8F0;
      font-size: 0.95rem;
    }

    .position-justif,
    .hs6-justif {
      font-style: italic;
      color: #CBD5E1;
      font-size: 0.86rem;
      line-height: 1.45;
      padding: 6px 12px;
      border-left: 2px solid rgba(96, 165, 250, 0.45);
      background: rgba(17, 24, 39, 0.55);
      border-radius: 0 8px 8px 0;
    }

    .position-justif {
      border-left-color: rgba(245, 158, 11, 0.55);
      margin-top: -6px;
    }

    .hs6-justif {
      margin: -4px 0 4px 4px;
    }

    .hs6-subheader {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 10px;
      padding: 4px 4px 0;
    }

    .hs6-tag {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.85rem;
      font-weight: 700;
      color: #60A5FA;
      background: rgba(59, 130, 246, 0.14);
      padding: 3px 9px;
      border-radius: 6px;
    }

    .hs6-desc {
      color: #CBD5E1;
      font-size: 0.92rem;
      font-weight: 500;
    }

    .featured-stack {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .siblings-accordion {
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 12px;
      padding: 12px 16px;
    }

    .siblings-accordion summary {
      cursor: pointer;
      color: #93C5FD;
      font-size: 0.88rem;
      font-weight: 600;
      user-select: none;
    }

    .siblings-table-wrap {
      margin-top: 12px;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      padding: 8px 12px;
      text-align: left;
      color: #94A3B8;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    td {
      padding: 10px 12px;
      color: #CBD5E1;
      font-size: 0.88rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      vertical-align: top;
    }

    .code-cell.p10 {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-weight: 700;
      color: #F59E0B;
      white-space: nowrap;
    }

    .mini-key {
      margin-left: 4px;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(245, 158, 11, 0.16);
      color: #FCD34D;
      font-size: 0.72rem;
    }

    .tax-cell, .fap-cell {
      white-space: nowrap;
      font-size: 0.82rem;
      color: #94A3B8;
    }

    .titre-row td {
      border-bottom: none;
      padding: 6px 12px 2px;
    }

    .titre-p10 {
      font-style: italic;
      color: #94A3B8;
      font-size: 0.82rem;
      padding-left: 10px;
      border-left: 2px solid rgba(245, 158, 11, 0.45);
    }

    @media (max-width: 720px) {
      .search-form { flex-direction: column; }
      .search-button { border-radius: 0 0 12px 12px; }
    }
  `]
})
export class SearchComponent implements OnInit, OnDestroy {
  searchTerm: string = '';
  groupedResults: GroupedP4[] | null = null;
  isLoading: boolean = false;
  error: string | null = null;
  endpoint: 'positions6' | 'positions10' = 'positions6';
  zone: TariffZone = 'DZ';

  private readonly exampleQueriesDz = [
    'Chevaux pur sang arabe',
    'Canards sauvages',
    'Dattes Deglet Nour',
    'Voiture électrique'
  ];

  private readonly exampleQueriesEu = [
    'Chevaux reproducteurs race pure',
    'Voiture électrique',
    'Panneaux solaires photovoltaïques',
    'Huile d’olive vierge'
  ];

  get exampleQueries(): string[] {
    return (this.endpoint === 'positions10' && this.zone === 'EU')
      ? this.exampleQueriesEu
      : this.exampleQueriesDz;
  }

  private searchService = inject(SearchService);
  private oauthService = inject(OAuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private state = inject(SearchStateService);
  private zoneSub?: Subscription;

  guestTrialsRemaining$ = this.searchService.guestTrialsRemaining$;

  get isAuthenticated(): boolean {
    return this.oauthService.hasValidAccessToken();
  }

  ngOnInit(): void {
    const mode = this.route.snapshot.data['mode'];
    this.endpoint = mode === 'position10' ? 'positions10' : 'positions6';

    this.zoneSub = this.state.selectedZone$.subscribe(z => {
      this.zone = z;
      this.error = null;
      this.loadStateForZone();
    });

    if (!this.isAuthenticated) {
      this.searchService.getGuestQuota().subscribe({ error: () => {} });
    }
  }

  ngOnDestroy(): void {
    this.zoneSub?.unsubscribe();
  }

  formatSiblingDuty(value?: string): string {
    if (!value) return '—';
    const trimmed = value.trim();
    if (!trimmed || trimmed === '-') return '—';
    if (trimmed.includes('%')) return trimmed;
    const starMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*\*$/);
    if (starMatch) return `${starMatch[1]} % *`;
    return /^\d+(?:[.,]\d+)?$/.test(trimmed) ? `${trimmed} %` : trimmed;
  }

  searchExample(term: string): void {
    this.searchTerm = term;
    this.search();
  }

  search(): void {
    const trimmed = this.searchTerm.trim();
    if (!trimmed) {
      this.error = 'Veuillez entrer une désignation à rechercher.';
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.groupedResults = null;

    this.searchService.searchCodes(trimmed, this.endpoint, this.zone).subscribe({
      next: (results: any[]) => {
        if (!results || results.length === 0) {
          this.groupedResults = [];
          this.isLoading = false;
          this.saveState([]);
          return;
        }

        // Filtrer les résultats sans code valide (évite les appels decode?code= vides)
        const validResults = results.filter((r: any) => {
          const code = (r.code || '').replace(/[^0-9]/g, '');
          return code.length > 0;
        });

        if (validResults.length === 0) {
          this.error = 'L\'IA n\'a retourné aucun code valide. Veuillez reformuler votre recherche.';
          this.isLoading = false;
          return;
        }

        const decodeObservables = validResults.map((r: any) => {
          const rawDigits = (r.code || '').replace(/[^0-9]/g, '');
          const targetLeafLen = this.zone === 'EU' ? 8 : 10;
          const aiCode = this.endpoint === 'positions6' && rawDigits.length > 6
            ? rawDigits.substring(0, 6)
            : (rawDigits.length > 6 && rawDigits.length !== targetLeafLen ? rawDigits.substring(0, 6) : rawDigits);
          const justification: string | null = r.justification ?? null;

          if (this.endpoint === 'positions10' && aiCode.length === 4) {
            return this.searchService.decodeP10Code(aiCode, this.zone).pipe(
              retry(1),
              catchError(() => of(null)),
              switchMap(p4Decoded => {
                if (!p4Decoded || !p4Decoded.position4) {
                  return of([] as SearchResultItem[]);
                }
                const hs6List = p4Decoded.positions6 || [];
                if (hs6List.length === 0) {
                  return of([{ decoded: p4Decoded, justification, aiCode } as SearchResultItem]);
                }
                const childCalls = hs6List.map(p6 =>
                  this.searchService.decodeP10Code(p6.code.replace(/[^0-9]/g, ''), this.zone).pipe(
                    retry(1),
                    catchError(() => of(null)),
                    map(p6Decoded => {
                      if (!p6Decoded || (!p6Decoded.position4 && (!p6Decoded.positions6 || p6Decoded.positions6.length === 0))) {
                        return null;
                      }
                      return { decoded: p6Decoded, justification, aiCode } as SearchResultItem;
                    })
                  )
                );
                return forkJoin(childCalls).pipe(
                  map(children => {
                    const validChildren = children.filter((c): c is SearchResultItem => c !== null);
                    return validChildren.length > 0
                      ? validChildren
                      : [{ decoded: p4Decoded, justification, aiCode } as SearchResultItem];
                  })
                );
              })
            );
          }

          const codeToDecode = this.endpoint === 'positions10' && aiCode.length >= 6
            ? aiCode.substring(0, 6)
            : aiCode;

          const decode$ = this.endpoint === 'positions10'
            ? this.searchService.decodeP10Code(codeToDecode, this.zone)
            : this.searchService.decodeCode(codeToDecode, this.zone);

          return decode$.pipe(
            retry(1),
            catchError(() => of(null)),
            map(decoded => {
              if (!decoded || (!decoded.position4 && (!decoded.positions6 || decoded.positions6.length === 0))) {
                return [] as SearchResultItem[];
              }
              return [{ decoded, justification, aiCode } as SearchResultItem];
            })
          );
        });

        forkJoin(decodeObservables).subscribe({
          next: (itemLists: SearchResultItem[][]) => {
            const valid = itemLists.flat().filter(i => i != null);
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
        if ((err.status === 401 || err.status === 403) && this.oauthService.hasValidAccessToken()) {
          this.oauthService.logOut();
        }
        this.error = err.message || 'Une erreur est survenue lors de la recherche.';
        this.isLoading = false;
      }
    });
  }

  getFeaturedP10(p6: GroupedP6): GroupedP10[] {
    const highlighted = p6.codes10.filter(c => !!c.justification);
    if (highlighted.length > 0) return highlighted;
    return p6.codes10.slice(0, 1);
  }

  getSiblingP10(p6: GroupedP6): GroupedP10[] {
    const highlighted = p6.codes10.filter(c => !!c.justification);
    if (highlighted.length > 0) return p6.codes10.filter(c => !c.justification);
    return p6.codes10.slice(1);
  }

  onHs6Match(event: { hs6: string; zone: string; sourceCode: string }): void {
    this.state.compareMode = true;
    this.state.compareHs6Input = event.hs6;
    this.state.compareResult = null;
    this.router.navigate(['/recherche/decode-p10']);
  }

  /** Construit la structure groupée : P4 → P6 → P10, sans doublons. */
  private buildGrouped(items: SearchResultItem[]): GroupedP4[] {
    const mapP4 = new Map<string, GroupedP4>();
    const prevTitlesMap = new Map<string, string[]>();

    for (const item of items) {
      const p4 = item.decoded.position4;
      if (!p4) continue;

      const p4Clean = p4.code.replace(/[^0-9]/g, '');
      if (!mapP4.has(p4.code)) {
        mapP4.set(p4.code, {
          code: p4.code,
          description: p4.description,
          justification: null,
          codes6: []
        });
      }
      const group4 = mapP4.get(p4.code)!;
      if (this.endpoint === 'positions10' && item.aiCode === p4Clean && item.justification && !group4.justification) {
        group4.justification = item.justification;
      }

      for (const p6 of (item.decoded.positions6 || [])) {
        const p6Clean = p6.code.replace(/[^0-9]/g, '');
        let group6 = group4.codes6.find(g => g.code.replace(/[^0-9]/g, '') === p6Clean);
        if (!group6) {
          group6 = {
            code: p6.code,
            description: p6.description,
            justification: null,
            codes10: [],
            glossary: item.decoded.glossary
          };
          group4.codes6.push(group6);
        }

        if (this.endpoint === 'positions6') {
          if (!group6.justification) group6.justification = item.justification;
        } else {
          if (item.aiCode === p6Clean && item.justification && !group6.justification) {
            group6.justification = item.justification;
          }

          const p10ForGroup6 = (item.decoded.positions10 || []).filter(
            p10 => p10.code.replace(/[^0-9]/g, '').startsWith(p6Clean)
          );

          for (const p10 of p10ForGroup6) {
            const p10Code = p10.code.replace(/[^0-9]/g, '');
            const existing = group6.codes10.find(g => g.code.replace(/[^0-9]/g, '') === p10Code);
            if (!existing) {
              const allTitres = item.decoded.titresParPosition10?.[p10.code]
                ?? ((item.decoded.niveau === 'POSITION10' || item.decoded.niveau === 'POSITION8') ? (item.decoded.titresPosition10 ?? []) : []);
              const prevTitres = prevTitlesMap.get(p6Clean) ?? [];
              const delta = this.titreDelta(allTitres, prevTitres);
              prevTitlesMap.set(p6Clean, allTitres);
              group6.codes10.push({
                code: p10.code,
                formattedCode: p10.formattedCode,
                checkDigit: p10.checkDigit,
                description: p10.description,
                justification: p10Code === item.aiCode ? item.justification : null,
                titres: delta.length > 0 ? delta : null,
                fullTitres: allTitres,
                regulatoryData: p10.regulatoryData,
                enriched: !!p10.enriched,
                glossary: item.decoded.glossary
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

  private titreDelta(current: string[], prev: string[]): string[] {
    let i = 0;
    while (i < Math.min(current.length, prev.length) && current[i] === prev[i]) i++;
    return current.slice(i);
  }

  private loadStateForZone(): void {
    if (this.endpoint === 'positions10') {
      if (this.zone === 'EU') {
        this.searchTerm = this.state.searchTerm_p10_eu;
        this.groupedResults = this.state.searchDecoded_p10_eu ? this.buildGrouped(this.state.searchDecoded_p10_eu) : null;
      } else {
        this.searchTerm = this.state.searchTerm_p10;
        this.groupedResults = this.state.searchDecoded_p10 ? this.buildGrouped(this.state.searchDecoded_p10) : null;
      }
    } else {
      this.searchTerm = this.state.searchTerm_hs;
      this.groupedResults = this.state.searchDecoded_hs ? this.buildGrouped(this.state.searchDecoded_hs) : null;
    }
  }

  private saveState(decoded: SearchResultItem[]): void {
    if (this.endpoint === 'positions10') {
      if (this.zone === 'EU') {
        this.state.searchTerm_p10_eu = this.searchTerm;
        this.state.searchDecoded_p10_eu = decoded;
      } else {
        this.state.searchTerm_p10 = this.searchTerm;
        this.state.searchDecoded_p10 = decoded;
      }
    } else {
      this.state.searchTerm_hs = this.searchTerm;
      this.state.searchDecoded_hs = decoded;
    }
  }
}
