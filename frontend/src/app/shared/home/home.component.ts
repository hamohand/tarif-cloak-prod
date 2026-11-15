import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, defer, forkJoin, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, retry, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { OrganizationAccountService } from '../../core/services/organization-account.service';
import { DecodeCodeItem, DecodeResult, SearchService } from '../../tarif/services/search.service';
import { SearchStateService, TariffZone } from '../../tarif/services/search-state.service';
import { CustomsCardComponent } from '../../tarif/components/customs-card/customs-card.component';
import { environment } from '../../../environments/environment';

interface TryCardItem {
  code: string;
  formattedCode?: string;
  checkDigit?: string;
  zone: string;
  description: string;
  titles: string[];
  position4?: { code: string; description: string } | null;
  justification?: string | null;
  regulatoryData?: DecodeCodeItem['regulatoryData'];
  glossary?: Record<string, string>;
  enriched: boolean;
  highlight: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AsyncPipe, CustomsCardComponent],
  template: `
    <div class="home-container">
      <!-- En-tête principal unifié (visiteurs + utilisateurs connectés) -->
      <section class="hero" [class.hero-compact]="isAuthenticated$ | async">
        <div class="hero-glow"></div>

        <div class="hero-kicker">
          <span class="kicker-badge">TCI</span>
          <span>Tarif du Commerce International</span>
          <span class="kicker-sep" aria-hidden="true">·</span>
          <span class="kicker-ar">تعريفة التجارة الدولية</span>
        </div>

        <h1 class="hero-main-title">
          Nomenclature Douanière &amp; Recherche Tarifaire
          <span class="hero-zones">
            <span class="zone-pill dz">DZ · P10</span>
            <span class="zone-pill eu">UE · NC8</span>
          </span>
        </h1>

        <p class="hero-subtitle">
          Tarif officiel Algérie (DGD) et Union Européenne (NC 2026) — recherche multilingue assistée, décodage SQL gratuit et comparateur HS6.
        </p>

        @if (!(isAuthenticated$ | async)) {
          <!-- Widget d'essai immédiat avec barre compacte unique -->
          <div class="try-widget">
            <div class="try-toolbar">
              <div class="try-zone-group" role="group" aria-label="Zone tarifaire">
                <button
                  type="button"
                  class="try-zone-btn"
                  [class.active]="tryZone === 'DZ'"
                  (click)="setTryZone('DZ')">
                  Algérie · P10
                </button>
                <button
                  type="button"
                  class="try-zone-btn eu"
                  [class.active]="tryZone === 'EU'"
                  (click)="setTryZone('EU')">
                  Europe · NC8 (2026)
                </button>
              </div>

              <div class="try-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="tryTab === 'ai'"
                  class="try-tab"
                  [class.active]="tryTab === 'ai'"
                  (click)="switchTryTab('ai')">
                  Décrire un produit
                  <span class="tab-badge amber">IA · {{ getTrialBadgeText(guestTrialsRemaining$ | async) }}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="tryTab === 'decode'"
                  class="try-tab"
                  [class.active]="tryTab === 'decode'"
                  (click)="switchTryTab('decode')">
                  Décoder un code
                  <span class="tab-badge green">SQL · Gratuit</span>
                </button>
              </div>
            </div>

            @if (tryTab === 'ai') {
              <div class="try-body">
                <div class="try-input-row">
                  <input
                    type="text"
                    [(ngModel)]="tryAiTerm"
                    [placeholder]="tryZone === 'EU' ? 'Ex : Chevaux reproducteurs race pure, Voiture électrique, Panneaux solaires...' : 'Ex : Chevaux pur sang arabe, Canards sauvages, Dattes...'"
                    class="try-input"
                    (keydown.enter)="runTryAi()"
                  />
                  <button
                    type="button"
                    class="try-submit"
                    (click)="runTryAi()"
                    [disabled]="tryLoading || !tryAiTerm.trim()">
                    {{ tryLoading ? 'Analyse...' : (tryZone === 'EU' ? 'Trouver le code NC8' : 'Trouver le code P10') }}
                  </button>
                </div>

                <div class="try-examples">
                  <span class="examples-label">Essayer :</span>
                  @for (q of aiExamples; track q) {
                    <button type="button" class="try-chip" (click)="pickAiExample(q)">{{ q }}</button>
                  }
                </div>
              </div>
            } @else {
              <div class="try-body">
                <div class="try-input-row">
                  <input
                    type="text"
                    [(ngModel)]="tryDecodeInput"
                    [placeholder]="tryZone === 'EU' ? 'Ex : 0101.21.00, 0804.10.00, 8703.80.10' : 'Ex : 0101.21.91.00 L, 0106.39.94.00 X, 080410'"
                    class="try-input mono"
                    maxlength="20"
                    (keydown.enter)="runTryDecode()"
                  />
                  <button
                    type="button"
                    class="try-submit blue"
                    (click)="runTryDecode()"
                    [disabled]="tryLoading || !tryDecodeInput.trim()">
                    {{ tryLoading ? 'Décodage...' : 'Décoder' }}
                  </button>
                </div>

                <div class="try-examples">
                  <span class="examples-label">Codes :</span>
                  @for (c of decodeExamples; track c) {
                    <button type="button" class="try-chip mono" (click)="pickDecodeExample(c)">{{ c }}</button>
                  }
                </div>
              </div>
            }

            @if (tryLoading) {
              <div class="try-status loading">Consultation de la nomenclature officielle en cours...</div>
            }

            @if (tryError) {
              <div class="try-status error">
                <span>{{ tryError }}</span>
                <a routerLink="/auth/register" class="inline-cta">Créer un compte gratuit →</a>
              </div>
            }

            @if (tryDecodeHierarchy && !tryLoading) {
              <div class="try-hierarchy">
                <span><strong>Section {{ tryDecodeHierarchy.section.code }}</strong> · {{ tryDecodeHierarchy.section.description }}</span>
                <span><strong>Chapitre {{ tryDecodeHierarchy.chapitre.code }}</strong> · {{ tryDecodeHierarchy.chapitre.description }}</span>
                @if (tryDecodeHierarchy.position4) {
                  <span><strong>Pos. {{ tryDecodeHierarchy.position4.code }}</strong> · {{ tryDecodeHierarchy.position4.description }}</span>
                }
              </div>
            }

            @if (tryCards.length > 0 && !tryLoading) {
              <div class="try-results">
                @for (card of tryCards; track card.code) {
                  <app-customs-card
                    [code]="card.code"
                    [formattedCode]="card.formattedCode"
                    [checkDigit]="card.checkDigit"
                    [zone]="card.zone"
                    [description]="card.description"
                    [titles]="card.titles"
                    [position4]="card.position4"
                    [showPosition4]="!tryDecodeHierarchy?.position4"
                    [justification]="card.justification"
                    [regulatoryData]="card.regulatoryData"
                    [glossary]="card.glossary"
                    [enriched]="card.enriched"
                    [highlight]="card.highlight"
                    (hs6MatchRequest)="onHs6Match($event)">
                  </app-customs-card>
                }
              </div>
            }
          </div>

          <div class="hero-cta">
            <a routerLink="/recherche/decode-p10" class="cta-button secondary">
              Ouvrir l'espace complet &amp; Comparateur DZ ↔ UE
            </a>
            <a *ngIf="isBetaMode" routerLink="/auth/register" class="cta-button primary">
              Créer un compte gratuit (500 crédits)
            </a>
            <a *ngIf="!isBetaMode" routerLink="/pricing" class="cta-button ghost">Voir les tarifs</a>
          </div>
        }
      </section>

      <!-- Présentation synthétique en 3 piliers (visiteurs non connectés) -->
      @if (!(isAuthenticated$ | async)) {
        <section class="pillars-section">
          <div class="pillars-header">
            <h2>Qualification rigoureuse sur nomenclature officielle</h2>
            <p class="pillars-subtitle">
              Aucun intitulé inventé : parcours hiérarchique complet de la Section jusqu'aux sous-positions P10 et NC8.
            </p>
          </div>

          <div class="pillars-grid">
            <article class="pillar-card">
              <div class="pillar-num">01</div>
              <h3>Nomenclature 100 % Officielle</h3>
              <p>Chaque code, clé de contrôle, intitulé à tirets, DD, TVA, UQN, FAP et taux TDC provient des tables officielles DGD et EUR-Lex 2026.</p>
            </article>

            <article class="pillar-card">
              <div class="pillar-num">02</div>
              <h3>Qualification Hiérarchique IA</h3>
              <p>Analyse en arbre Section → Chapitre → Position 4 → HS6 → P10/NC8 en français, anglais ou arabe avec critère douanier factuel.</p>
            </article>

            <article class="pillar-card">
              <div class="pillar-num">03</div>
              <h3>Décodage &amp; Comparateur DZ ↔ UE</h3>
              <p>Décodage SQL instantané (2 à 10 chiffres) et alignement côte à côte Algérie ↔ Europe sur le pivot universel HS6, gratuits sans crédit.</p>
            </article>
          </div>
        </section>
      }

      <!-- Espace de travail (utilisateurs connectés) -->
      <section class="user-actions" *ngIf="showRequestButtons$ | async">
        @if (!(canMakeRequests$ | async)) {
          <div class="trial-expired-message">
            <div class="message-content">
              <h4>Quota de recherche IA épuisé</h4>
              @if (isOrganizationAccount$ | async) {
                <p>
                  Le quota de votre organisation a été atteint pour les recherches IA.
                  Le <a routerLink="/recherche/decode-p10">décodeur officiel par code</a> reste disponible gratuitement,
                  ou vous pouvez <a routerLink="/organization/stats">choisir un plan tarifaire</a> ou
                  <a routerLink="/organization/quote-requests">demander un devis</a>.
                </p>
              } @else {
                <p>
                  Le quota de votre organisation est épuisé pour les recherches IA.
                  Le <a routerLink="/recherche/decode-p10">décodeur officiel par code</a> reste gratuit et accessible.
                </p>
              }
            </div>
          </div>
        } @else {
          <div class="workspace-grid">
            <article class="workspace-card primary-card">
              <div class="card-tag amber">IA Multi-Zones</div>
              <h3>Recherche Tarifaire (DZ &amp; UE)</h3>
              <p>Qualifiez une marchandise en langage naturel vers son code exact P10 (Algérie) ou NC8 (UE 2026) et ses droits et formalités.</p>
              <a [routerLink]="['/recherche/search-position10']" class="cta-button primary">
                Ouvrir la recherche IA
              </a>
            </article>

            <article class="workspace-card">
              <div class="card-tag green">SQL · Gratuit</div>
              <h3>Décodeur Officiel par code</h3>
              <p>Saisissez un code à 2, 4, 6, 8 ou 10 chiffres pour consulter sa hiérarchie, ses notes légales et sa fiche réglementaire.</p>
              <button type="button" (click)="openDecoder(false)" class="cta-button secondary">
                Décoder un code
              </button>
            </article>

            <article class="workspace-card">
              <div class="card-tag blue">HS6 · Gratuit</div>
              <h3>Comparateur DZ ↔ UE</h3>
              <p>Alignez côte à côte les sous-positions officielles Algérie (DGD · P10) et Union Européenne (NC8) sous un même code HS6.</p>
              <button type="button" (click)="openDecoder(true)" class="cta-button secondary">
                ⇄ Comparer DZ ↔ UE
              </button>
            </article>

            @if (!isBetaMode) {
              <article class="workspace-card">
                <div class="card-tag">Import Fichier</div>
                <h3>Recherche par liste CSV/Excel</h3>
                <p>Importez un tableau d'articles pour qualifier plusieurs lignes tarifaires en une opération.</p>
                <a [routerLink]="['/recherche/searchListLots']" class="cta-button secondary">
                  Importer une liste
                </a>
              </article>

              <article class="workspace-card">
                <div class="card-tag">Asynchrone -50 %</div>
                <h3>Traitement par lots</h3>
                <p>Soumettez jusqu'à 1 000 désignations en lot asynchrone à coût réduit de moitié.</p>
                <a [routerLink]="['/recherche/batch-search']" class="cta-button secondary">
                  Lancer un lot
                </a>
              </article>
            }
          </div>
        }

        <div class="org-callout" *ngIf="(isOrganizationAccount$ | async) && !isBetaMode">
          <div class="feature-card advise">
            <h3>Gestion d'organisation</h3>
            <p>Utilisez l'espace <strong>Mon organisation</strong> pour inviter vos collaborateurs et suivre les statistiques globales.</p>
            <a [routerLink]="['/organization/account']" class="cta-button secondary">
              Ouvrir l'espace organisation
            </a>
          </div>
        </div>
      </section>

      <footer class="home-footer">
        <p>Développement d'applications pour les entreprises — Auto-entreprise Hamroun<br>
        Contact : mohhamroun&#64;gmail.com · WhatsApp : +213 5 60 96 80 66</p>
      </footer>
    </div>
  `,
  styles: [`
    .home-container {
      text-align: center;
      padding: 1.5rem 1.25rem 2.75rem;
      max-width: 1140px;
      margin: 0 auto;
      color: #E2E8F0;
    }

    .hero {
      position: relative;
      padding: 1.5rem 0.5rem 1.25rem;
      margin-bottom: 1.5rem;
    }

    .hero.hero-compact {
      padding: 1rem 0.5rem 1.25rem;
      margin-bottom: 0.5rem;
    }

    .hero-glow {
      position: absolute;
      top: 18%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 520px;
      height: 280px;
      background: radial-gradient(ellipse, rgba(245, 158, 11, 0.08) 0%, transparent 65%);
      pointer-events: none;
      z-index: 0;
    }

    .hero-kicker {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.55rem;
      font-family: var(--font-sans, 'Inter', sans-serif);
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #94A3B8;
      margin-bottom: 0.75rem;
    }

    .kicker-badge {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.76rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 5px;
      background: rgba(245, 158, 11, 0.14);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #FCD34D;
    }

    .kicker-sep { color: rgba(255, 255, 255, 0.25); }
    .kicker-ar { font-weight: 500; text-transform: none; letter-spacing: 0; color: #94A3B8; direction: rtl; }

    .hero-main-title {
      position: relative;
      z-index: 1;
      margin: 0 auto 0.7rem;
      font-family: var(--font-serif, 'Source Serif 4', Georgia, serif);
      font-size: clamp(1.85rem, 3.6vw, 2.75rem);
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -0.015em;
      color: #F8FAFC;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
    }

    .hero.hero-compact .hero-main-title {
      font-size: clamp(1.65rem, 3vw, 2.25rem);
    }

    .hero-zones {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      vertical-align: middle;
    }

    .zone-pill {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      padding: 4px 10px;
      border-radius: 999px;
    }

    .zone-pill.dz {
      background: rgba(245, 158, 11, 0.14);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #FCD34D;
    }

    .zone-pill.eu {
      background: rgba(59, 130, 246, 0.14);
      border: 1px solid rgba(59, 130, 246, 0.4);
      color: #93C5FD;
    }

    .hero-subtitle {
      position: relative;
      z-index: 1;
      font-family: var(--font-sans, 'Inter', sans-serif);
      font-size: 0.98rem;
      font-weight: 400;
      color: #94A3B8;
      max-width: 700px;
      margin: 0 auto 1.5rem;
      line-height: 1.55;
    }

    /* ═══ Try Widget (barre unifiée) ═══ */
    .try-widget {
      position: relative;
      z-index: 1;
      max-width: 880px;
      margin: 0 auto 1.35rem;
      background: #111827;
      border: 1px solid rgba(245, 158, 11, 0.28);
      border-radius: 16px;
      padding: 16px 18px;
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.38);
      text-align: left;
    }

    .try-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .try-zone-group {
      display: inline-flex;
      gap: 4px;
      padding: 3px;
      background: #0D1421;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .try-zone-btn {
      padding: 6px 12px;
      border-radius: 7px;
      background: transparent;
      border: 1px solid transparent;
      color: #94A3B8;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .try-zone-btn:hover { color: #F8FAFC; }

    .try-zone-btn.active {
      background: rgba(245, 158, 11, 0.16);
      border-color: rgba(245, 158, 11, 0.45);
      color: #FCD34D;
    }

    .try-zone-btn.eu.active {
      background: rgba(59, 130, 246, 0.16);
      border-color: rgba(59, 130, 246, 0.45);
      color: #93C5FD;
    }

    .try-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .try-tab {
      padding: 7px 12px;
      border-radius: 9px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #CBD5E1;
      font-weight: 600;
      font-size: 0.84rem;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .try-tab.active {
      background: rgba(245, 158, 11, 0.12);
      border-color: rgba(245, 158, 11, 0.5);
      color: #F8FAFC;
    }

    .tab-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 999px;
      white-space: nowrap;
    }

    .tab-badge.amber { background: rgba(245, 158, 11, 0.2); color: #FCD34D; }
    .tab-badge.green { background: rgba(16, 185, 129, 0.18); color: #34D399; }

    .try-input-row {
      display: flex;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 11px;
      overflow: hidden;
      margin-bottom: 10px;
    }

    .try-input-row:focus-within {
      border-color: #F59E0B;
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
    }

    .try-input {
      flex: 1;
      padding: 13px 15px;
      min-height: 46px;
      background: transparent;
      border: none;
      outline: none;
      color: #F8FAFC;
      font-size: 0.95rem;
    }

    .try-input.mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); }
    .try-input::placeholder { color: #64748B; }

    .try-submit {
      padding: 12px 20px;
      min-height: 46px;
      background: #F59E0B;
      color: #070B14;
      border: none;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      white-space: nowrap;
    }

    .try-submit.blue { background: #3B82F6; color: #F8FAFC; }
    .try-submit:disabled { opacity: 0.45; cursor: not-allowed; }

    .try-examples {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 7px;
    }

    .examples-label { font-size: 0.78rem; color: #94A3B8; font-weight: 600; }

    .try-chip {
      padding: 4px 10px;
      border-radius: 999px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #CBD5E1;
      font-size: 0.78rem;
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease;
    }

    .try-chip.mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); }
    .try-chip:hover { border-color: rgba(245, 158, 11, 0.5); color: #FCD34D; }

    .try-status {
      margin-top: 12px;
      padding: 11px 14px;
      border-radius: 10px;
      font-size: 0.88rem;
    }

    .try-status.loading { background: rgba(245, 158, 11, 0.08); color: #FCD34D; }
    .try-status.error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #FCA5A5;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    .inline-cta { color: #FCD34D; font-weight: 700; text-decoration: none; }

    .try-hierarchy {
      margin-top: 12px;
      padding: 9px 13px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 9px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 0.83rem;
      color: #CBD5E1;
    }

    .try-results {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .hero-cta {
      position: relative;
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      justify-content: center;
    }

    .cta-button {
      padding: 0.65rem 1.25rem;
      font-size: 0.88rem;
      border: none;
      border-radius: 9px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      font-family: var(--font-sans, 'Inter', sans-serif);
      font-weight: 600;
      transition: all 0.2s ease;
      min-height: 40px;
    }

    .cta-button.primary { background: #F59E0B; color: #070B14; font-weight: 700; }
    .cta-button.primary:hover { background: #D97706; }

    .cta-button.secondary {
      background: rgba(245, 158, 11, 0.14);
      color: #FCD34D;
      border: 1px solid rgba(245, 158, 11, 0.35);
    }

    .cta-button.secondary:hover { background: rgba(245, 158, 11, 0.22); }

    .cta-button.ghost {
      background: transparent;
      color: #CBD5E1;
      border: 1px solid rgba(255, 255, 255, 0.14);
    }

    .cta-button.ghost:hover { border-color: rgba(245, 158, 11, 0.45); color: #FCD34D; }

    /* ═══ 3 Piliers (visiteurs) ═══ */
    .pillars-section {
      padding: 1.5rem 0 1.25rem;
    }

    .pillars-header { margin-bottom: 1.5rem; }
    .pillars-header h2 {
      font-family: var(--font-serif, 'Source Serif 4', Georgia, serif);
      font-size: 1.55rem;
      font-weight: 600;
      color: #F8FAFC;
      margin: 0 0 0.4rem;
    }

    .pillars-subtitle {
      font-family: var(--font-sans, 'Inter', sans-serif);
      font-size: 0.92rem;
      font-weight: 400;
      color: #94A3B8;
      margin: 0;
    }

    .pillars-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1.15rem;
      text-align: left;
    }

    .pillar-card {
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 1.35rem;
      transition: border-color 0.2s ease, transform 0.2s ease;
    }

    .pillar-card:hover {
      transform: translateY(-2px);
      border-color: rgba(245, 158, 11, 0.32);
    }

    .pillar-num {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.78rem;
      font-weight: 700;
      color: #F59E0B;
      margin-bottom: 0.5rem;
    }

    .pillar-card h3 {
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-size: 1.02rem;
      color: #F8FAFC;
      margin: 0 0 0.45rem;
    }

    .pillar-card p {
      color: #94A3B8;
      font-size: 0.87rem;
      line-height: 1.55;
      margin: 0;
    }

    /* ═══ Workspace (utilisateurs connectés) ═══ */
    .user-actions { margin: 0.5rem 0 2rem; }

    .workspace-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.15rem;
      text-align: left;
      margin-bottom: 1.5rem;
    }

    .workspace-card {
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 1.35rem;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.65rem;
    }

    .workspace-card.primary-card {
      border-color: rgba(245, 158, 11, 0.35);
      background: linear-gradient(155deg, rgba(17, 24, 39, 1), rgba(13, 20, 33, 1));
    }

    .card-tag {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 2px 8px;
      border-radius: 5px;
      background: rgba(255, 255, 255, 0.06);
      color: #94A3B8;
    }

    .card-tag.amber { background: rgba(245, 158, 11, 0.16); color: #FCD34D; }
    .card-tag.green { background: rgba(16, 185, 129, 0.16); color: #34D399; }
    .card-tag.blue { background: rgba(59, 130, 246, 0.16); color: #93C5FD; }

    .workspace-card h3 { color: #F8FAFC; font-size: 1.04rem; margin: 0; }
    .workspace-card p { color: #94A3B8; font-size: 0.87rem; line-height: 1.5; margin: 0 0 0.4rem; }
    .workspace-card .cta-button { margin-top: auto; }

    .org-callout { display: flex; justify-content: center; }

    .feature-card.advise {
      background: #111827;
      border: 1px solid rgba(59, 130, 246, 0.28);
      border-radius: 14px;
      padding: 1.35rem;
      max-width: 520px;
      width: 100%;
      text-align: left;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.65rem;
    }

    .feature-card.advise h3 { color: #60A5FA; margin: 0; }
    .feature-card.advise p { color: #94A3B8; margin: 0; font-size: 0.88rem; }

    .trial-expired-message {
      margin: 1.5rem auto;
      padding: 1.35rem;
      background: #111827;
      border: 1px solid rgba(245, 158, 11, 0.35);
      border-radius: 14px;
      max-width: 780px;
    }

    .message-content h4 { margin: 0 0 0.6rem; color: #F59E0B; font-size: 1.15rem; }
    .message-content p { margin: 0; color: #CBD5E1; font-size: 0.92rem; line-height: 1.6; }
    .message-content a { color: #FCD34D; font-weight: 700; }

    .home-footer {
      margin-top: 2rem;
      padding-top: 1.25rem;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .home-footer p { margin: 0; font-size: 0.82rem; color: #64748B; line-height: 1.6; }

    @media (max-width: 820px) {
      .pillars-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 720px) {
      .try-input-row { flex-direction: column; }
    }
  `]
})
export class HomeComponent implements OnInit {
  private authService = inject(AuthService);
  private organizationAccountService = inject(OrganizationAccountService);
  private searchService = inject(SearchService);
  private state = inject(SearchStateService);
  private router = inject(Router);

