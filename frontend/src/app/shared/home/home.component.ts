import { Component, inject } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { OrganizationAccountService } from '../../core/services/organization-account.service';
import { combineLatest, of } from 'rxjs';
import { map, switchMap, catchError, distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, AsyncPipe],
  template: `
    <div class="home-container">
      <!-- Hero Section -->
      <section class="hero" [class.hero-compact]="isAuthenticated$ | async">
        <div class="hero-glow"></div>
        <h1>TCI</h1>
        <p class="hero-subtitle">Tarif du commerce international -  سعر التجارة الدولية </p>
        <p class="hero-subtitle">Recherche multilingue - Multilingual search - 多语言搜索 - بحث متعدد اللغات
        </p>
        <ng-container *ngIf="!(isAuthenticated$ | async)">
          <p class="hero-desc">TCI analyse vos produits et retourne les positions tarifaires les plus pertinentes — avec explication détaillée.
          <br>Un code de nomenclature inconnu devient lisible en un instant : section, chapitre, position, sous-position.</p>
        </ng-container>
        <div class="hero-cta" *ngIf="!(isAuthenticated$ | async)">
          <div class="hero-cta-top">
            @if (isBetaMode) {
              <div class="trial-offer-badge">
                <svg class="trial-offer-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v9H4v-9"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
                <div class="trial-offer-text">
                  <strong>Offre Invité</strong> — 500 crédits / 30 jours
                </div>
              </div>
            }
            <a routerLink="/aide" class="cta-button ghost guide-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M12 6v6M12 15h.01"/></svg>
              Guide d'utilisation
            </a>
          </div>
          <a *ngIf="isBetaMode" routerLink="/auth/login" class="cta-button primary">Commencer gratuitement</a>
          <a *ngIf="!isBetaMode" routerLink="/pricing" class="cta-button ghost">Voir les tarifs</a>
        </div>
      </section>

      <!-- Présentation de l'API Recherche HS-code - Affichée uniquement pour les utilisateurs non connectés -->
      <section class="api-presentation" *ngIf="!(isAuthenticated$ | async)">
        <div class="api-header">
          <h2>Recherche de HS-code et positions tarifaires</h2>
          <p class="api-subtitle">Recherche intelligente et multilingue dans le système harmonisé douanier</p>
        </div>

        <div class="api-content">
          <div class="api-features-grid">
            <div class="api-feature">
              <div class="api-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18M3 12h18"/>
                </svg>
              </div>
              <h3>Multilingue</h3>
              <p>Saisissez votre produit dans n'importe quelle langue — français, anglais, arabe, chinois…</p>
            </div>

            <div class="api-feature">
              <div class="api-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M12 3l1.5 4.5h4.5l-3.5 2.5 1.5 4.5L12 12l-4 2.5 1.5-4.5L6 7.5h4.5z"/>
                  <path d="M5 19l2-2M19 19l-2-2M12 21v-3"/>
                </svg>
              </div>
              <h3>Intelligence Artificielle</h3>
              <p>L'IA analyse la description du produit et retourne la position tarifaire la plus pertinente avec justification.</p>
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
              <h3>Hiérarchie Complète</h3>
              <p>Section → Chapitre → Position → Sous-position : chaque niveau est retourné et expliqué.</p>
            </div>

            <div class="api-feature">
              <div class="api-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="4" width="18" height="3" rx="1"/>
                  <rect x="3" y="10" width="18" height="3" rx="1"/>
                  <rect x="3" y="16" width="12" height="3" rx="1"/>
                </svg>
              </div>
              <h3>Recherche par Listes</h3>
              <p>Traitez plusieurs produits simultanément — jusqu'à 1 000 produits en traitement asynchrone.</p>
            </div>

            <div class="api-feature">
              <div class="api-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/>
                  <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/>
                  <path d="M12 8v8M9 11l3-3 3 3"/>
                </svg>
              </div>
              <h3>Décodage Inverse</h3>
              <p>Partez d'un code existant et obtenez instantanément sa désignation complète et sa position dans la nomenclature.</p>
            </div>

            <div class="api-feature">
              <div class="api-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/>
                </svg>
              </div>
              <h3>Sécurisé et Fiable</h3>
              <p>Authentification OAuth2, suivi détaillé de l'utilisation et gestion des quotas par organisation.</p>
            </div>
          </div>

          <div class="api-endpoints">
            <h3>Exemples de résultats</h3>
            <div class="examples-grid">

              <div class="example-card">
                <div class="example-query">
                  <span class="query-label">Recherche</span>
                  <span class="query-term" dir="rtl">سيارة كهربائية</span>
                </div>
                <div class="example-result">
                  <div class="result-row">
                    <span class="result-badge hscode">HS-code</span>
                    <span class="result-code">870380</span>
                    <span class="result-desc">Véhicules à moteur électrique pour la propulsion</span>
                  </div>
                  <div class="result-row sub">
                    <span class="result-badge p10">P10</span>
                    <span class="result-code">8703801000</span>
                    <span class="result-desc">Véhicules blindés</span>
                  </div>
                  <div class="result-row sub">
                    <span class="result-badge p10">P10</span>
                    <span class="result-code">8703809000</span>
                    <span class="result-desc">Autres véhicules</span>
                  </div>
                </div>
              </div>

              <div class="example-card">
                <div class="example-query">
                  <span class="query-label">Recherche</span>
                  <span class="query-term">dattes</span>
                </div>
                <div class="example-result">
                  <div class="result-row">
                    <span class="result-badge hscode">HS-code</span>
                    <span class="result-code">080410</span>
                    <span class="result-desc">Dattes</span>
                  </div>
                  <div class="result-row sub">
                    <span class="result-badge p10">P10</span>
                    <span class="result-code">0804101111</span>
                    <span class="result-desc">Deglet nour — ≤ 1 kg</span>
                  </div>
                  <div class="result-row sub">
                    <span class="result-badge p10">P10</span>
                    <span class="result-code">0804101112</span>
                    <span class="result-desc">Deglet nour — > 1 kg</span>
                  </div>
                </div>
              </div>

              <div class="example-card">
                <div class="example-query">
                  <span class="query-label">Recherche</span>
                  <span class="query-term">Smart phone</span>
                </div>
                <div class="example-result">
                  <div class="result-row">
                    <span class="result-badge hscode">HS-code</span>
                    <span class="result-code">851713</span>
                    <span class="result-desc">Téléphones intelligents pour réseaux cellulaires</span>
                  </div>
                </div>
              </div>

              <div class="example-card">
                <div class="example-query">
                  <span class="query-label">Recherche</span>
                  <span class="query-term" lang="zh">笔记本电脑</span>
                </div>
                <div class="example-result">
                  <div class="result-row">
                    <span class="result-badge hscode">HS-code</span>
                    <span class="result-code">847130</span>
                    <span class="result-desc">Ordinateurs portables</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      <!-- Section pour les utilisateurs connectés avec rôle ORGANIZATION ou COLLABORATOR -->
      <section class="user-actions" *ngIf="showRequestButtons$ | async">
        @if (!(canMakeRequests$ | async)) {
          <div class="trial-expired-message">
            <div class="message-content">
              <h4>Essai gratuit terminé</h4>
              @if (isOrganizationAccount$ | async) {
                <p>
                  Le quota de votre essai gratuit a été atteint et est maintenant définitivement désactivé pour votre organisation.
                  Aucune recherche HS-code n'est autorisée pour tous les collaborateurs.
                  Veuillez <a routerLink="/organization/stats">choisir un plan tarifaire</a> ou
                  <a routerLink="/organization/quote-requests">faire une demande de devis</a> pour continuer à utiliser le service.
                </p>
              } @else {
                <p>
                  Le quota de l'essai gratuit de votre organisation a été atteint et est maintenant définitivement désactivé.
                  Aucune recherche HS-code n'est autorisée.
                  Veuillez contacter votre administrateur d'organisation pour choisir un plan tarifaire ou faire une demande de devis.
                </p>
              }
            </div>
          </div>
        } @else {
          <h4 class="section-title">Outils de recherche Code tarifaire</h4>
          <div class="features primary">
            <div class="feature-card request-card">
              <div class="request-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              </div>
              <h3>Recherche d'un produit</h3>
              <p>Recherchez le code HS d'un produit spécifique en quelques secondes.</p>
              <a [routerLink]="['/recherche/search']" class="cta-button secondary">
                Rechercher un produit
              </a>
            </div>

            @if (!isBetaMode) {
            <div class="feature-card request-card">
              <div class="request-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
              </div>
              <h3>Recherche par liste</h3>
              <p>Traitez une liste de produits en une seule fois.</p>
              <a [routerLink]="['/recherche/searchListLots']" class="cta-button secondary">
                Rechercher par liste
              </a>
            </div>

            <div class="feature-card request-card">
              <div class="request-icon">⚡</div>
              <h3>Recherche par lots</h3>
              <p>Soumettez jusqu'à 1000 produits en une seule fois. Traitement asynchrone avec 50% de réduction.</p>
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
        <p>Développement d'applications pour les entreprises</p>
        <p>Auto-entreprise Hamroun<br>
        Contact : mohhamroun&#64;gmail.com <br>
        WhatsApp : +213 5 60 96 80 66</p>
        
      </footer>
    </div>
  `,
  styles: [`
    .home-container {
      text-align: center;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* ═══ Hero Section ═══ */
    .hero {
      position: relative;
      padding: 1.5rem 2rem 2.5rem;
      margin-bottom: 2rem;
    }

    .hero.hero-compact {
      padding: 1.25rem 2rem 0.75rem;
      margin-bottom: 0;
    }

    .hero.hero-compact h1 { font-size: 1.8rem; margin-bottom: 0.25rem; }
    .hero.hero-compact .hero-subtitle { font-size: 1rem; margin-bottom: 0; }
    .hero.hero-compact .hero-glow { display: none; }

    .hero-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(108, 99, 255, 0.08) 0%, transparent 70%);
      pointer-events: none;
    }

    .hero h1 {
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
      font-size: 3.5rem;
      font-weight: 800;
      margin-bottom: 0.75rem;
      letter-spacing: -0.03em;
      position: relative;
    }

    .hero-subtitle {
      font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
      font-size: 1.3rem;
      color: var(--neu-accent-secondary, #2DD4BF);
      font-weight: 600;
      margin-bottom: 1rem;
    }

    .hero-desc {
      font-size: 1.05rem;
      color: var(--neu-text-muted, #6B7280);
      max-width: 600px;
      margin: 0 auto 2rem;
      line-height: 1.7;
    }

    .hero-cta {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    .hero-cta-top {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .guide-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .guide-btn svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .trial-offer-badge {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      background: var(--neu-bg, #E0E5EC);
      box-shadow: var(--neu-inset, inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5));
      border-radius: var(--neu-radius-button, 16px);
      padding: 0.75rem 1.25rem;
      font-size: 0.95rem;
      color: var(--neu-accent-secondary, #38B2AC);
      border: none;
    }
    .trial-offer-svg { width: 20px; height: 20px; flex-shrink: 0; }
    .trial-offer-text strong { display: block; margin-bottom: 0.1rem; color: var(--neu-text-heading, #2D3748); }

    /* ═══ CTA Buttons ═══ */
    .cta-button {
      padding: 0.9rem 2rem;
      font-size: 1rem;
      border: none;
      border-radius: var(--neu-radius-button, 16px);
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
      font-weight: 600;
      transition: all var(--neu-transition, 0.3s ease-out);
      min-height: var(--touch-target, 44px);
    }

    .cta-button.primary {
      background: var(--neu-accent, #6C63FF);
      color: white;
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
    }

    .cta-button.primary:hover {
      transform: translateY(-2px);
      box-shadow: var(--neu-extruded-hover, 12px 12px 20px rgba(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6));
      background: var(--neu-accent-hover, #5A52D5);
    }

    .cta-button.primary:active {
      transform: translateY(0.5px);
      box-shadow: var(--neu-inset-sm);
    }

    .cta-button.ghost {
      background: var(--neu-bg, #E0E5EC);
      color: var(--neu-accent-secondary, #2DD4BF);
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
    }

    .cta-button.ghost:hover {
      transform: translateY(-1px);
      box-shadow: var(--neu-extruded-hover);
    }

    .cta-button.ghost:active {
      box-shadow: var(--neu-inset-sm);
    }

    .cta-button.secondary {
      background: var(--neu-accent, #6C63FF);
      color: white;
      font-weight: 700;
      box-shadow: var(--neu-extruded-sm);
    }

    .cta-button.secondary:hover {
      transform: translateY(-2px);
      box-shadow: var(--neu-extruded-hover);
      background: var(--neu-accent-hover, #5A52D5);
    }

    /* ═══ Features grid ═══ */
    p {
      font-size: 1.05rem;
      color: var(--neu-text-muted, #6B7280);
      margin-bottom: 1.5rem;
    }

    .features {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      margin-bottom: 3rem;
      flex-wrap: wrap;
    }

    .features.primary { margin-top: 0.5rem; }
    .features.secondary { margin-top: 3rem; }

    .feature-card {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      padding: 2rem;
      border-radius: var(--neu-radius-container, 32px);
      width: 240px;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      align-items: center;
      transition: all var(--neu-transition, 0.3s ease-out);
      border: none;
    }

    .feature-card:hover {
      transform: translateY(-4px);
      background: var(--neu-card-bg-hover, linear-gradient(145deg, #EDF0F5, #DCE1E8));
      box-shadow: var(--neu-extruded-hover, 12px 12px 20px rgba(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6));
    }

    .feature-card h3 {
      color: var(--neu-text-heading, #2D3748);
      font-family: var(--font-display);
      font-size: 1.05rem;
      margin-bottom: 0.4rem;
    }

    .feature-card p {
      color: var(--neu-text-muted, #6B7280);
      font-size: 0.9rem;
      margin: 0;
    }

    .feature-card.advise {
      background: var(--neu-bg, #E0E5EC);
      box-shadow: var(--neu-inset, inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5));
      text-align: left;
      width: 100%;
      max-width: 500px;
      border: none;
    }

    .feature-card.advise h3 { color: var(--neu-accent-secondary, #2DD4BF); margin-bottom: 0.5rem; }
    .feature-card.advise p { color: var(--neu-text-muted, #6B7280); }

    /* ═══ User actions ═══ */
    .user-actions { margin: 0.5rem 0; padding: 0.5rem 0; }

    .section-title {
      color: var(--neu-accent-tertiary, #FF6B8A);
      font-family: var(--font-display);
      font-size: 1.3rem;
      margin-bottom: 1rem;
      font-weight: 700;
      text-align: center;
    }

    .request-card {
      background: var(--neu-card-violet, linear-gradient(145deg, #EAE8F8, #DDDAF0));
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      color: var(--neu-text-primary, #3D4852);
      text-align: center;
      min-width: 240px;
      max-width: 320px;
      padding: 1.5rem;
      border: none;
      border-radius: var(--neu-radius-container, 32px);
    }

    .request-card:hover {
      transform: translateY(-4px);
      background: var(--neu-card-violet-hover, linear-gradient(145deg, #EFECFB, #E2E0F4));
      box-shadow: var(--neu-extruded-hover);
    }

    .request-card h3 { color: var(--neu-text-heading, #2D3748); margin-bottom: 0.4rem; font-size: 1rem; }
    .request-card p { color: var(--neu-text-muted, #6B7280); font-size: 0.85rem; margin-bottom: 1rem; }

    .request-icon {
      width: 36px;
      height: 36px;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      margin: 0 auto 0.75rem;
      border-radius: 50%;
      box-shadow: var(--neu-inset-deep, inset 10px 10px 20px rgba(163,177,198,0.7), inset -10px -10px 20px rgba(255,255,255,0.6));
    }

    .request-card .cta-button.secondary { margin-top: auto; }

    /* ═══ Trial expired ═══ */
    .trial-expired-message {
      margin: 2rem auto;
      padding: 2rem;
      background: var(--neu-bg, #E0E5EC);
      box-shadow: var(--neu-inset, inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5));
      border-radius: var(--neu-radius-container, 32px);
      max-width: 800px;
      border: none;
    }

    .message-content { text-align: center; }
    .message-content h4 { margin: 0 0 1rem 0; font-size: 1.4rem; font-weight: 700; color: var(--neu-accent-warning, #ED8936); font-family: var(--font-display); }
    .message-content p { margin: 0; font-size: 1rem; line-height: 1.7; color: var(--neu-text-muted, #6B7280); }
    .message-content a { color: var(--neu-accent, #6C63FF); text-decoration: underline; font-weight: 700; }
    .message-content a:hover { color: var(--neu-accent-hover, #5A52D5); }

    /* ═══ API Presentation ═══ */
    .api-presentation {
      border-radius: var(--neu-radius-container, 32px);
      padding: 3rem 2rem;
      margin: 0 0 3rem;
      max-width: 1200px;
      margin-left: auto;
      margin-right: auto;
    }

    .api-header { text-align: center; margin-bottom: 3rem; }
    .api-header h2 { color: var(--neu-text-heading, #2D3748); font-size: 2rem; margin-bottom: 0.5rem; font-weight: 700; }
    .api-subtitle { color: var(--neu-text-muted, #6B7280); font-size: 1.05rem; margin: 0; }

    .api-content { display: flex; flex-direction: column; gap: 3rem; }

    .api-features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .api-feature {
      background: var(--neu-card-teal, linear-gradient(145deg, #E2F2F0, #D4EAE7));
      box-shadow: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      padding: 2rem;
      border-radius: var(--neu-radius-container, 32px);
      transition: all var(--neu-transition, 0.3s ease-out);
      text-align: center;
      border: none;
    }

    .api-feature:hover {
      transform: translateY(-4px);
      background: var(--neu-card-teal-hover, linear-gradient(145deg, #E9F6F4, #DAF0ED));
      box-shadow: var(--neu-extruded-hover, 12px 12px 20px rgba(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6));
    }

    .api-icon {
      width: 56px;
      height: 56px;
      margin: 0 auto 1rem;
      color: var(--neu-accent-secondary, #2DD4BF);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      box-shadow: var(--neu-inset-deep, inset 10px 10px 20px rgba(163,177,198,0.7), inset -10px -10px 20px rgba(255,255,255,0.6));
      padding: 12px;
    }

    .api-icon svg { width: 100%; height: 100%; }

    .api-feature h3 { color: var(--neu-text-heading, #2D3748); font-family: var(--font-display); font-size: 1.15rem; margin-bottom: 0.75rem; font-weight: 600; }
    .api-feature p { color: var(--neu-text-muted, #6B7280); font-size: 0.92rem; line-height: 1.6; margin: 0; }

    /* ═══ Examples ═══ */
    .api-endpoints {
      background: var(--neu-bg, #E0E5EC);
      box-shadow: var(--neu-inset, inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5));
      padding: 2rem;
      border-radius: var(--neu-radius-container, 32px);
      border: none;
    }

    .api-endpoints h3 { color: var(--neu-text-heading, #2D3748); font-family: var(--font-display); font-size: 1.4rem; margin-bottom: 1.5rem; font-weight: 600; text-align: center; }

    .examples-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.25rem;
    }

    .example-card {
      background: var(--neu-card-coral, linear-gradient(145deg, #F2E8EC, #EAD8DE));
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
      border-radius: var(--neu-radius-button, 16px);
      overflow: hidden;
      transition: all var(--neu-transition, 0.3s ease-out);
      border: none;
    }

    .example-card:hover {
      transform: translateY(-2px);
      background: var(--neu-card-coral-hover, linear-gradient(145deg, #F7EDF1, #EEDDE3));
      box-shadow: var(--neu-extruded-hover);
    }

    .example-query {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      box-shadow: var(--neu-inset-sm);
    }

    .query-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--neu-accent-secondary, #2DD4BF);
      font-weight: 700;
      white-space: nowrap;
    }

    .query-term {
      color: var(--neu-text-heading, #2D3748);
      font-weight: 600;
      font-family: 'Courier New', monospace;
      font-size: 0.95rem;
    }

    .example-result {
      padding: 0.75rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .result-row {
      display: flex;
      align-items: baseline;
      gap: 0.6rem;
      text-align: left;
    }

    .result-row.sub {
      padding-left: 0.75rem;
      margin-left: 0.5rem;
    }

    .result-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: var(--neu-radius-inner, 12px);
      white-space: nowrap;
      flex-shrink: 0;
      box-shadow: var(--neu-inset-sm);
    }

    .result-badge.hscode { color: var(--neu-accent-secondary, #2DD4BF); }
    .result-badge.p10 { color: var(--neu-accent-secondary, #38B2AC); }

    .result-code {
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--neu-text-heading, #2D3748);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .result-desc {
      font-size: 0.82rem;
      color: var(--neu-text-muted, #6B7280);
      line-height: 1.4;
    }

    /* ═══ Footer ═══ */
    .home-footer {
      margin-top: 3rem;
      padding-top: 2rem;
      text-align: center;
    }

    .home-footer p {
      margin: 0;
      font-size: 0.85rem;
      color: var(--neu-text-muted, #6B7280);
      padding: 1.5rem;
      line-height: 1.7;
    }

    .home-footer a { color: var(--neu-accent, #6C63FF); text-decoration: none; font-weight: 600; }
    .home-footer a:hover { color: var(--neu-accent-hover, #5A52D5); }

    /* ═══ Responsive ═══ */
    @media (max-width: 768px) {
      .home-container { padding: 1rem; overflow-x: hidden; }
      .hero { padding: 2.5rem 1rem 2rem; }
      .hero-glow { width: 250px; height: 250px; }
      .hero h1 { font-size: 2.2rem; }
      .hero-subtitle { font-size: 1.05rem; }
      .hero-desc { font-size: 1.0rem; }

      .feature-card { width: 100%; min-width: unset; }
      .request-card { min-width: unset; max-width: 100%; width: 100%; }
      .features { flex-direction: column; align-items: stretch; }

      .api-presentation { padding: 1.5rem 1rem; margin: 1.5rem 0; }
      .api-header h2 { font-size: 1.5rem; }
      .api-features-grid { grid-template-columns: 1fr; }
      .examples-grid { grid-template-columns: 1fr; }
      .result-code { white-space: normal; word-break: break-all; }
      .result-row { flex-wrap: wrap; }
      .home-footer { margin-top: 2rem; padding-top: 1.5rem; }
    }

    @media (min-width: 769px) and (max-width: 1024px) {
      .api-features-grid { grid-template-columns: repeat(2, 1fr); }
      .examples-grid { grid-template-columns: repeat(2, 1fr); }
      .hero h1 { font-size: 2.8rem; }
    }
  `]
})
export class HomeComponent {
  private authService = inject(AuthService);
  private organizationAccountService = inject(OrganizationAccountService);
  isBetaMode = environment.betaMode === true;

