import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OAuthService } from 'angular-oauth2-oidc';
import { Subscription } from 'rxjs';
import { DecodeResult, Hs6ComparisonResult, SearchService } from '../services/search.service';
import { SearchStateService, TariffZone } from '../services/search-state.service';
import { CustomsCardComponent } from '../components/customs-card/customs-card.component';

@Component({
  selector: 'app-decode-p10',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomsCardComponent],
  template: `
    <div class="decode-container" [class.compare-wide]="compareMode">
      <div class="free-badge-row">
        <span class="free-pill">Décodage SQL officiel · 100 % gratuit &amp; sans crédit</span>
      </div>

      <div class="mode-switch" role="tablist" aria-label="Mode de décodage">
        <button
          type="button"
          role="tab"
          class="mode-tab"
          [class.active]="!compareMode"
          [attr.aria-selected]="!compareMode"
          (click)="setCompareMode(false)">
          Décodage par code ({{ zone === 'EU' ? 'UE · NC8' : 'DZ · P10' }})
        </button>
        <button
          type="button"
          role="tab"
          class="mode-tab compare-tab"
          [class.active]="compareMode"
          [attr.aria-selected]="compareMode"
          (click)="setCompareMode(true)">
          ⇄ Comparateur Algérie ↔ Europe (HS6)
        </button>
      </div>

      @if (!compareMode) {
        <div class="search-form">
          <input
            type="text"
            [(ngModel)]="codeInput"
            [placeholder]="zone === 'EU' ? 'Ex : 0101.21.00, 0804.10.00, 870380, 08' : 'Ex : 0101.21.91.00 L, 080410, 0808, 08'"
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

        <p class="hint">
          Saisissez 2 chiffres (chapitre), 4 (position), 6 (HS6 international), 8 (NC8 UE) ou 10 chiffres (P10 DZ) avec ou sans points/clé.
        </p>

        @if (isLoading) {
          <div class="loading">Extraction officielle depuis la nomenclature...</div>
        }

        @if (error) {
          <div class="error">{{ error }}</div>
        }

        @if (result && !isLoading) {
          <div class="results">
            <h3>
              Hiérarchie officielle du code <span class="code-badge">{{ result.codeRecherche }}</span>
            </h3>

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

            @if (result.positions6 && result.positions6.length > 0 && (!result.positions10 || result.positions10.length === 0)) {
              <div class="subpositions">
                <h4>
                  @if (result.niveau === 'CHAPITRE') { Positions sous ce chapitre }
                  @if (result.niveau === 'POSITION4') { Codes HS6 sous cette position }
                </h4>
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Code</th><th>Désignation</th></tr></thead>
                    <tbody>
                      @for (item of result.positions6; track item.code) {
                        <tr class="clickable-row" (click)="quickDecode(item.code)">
                          <td class="code-cell">{{ item.code }}</td>
                          <td>{{ item.description }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }

            @if (result.positions10 && result.positions10.length > 0) {
              <div class="subpositions">
                <h4>
                  @if (result.niveau === 'POSITION6') {
                    Sous-positions nationales ({{ result.zone || zone }}) sous {{ result.positions6[0]?.code }} ({{ result.positions10.length }})
                  } @else {
                    Fiche douanière complète ({{ result.niveau }})
                  }
                </h4>

                <div class="cards-list">
                  @for (item of result.positions10; track item.code) {
                    <app-customs-card
                      [code]="item.code"
                      [formattedCode]="item.formattedCode"
                      [checkDigit]="item.checkDigit"
                      [zone]="result.zone || zone"
                      [description]="item.description"
                      [titles]="getItemTitles(item.code)"
                      [position4]="result.position4"
                      [regulatoryData]="item.regulatoryData"
                      [glossary]="result.glossary"
                      [enriched]="!!item.enriched"
                      [highlight]="result.niveau === 'POSITION10' || result.niveau === 'POSITION8'"
                      (hs6MatchRequest)="onHs6Match($event)">
                    </app-customs-card>
                  }
                </div>
              </div>
            }
          </div>
        }
      } @else {
        <div class="search-form">
          <input
            type="text"
            [(ngModel)]="compareInput"
            placeholder="Ex : 010121, 0804.10, 0101.21.91.00 L, 8703.80.10"
            class="search-input"
            (keydown.enter)="compare()"
            maxlength="20"
          />
          <button
            type="button"
            (click)="compare()"
            class="search-button compare-submit"
            [disabled]="compareLoading || !compareInput.trim()"
          >
            {{ compareLoading ? 'Comparaison...' : 'Comparer DZ ↔ UE' }}
          </button>
        </div>

        <p class="hint">
          Saisissez un code HS6 (6 chiffres) ou un code complet NC8 / P10 : le comparateur aligne côte à côte la nomenclature algérienne (DGD · P10) et européenne (UE 2026 · NC8) sous la même racine OMD.
        </p>

        <div class="compare-examples">
          <span class="examples-label">Exemples rapides :</span>
          @for (ex of compareExamples; track ex.code) {
            <button type="button" class="compare-chip" (click)="quickCompare(ex.code)">
              <span class="chip-code">{{ ex.code }}</span> {{ ex.label }}
            </button>
          }
        </div>

        @if (compareLoading) {
          <div class="loading">Alignement Algérie (DGD) ↔ Union Européenne (NC 2026) en cours...</div>
        }

        @if (compareError) {
          <div class="error">{{ compareError }}</div>
        }

        @if (compareResult && !compareLoading) {
          <div class="results">
            <h3>
              Comparaison HS6 <span class="code-badge">{{ compareResult.hs6 }}</span> : Algérie (DGD) ↔ Union Européenne (NC 2026)
            </h3>

            <div class="hierarchy">
              <div class="level level-section">
                <span class="level-label">Section</span>
                <span class="level-code">{{ compareResult.section.code }}</span>
                <div class="level-content">
                  <span class="level-desc">{{ compareResult.section.description }}</span>
                </div>
              </div>

              <div class="level level-chapitre">
                <span class="level-label">Chapitre</span>
                <span class="level-code">{{ compareResult.chapitre.code }}</span>
                <div class="level-content">
                  <span class="level-desc">{{ compareResult.chapitre.description }}</span>
                </div>
              </div>

              @if (compareResult.position4) {
                <div class="level level-position4">
                  <span class="level-label">Position 4</span>
                  <span class="level-code">{{ compareResult.position4.code }}</span>
                  <span class="level-desc">{{ compareResult.position4.description }}</span>
                </div>
              }

              @if (compareResult.position6) {
                <div class="level level-position6">
                  <span class="level-label">HS6 OMD</span>
                  <span class="level-code">{{ compareResult.position6.code }}</span>
                  <span class="level-desc">{{ compareResult.position6.description }}</span>
                </div>
              }
            </div>

            <div class="compare-grid">
              <section class="compare-col">
                <header class="compare-col-head dz">
                  <span class="col-title">Algérie · DGD (P10)</span>
                  <span class="col-count">{{ compareResult.dz?.positions10?.length || 0 }} sous-position(s)</span>
                </header>

                @if (compareResult.dz?.positions10 && compareResult.dz!.positions10!.length > 0) {
                  <div class="cards-list">
                    @for (item of compareResult.dz!.positions10!; track item.code) {
                      <app-customs-card
                        [code]="item.code"
                        [formattedCode]="item.formattedCode"
                        [checkDigit]="item.checkDigit"
                        [zone]="'DZ'"
                        [description]="item.description"
                        [titles]="getCompareTitles(compareResult.dz!, item.code)"
                        [position4]="compareResult.position4 ?? null"
                        [regulatoryData]="item.regulatoryData"
                        [glossary]="compareResult.dz?.glossary"
                        [enriched]="!!item.enriched"
                        [highlight]="false"
                        (hs6MatchRequest)="onHs6Match($event)">
                      </app-customs-card>
                    }
                  </div>
                } @else {
                  <div class="compare-empty">
                    Aucune sous-position P10 officielle répertoriée en Algérie sous le HS6 {{ compareResult.hs6 }}.
                  </div>
                }
              </section>

              <section class="compare-col">
                <header class="compare-col-head eu">
                  <span class="col-title">Union Européenne · NC 2026 (NC8)</span>
                  <span class="col-count">{{ compareResult.eu?.positions10?.length || 0 }} sous-position(s)</span>
                </header>

                @if (compareResult.eu?.positions10 && compareResult.eu!.positions10!.length > 0) {
                  <div class="cards-list">
                    @for (item of compareResult.eu!.positions10!; track item.code) {
                      <app-customs-card
                        [code]="item.code"
                        [formattedCode]="item.formattedCode"
                        [checkDigit]="item.checkDigit"
                        [zone]="'EU'"
                        [description]="item.description"
                        [titles]="getCompareTitles(compareResult.eu!, item.code)"
                        [position4]="compareResult.position4 ?? null"
                        [regulatoryData]="item.regulatoryData"
                        [glossary]="compareResult.eu?.glossary"
                        [enriched]="!!item.enriched"
                        [highlight]="false"
                        (hs6MatchRequest)="onHs6Match($event)">
                      </app-customs-card>
                    }
                  </div>
                } @else {
                  <div class="compare-empty">
                    Aucune sous-position NC8 répertoriée dans la nomenclature UE 2026 sous le HS6 {{ compareResult.hs6 }}.
                  </div>
                }
              </section>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .decode-container {
      padding: 20px 8px;
      max-width: 960px;
      margin: 0 auto;
      animation: fadeIn 0.35s ease;
      transition: max-width 0.2s ease;
    }

    .decode-container.compare-wide {
      max-width: 1140px;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .free-badge-row {
      margin-bottom: 14px;
    }

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

    .mode-switch {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }

    .mode-tab {
      padding: 9px 16px;
      border-radius: 10px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94A3B8;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .mode-tab:hover {
      color: #F8FAFC;
      border-color: rgba(255, 255, 255, 0.22);
    }

    .mode-tab.active {
      background: rgba(245, 158, 11, 0.14);
      border-color: rgba(245, 158, 11, 0.5);
      color: #FCD34D;
    }

    .mode-tab.compare-tab.active {
      background: rgba(59, 130, 246, 0.15);
      border-color: rgba(59, 130, 246, 0.5);
      color: #93C5FD;
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
      border-color: #F59E0B;
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
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
      background: #F59E0B;
      color: #070B14;
      border: none;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.2s ease;
    }

    .search-button.compare-submit {
      background: #3B82F6;
      color: #F8FAFC;
    }

    .search-button.compare-submit:hover:not(:disabled) { background: #2563EB; }
    .search-button:hover:not(:disabled) { background: #D97706; }
    .search-button:disabled { opacity: 0.45; cursor: not-allowed; }

    .hint {
      color: #94A3B8;
      font-size: 0.85rem;
      margin: 0 0 16px;
    }

    .compare-examples {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }

    .examples-label {
      font-size: 0.8rem;
      color: #64748B;
      font-weight: 600;
    }

    .compare-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 11px;
      border-radius: 999px;
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #CBD5E1;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .compare-chip:hover {
      border-color: rgba(59, 130, 246, 0.5);
      color: #93C5FD;
    }

    .chip-code {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-weight: 700;
      color: #60A5FA;
    }

    .loading {
      margin: 26px 0;
      text-align: center;
      color: #F59E0B;
      font-weight: 600;
    }

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
      background: rgba(245, 158, 11, 0.16);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #F59E0B;
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 1rem;
    }

    .hierarchy {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 22px;
    }

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
    .level-position6 { border-left: 3px solid #A78BFA; margin-left: 42px; }

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
      min-width: 56px;
    }

    .level-content { display: flex; flex-direction: column; gap: 4px; }
    .level-desc { color: #E2E8F0; font-size: 0.94rem; line-height: 1.4; }
    .level-note { margin: 0; color: #94A3B8; font-size: 0.82rem; line-height: 1.4; }

    .subpositions h4 {
      color: #F8FAFC;
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-size: 1rem;
      margin: 0 0 12px;
    }

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
    .clickable-row { cursor: pointer; }
    .clickable-row:hover td { background: rgba(245, 158, 11, 0.06); }

    .code-cell {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-weight: 700;
      color: #F59E0B;
      white-space: nowrap;
    }

    .cards-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .compare-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      align-items: start;
    }

    .compare-col {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }

    .compare-col-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 11px 14px;
      border-radius: 10px;
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .compare-col-head.dz {
      border-top: 3px solid #F59E0B;
    }

    .compare-col-head.eu {
      border-top: 3px solid #3B82F6;
    }

    .col-title {
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-weight: 700;
      font-size: 0.96rem;
      color: #F8FAFC;
    }

    .col-count {
      font-size: 0.76rem;
      font-weight: 700;
      color: #94A3B8;
      white-space: nowrap;
    }

    .compare-empty {
      padding: 18px;
      border-radius: 12px;
      background: #111827;
      border: 1px dashed rgba(255, 255, 255, 0.14);
      color: #94A3B8;
      font-size: 0.88rem;
      line-height: 1.45;
    }

    @media (max-width: 900px) {
      .compare-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .search-form { flex-direction: column; }
      .search-button { border-radius: 0 0 12px 12px; }
      .level { flex-direction: column; gap: 4px; }
      .level-chapitre, .level-position4, .level-position6 { margin-left: 0; }
    }
  `]
})
export class DecodeP10Component implements OnInit, OnDestroy {
  codeInput: string = '';
  result: DecodeResult | null = null;
  isLoading: boolean = false;
  error: string | null = null;
  zone: TariffZone = 'DZ';