  isBetaMode = environment.betaMode === true;

  isAuthenticated$ = this.authService.isAuthenticated();
  isOrganizationAccount$ = this.authService.isOrganizationAccount();
  isCollaboratorAccount$ = this.authService.isCollaboratorAccount();
  guestTrialsRemaining$ = this.searchService.guestTrialsRemaining$;

  tryZone: TariffZone = this.state.zone;
  tryTab: 'ai' | 'decode' = 'ai';
  tryAiTerm = '';
  tryDecodeInput = '';
  tryLoading = false;
  tryError: string | null = null;
  tryCards: TryCardItem[] = [];
  tryDecodeHierarchy: DecodeResult | null = null;

  private readonly aiExamplesDz = [
    'Chevaux pur sang arabe',
    'Canards sauvages',
    'Dattes Deglet Nour',
    'Voiture électrique'
  ];

  private readonly aiExamplesEu = [
    'Chevaux reproducteurs race pure',
    'Voiture électrique',
    'Panneaux solaires photovoltaïques',
    'Huile d’olive vierge'
  ];

  private readonly decodeExamplesDz = [
    '0101.21.91.00 L',
    '0106.39.94.00 X',
    '080410'
  ];

  private readonly decodeExamplesEu = [
    '0101.21.00',
    '0804.10.00',
    '8703.80.10'
  ];

