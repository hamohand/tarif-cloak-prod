import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegulatoryData } from '../../services/search.service';

@Component({
  selector: 'app-customs-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="customs-card" [class.highlighted]="highlight">
      <!-- En-tête : Code formaté + Clé + Zone + Actions -->
      <header class="card-header">
        <div class="code-group">
          <span class="zone-badge" [class.zone-eu]="normalizedZone === 'EU'">
            {{ normalizedZone === 'EU' ? 'UE · NC8' : 'DZ · P10' }}
          </span>
          <span class="formatted-code" [title]="'Code brut : ' + code">{{ displayCode }}</span>
          @if (checkDigit) {
            <span class="check-badge" title="Clé de contrôle officielle">Clé {{ checkDigit }}</span>
          }
          <button
            type="button"
            class="copy-btn"
            (click)="copyCode()"
            [title]="'Copier ' + displayCodeWithKey">
            {{ copied ? '✓ Copié' : 'Copier' }}
          </button>
        </div>

        <button
          type="button"
          class="hs6-btn"
          *ngIf="hs6Prefix && showCompareAction"
          (click)="emitHs6Match()"
          title="Comparer côte à côte les positions DZ et UE partageant ce HS6">
          ⇄ DZ ↔ UE ({{ hs6Prefix }})
        </button>
      </header>

      <!-- Contexte hiérarchique compact + Désignation officielle -->
      <div class="card-body">
        @if ((showPosition4 && position4) || cleanTitles.length > 0) {
          <div class="breadcrumb-trail">
            @if (showPosition4 && position4) {
              <span class="crumb-pos4">
                <span class="chain-tag">{{ position4.code }}</span>
                <span>{{ position4.description }}</span>
              </span>
            }
            @for (t of cleanTitles; track $index) {
              @if ((showPosition4 && position4) || $index > 0) {
                <span class="crumb-sep" aria-hidden="true">›</span>
              }
              <span class="crumb-item">{{ t }}</span>
            }
          </div>
        }

        <p class="official-designation">{{ cleanDescription }}</p>

        @if (justification) {
          <p class="ai-note">
            <span class="ai-pill">IA</span>
            <span>{{ justification }}</span>
          </p>
        }
      </div>

      <!-- Ruban réglementaire compact -->
      @if (hasRegulatoryData) {
        @if (normalizedZone === 'EU') {
          <footer class="reg-strip" aria-label="Données réglementaires Union Européenne">
            <span class="reg-pill">
              <span class="reg-k" [title]="getGlossaryTip('DD')">TDC</span>
              <strong class="reg-v eu-accent">{{ formatDuty(regulatoryData?.dd) }}</strong>
            </span>
            <span class="reg-pill">
              <span class="reg-k">Unité</span>
              <strong class="reg-v">
                {{ displayScalar(regulatoryData?.uqn) }}
                @if (regulatoryData?.uqn && getGlossaryShort(regulatoryData!.uqn!)) {
                  <small class="reg-hint">({{ getGlossaryShort(regulatoryData!.uqn!) }})</small>
                }
              </strong>
            </span>
            <span class="reg-pill">
              <span class="reg-k">TVA</span>
              <span class="reg-v muted">État membre</span>
            </span>
          </footer>
        } @else {
          <footer class="reg-strip" aria-label="Données réglementaires douanières">
            <span class="reg-pill">
              <span class="reg-k" [title]="getGlossaryTip('DD')">DD</span>
              <strong class="reg-v accent">{{ formatDuty(regulatoryData?.dd) }}</strong>
            </span>
            <span class="reg-pill">
              <span class="reg-k" [title]="getGlossaryTip('TVA')">TVA</span>
              <strong class="reg-v">{{ formatDuty(regulatoryData?.tva) }}</strong>
            </span>
            @if (hasAutresTaxes) {
              <span class="reg-pill">
                <span class="reg-k">Autres</span>
                <strong class="reg-v">{{ regulatoryData?.autres }}</strong>
              </span>
            }
            <span class="reg-pill">
              <span class="reg-k">UQN</span>
              <strong class="reg-v">
                {{ displayScalar(regulatoryData?.uqn) }}
                @if (regulatoryData?.uqn && getGlossaryShort(regulatoryData!.uqn!)) {
                  <small class="reg-hint">({{ getGlossaryShort(regulatoryData!.uqn!) }})</small>
                }
              </strong>
            </span>
            <span class="reg-pill">
              <span class="reg-k" [title]="getGlossaryTip('GU')">GU</span>
              <strong class="reg-v">{{ displayScalar(regulatoryData?.gu) }}</strong>
            </span>

            @if (fapList.length > 0) {
              <div class="fap-inline">
                <span class="fap-label">FAP :</span>
                @for (sigle of fapList; track sigle) {
                  <span class="fap-chip" [title]="getGlossaryTip(sigle)">
                    <strong>{{ sigle }}</strong>
                    @if (getGlossaryShort(sigle)) {
                      <span class="fap-meaning">· {{ getGlossaryShort(sigle) }}</span>
                    }
                  </span>
                }
              </div>
            }
          </footer>
        }
      } @else if (enriched === false && normalizedZone === 'DZ' && code.length >= 8) {
        <div class="reg-pending">
          Droits, TVA, UQN et FAP non encore importés pour cette sous-position.
        </div>
      }
    </article>
  `,
  styles: [`
    .customs-card {
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      text-align: left;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .customs-card.highlighted {
      border-color: rgba(245, 158, 11, 0.45);
      box-shadow: 0 6px 22px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(245, 158, 11, 0.14);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .code-group {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .zone-badge {
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      background: rgba(16, 185, 129, 0.14);
      color: #34D399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .zone-badge.zone-eu {
      background: rgba(59, 130, 246, 0.16);
      color: #60A5FA;
      border-color: rgba(59, 130, 246, 0.35);
    }

    .formatted-code {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 1.08rem;
      font-weight: 700;
      color: #F59E0B;
      letter-spacing: 0.03em;
    }

    .check-badge {
      padding: 2px 7px;
      border-radius: 5px;
      font-size: 0.72rem;
      font-weight: 700;
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      background: rgba(245, 158, 11, 0.14);
      color: #FCD34D;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .copy-btn, .hs6-btn {
      padding: 4px 10px;
      border-radius: 7px;
      font-size: 0.76rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .copy-btn {
      background: rgba(255, 255, 255, 0.04);
      color: #CBD5E1;
      border: 1px solid rgba(255, 255, 255, 0.11);
    }

    .copy-btn:hover {
      background: rgba(245, 158, 11, 0.16);
      border-color: rgba(245, 158, 11, 0.4);
      color: #FCD34D;
    }

    .hs6-btn {
      background: rgba(59, 130, 246, 0.12);
      color: #93C5FD;
      border: 1px solid rgba(59, 130, 246, 0.28);
    }

    .hs6-btn:hover {
      background: rgba(59, 130, 246, 0.22);
      border-color: rgba(59, 130, 246, 0.52);
      color: #DBEAFE;
    }

    .card-body {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .breadcrumb-trail {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 5px;
      font-size: 0.8rem;
      color: #94A3B8;
      line-height: 1.35;
    }

    .crumb-pos4 {
      display: inline-flex;
      align-items: baseline;
      gap: 5px;
    }

    .chain-tag {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      color: #F59E0B;
      font-weight: 700;
      font-size: 0.78rem;
    }

    .crumb-sep {
      color: #475569;
      font-weight: 700;
    }

    .official-designation {
      margin: 0;
      font-size: 0.98rem;
      font-weight: 600;
      color: #F8FAFC;
      line-height: 1.42;
    }

    .ai-note {
      margin: 2px 0 0;
      display: flex;
      align-items: baseline;
      gap: 8px;
      font-size: 0.83rem;
      color: #CBD5E1;
      line-height: 1.4;
      font-style: italic;
    }

    .ai-pill {
      flex-shrink: 0;
      font-style: normal;
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.66rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(59, 130, 246, 0.18);
      border: 1px solid rgba(59, 130, 246, 0.35);
      color: #93C5FD;
    }

    .reg-strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 7px 10px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .reg-pill {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
      padding: 4px 9px;
      border-radius: 7px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .reg-k {
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94A3B8;
      font-weight: 600;
    }

    .reg-v {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.85rem;
      font-weight: 700;
      color: #F8FAFC;
    }

    .reg-v.accent { color: #F59E0B; }
    .reg-v.eu-accent { color: #60A5FA; }

    .reg-v.muted {
      font-family: var(--font-sans, 'Inter', sans-serif);
      font-size: 0.78rem;
      font-weight: 500;
      color: #94A3B8;
    }

    .reg-hint {
      font-family: var(--font-sans, 'Inter', sans-serif);
      font-size: 0.72rem;
      font-weight: 400;
      color: #94A3B8;
    }

    .fap-inline {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }

    .fap-label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94A3B8;
    }

    .fap-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.28);
      font-size: 0.76rem;
      color: #FCD34D;
    }

    .fap-meaning {
      color: #CBD5E1;
      font-weight: 400;
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .reg-pending {
      font-size: 0.78rem;
      color: #64748B;
      font-style: italic;
      padding-top: 2px;
    }
  `]
})
export class CustomsCardComponent {
  @Input() code: string = '';
  @Input() formattedCode?: string | null;
  @Input() checkDigit?: string | null;
  @Input() zone: string = 'DZ';
  @Input() description: string = '';
  @Input() titles: string[] = [];
  @Input() position4?: { code: string; description: string } | null;
  @Input() justification?: string | null;
  @Input() regulatoryData?: RegulatoryData | null;
  @Input() glossary?: Record<string, string> | null;
  @Input() enriched: boolean = false;
  @Input() highlight: boolean = false;
  @Input() showPosition4: boolean = true;
  @Input() showCompareAction: boolean = true;

  @Output() hs6MatchRequest = new EventEmitter<{ hs6: string; zone: string; sourceCode: string }>();

  copied = false;

  get normalizedZone(): string {
    return (this.zone || 'DZ').trim().toUpperCase();
  }

  get cleanTitles(): string[] {
    return (this.titles || [])
      .map(t => (t || '').replace(/^[-–—\s]+/, '').replace(/\s*:\s*$/, '').trim())
      .filter(t => t.length > 0 && !/^d[ée]signation des produits$/i.test(t));
  }

  get cleanDescription(): string {
    const cleaned = (this.description || '').replace(/^[-–—\s]+/, '').trim();
    return cleaned || this.description || '—';
  }

  get hasAutresTaxes(): boolean {
    const val = this.regulatoryData?.autres?.trim();
    return !!val && val !== '-' && val !== '—';
  }

  get displayCode(): string {
    if (this.formattedCode) return this.formattedCode;
    const digits = (this.code || '').replace(/[^0-9]/g, '');
    if (digits.length === 10) {
      return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}.${digits.slice(8, 10)}`;
    }
    if (digits.length === 8) {
      return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
    }
    return this.code || '';
  }

  get displayCodeWithKey(): string {
    return this.checkDigit ? `${this.displayCode} ${this.checkDigit}` : this.displayCode;
  }

  get hs6Prefix(): string {
    const digits = (this.code || '').replace(/[^0-9]/g, '');
    return digits.length >= 6 ? digits.slice(0, 6) : '';
  }

  get fapList(): string[] {
    const fap = this.regulatoryData?.fap;
    if (!Array.isArray(fap)) return [];
    return fap.filter(Boolean);
  }

  get hasRegulatoryData(): boolean {
    const r = this.regulatoryData;
    if (!r) return false;
    return !!(r.dd || r.tva || r.autres || r.uqn || r.gu || (r.fap && r.fap.length > 0));
  }

  formatDuty(value?: string): string {
    if (!value) return '—';
    const trimmed = value.trim();
    if (!trimmed || trimmed === '-') return '—';
    if (trimmed.includes('%')) return trimmed;
    const starMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*\*$/);
    if (starMatch) {
      return `${starMatch[1]} % *`;
    }
    if (/^\d+(?:[.,]\d+)?$/.test(trimmed)) {
      return `${trimmed} %`;
    }
    return trimmed;
  }

  formatPercent(value?: string): string {
    return this.formatDuty(value);
  }

  displayScalar(value?: string): string {
    if (!value || value === '-') return '—';
    return value;
  }

  getGlossaryTip(key: string): string {
    return this.glossary?.[key] || '';
  }

  getGlossaryShort(key: string): string {
    const full = this.glossary?.[key];
    if (!full) return '';
    const idx = full.indexOf(' — ');
    return idx > 0 ? full.slice(0, idx) : full;
  }

  copyCode(): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(this.displayCodeWithKey).catch(() => {});
    }
    this.copied = true;
    setTimeout(() => {
      this.copied = false;
    }, 1800);
  }

  emitHs6Match(): void {
    if (!this.hs6Prefix) return;
    this.hs6MatchRequest.emit({
      hs6: this.hs6Prefix,
      zone: this.normalizedZone,
      sourceCode: this.code
    });
  }
}
