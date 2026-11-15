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
          *ngIf="hs6Prefix"
          (click)="emitHs6Match()"
          title="Comparer côte à côte les positions DZ et UE partageant ce HS6">
          ⇄ Comparer DZ ↔ UE ({{ hs6Prefix }})
        </button>
      </header>

      <!-- Hiérarchie officielle (Position 4 + titres à tirets) -->
      @if (position4 || (titles && titles.length > 0)) {
        <div class="hierarchy-chain">
          @if (position4) {
            <div class="chain-pos4">
              <span class="chain-tag">{{ position4.code }}</span>
              <span class="chain-text">{{ position4.description }}</span>
            </div>
          }
          @if (titles && titles.length > 0) {
            <ul class="chain-titles">
              @for (t of titles; track $index) {
                <li>{{ t }}</li>
              }
            </ul>
          }
        </div>
      }

      <!-- Désignation officielle -->
      <div class="official-desc">
        <span class="desc-kicker">Désignation officielle</span>
        <p>{{ description || '—' }}</p>
      </div>

      <!-- Justification IA si présente -->
      @if (justification) {
        <div class="ai-justification">
          <span class="ai-tag">Analyse IA</span>
          <p>{{ justification }}</p>
        </div>
      }

      <!-- Données réglementaires officielles -->
      @if (hasRegulatoryData) {
        @if (normalizedZone === 'EU') {
          <section class="reg-grid reg-grid-eu" aria-label="Données réglementaires Union Européenne">
            <div class="reg-cell">
              <span class="reg-label" [title]="getGlossaryTip('DD')">Droit pays tiers (TDC)</span>
              <strong class="reg-val eu-accent">{{ formatDuty(regulatoryData?.dd) }}</strong>
            </div>
            <div class="reg-cell">
              <span class="reg-label">Unité supplémentaire</span>
              <strong class="reg-val">
                {{ displayScalar(regulatoryData?.uqn) }}
                @if (regulatoryData?.uqn && getGlossaryShort(regulatoryData!.uqn!)) {
                  <small class="reg-sub">{{ getGlossaryShort(regulatoryData!.uqn!) }}</small>
                }
              </strong>
            </div>
            <div class="reg-cell">
              <span class="reg-label">TVA import</span>
              <strong class="reg-val muted">Nationale (État membre)</strong>
            </div>
          </section>
        } @else {
          <section class="reg-grid" aria-label="Données réglementaires douanières">
            <div class="reg-cell">
              <span class="reg-label" [title]="getGlossaryTip('DD')">Droits (DD)</span>
              <strong class="reg-val accent">{{ formatDuty(regulatoryData?.dd) }}</strong>
            </div>
            <div class="reg-cell">
              <span class="reg-label" [title]="getGlossaryTip('TVA')">TVA</span>
              <strong class="reg-val">{{ formatDuty(regulatoryData?.tva) }}</strong>
            </div>
            <div class="reg-cell">
              <span class="reg-label">Autres taxes</span>
              <strong class="reg-val">{{ displayScalar(regulatoryData?.autres) }}</strong>
            </div>
            <div class="reg-cell">
              <span class="reg-label">UQN</span>
              <strong class="reg-val">
                {{ displayScalar(regulatoryData?.uqn) }}
                @if (regulatoryData?.uqn && getGlossaryShort(regulatoryData!.uqn!)) {
                  <small class="reg-sub">{{ getGlossaryShort(regulatoryData!.uqn!) }}</small>
                }
              </strong>
            </div>
            <div class="reg-cell">
              <span class="reg-label" [title]="getGlossaryTip('GU')">Guichet (GU)</span>
              <strong class="reg-val">{{ displayScalar(regulatoryData?.gu) }}</strong>
            </div>
          </section>

          @if (fapList.length > 0) {
            <section class="fap-section">
              <span class="fap-title">Formalités Administratives Particulières (FAP)</span>
              <div class="fap-chips">
                @for (sigle of fapList; track sigle) {
                  <span class="fap-chip" [title]="getGlossaryTip(sigle)">
                    <strong>{{ sigle }}</strong>
                    @if (getGlossaryShort(sigle)) {
                      <span class="fap-meaning">— {{ getGlossaryShort(sigle) }}</span>
                    }
                  </span>
                }
              </div>
            </section>
          }
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
      border-radius: 14px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      text-align: left;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .customs-card.highlighted {
      border-color: rgba(245, 158, 11, 0.45);
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(245, 158, 11, 0.15);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .code-group {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .zone-badge {
      padding: 3px 9px;
      border-radius: 6px;
      font-size: 0.72rem;
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
      font-size: 1.18rem;
      font-weight: 700;
      color: #F59E0B;
      letter-spacing: 0.03em;
    }

    .check-badge {
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      background: rgba(245, 158, 11, 0.14);
      color: #FCD34D;
      border: 1px solid rgba(245, 158, 11, 0.32);
    }

    .copy-btn, .hs6-btn {
      padding: 5px 11px;
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .copy-btn {
      background: rgba(255, 255, 255, 0.05);
      color: #E2E8F0;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }

    .copy-btn:hover {
      background: rgba(245, 158, 11, 0.16);
      border-color: rgba(245, 158, 11, 0.4);
      color: #FCD34D;
    }

    .hs6-btn {
      background: rgba(59, 130, 246, 0.12);
      color: #93C5FD;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .hs6-btn:hover {
      background: rgba(59, 130, 246, 0.22);
      border-color: rgba(59, 130, 246, 0.55);
      color: #DBEAFE;
    }

    .hierarchy-chain {
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-left: 3px solid rgba(245, 158, 11, 0.5);
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .chain-pos4 {
      display: flex;
      align-items: baseline;
      gap: 8px;
      font-size: 0.85rem;
      color: #CBD5E1;
    }

    .chain-tag {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      color: #F59E0B;
      font-weight: 700;
      font-size: 0.82rem;
    }

    .chain-titles {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .chain-titles li {
      font-size: 0.83rem;
      color: #94A3B8;
      line-height: 1.35;
    }

    .official-desc .desc-kicker {
      display: block;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #64748B;
      margin-bottom: 4px;
    }

    .official-desc p {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #F8FAFC;
      line-height: 1.45;
    }

    .ai-justification {
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.22);
      border-radius: 8px;
      padding: 10px 14px;
    }

    .ai-tag {
      display: inline-block;
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #60A5FA;
      margin-bottom: 4px;
    }

    .ai-justification p {
      margin: 0;
      font-size: 0.88rem;
      color: #CBD5E1;
      line-height: 1.45;
    }

    .reg-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 10px;
    }

    .reg-cell {
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .reg-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #94A3B8;
      font-weight: 600;
    }

    .reg-val {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.95rem;
      color: #F8FAFC;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .reg-val.accent {
      color: #F59E0B;
    }

    .reg-val.eu-accent {
      color: #60A5FA;
    }

    .reg-val.muted {
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.82rem;
      font-weight: 500;
      color: #94A3B8;
    }

    .reg-sub {
      font-family: var(--font-sans, system-ui, sans-serif);
      font-size: 0.72rem;
      font-weight: 500;
      color: #94A3B8;
    }

    .fap-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .fap-title {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #94A3B8;
    }

    .fap-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .fap-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: 8px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.28);
      font-size: 0.8rem;
      color: #FCD34D;
    }

    .fap-meaning {
      color: #CBD5E1;
      font-weight: 400;
    }

    .reg-pending {
      font-size: 0.8rem;
      color: #64748B;
      font-style: italic;
      padding-top: 4px;
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

  @Output() hs6MatchRequest = new EventEmitter<{ hs6: string; zone: string; sourceCode: string }>();

  copied = false;

  get normalizedZone(): string {
    return (this.zone || 'DZ').trim().toUpperCase();
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