  get aiExamples(): string[] {
    return this.tryZone === 'EU' ? this.aiExamplesEu : this.aiExamplesDz;
  }

  get decodeExamples(): string[] {
    return this.tryZone === 'EU' ? this.decodeExamplesEu : this.decodeExamplesDz;
  }

  showRequestButtons$ = combineLatest([
    this.isAuthenticated$,
    this.isOrganizationAccount$,
    this.isCollaboratorAccount$
  ]).pipe(
    map(([isAuthenticated, isOrganization, isCollaborator]) =>
      isAuthenticated && (isOrganization || isCollaborator)
    )
  );

  canMakeRequests$ = combineLatest([
    this.isAuthenticated$,
    this.isOrganizationAccount$,
    this.isCollaboratorAccount$
  ]).pipe(
    switchMap(([isAuthenticated, isOrganization, isCollaborator]) => {
      const hasOrgOrCollabAccount = isOrganization || isCollaborator;
      if (!isAuthenticated || !hasOrgOrCollabAccount) {
        return of(true);
      }
      return this.organizationAccountService.getOrganizationStatus().pipe(
        map(status => status.canMakeRequests),
        catchError(err => {
          console.error('Erreur lors de la vérification de l\'état de l\'organisation:', err);
          return of(true);
        })
      );
    }),
    distinctUntilChanged()
  );

