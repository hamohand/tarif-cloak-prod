import { Component, inject } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { OrganizationAccountService } from '../../core/services/organization-account.service';
import { EditionService } from '../../core/services/edition.service';
import { SearchStateService, TariffZone } from '../../tarif/services/search-state.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, AsyncPipe],
  template: `
    <div class="home-container">
      <!-- En-tête essentiel -->
      <section class="hero">
        <div class="hero-glow"></div>

        <div class="hero-kicker">
          <span class="kicker-badge">TCI</span>
          <span>Tarif du Commerce International</span>
          <span class="kicker-sep" aria-hidden="true">·</span>
          <span class="kicker-ar">تعريفة التجارة الدولية</span>
        </div>

        <h1 class="hero-main-title">
          Nomenclature Douanière &amp; Recherche Tarifaire
        </h1>

        <p class="hero-subtitle">
          Identifiez le code douanier d'une marchandise, vérifiez sa fiche officielle et comparez les régimes tarifaires entre zones douanières.
        </p>

        <div class="zones-bar" role="group" aria-label="Zones douanières couvertes">
          <span class="zones-label">Zones couvertes :</span>
          <button
            type="button"
            class="zone-chip"
            [class.active]="(selectedZone$ | async) !== 'EU'"
            (click)="selectZone('DZ')">
            <span class="zone-iso">DZ</span> Algérie
          </button>
          <button
            type="button"
            class="zone-chip eu"
            [class.active]="(selectedZone$ | async) === 'EU'"
            (click)="selectZone('EU')">
            <span class="zone-iso">UE</span> Union Européenne
          </button>
          <span class="zone-chip soon" aria-label="Chine disponible prochainement">
            <span class="zone-iso">CN</span> Chine <em>· bientôt</em>
          </span>
        </div>
      </section>

      <!-- Trichotomie : Recherche de code · Décodage · Comparaison -->
      <section class="trichotomy-section" aria-label="Trois modes d'utilisation">
        @if ((showRequestButtons$ | async) && !(canMakeRequests$ | async)) {
          <div class="quota-notice">
            <span>
              Le quota de recherche assistée de votre organisation est atteint. Les services de
              <strong>décodage</strong> et de <strong>comparaison</strong> restent en accès libre.
            </span>
            @if (isOrganizationAccount$ | async) {
              <span class="quota-links">
                <a routerLink="/organization/stats">Choisir un plan</a>
                <a routerLink="/organization/quote-requests">Demander un devis</a>
              </span>
            }
          </div>
        }

        <div class="trichotomy-grid">
          <article class="tri-card accent-amber">
            <span class="tri-index">01 · Désignation → Code</span>
            <h2>Recherche de code</h2>
            <p class="card-sub">À partir de la description d'un produit</p>
            <p class="card-desc">
              Décrivez une marchandise en langage courant (français, anglais, arabe…) pour identifier sa position douanière officielle en
              {{ (selectedZone$ | async) === 'EU' ? 'Union Européenne' : 'Algérie' }}.
            </p>
            <div class="tri-footer">
              <button
                type="button"
                class="tri-btn primary"
                [disabled]="(showRequestButtons$ | async) && !(canMakeRequests$ | async)"
                (click)="openSearch()">
                Rechercher un code →
              </button>
              @if (!(isAuthenticated$ | async)) {
                <span class="tri-meta">1 essai découverte</span>
              }
            </div>
          </article>

          <article class="tri-card accent-green">
            <span class="tri-index">02 · Code → Fiche officielle</span>
            <h2>Décodage</h2>
            <p class="card-sub">À partir d'un code douanier</p>
            <p class="card-desc">
              Saisissez un code tarifaire complet ou partiel pour consulter son arborescence officielle, son intitulé exact, ses droits applicables et ses formalités.
            </p>
            <div class="tri-footer">
              <button
                type="button"
                class="tri-btn secondary"
                (click)="openDecoder(false)">
                Décoder un code →
              </button>
              <span class="tri-meta free">{{ (isAuthenticated$ | async) ? 'Gratuit illimité' : 'Aperçu · Gratuit sur compte' }}</span>
            </div>
          </article>

          <article class="tri-card accent-blue">
            <span class="tri-index">03 · Multi-zones (DZ ↔ UE)</span>
            <h2>Comparaison</h2>
            <p class="card-sub">Mise en regard entre territoires</p>
            <p class="card-desc">
              Affichez côte à côte les positions officielles et les régimes d'importation d'une même famille de produits entre l'Algérie et l'Union Européenne.
            </p>
            <div class="tri-footer">
              <button
                type="button"
                class="tri-btn blue"
                (click)="openDecoder(true)">
                Comparer DZ ↔ UE →
              </button>
              <span class="tri-meta free">{{ (isAuthenticated$ | async) ? 'Gratuit illimité' : 'Aperçu · Gratuit sur compte' }}</span>
            </div>
          </article>
        </div>
      </section>

      <!-- Complément visiteur non connecté (Box Locale sur site) -->
      @if (!(isAuthenticated$ | async)) {
        <section class="guest-strip" aria-label="Connexion Box Locale">
          <p class="guest-copy">
            Instance locale souveraine · Connectez-vous avec les identifiants fournis par votre organisation pour accéder à la recherche IA locale et aux outils de traitement par lots.
          </p>
          <div class="guest-actions">
            <a routerLink="/auth/login" class="strip-btn primary">Se connecter</a>
            <a routerLink="/aide" class="strip-btn ghost">Guide</a>
          </div>
        </section>
      }

      <!-- Outils complémentaires (connectés hors bêta) -->
      @if ((showRequestButtons$ | async) && !isBetaMode) {
        <section class="secondary-tools" aria-label="Outils de traitement groupé et gestion">
          @if (canMakeRequests$ | async) {
            <a routerLink="/recherche/searchListLots" class="secondary-card">
              <h3>Recherche sur liste de produits</h3>
              <p>Importez un tableau de désignations pour qualifier plusieurs lignes en une opération.</p>
            </a>
            <a routerLink="/recherche/batch-search" class="secondary-card">
              <h3>Traitement par lots</h3>
              <p>Soumettez un volume important de marchandises en traitement différé.</p>
            </a>
          }
          @if (isOrganizationAccount$ | async) {
            <a routerLink="/organization/account" class="secondary-card org">
              <h3>Mon organisation</h3>
              <p>Invitez vos collaborateurs et suivez les statistiques globales d'utilisation.</p>
            </a>
          }
        </section>
      }

      <!-- Note technique en bas d'écran -->
      <aside class="bottom-note" aria-label="Note et références techniques">
        <strong>Note &amp; références techniques</strong> — Toutes les positions affichées proviennent exclusivement des nomenclatures douanières officielles (aucun code ni intitulé inventé) : tarif algérien à 10 chiffres (P10, Direction Générale des Douanes — DD, TVA, UQN, FAP) et nomenclature combinée européenne à 8 chiffres (NC8, EUR-Lex — tarif douanier commun TDC). La recherche de code procède par qualification hiérarchique assistée ; le décodage et la comparaison interrogent directement la base réglementaire (SQL) autour de la racine internationale commune à 6 chiffres du Système Harmonisé (SH / OMD), socle prêt à accueillir prochainement la nomenclature chinoise.
      </aside>

      <footer class="home-footer">
        <p>Développement d'applications pour les entreprises — Auto-entreprise Hamroun<br>
        Contact : mohhamroun&#64;gmail.com · WhatsApp : +213 5 60 96 80 66</p>
        <span class="edition-tag">TCI · {{ appEdition() }}</span>
      </footer>
    </div>
  `,
  styles: [`
    .home-container {
      text-align: center;
      padding: 2rem 1.25rem 2.5rem;
      max-width: 1120px;
      margin: 0 auto;
      color: #E2E8F0;
    }

    .hero {
      position: relative;
      padding: 1.25rem 0.5rem 2rem;
    }

    .hero-glow {
      position: absolute;
      top: 15%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 520px;
      height: 260px;
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
      margin-bottom: 0.9rem;
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
      margin: 0 auto 0.85rem;
      font-family: var(--font-serif, 'Source Serif 4', Georgia, serif);
      font-size: clamp(1.95rem, 3.8vw, 2.9rem);
      font-weight: 700;
      line-height: 1.14;
      letter-spacing: -0.015em;
      color: #F8FAFC;
    }

    .hero-subtitle {
      position: relative;
      z-index: 1;
      font-family: var(--font-sans, 'Inter', sans-serif);
      font-size: 1.04rem;
      font-weight: 400;
      color: #CBD5E1;
      max-width: 680px;
      margin: 0 auto 1.65rem;
      line-height: 1.6;
    }

    /* ═══ Barre des zones douanières ═══ */
    .zones-bar {
      position: relative;
      z-index: 1;
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 999px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .zones-label {
      font-size: 0.78rem;
      font-weight: 500;
      color: #94A3B8;
      margin-right: 4px;
    }

    .zone-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 13px;
      border-radius: 999px;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #CBD5E1;
      font-family: var(--font-sans, 'Inter', sans-serif);
      font-size: 0.84rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .zone-chip:hover { color: #F8FAFC; border-color: rgba(255, 255, 255, 0.24); }

    .zone-chip.active {
      background: rgba(245, 158, 11, 0.16);
      border-color: rgba(245, 158, 11, 0.5);
      color: #FCD34D;
    }

    .zone-chip.eu.active {
      background: rgba(59, 130, 246, 0.16);
      border-color: rgba(59, 130, 246, 0.5);
      color: #93C5FD;
    }

    .zone-chip.soon {
      cursor: default;
      border-style: dashed;
      border-color: rgba(255, 255, 255, 0.14);
      color: #64748B;
      font-weight: 500;
    }

    .zone-chip.soon em {
      font-style: normal;
      font-size: 0.75rem;
      color: #64748B;
    }

    .zone-iso {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.72rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
    }

    /* ═══ Trichotomie ═══ */
    .trichotomy-section {
      margin: 0.5rem 0 2rem;
      text-align: left;
    }

    .quota-notice {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      margin-bottom: 1.25rem;
      border-radius: 12px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #E2E8F0;
      font-size: 0.88rem;
    }

    .quota-links { display: flex; gap: 14px; }
    .quota-links a { color: #FCD34D; font-weight: 600; text-decoration: none; }
    .quota-links a:hover { text-decoration: underline; }

    .trichotomy-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1.25rem;
    }

    .tri-card {
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-top: 3px solid rgba(255, 255, 255, 0.16);
      border-radius: 16px;
      padding: 1.6rem 1.5rem 1.45rem;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }

    .tri-card:hover { transform: translateY(-2px); }
    .tri-card.accent-amber { border-top-color: #F59E0B; }
    .tri-card.accent-green { border-top-color: #10B981; }
    .tri-card.accent-blue { border-top-color: #3B82F6; }

    .tri-index {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #94A3B8;
      margin-bottom: 0.6rem;
    }

    .tri-card h2 {
      font-family: var(--font-serif, 'Source Serif 4', Georgia, serif);
      font-size: 1.45rem;
      font-weight: 700;
      color: #F8FAFC;
      margin: 0 0 0.25rem;
    }

    .card-sub {
      font-family: var(--font-sans, 'Inter', sans-serif);
      font-size: 0.88rem;
      font-weight: 400;
      color: #94A3B8;
      margin: 0 0 0.9rem;
    }

    .card-desc {
      font-size: 0.93rem;
      line-height: 1.58;
      color: #CBD5E1;
      margin: 0 0 1.35rem;
    }

    .tri-footer {
      margin-top: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      padding-top: 0.9rem;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .tri-btn {
      padding: 0.62rem 1.15rem;
      border-radius: 9px;
      font-family: var(--font-sans, 'Inter', sans-serif);
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
    }

    .tri-btn.primary { background: #F59E0B; color: #070B14; font-weight: 700; }
    .tri-btn.primary:hover:not(:disabled) { background: #D97706; }
    .tri-btn.primary:disabled { opacity: 0.45; cursor: not-allowed; }

    .tri-btn.secondary {
      background: rgba(16, 185, 129, 0.14);
      border-color: rgba(16, 185, 129, 0.35);
      color: #34D399;
    }
    .tri-btn.secondary:hover { background: rgba(16, 185, 129, 0.22); }

    .tri-btn.blue {
      background: rgba(59, 130, 246, 0.14);
      border-color: rgba(59, 130, 246, 0.35);
      color: #93C5FD;
    }
    .tri-btn.blue:hover { background: rgba(59, 130, 246, 0.22); }

    .tri-meta { font-size: 0.78rem; color: #94A3B8; font-weight: 500; }
    .tri-meta.free { color: #34D399; }

    /* ═══ Bandeau visiteur / outils secondaires ═══ */
    .guest-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding: 14px 18px;
      margin-bottom: 1.75rem;
      border-radius: 12px;
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.08);
      text-align: left;
    }

    .guest-copy { margin: 0; font-size: 0.9rem; color: #CBD5E1; }
    .guest-actions { display: flex; flex-wrap: wrap; gap: 8px; }

    .strip-btn {
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 0.84rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .strip-btn.primary { background: rgba(245, 158, 11, 0.16); color: #FCD34D; border: 1px solid rgba(245, 158, 11, 0.38); }
    .strip-btn.primary:hover { background: rgba(245, 158, 11, 0.25); }
    .strip-btn.ghost { color: #CBD5E1; border: 1px solid rgba(255, 255, 255, 0.14); }
    .strip-btn.ghost:hover { color: #F8FAFC; border-color: rgba(255, 255, 255, 0.28); }

    .secondary-tools {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
      margin-bottom: 1.75rem;
      text-align: left;
    }

    .secondary-card {
      background: #0D1421;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 1rem 1.2rem;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s ease;
    }

    .secondary-card:hover { border-color: rgba(245, 158, 11, 0.4); }
    .secondary-card.org:hover { border-color: rgba(59, 130, 246, 0.45); }
    .secondary-card h3 { margin: 0 0 0.3rem; font-size: 0.96rem; color: #F8FAFC; }
    .secondary-card p { margin: 0; font-size: 0.83rem; color: #94A3B8; line-height: 1.45; }

    /* ═══ Note technique en bas d'écran ═══ */
    .bottom-note {
      margin-top: 1rem;
      padding: 14px 18px;
      border-radius: 10px;
      background: rgba(13, 20, 33, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.06);
      text-align: left;
      font-size: 0.8rem;
      line-height: 1.6;
      color: #94A3B8;
    }

    .bottom-note strong { color: #CBD5E1; font-weight: 600; }

    .home-footer {
      margin-top: 1.75rem;
      padding-top: 1.15rem;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .home-footer p { margin: 0; font-size: 0.8rem; color: #64748B; line-height: 1.6; }

    .edition-tag {
      display: inline-block;
      margin-top: 0.45rem;
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.7rem;
      color: #475569;
      letter-spacing: 0.04em;
    }

    @media (max-width: 860px) {
      .trichotomy-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class HomeComponent {
  private authService = inject(AuthService);
  private organizationAccountService = inject(OrganizationAccountService);
  private state = inject(SearchStateService);
  private router = inject(Router);

  isBetaMode = environment.betaMode === true;
  appEdition = inject(EditionService).edition;

  isAuthenticated$ = this.authService.isAuthenticated();
  isOrganizationAccount$ = this.authService.isOrganizationAccount();
  isCollaboratorAccount$ = this.authService.isCollaboratorAccount();
  selectedZone$ = this.state.selectedZone$;

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

  selectZone(zone: TariffZone): void {
    this.state.setZone(zone);
  }

  openSearch(): void {
    this.router.navigate(['/recherche/search-position10']);
  }

  openDecoder(compareMode: boolean): void {
    this.state.compareMode = compareMode;
    this.router.navigate(['/recherche/decode-p10']);
  }
}
