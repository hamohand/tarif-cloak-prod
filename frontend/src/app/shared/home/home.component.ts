import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, forkJoin, of } from 'rxjs';
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
      <!-- Hero Section -->
      <section class="hero" [class.hero-compact]="isAuthenticated$ | async">
        <div class="hero-glow"></div>

        <div class="hero-eyebrow">
          <span class="eyebrow-chip">
            <span class="official-dot"></span>
            100 % Nomenclature Officielle — Zéro code inventé
          </span>
        </div>

        <h1 class="hero-title">
          <span class="hero-acronym">TCI</span>
          <span class="hero-fullname">
            <span class="hero-name-fr">Tarif du Commerce International</span>
            <span class="hero-name-sep">—</span>
            <span class="hero-name-ar">تعريفة التجارة الدولية</span>
          </span>
        </h1>

        <div class="hero-langs">
          <span class="lang-chip">Français</span>
          <span class="lang-chip">English</span>
          <span class="lang-chip">عربي</span>
          <span class="lang-chip">中文</span>
          <span class="lang-chip lang-chip-more">+ recherche par arbre officiel DGD / EUR-Lex / OMD</span>
        </div>

        @if (!(isAuthenticated$ | async)) {
          <p class="hero-desc">
            Décrivez un produit en langage naturel ou saisissez un code douanier : TCI retrouve la position officielle
            exacte à 10 chiffres (Algérie · P10) ou 8 chiffres (UE · NC8), ses droits et taxes, son unité et ses formalités.
          </p>

          <!-- Widget d'essai immédiat sans inscription -->
          <div class="try-widget">
            <div class="try-zone-bar" role="group" aria-label="Zone tarifaire">
              <span class="try-zone-label">Nomenclature :</span>
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
                <span class="tab-badge green">SQL · Gratuit illimité</span>
              </button>
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
                    {{ tryLoading ? 'Décodage...' : 'Décoder le code' }}
                  </button>
                </div>

                <div class="try-examples">
                  <span class="examples-label">Codes d'exemple :</span>
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
                <span><strong>Section {{ tryDecodeHierarchy.section.code }}</strong> : {{ tryDecodeHierarchy.section.description }}</span>
                <span><strong>Chapitre {{ tryDecodeHierarchy.chapitre.code }}</strong> : {{ tryDecodeHierarchy.chapitre.description }}</span>
                @if (tryDecodeHierarchy.position4) {
                  <span><strong>Pos. {{ tryDecodeHierarchy.position4.code }}</strong> : {{ tryDecodeHierarchy.position4.description }}</span>
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
              Ouvrir le décodeur complet (Gratuit)
            </a>
            <a *ngIf="isBetaMode" routerLink="/auth/register" class="cta-button primary">
              Créer un compte gratuit (500 crédits)
            </a>
            <a *ngIf="!isBetaMode" routerLink="/pricing" class="cta-button ghost">Voir les tarifs</a>
            <a routerLink="/aide" class="cta-button ghost guide-btn">Guide</a>
          </div>
        }
      </section>

      <!-- Présentation de la plateforme (visiteurs non connectés) -->
      @if (!(isAuthenticated$ | async)) {
        <section class="api-presentation">
          <div class="api-header">
            <h2>Recherche algorithmique sur nomenclature officielle</h2>
            <p class="api-subtitle">
              Aucun intitulé inventé : parcours hiérarchique guidé de la Section jusqu'à la sous-position à 10 chiffres
            </p>
          </div>

          <div class="api-content">
            <div class="api-features-grid">
              <div class="api-feature">
                <div class="api-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 12l2 2 4-4"/>
                    <circle cx="12" cy="12" r="9"/>
                  </svg>
                </div>
                <h3>100 % Officiel</h3>
                <p>Chaque code, clé de contrôle, intitulé à tirets, DD, TVA, UQN et FAP provient des tables douanières officielles.</p>
              </div>

              <div class="api-feature">
                <div class="api-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="9" y="2" width="6" height="4" rx="1"/>
                    <rect x="2" y="10" width="6" height="4" rx="1"/>
                    <rect x="16" y="10" width="6" height="4" rx="1"/>
                    <rect x="9" y="18" width="6" height="4" rx="1"/>
                    <path d="M12 6v4M5 14v4h4M19 14v4h-4"/>
                  </svg>
                </div>
                <h3>Recherche en Arbre</h3>
                <p>Cascade chirurgicale Section → Chapitre → Position 4 → HS6 → Position 10 avec justification de la correspondance.</p>
              </div>

              <div class="api-feature">
                <div class="api-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/>
                    <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/>
                    <path d="M12 8v8M9 11l3-3 3 3"/>
                  </svg>
                </div>
                <h3>Décodage SQL Gratuit</h3>
                <p>Entrez un code à 2, 4, 6, 8 ou 10 chiffres et obtenez instantanément son arbre hiérarchique et ses exigences, sans crédit.</p>
              </div>

              <div class="api-feature">
                <div class="api-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18M3 12h18"/>
                  </svg>
                </div>
                <h3>Passerelle Multi-Zones</h3>
                <p>Pivot universel sur le HS à 6 chiffres pour préparer le passage vers le tarif européen NC8 / TARIC.</p>
              </div>
            </div>
          </div>
        </section>
      }

      <!-- Section utilisateurs connectés -->
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
          <h4 class="section-title">Espace de travail tarifaire</h4>
          <div class="features primary">
            <div class="feature-card request-card">
              <div class="request-icon">🔍</div>
              <h3>Recherche Position-10 (IA)</h3>
              <p>Trouvez la position douanière exacte et sa fiche réglementaire (DD, TVA, UQN, FAP) à partir d'une description.</p>
              <a [routerLink]="['/recherche/search-position10']" class="cta-button primary">
                Rechercher un produit
              </a>
            </div>

            <div class="feature-card request-card">
              <div class="request-icon">📋</div>
              <h3>Décodeur officiel (Gratuit)</h3>
              <p>Décodez un code à 2, 4, 6, 8 ou 10 chiffres en requête SQL directe sans consommer de crédits.</p>
              <a [routerLink]="['/recherche/decode-p10']" class="cta-button secondary">
                Décoder un code
              </a>
            </div>

            @if (!isBetaMode) {
              <div class="feature-card request-card">
                <div class="request-icon">📑</div>
                <h3>Recherche par liste</h3>
                <p>Importez un fichier CSV ou Excel pour qualifier une liste d'articles.</p>
                <a [routerLink]="['/recherche/searchListLots']" class="cta-button secondary">
                  Rechercher par liste
                </a>
              </div>

              <div class="feature-card request-card">
                <div class="request-icon">⚡</div>
                <h3>Recherche par lots</h3>
                <p>Soumettez jusqu'à 1 000 produits en traitement asynchrone (-50 %).</p>
                <a [routerLink]="['/recherche/batch-search']" class="cta-button secondary">
                  Rechercher par lots
                </a>
              </div>
            }
          </div>
        }

        <div class="features primary" *ngIf="(isOrganizationAccount$ | async) && !isBetaMode">
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
      padding: 1.5rem 1.25rem 3rem;
      max-width: 1180px;
      margin: 0 auto;
      color: #E2E8F0;
    }

    .hero {
      position: relative;
      padding: 2.5rem 1rem 2rem;
      margin-bottom: 1.5rem;
    }

    .hero.hero-compact {
      padding: 1.25rem 1rem 0.75rem;
      margin-bottom: 0;
    }

    .hero.hero-compact .hero-eyebrow,
    .hero.hero-compact .hero-langs,
    .hero.hero-compact .hero-glow,
    .hero.hero-compact .hero-name-sep,
    .hero.hero-compact .hero-name-ar {
      display: none;
    }

    .hero.hero-compact .hero-acronym { font-size: 2.1rem; }
    .hero.hero-compact .hero-name-fr { font-size: 0.95rem; }

    .hero-glow {
      position: absolute;
      top: 25%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 560px;
      height: 340px;
      background: radial-gradient(ellipse, rgba(245, 158, 11, 0.08) 0%, transparent 65%);
      pointer-events: none;
      z-index: 0;
    }

    .hero-eyebrow {
      position: relative;
      z-index: 1;
      margin-bottom: 1.25rem;
    }

    .eyebrow-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 1rem;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.32);
      color: #34D399;
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .official-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10B981;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
    }

    .hero-title {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.45rem;
      margin: 0 0 1.25rem;
    }

    .hero-acronym {
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-size: 4.75rem;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.04em;
      background: linear-gradient(135deg, #D97706 0%, #F59E0B 40%, #FCD34D 65%, #F59E0B 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .hero-fullname {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .hero-name-fr {
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-size: 1.15rem;
      font-weight: 600;
      color: #F8FAFC;
    }

    .hero-name-sep { color: rgba(245, 158, 11, 0.45); }
    .hero-name-ar { font-size: 1.1rem; color: #94A3B8; direction: rtl; }

    .hero-langs {
      position: relative;
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }

    .lang-chip {
      padding: 0.25rem 0.8rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.09);
      color: #94A3B8;
      font-size: 0.76rem;
      font-weight: 500;
    }

    .hero-desc {
      position: relative;
      z-index: 1;
      font-size: 1rem;
      color: #CBD5E1;
      max-width: 660px;
      margin: 0 auto 1.75rem;
      line-height: 1.65;
    }

    /* ═══ Try Widget ═══ */
    .try-widget {
      position: relative;
      z-index: 1;
      max-width: 880px;
      margin: 0 auto 1.75rem;
      background: #111827;
      border: 1px solid rgba(245, 158, 11, 0.28);
      border-radius: 18px;
      padding: 18px 20px;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.4);
      text-align: left;
    }

    .try-zone-bar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .try-zone-label {
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748B;
      margin-right: 4px;
    }

    .try-zone-btn {
      padding: 5px 12px;
      border-radius: 999px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94A3B8;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
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
      gap: 10px;
      margin-bottom: 16px;
    }

    .try-tab {
      flex: 1 1 240px;
      padding: 10px 14px;
      border-radius: 10px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #CBD5E1;
      font-weight: 600;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .try-tab.active {
      background: rgba(245, 158, 11, 0.12);
      border-color: rgba(245, 158, 11, 0.5);
      color: #F8FAFC;
    }

    .tab-badge {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      white-space: nowrap;
    }

    .tab-badge.amber {
      background: rgba(245, 158, 11, 0.2);
      color: #FCD34D;
    }

    .tab-badge.green {
      background: rgba(16, 185, 129, 0.18);
      color: #34D399;
    }

    .try-input-row {
      display: flex;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 12px;
    }

    .try-input-row:focus-within {
      border-color: #F59E0B;
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
    }

    .try-input {
      flex: 1;
      padding: 14px 16px;
      min-height: 46px;
      background: transparent;
      border: none;
      outline: none;
      color: #F8FAFC;
      font-size: 0.96rem;
    }

    .try-input.mono {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
    }

    .try-input::placeholder { color: #64748B; }

    .try-submit {
      padding: 12px 22px;
      min-height: 46px;
      background: #F59E0B;
      color: #070B14;
      border: none;
      font-weight: 700;
      font-size: 0.92rem;
      cursor: pointer;
      white-space: nowrap;
    }

    .try-submit.blue {
      background: #3B82F6;
      color: #F8FAFC;
    }

    .try-submit:disabled { opacity: 0.45; cursor: not-allowed; }

    .try-examples {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .examples-label {
      font-size: 0.8rem;
      color: #94A3B8;
      font-weight: 600;
    }

    .try-chip {
      padding: 5px 11px;
      border-radius: 999px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #CBD5E1;
      font-size: 0.8rem;
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease;
    }

    .try-chip.mono {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
    }

    .try-chip:hover {
      border-color: rgba(245, 158, 11, 0.5);
      color: #FCD34D;
    }

    .try-status {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 0.9rem;
    }

    .try-status.loading {
      background: rgba(245, 158, 11, 0.08);
      color: #FCD34D;
    }

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

    .inline-cta {
      color: #FCD34D;
      font-weight: 700;
      text-decoration: none;
    }

    .try-hierarchy {
      margin-top: 14px;
      padding: 10px 14px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.85rem;
      color: #CBD5E1;
    }

    .try-results {
      margin-top: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
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
      padding: 0.72rem 1.5rem;
      font-size: 0.92rem;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-weight: 600;
      transition: all 0.2s ease;
      min-height: 44px;
    }

    .cta-button.primary {
      background: #F59E0B;
      color: #070B14;
      font-weight: 700;
    }

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

    .cta-button.ghost:hover {
      border-color: rgba(245, 158, 11, 0.45);
      color: #FCD34D;
    }

    /* ═══ Features & Cards (Thème Sombre Unifié) ═══ */
    .api-presentation {
      padding: 2rem 0 2.5rem;
      max-width: 1160px;
      margin: 0 auto;
    }

    .api-header { margin-bottom: 2rem; }
    .api-header h2 {
      color: #F8FAFC;
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-size: 1.75rem;
      margin: 0 0 0.5rem;
    }
    .api-subtitle { color: #94A3B8; font-size: 0.98rem; margin: 0; }

    .api-features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
    }

    .api-feature {
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 1.6rem;
      border-radius: 16px;
      text-align: center;
      transition: border-color 0.2s ease, transform 0.2s ease;
    }

    .api-feature:hover {
      transform: translateY(-3px);
      border-color: rgba(245, 158, 11, 0.32);
    }

    .api-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 0.9rem;
      color: #F59E0B;
      background: #0D1421;
      border: 1px solid rgba(245, 158, 11, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      padding: 10px;
    }

    .api-icon svg { width: 100%; height: 100%; }

    .api-feature h3 {
      color: #F8FAFC;
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-size: 1.05rem;
      margin: 0 0 0.5rem;
    }

    .api-feature p {
      color: #94A3B8;
      font-size: 0.88rem;
      line-height: 1.55;
      margin: 0;
    }

    /* ═══ Authenticated Section ═══ */
    .user-actions { margin: 1rem 0 2rem; }
    .section-title {
      color: #F8FAFC;
      font-family: var(--font-display, 'Space Grotesk', sans-serif);
      font-size: 1.25rem;
      margin-bottom: 1.25rem;
    }

    .features {
      display: flex;
      justify-content: center;
      gap: 1.25rem;
      flex-wrap: wrap;
      margin-bottom: 1.75rem;
    }

    .request-card {
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 1.5rem;
      min-width: 240px;
      max-width: 280px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.7rem;
      text-align: center;
    }

    .request-card h3 { color: #F8FAFC; font-size: 1.02rem; margin: 0; }
    .request-card p { color: #94A3B8; font-size: 0.86rem; line-height: 1.45; margin: 0 0 0.5rem; }
    .request-card a { margin-top: auto; }

    .request-icon {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 1.35rem;
    }

    .feature-card.advise {
      background: #111827;
      border: 1px solid rgba(59, 130, 246, 0.28);
      border-radius: 16px;
      padding: 1.5rem;
      max-width: 520px;
      width: 100%;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .feature-card.advise h3 { color: #60A5FA; margin: 0; }
    .feature-card.advise p { color: #94A3B8; margin: 0; font-size: 0.9rem; }

    .trial-expired-message {
      margin: 1.5rem auto;
      padding: 1.5rem;
      background: #111827;
      border: 1px solid rgba(245, 158, 11, 0.35);
      border-radius: 16px;
      max-width: 780px;
    }

    .message-content h4 { margin: 0 0 0.75rem; color: #F59E0B; font-size: 1.2rem; }
    .message-content p { margin: 0; color: #CBD5E1; font-size: 0.95rem; line-height: 1.6; }
    .message-content a { color: #FCD34D; font-weight: 700; }

    .home-footer {
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .home-footer p {
      margin: 0;
      font-size: 0.85rem;
      color: #64748B;
      line-height: 1.65;
    }

    @media (max-width: 720px) {
      .hero-acronym { font-size: 3.3rem; }
      .try-input-row { flex-direction: column; }
      .request-card { max-width: 100%; width: 100%; }
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

  runTryAi(): void {
    const term = this.tryAiTerm.trim();
    if (!term) return;

    this.tryLoading = true;
    this.tryError = null;
    this.tryCards = [];
    this.tryDecodeHierarchy = null;

    this.searchService.searchCodes(term, 'positions10', this.tryZone).subscribe({
      next: (results) => {
        const valid = (results || []).filter(r => ((r.code || '').replace(/\s/g, '')).length > 0);
        if (valid.length === 0) {
          this.tryError = 'Aucune position trouvée pour cette description. Essayez un autre terme.';
          this.tryLoading = false;
          return;
        }

        const calls$ = valid.map(r => {
          const aiCode = (r.code || '').replace(/\s/g, '');
          const codeForDecode = aiCode.length >= 6 ? aiCode.substring(0, 6) : aiCode;
          return this.searchService.decodeP10Code(codeForDecode, this.tryZone).pipe(
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
              const exact = list.find(p => p.code.replace(/\s/g, '') === entry.aiCode);
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
                cards.push({
                  code: item.code,
                  formattedCode: item.formattedCode,
                  checkDigit: item.checkDigit,
                  zone: entry.decoded.zone || 'DZ',
                  description: item.description,
                  titles: entry.decoded.titresParPosition10?.[item.code] ?? [],
                  position4: entry.decoded.position4,
                  justification: item.code.replace(/\s/g, '') === entry.aiCode ? entry.justification : null,
                  regulatoryData: item.regulatoryData,
                  glossary: entry.decoded.glossary,
                  enriched: !!item.enriched,
                  highlight: item.code.replace(/\s/g, '') === entry.aiCode
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