  ngOnInit(): void {
    this.isAuthenticated$.pipe(take(1)).subscribe(auth => {
      if (!auth) {
        this.searchService.getGuestQuota().subscribe({ error: () => {} });
      }
    });
  }

  getTrialBadgeText(remaining: number | null): string {
    if (remaining === null || remaining === undefined) {
      return '2 essais gratuits/jour';
    }
    return `${remaining}/2 restant${remaining > 1 ? 's' : ''}`;
  }

  setTryZone(zone: TariffZone): void {
    this.tryZone = zone;
    this.state.setZone(zone);
    this.tryError = null;
    this.tryCards = [];
    this.tryDecodeHierarchy = null;
  }

  switchTryTab(tab: 'ai' | 'decode'): void {
    this.tryTab = tab;
    this.tryError = null;
    this.tryCards = [];
    this.tryDecodeHierarchy = null;
  }

  pickAiExample(term: string): void {
    this.tryTab = 'ai';
    this.tryAiTerm = term;
    this.runTryAi();
  }

  pickDecodeExample(code: string): void {
    this.tryTab = 'decode';
    this.tryDecodeInput = code;
    this.runTryDecode();
  }

  openDecoder(compareMode: boolean): void {
    this.state.compareMode = compareMode;
    this.router.navigate(['/recherche/decode-p10']);
  }

