import { Component, inject } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { OrganizationAccountService } from '../../core/services/organization-account.service';
import { combineLatest, of } from 'rxjs';
import { map, switchMap, catchError, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, AsyncPipe],
  template: `
    <div class="home-container">
      <!-- Hero Section -->
      <section class="hero">
        <div class="hero-glow"></div>
        <h1>Enclume-Numérique</h1>
        <p class="hero-subtitle">Votre solution complète pour la recherche de position tarifaire (HS code)
 </p>
        <p class="hero-desc">Identifiez les codes HS de vos produits en quelques secondes grâce à notre moteur de recherche intelligent et multilingue.</p>
        <div class="hero-cta" *ngIf="!(isAuthenticated$ | async)">
          <a routerLink="/auth/register" class="cta-button primary">Commencer gratuitement</a>
          <a routerLink="/pricing" class="cta-button ghost">Voir les tarifs</a>
        </div>
      </section>

      <!-- Présentation de l'API Recherche HS-code - Affichée uniquement pour les utilisateurs non connectés -->
      <section class="api-presentation" *ngIf="!(isAuthenticated$ | async)">
        <div class="api-header">
          <h2>Recherche de HS-Code</h2>
          <p class="api-subtitle">Recherche intelligente et multilingue dans le système harmonisé douanier</p>
        </div>

        <div class="api-content">
          <div class="api-features-grid">
            <div class="api-feature">
              <div class="api-icon">🌍</div>
              <h3>Recherche Multilingue</h3>
              <p>Recherchez des codes HS dans toutes les langues.</p>
            </div>

            <div class="api-feature">
              <div class="api-icon">🤖</div>
              <h3>Intelligence Artificielle</h3>
              <p>Moteur de recherche alimenté par l'IA pour des résultats précis et pertinents basés sur vos descriptions de produits.</p>
            </div>

            <div class="api-feature">
              <div class="api-icon">📊</div>
              <h3>Hiérarchie Complète</h3>
              <p>Accédez à tous les niveaux : Section, Chapitre, Position et Sous-Position.</p>
            </div>

            <div class="api-feature">
              <div class="api-icon">📋</div>
              <h3>Recherche par Listes</h3>
              <p>Traitez plusieurs produits simultanément avec l'outil de recherche par listes pour optimiser votre flux de travail.</p>
            </div>

            <div class="api-feature">
              <div class="api-icon">📱</div>
              <h3>Responsive</h3>
              <p>Une interface adaptée à tous les usages : Ordinateurs, tablettes et smartphones.</p>
            </div>

            <div class="api-feature">
              <div class="api-icon">🔒</div>
              <h3>Sécurisé et Fiable</h3>
              <p>API sécurisée avec authentification OAuth2 et suivi détaillé de l'utilisation pour une conformité totale.</p>
            </div>
          </div>

          <div class="api-endpoints">
            <h3>Exemples d'utilisation</h3>
            <div class="endpoint-list">
              <div class="endpoint-item">
                <code class="endpoint-method">Produit recherché</code>
                <code class="endpoint-path">سيارة كهربائية</code>
                <code class="response-method">Réponse HS-Code :</code>
                <span class="endpoint-desc">
                <b>code</b>: "8703 80" <br>
                <b>description</b>: "Véhicules, équipés uniquement d'un moteur électrique pour la propulsion"
                </span>
              </div>
              <div class="endpoint-item">
                <code class="endpoint-method">Produit recherché</code>
                <code class="endpoint-path">dattes</code>
                <code class="response-method">Réponse HS-Code :</code>
                <span class="endpoint-desc"><b>code</b>: "0804 10" <br>
                <b>description</b>: "Dattes"</span>
              </div>
              <div class="endpoint-item">
                <code class="endpoint-method">Produit recherché</code>
                <code class="endpoint-path">Smart phone</code>
                <code class="response-method">Réponse HS-Code :</code>
                <span class="endpoint-desc"><b>code</b>: "8517 13" <br>
                  <b>description</b>: "Postes téléphoniques d'usagers, y compris les téléphones intelligents et autres téléphones pour réseaux cellulaires et pour autres réseaux sans fil: - Téléphones intelligents"</span>
              </div>
              <div class="endpoint-item">
                <code class="endpoint-method">Produit recherché</code>
                <code class="endpoint-path">笔记本电脑</code>
                <code class="response-method">Réponse HS-Code :</code>
                <span class="endpoint-desc"><b>code</b>: "8471.30" <br>
                <b>description</b>: "Ordinateurs portables ..."</span>
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
                  Aucune requête HS-code n'est autorisée pour tous les collaborateurs.
                  Veuillez <a routerLink="/organization/stats">choisir un plan tarifaire</a> ou
                  <a routerLink="/organization/quote-requests">faire une demande de devis</a> pour continuer à utiliser le service.
                </p>
              } @else {
                <p>
                  Le quota de l'essai gratuit de votre organisation a été atteint et est maintenant définitivement désactivé.
                  Aucune requête HS-code n'est autorisée.
                  Veuillez contacter votre administrateur d'organisation pour choisir un plan tarifaire ou faire une demande de devis.
                </p>
              }
            </div>
          </div>
        } @else {
          <h4 class="section-title">Outils de recherche HS-Code</h4>
          <div class="features primary">
            <div class="feature-card request-card">
              <div class="request-icon">🔍</div>
              <h3>Recherche d'article unique</h3>
              <p>Recherchez le code HS d'un produit spécifique en quelques secondes.</p>
              <a [routerLink]="['/recherche/search']" class="cta-button secondary">
                Rechercher un article
              </a>
            </div>

            <div class="feature-card request-card">
              <div class="request-icon">📋</div>
              <h3>Recherche par liste</h3>
              <p>Traitez une liste de produits simultanément avec l'outil de recherche par lots.</p>
              <a [routerLink]="['/recherche/searchListLots']" class="cta-button secondary">
                Rechercher par liste
              </a>
            </div>

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
        <p>Micro-entreprise <a href="https://www.forge-numerique.com">Enclume-Numérique</a><br>
        Contact : med&#64;forge-numerique.com <br>
        WathsApp : +33 6 22 56 38 41 </p>
        
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
      font-size: 2.8rem;
      margin-bottom: 1rem;
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
    }

    .endpoint-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .endpoint-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      border-left: 3px solid #f59e0b;
      transition: all 0.2s ease;
    }

    .endpoint-item:hover {
      background: rgba(245, 158, 11, 0.06);
    }

    .endpoint-method {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      padding: 0.35rem 0.75rem;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.8rem;
      min-width: 60px;
      text-align: center;
      white-space: nowrap;
    }

    .response-method {
      color: #fffff0;
      padding: 0.35rem 0.75rem;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.8rem;
      min-width: 60px;
      text-align: center;
      white-space: nowrap;
    }

    .endpoint-path {
      color: #fbbf24;
      font-weight: 600;
      font-family: 'Courier New', monospace;
      font-size: 0.95rem;
      flex: 0 0 auto;
    }

    .endpoint-desc {
      text-align: left;
      color: #94a3b8;
      font-size: 0.88rem;
      flex: 1;
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
      .hero {
        padding: 3rem 1rem 2.5rem;
      }

      .hero h1 {
        font-size: 2.2rem;
      }

      .hero-subtitle {
        font-size: 1.1rem;
      }

      .hero-desc {
        font-size: 1rem;
      }

      .feature-card {
        width: 100%;
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

      .endpoint-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }

      .endpoint-path {
        width: 100%;
        word-break: break-all;
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