  compareMode: boolean = false;
  compareInput: string = '';
  compareResult: Hs6ComparisonResult | null = null;
  compareLoading: boolean = false;
  compareError: string | null = null;

  readonly compareExamples = [
    { code: '010121', label: 'Chevaux race pure' },
    { code: '080410', label: 'Dattes' },
    { code: '870380', label: 'Voitures électriques' }
  ];

  private searchService = inject(SearchService);
  private oauthService = inject(OAuthService);
  private state = inject(SearchStateService);
  private zoneSub?: Subscription;
  private compareSub?: Subscription;

  ngOnInit(): void {
    this.compareMode = this.state.compareMode;

    this.zoneSub = this.state.selectedZone$.subscribe(z => {
      this.zone = z;
      this.error = null;
      if (z === 'EU') {
        this.codeInput = this.state.decodeP10Input_eu;
        this.result = this.state.decodeP10Result_eu;
      } else {
        this.codeInput = this.state.decodeP10Input;
        this.result = this.state.decodeP10Result;
      }
      if (!this.compareMode && this.codeInput && !this.result) {
        this.decode();
      }
    });

    this.compareSub = this.state.compareMode$.subscribe(isCompare => {
      this.compareMode = isCompare;
      if (isCompare) {
        this.compareInput = this.state.compareHs6Input;
        this.compareResult = this.state.compareResult;
        if (this.compareInput && !this.compareResult) {
          this.compare();
        }
      } else if (this.codeInput && !this.result) {
        this.decode();
      }
    });
  }

