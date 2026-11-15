import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OAuthService } from 'angular-oauth2-oidc';
import { Subscription } from 'rxjs';
import { DecodeCodeItem, DecodeResult, Hs6ComparisonResult, SearchService } from '../services/search.service';
import { SearchStateService, TariffZone } from '../services/search-state.service';
import { CustomsCardComponent } from '../components/customs-card/customs-card.component';

@Component({
  selector: 'app-decode-p10',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomsCardComponent],
  template: `
    <div class="decode-container" [class.compare-wide]="compareMode">
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

        <div class="quick-bar">
          <span class="examples-label">Décodage SQL gratuit (2 à 10 chiffres) · Exemples :</span>
          @for (ex of decodeExamples; track ex) {
            <button type="button" class="example-chip mono" (click)="quickDecode(ex)">{{ ex }}</button>
          }
        </div>

        @if (isLoading) {
          <div class="loading">Extraction officielle depuis la nomenclature...</div>
        }

        @if (error) {
          <div class="error">{{ error }}</div>
        }

        @if (result && !isLoading) {
          <div class="results">
            <div class="results-head">
              <h3>
                Hiérarchie officielle du code <span class="code-badge">{{ result.codeRecherche }}</span>
              </h3>
              @if (currentHs6Prefix) {
                <button
                  type="button"
                  class="compare-shortcut-btn"
                  (click)="onHs6Match({ hs6: currentHs6Prefix, zone: result.zone || zone, sourceCode: result.codeRecherche })">
                  ⇄ Comparer DZ ↔ UE ({{ currentHs6Prefix }})
                </button>
              }
            </div>

            <div class="hierarchy">
              <div class="level level-section">
                <span class="level-label">Section</span>
                <span class="level-code">{{ result.section.code }}</span>
                <div class="level-content">
                  <span class="level-desc">{{ result.section.description }}</span>
                  @if (result.section.note) {
                    <details class="note-details">
                      <summary>Note légale de section</summary>
                      <p class="level-note">{{ result.section.note }}</p>
                    </details>
                  }
                </div>
              </div>

              <div class="level level-chapitre">
                <span class="level-label">Chapitre</span>
                <span class="level-code">{{ result.chapitre.code }}</span>
                <div class="level-content">
                  <span class="level-desc">{{ result.chapitre.description }}</span>
                  @if (result.chapitre.note) {
                    <details class="note-details">
                      <summary>Note légale de chapitre</summary>
                      <p class="level-note">{{ result.chapitre.note }}</p>
                    </details>
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

                @if (result.niveau === 'POSITION6' && result.positions10.length > 2) {
                  <div class="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{{ (result.zone || zone) === 'EU' ? 'Code NC8' : 'Code P10' }}</th>
                          <th>Désignation officielle</th>
                          @if ((result.zone || zone) === 'EU') {
                            <th>TDC</th>
                            <th>Unité</th>
                          } @else {
                            <th>DD / TVA</th>
                            <th>UQN · GU</th>
                            <th>FAP</th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (item of result.positions10; track item.code; let idx = $index) {
                          @let deltaTitles = getDeltaTitles(idx, item.code);
                          @if (deltaTitles.length > 0) {
                            <tr class="titre-row">
                              <td [attr.colspan]="(result.zone || zone) === 'EU' ? 4 : 5" class="titres-cell">
                                {{ deltaTitles.join(' › ') }}
                              </td>
                            </tr>
                          }
                          <tr class="clickable-row" (click)="quickDecode(item.code)" title="Cliquer pour ouvrir la fiche détaillée">
                            <td class="code-cell">
                              {{ item.formattedCode || item.code }}
                              @if (item.checkDigit) {
                                <span class="mini-key">{{ item.checkDigit }}</span>
                              }
                            </td>
                            <td class="desc-cell">{{ cleanDesc(item.description) }}</td>
                            @if ((result.zone || zone) === 'EU') {
                              <td class="tax-cell">{{ formatDuty(item.regulatoryData?.dd) }}</td>
                              <td class="tax-cell">{{ item.regulatoryData?.uqn || '—' }}</td>
                            } @else {
                              <td class="tax-cell">
                                @if (item.regulatoryData?.dd || item.regulatoryData?.tva) {
                                  {{ formatDuty(item.regulatoryData?.dd) }} / {{ formatDuty(item.regulatoryData?.tva) }}
                                } @else {
                                  —
                                }
                              </td>
                              <td class="tax-cell">
                                {{ item.regulatoryData?.uqn || '—' }}
                                @if (item.regulatoryData?.gu && item.regulatoryData?.gu !== '-') {
                                  · GU {{ item.regulatoryData?.gu }}
                                }
                              </td>
                              <td class="tax-cell">{{ item.regulatoryData?.fap?.join(', ') || '—' }}</td>
                            }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                } @else {
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
                        [showPosition4]="false"
                        [regulatoryData]="item.regulatoryData"
                        [glossary]="result.glossary"
                        [enriched]="!!item.enriched"
                        [highlight]="result.niveau === 'POSITION10' || result.niveau === 'POSITION8'"
                        (hs6MatchRequest)="onHs6Match($event)">
                      </app-customs-card>
                    }
                  </div>
                }
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

        <div class="quick-bar">
          <span class="examples-label">Comparateur HS6 (Algérie DGD ↔ UE 2026) · Exemples :</span>
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
                <span class="level-desc">{{ compareResult.section.description }}</span>
              </div>

              <div class="level level-chapitre">
                <span class="level-label">Chapitre</span>
                <span class="level-code">{{ compareResult.chapitre.code }}</span>
                <span class="level-desc">{{ compareResult.chapitre.description }}</span>
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
                        [showPosition4]="false"
                        [showCompareAction]="false"
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
                        [showPosition4]="false"
                        [showCompareAction]="false"
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
      padding: 4px 0 16px;
      max-width: 980px;
      margin: 0 auto;
      animation: fadeIn 0.25s ease;
    }

    .decode-container.compare-wide { max-width: 1140px; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
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
      padding: 14px 16px;
      min-height: 46px;
      font-size: 17px;
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      border: none;
      outline: none;
      letter-spacing: 0.04em;
      background: transparent;
      color: #F8FAFC;
    }

    .search-input::placeholder {
      color: #64748B;
      font-size: 14px;
      letter-spacing: normal;
      font-family: var(--font-sans, 'Inter', sans-serif);
    }

    .search-button {
      padding: 14px 24px;
      min-height: 46px;
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

    .search-button.compare-submit { background: #3B82F6; color: #F8FAFC; }
    .search-button.compare-submit:hover:not(:disabled) { background: #2563EB; }
    .search-button:hover:not(:disabled) { background: #D97706; }
    .search-button:disabled { opacity: 0.45; cursor: not-allowed; }

    .quick-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 18px;
    }

    .examples-label { font-size: 0.8rem; color: #94A3B8; font-weight: 500; }

    .example-chip, .compare-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 11px;
      border-radius: 999px;
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #CBD5E1;
      font-size: 0.79rem;
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease;
    }

    .example-chip.mono, .chip-code {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-weight: 600;
    }

    .example-chip:hover { border-color: rgba(245, 158, 11, 0.5); color: #FCD34D; }
    .compare-chip:hover { border-color: rgba(59, 130, 246, 0.5); color: #93C5FD; }
    .chip-code { color: #60A5FA; }

    .loading { margin: 22px 0; text-align: center; color: #F59E0B; font-weight: 600; }

    .error {
      margin: 16px 0;
      color: #FCA5A5;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 13px 16px;
      border-radius: 10px;
    }

    .results {
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 18px;
    }

    .results-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 14px;
    }

    .results h3 {
      margin: 0;
      color: #F8FAFC;
      font-family: var(--font-serif, 'Source Serif 4', Georgia, serif);
      font-size: 1.25rem;
      font-weight: 600;
    }

    .results-head + .hierarchy { margin-top: 0; }
    .results > h3 { margin-bottom: 14px; }

    .code-badge {
      display: inline-block;
      margin-left: 6px;
      padding: 2px 9px;
      border-radius: 7px;
      background: rgba(245, 158, 11, 0.16);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #F59E0B;
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.95rem;
    }

    .compare-shortcut-btn {
      padding: 6px 12px;
      border-radius: 8px;
      background: rgba(59, 130, 246, 0.14);
      border: 1px solid rgba(59, 130, 246, 0.35);
      color: #93C5FD;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }

    .compare-shortcut-btn:hover { background: rgba(59, 130, 246, 0.24); color: #DBEAFE; }

    .hierarchy {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 18px;
    }

    .level {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 9px 13px;
      border-radius: 9px;
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .level-section { border-left: 3px solid #3B82F6; }
    .level-chapitre { border-left: 3px solid #10B981; }
    .level-position4 { border-left: 3px solid #F59E0B; }
    .level-position6 { border-left: 3px solid #A78BFA; }

    .level-label {
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #94A3B8;
      min-width: 72px;
      padding-top: 2px;
    }

    .level-code {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-weight: 700;
      font-size: 0.92rem;
      color: #F8FAFC;
      min-width: 56px;
    }

    .level-content { display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .level-desc { color: #E2E8F0; font-size: 0.9rem; line-height: 1.4; }

    .note-details summary {
      cursor: pointer;
      color: #93C5FD;
      font-size: 0.78rem;
      font-weight: 600;
      user-select: none;
    }

    .level-note {
      margin: 6px 0 0;
      padding: 8px 10px;
      border-radius: 6px;
      background: #0D1421;
      color: #94A3B8;
      font-size: 0.8rem;
      line-height: 1.45;
      white-space: pre-line;
    }

    .subpositions h4 {
      color: #F8FAFC;
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-size: 0.98rem;
      margin: 0 0 10px;
    }

    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th {
      padding: 8px 11px;
      text-align: left;
      color: #94A3B8;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    td {
      padding: 9px 11px;
      color: #CBD5E1;
      font-size: 0.87rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      vertical-align: top;
    }

    .clickable-row { cursor: pointer; }
    .clickable-row:hover td { background: rgba(245, 158, 11, 0.06); }

    .titre-row td {
      border-bottom: none;
      padding: 10px 11px 3px;
      color: #94A3B8;
      font-size: 0.79rem;
      font-style: italic;
    }

    .code-cell {
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
      font-size: 0.7rem;
    }

    .tax-cell { white-space: nowrap; font-size: 0.82rem; color: #CBD5E1; }

    .cards-list { display: flex; flex-direction: column; gap: 10px; }

    .compare-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      align-items: start;
    }

    .compare-col { display: flex; flex-direction: column; gap: 10px; min-width: 0; }

    .compare-col-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 10px;
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .compare-col-head.dz { border-top: 3px solid #F59E0B; }
    .compare-col-head.eu { border-top: 3px solid #3B82F6; }

    .col-title {
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-weight: 700;
      font-size: 0.94rem;
      color: #F8FAFC;
    }

    .col-count { font-size: 0.75rem; font-weight: 600; color: #94A3B8; white-space: nowrap; }

    .compare-empty {
      padding: 16px;
      border-radius: 10px;
      background: #111827;
      border: 1px dashed rgba(255, 255, 255, 0.14);
      color: #94A3B8;
      font-size: 0.86rem;
      line-height: 1.45;
    }

    @media (max-width: 900px) { .compare-grid { grid-template-columns: 1fr; } }

    @media (max-width: 720px) {
      .search-form { flex-direction: column; }
      .search-button { border-radius: 0 0 12px 12px; }
      .level { flex-direction: column; gap: 4px; }
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

  private readonly decodeExamplesDz = ['0101.21.91.00 L', '080410', '0808'];
  private readonly decodeExamplesEu = ['0101.21.00', '0804.10.00', '870380'];

  private searchService = inject(SearchService);
  private oauthService = inject(OAuthService);
  private state = inject(SearchStateService);
  private zoneSub?: Subscription;
  private compareSub?: Subscription;

  get decodeExamples(): string[] {
    return this.zone === 'EU' ? this.decodeExamplesEu : this.decodeExamplesDz;
  }

  get currentHs6Prefix(): string {
    const digits = (this.result?.codeRecherche || '').replace(/[^0-9]/g, '');
    return digits.length >= 6 ? digits.slice(0, 6) : '';
  }

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

  cleanDesc(text?: string | null): string {
    const cleaned = (text || '').replace(/^[-–—\s]+/, '').trim();
    return cleaned || text || '—';
  }

  formatDuty(value?: string): string {
    if (!value) return '—';
    const trimmed = value.trim();
    if (!trimmed || trimmed === '-') return '—';
    if (trimmed.includes('%')) return trimmed;
    const starMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*\*$/);
    if (starMatch) return `${starMatch[1]} % *`;
    return /^\d+(?:[.,]\d+)?$/.test(trimmed) ? `${trimmed} %` : trimmed;
  }

  getDeltaTitles(index: number, code: string): string[] {
    const curr = this.cleanTitleList(this.getItemTitles(code));
    if (curr.length === 0) return [];
    if (index === 0) return curr;
    const prevItem = this.result?.positions10?.[index - 1];
    const prev = prevItem ? this.cleanTitleList(this.getItemTitles(prevItem.code)) : [];
    let i = 0;
    while (i < Math.min(curr.length, prev.length) && curr[i] === prev[i]) i++;
    return curr.slice(i);
  }

  private cleanTitleList(titles: string[]): string[] {
    return (titles || [])
      .map(t => (t || '').replace(/^[-–—\s]+/, '').replace(/\s*:\s*$/, '').trim())
      .filter(t => t.length > 0 && !/^d[ée]signation des produits$/i.test(t));
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