  runTryAi(): void {
    const term = this.tryAiTerm.trim();
    if (!term) return;

    this.tryLoading = true;
    this.tryError = null;
    this.tryCards = [];
    this.tryDecodeHierarchy = null;

    this.searchService.searchCodes(term, 'positions10', this.tryZone).subscribe({
      next: (results) => {
        const valid = (results || []).filter(r => ((r.code || '').replace(/[^0-9]/g, '')).length > 0);
        if (valid.length === 0) {
          this.tryError = 'Aucune position trouvée pour cette description. Essayez un autre terme.';
          this.tryLoading = false;
          return;
        }

        const calls$ = valid.map(r => {
          const aiCode = (r.code || '').replace(/[^0-9]/g, '');
          const codeForDecode = aiCode.length >= 6 ? aiCode.substring(0, 6) : aiCode;
          return defer(() => this.searchService.decodeP10Code(codeForDecode, this.tryZone)).pipe(
            retry(1),
            catchError(() => of(null)),
            map(decoded => ({ decoded, aiCode, justification: r.justification ?? null }))
          );
        });

        forkJoin(calls$).subscribe({
          next: (entries) => {
            const cards: TryCardItem[] = [];
            for (const entry of entries) {
              if (!entry.decoded) continue;
              const list = entry.decoded.positions10 || [];
              const exact = list.find(p => p.code.replace(/[^0-9]/g, '') === entry.aiCode);
              const targets = exact ? [exact] : list.slice(0, 2);

              if (targets.length === 0 && entry.decoded.positions6?.[0]) {
                const p6 = entry.decoded.positions6[0];
                cards.push({
                  code: p6.code,
                  zone: entry.decoded.zone || 'DZ',
                  description: p6.description,
                  titles: [],
                  position4: entry.decoded.position4,
                  justification: entry.justification,
                  enriched: false,
                  highlight: true
                });
              }

              for (const item of targets) {
                if (cards.some(c => c.code === item.code)) continue;
                const itemDigits = item.code.replace(/[^0-9]/g, '');
                cards.push({
                  code: item.code,
                  formattedCode: item.formattedCode,
                  checkDigit: item.checkDigit,
                  zone: entry.decoded.zone || 'DZ',
                  description: item.description,
                  titles: entry.decoded.titresParPosition10?.[item.code] ?? [],
                  position4: entry.decoded.position4,
                  justification: itemDigits === entry.aiCode ? entry.justification : null,
                  regulatoryData: item.regulatoryData,
                  glossary: entry.decoded.glossary,
                  enriched: !!item.enriched,
                  highlight: itemDigits === entry.aiCode
                });
              }
            }
            this.tryCards = cards;
            this.tryLoading = false;
          },
          error: () => {
            this.tryError = 'Erreur lors du décodage des positions retournées.';
            this.tryLoading = false;
          }
        });
      },
      error: (err) => {
        this.tryError = err?.message || 'Recherche impossible pour le moment.';
        this.tryLoading = false;
      }
    });
  }