  ngOnDestroy(): void {
    this.zoneSub?.unsubscribe();
    this.compareSub?.unsubscribe();
  }

  setCompareMode(enabled: boolean): void {
    this.state.compareMode = enabled;
  }

  getItemTitles(code: string): string[] {
    if (!this.result) return [];
    if (this.result.titresPosition10 && this.result.titresPosition10.length > 0) {
      return this.result.titresPosition10;
    }
    return this.result.titresParPosition10?.[code] ?? [];
  }

  getCompareTitles(res: DecodeResult | null | undefined, code: string): string[] {
    if (!res) return [];
    if (res.titresPosition10 && res.titresPosition10.length > 0) {
      return res.titresPosition10;
    }
    return res.titresParPosition10?.[code] ?? [];
  }

  quickDecode(code: string): void {
    this.codeInput = code;
    this.decode();
  }

  quickCompare(code: string): void {
    this.compareInput = code;
    this.compare();
  }

  onHs6Match(event: { hs6: string; zone: string; sourceCode: string }): void {
    this.compareInput = event.hs6;
    this.compareResult = null;
    this.state.compareHs6Input = event.hs6;
    this.state.compareResult = null;
    if (this.compareMode) {
      this.compare();
    } else {
      this.state.compareMode = true;
    }
  }