  isAuthenticated$ = this.authService.isAuthenticated();
  isOrganizationAccount$ = this.authService.isOrganizationAccount();
  isCollaboratorAccount$ = this.authService.isCollaboratorAccount();

  // Observable combiné pour afficher les boutons d'utilisation de requêtes
  showRequestButtons$ = combineLatest([
    this.isAuthenticated$,
    this.isOrganizationAccount$,
    this.isCollaboratorAccount$
  ]).pipe(
    map(([isAuthenticated, isOrganization, isCollaborator]) =>
      isAuthenticated && (isOrganization || isCollaborator)
    )
  );

  // Observable pour vérifier si l'organisation peut faire des requêtes
  canMakeRequests$ = combineLatest([
    this.isAuthenticated$,
    this.isOrganizationAccount$,
    this.isCollaboratorAccount$
  ]).pipe(
    switchMap(([isAuthenticated, isOrganization, isCollaborator]) => {
      const hasOrgOrCollabAccount = isOrganization || isCollaborator;
      if (!isAuthenticated || !hasOrgOrCollabAccount) {
        // Pas d'organisation, donc pas de restriction
        return of(true);
      }
      // Vérifier l'état de l'organisation
      return this.organizationAccountService.getOrganizationStatus().pipe(
        map(status => status.canMakeRequests),
        catchError(err => {
          console.error('Erreur lors de la vérification de l\'état de l\'organisation:', err);
          // En cas d'erreur, autoriser par défaut pour ne pas bloquer l'interface
          return of(true);
        })
      );
    }),
    distinctUntilChanged()
  );
}