  runTryDecode(): void {
    const code = this.tryDecodeInput.trim();
    if (!code) return;

    this.tryLoading = true;
    this.tryError = null;
    this.tryCards = [];
    this.tryDecodeHierarchy = null;

    const digits = code.replace(/[^0-9]/g, '');
    const effectiveZone: TariffZone = digits.length === 8 ? 'EU' : (digits.length === 10 ? 'DZ' : this.tryZone);

    this.searchService.decodeP10Code(code, effectiveZone).subscribe({
      next: (res) => {
        this.tryDecodeHierarchy = res;
        const items = res.positions10 && res.positions10.length > 0
          ? res.positions10
          : (res.positions6 || []);

        this.tryCards = items.slice(0, 6).map(item => ({
          code: item.code,
          formattedCode: item.formattedCode,
          checkDigit: item.checkDigit,
          zone: res.zone || 'DZ',
          description: item.description,
          titles: res.titresPosition10 && res.titresPosition10.length > 0
            ? res.titresPosition10
            : (res.titresParPosition10?.[item.code] ?? []),
          position4: res.position4,
          regulatoryData: item.regulatoryData,
          glossary: res.glossary,
          enriched: !!item.enriched,
          highlight: res.niveau === 'POSITION10' || res.niveau === 'POSITION8'
        }));
        this.tryLoading = false;
      },
      error: (err) => {
        this.tryError = err?.message || 'Code introuvable ou invalide.';
        this.tryLoading = false;
      }
    });
  }

  onHs6Match(event: { hs6: string; zone: string; sourceCode: string }): void {
    this.state.compareMode = true;
    this.state.compareHs6Input = event.hs6;
    this.state.compareResult = null;
    this.router.navigate(['/recherche/decode-p10']);
  }
}