  decode(): void {
    const trimmed = this.codeInput.trim();
    if (!trimmed) {
      this.error = 'Veuillez saisir un code.';
      return;
    }

    const normalized = trimmed.replace(/[^0-9]/g, '');
    if (![2, 4, 6, 8, 10].includes(normalized.length)) {
      this.error = 'Le code doit contenir 2, 4, 6, 8 ou 10 chiffres (ex : 0101.21.91.00 L ou 0101.21.00).';
      return;
    }

    const effectiveZone: TariffZone = normalized.length === 8
      ? 'EU'
      : (normalized.length === 10 ? 'DZ' : this.zone);

    this.isLoading = true;
    this.error = null;
    this.result = null;

    this.searchService.decodeP10Code(trimmed, effectiveZone).subscribe({
      next: (res) => {
        this.result = res;
        if (this.zone === 'EU') {
          this.state.decodeP10Input_eu = this.codeInput;
          this.state.decodeP10Result_eu = res;
        } else {
          this.state.decodeP10Input = this.codeInput;
          this.state.decodeP10Result = res;
        }
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

  compare(): void {
    const trimmed = this.compareInput.trim();
    if (!trimmed) {
      this.compareError = 'Veuillez saisir un code (minimum 6 chiffres).';
      return;
    }

    const normalized = trimmed.replace(/[^0-9]/g, '');
    if (normalized.length < 6) {
      this.compareError = 'Le comparateur requiert au moins 6 chiffres (HS6, NC8 ou P10).';
      return;
    }

    this.compareLoading = true;
    this.compareError = null;
    this.compareResult = null;

    this.searchService.compareHs6(trimmed).subscribe({
      next: (res) => {
        this.compareResult = res;
        this.state.compareHs6Input = this.compareInput;
        this.state.compareResult = res;
        this.compareLoading = false;
      },
      error: (err) => {
        this.compareError = err.message || 'Impossible de comparer ce code.';
        if (err.status === 401 && this.oauthService.hasValidAccessToken()) {
          this.oauthService.logOut();
        }
        this.compareLoading = false;
      }
    });
  }
}
