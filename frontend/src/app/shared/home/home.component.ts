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
      <section class="hero">
        <div class="hero-glow"></div>
        <h1>Intradia</h1>
        <p class="hero-subtitle">Classification pour le commerce international</p>
        <p class="hero-desc">Intradia analyse vos produits et retourne la position tarifaire la plus pertinente — avec explication détaillée.</p>
        <p class="hero-desc">Un code de nomenclature inconnu devient lisible en un instant : section, chapitre, position, sous-position.</p>
        <div class="hero-cta" *ngIf="!(isAuthenticated$ | async)">
          <a routerLink="/auth/register" class="cta-button primary">Commencer gratuitement</a>
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
              <p>Traitez plusieurs produits simultanément — jusqu'à 1 000 articles en traitement asynchrone.</p>
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
          <h4 class="section-title">Outils de recherche Code tarifaires</h4>
          <div class="features primary">
            <div class="feature-card request-card">
              <div class="request-icon">🔍</div>
              <h3>Recherche d'un article</h3>
              <p>Recherchez le code HS d'un produit spécifique en quelques secondes.</p>
              <a [routerLink]="['/recherche/search']" class="cta-button secondary">
                Rechercher un article
              </a>
            </div>

            <div class="feature-card request-card">
              <div class="request-icon">📋</div>
              <h3>Recherche par liste</h3>
              <p>Traitez une liste de produits en une seule fois.</p>
              <a class="cta-button secondary">
               Bientôt disponible
              </a>
              <!--
              <a [routerLink]="['/recherche/searchListLots']" class="cta-button secondary">
                Rechercher par liste
              </a>
              -->
            </div>

            <!--
            <div class="feature-card request-card">
              <div class="request-icon">⚡</div>
              <h3>Recherche par lots</h3>
              <p>Soumettez jusqu'à 1000 articles en une seule fois. Traitement asynchrone avec 50% de réduction.</p>
              <a [routerLink]="['/recherche/batch-search']" class="cta-button secondary">
                Rechercher par lots
              </a>
            </div>
            -->

          </div>
        }

        <div class="features primary" *ngIf="isOrganizationAccount$ | async">
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
        WathsApp : +213 5 60 96 80 66</p>
        
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

    /* ─── Hero Section ─── */
    .hero {
      position: relative;
      padding: 5rem 2rem 4rem;
      margin-bottom: 4rem;
    }

    .hero-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%);
      pointer-events: none;
    }

    .hero h1 {
      color: #f8fafc;
      font-size: 3.2rem;
      font-weight: 800;
      margin-bottom: 1rem;
      letter-spacing: -0.02em;
      position: relative;
    }

    .hero-subtitle {
      font-size: 1.4rem;
      color: #f59e0b;
      font-weight: 500;
      margin-bottom: 1rem;
    }

    .hero-desc {
      font-size: 1.1rem;
      color: #94a3b8;
      max-width: 600px;
      margin: 0 auto 2.5rem;
      line-height: 1.7;
    }

    .hero-cta {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    /* ─── Boutons CTA ─── */
    .cta-button {
      padding: 0.9rem 2rem;
      font-size: 1.05rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      font-weight: 600;
      transition: all 0.3s ease;
    }

    .cta-button.primary {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #0f172a;
      box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3);
    }

    .cta-button.primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(245, 158, 11, 0.45);
    }

    .cta-button.ghost {
      background: transparent;
      color: #f59e0b;
      border: 2px solid rgba(245, 158, 11, 0.4);
    }

    .cta-button.ghost:hover {
      border-color: #f59e0b;
      background: rgba(245, 158, 11, 0.08);
    }

    .cta-button.secondary {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #0f172a;
      font-weight: 700;
    }

    .cta-button.secondary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(245, 158, 11, 0.35);
    }

    /* ─── Features grid ─── */
    p {
      font-size: 1.1rem;
      color: #94a3b8;
      margin-bottom: 1.5rem;
    }

    .features {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      margin-bottom: 3rem;
      flex-wrap: wrap;
    }

    .features.primary {
      margin-top: 2rem;
    }

    .features.secondary {
      margin-top: 3rem;
    }

    .feature-card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 2rem;
      border-radius: 12px;
      width: 240px;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      align-items: center;
      transition: all 0.3s ease;
    }

    .feature-card:hover {
      background: rgba(255, 255, 255, 0.07);
      border-color: rgba(245, 158, 11, 0.2);
      transform: translateY(-2px);
    }

    .feature-card h3 {
      color: #e2e8f0;
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
    }

    .feature-card p {
      color: #94a3b8;
      font-size: 0.95rem;
      margin: 0;
    }

    .feature-card.advise {
      background: rgba(245, 158, 11, 0.06);
      border: 1px solid rgba(245, 158, 11, 0.2);
      text-align: left;
      width: 100%;
      max-width: 500px;
    }

    .feature-card.advise h3 {
      color: #f59e0b;
      margin-bottom: 0.5rem;
    }

    .feature-card.advise p {
      color: #cbd5e1;
    }

    /* ─── User actions (connecté) ─── */
    .user-actions {
      margin: 3rem 0;
      padding: 2rem 0;
    }

    .section-title {
      color: #f59e0b;
      font-size: 1.8rem;
      margin-bottom: 2rem;
      font-weight: 700;
      text-align: center;
    }

    .request-card {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border: 1px solid rgba(245, 158, 11, 0.25);
      color: white;
      text-align: center;
      min-width: 280px;
      max-width: 350px;
    }

    .request-card:hover {
      border-color: rgba(245, 158, 11, 0.5);
      box-shadow: 0 8px 32px rgba(245, 158, 11, 0.1);
    }

    .request-card h3 {
      color: #f8fafc;
      margin-bottom: 0.75rem;
    }

    .request-card p {
      color: #94a3b8;
      font-size: 0.95rem;
      margin-bottom: 1.5rem;
    }

    .request-icon {
      font-size: 3rem;
      margin-bottom: 0.75rem;
      display: block;
    }

    .request-card .cta-button.secondary {
      margin-top: auto;
    }

    /* ─── Trial expired ─── */
    .trial-expired-message {
      margin: 2rem auto;
      padding: 2rem;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.1));
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 12px;
      max-width: 800px;
    }

    .message-content {
      text-align: center;
    }

    .message-content h4 {
      margin: 0 0 1rem 0;
      font-size: 1.4rem;
      font-weight: 700;
      color: #f59e0b;
    }

    .message-content p {
      margin: 0;
      font-size: 1rem;
      line-height: 1.7;
      color: #cbd5e1;
    }

    .message-content a {
      color: #f59e0b;
      text-decoration: underline;
      font-weight: 700;
    }

    .message-content a:hover {
      color: #fbbf24;
    }

    /* ─── API Presentation ─── */
    .api-presentation {
      border-radius: 16px;
      padding: 3rem 2rem;
      margin: 0 0 4rem;
      max-width: 1200px;
      margin-left: auto;
      margin-right: auto;
    }

    .api-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .api-header h2 {
      color: #f8fafc;
      font-size: 2rem;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }

    .api-subtitle {
      color: #94a3b8;
      font-size: 1.05rem;
      margin: 0;
    }

    .api-content {
      display: flex;
      flex-direction: column;
      gap: 3rem;
    }

    .api-features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .api-feature {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 2rem;
      border-radius: 12px;
      transition: all 0.3s ease;
      text-align: center;
    }

    .api-feature:hover {
      background: rgba(255, 255, 255, 0.07);
      border-color: rgba(245, 158, 11, 0.25);
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    }

    .api-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 1rem;
      color: #f59e0b;
    }

    .api-icon svg {
      width: 100%;
      height: 100%;
    }

    .api-feature h3 {
      color: #e2e8f0;
      font-size: 1.2rem;
      margin-bottom: 0.75rem;
      font-weight: 600;
    }

    .api-feature p {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.6;
      margin: 0;
    }

    /* ─── Endpoints / Exemples ─── */
    .api-endpoints {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 2rem;
      border-radius: 12px;
    }

    .api-endpoints h3 {
      color: #e2e8f0;
      font-size: 1.4rem;
      margin-bottom: 1.5rem;
      font-weight: 600;
      text-align: center;
    }

    .examples-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }

    .example-card {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      overflow: hidden;
      transition: all 0.2s ease;
    }

    .example-card:hover {
      border-color: rgba(245, 158, 11, 0.3);
      background: rgba(255, 255, 255, 0.06);
    }

    .example-query {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: rgba(245, 158, 11, 0.08);
      border-bottom: 1px solid rgba(245, 158, 11, 0.15);
    }

    .query-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #f59e0b;
      font-weight: 700;
      white-space: nowrap;
    }

    .query-term {
      color: #fbbf24;
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
      border-left: 2px solid rgba(255, 255, 255, 0.08);
    }

    .result-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.2rem 0.45rem;
      border-radius: 4px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .result-badge.hscode {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
    }

    .result-badge.p10 {
      background: rgba(99, 179, 237, 0.12);
      color: #63b3ed;
    }

    .result-code {
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      font-weight: 700;
      color: #e2e8f0;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .result-desc {
      font-size: 0.82rem;
      color: #94a3b8;
      line-height: 1.4;
    }

    /* ─── Footer ─── */
    .home-footer {
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      text-align: center;
    }

    .home-footer p {
      margin: 0;
      font-size: 0.88rem;
      color: #64748b;
      padding: 1.5rem;
      line-height: 1.7;
    }

    .home-footer a {
      color: #f59e0b;
      text-decoration: none;
      font-weight: 600;
    }

    .home-footer a:hover {
      color: #fbbf24;
      text-decoration: underline;
    }

    /* ─── Responsive ─── */
    @media (max-width: 768px) {
      .home-container {
        padding: 1rem;
        overflow-x: hidden;
      }

      .hero {
        padding: 3rem 1rem 2.5rem;
      }

      .hero-glow {
        width: 280px;
        height: 280px;
      }

      .hero h1 {
        font-size: 2rem;
      }

      .hero-subtitle {
        font-size: 1.1rem;
      }

      .hero-desc {
        font-size: 1rem;
      }

      .feature-card {
        width: 100%;
        min-width: unset;
      }

      .request-card {
        min-width: unset;
        max-width: 100%;
        width: 100%;
      }

      .features {
        flex-direction: column;
        align-items: stretch;
      }

      .api-presentation {
        padding: 2rem 1rem;
        margin: 2rem 0;
      }

      .api-header h2 {
        font-size: 1.6rem;
      }

      .api-features-grid {
        grid-template-columns: 1fr;
      }

      .examples-grid {
        grid-template-columns: 1fr;
      }

      .result-code {
        white-space: normal;
        word-break: break-all;
      }

      .result-row {
        flex-wrap: wrap;
      }

      .home-footer {
        margin-top: 2rem;
        padding-top: 1.5rem;
      }
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
