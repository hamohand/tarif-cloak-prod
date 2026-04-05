import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="help-page">
      <h2>📚 Guide d'utilisation</h2>
      <p class="help-intro">
        TCI classe vos produits dans la nomenclature douanière (système harmonisé).
        Voici l'essentiel pour bien démarrer.
      </p>

      <!-- Crédits -->
      <section class="help-section">
        <h3>💳 Recherches et crédits</h3>
        <p>Chaque recherche consomme un certain nombre de crédits selon son type :</p>
        <table class="credits-table">
          <thead>
            <tr>
              <th>Type de recherche</th>
              <th>Crédits</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Recherche Position10 (10 chiffres)</td>
              <td><strong>15 crédits</strong></td>
            </tr>
            <tr>
              <td>Recherche HS-code Position6 (6 chiffres)</td>
              <td><strong>10 crédits</strong></td>
            </tr>
            <tr>
              <td>Décodage inverse Position10 (Désignation à partir d'un code à 10 chiffres)</td>
              <td><strong>5 crédits</strong></td>
            </tr>
            <tr>
              <td>Décodage inverse HS-code (Désignation à partir d'un code à 2, 4 ou 6 chiffres)</td>
              <td><strong>2 crédits</strong></td>
            </tr>
          </tbody>
        </table>
        <p class="help-note">
          Votre solde de crédits est visible sur le <strong>Tableau de bord</strong>.
          Les crédits non utilisés ne sont pas reportés au-delà de la période d'essai.
        </p>
      </section>

      <!-- Lire un résultat -->
      <section class="help-section">
        <h3>🔍 Lire un résultat HS-code</h3>
        <p>
          Un code HS est structuré en niveaux hiérarchiques. TCI retourne la position
          la plus précise disponible, avec une justification de son choix.
        </p>
        <div class="hierarchy-visual">
          <div class="hierarchy-level level-section">
            <span class="level-label">Section</span>
            <span class="level-example">Section XI — Matières textiles</span>
          </div>
          <div class="hierarchy-arrow">↓</div>
          <div class="hierarchy-level level-chapter">
            <span class="level-label">Chapitre (2 chiffres)</span>
            <span class="level-example">61 — Vêtements et accessoires du vêtement en bonneterie</span>
          </div>
          <div class="hierarchy-arrow">↓</div>
          <div class="hierarchy-level level-pos4">
            <span class="level-label">Position (4 chiffres)</span>
            <span class="level-example">6109 — T-shirts et maillots de corps, en bonneterie</span>
          </div>
          <div class="hierarchy-arrow">↓</div>
          <div class="hierarchy-level level-pos6">
            <span class="level-label">Sous-position (6 chiffres)</span>
            <span class="level-example">610910 — De coton</span>
          </div>
          <div class="hierarchy-arrow">↓</div>
          <div class="hierarchy-level level-pos10">
            <span class="level-label">Position tarifaire (10 chiffres)</span>
            <span class="level-example">6109100010 — Sous-position nationale</span>
          </div>
        </div>
        <p class="help-note">
          La justification affichée sous le code explique pourquoi l'IA a retenu
          cette position plutôt qu'une autre. Elle peut être exportée avec le résultat.
        </p>
      </section>

      <!-- Décodage inverse -->
      <section class="help-section">
        <h3>↩️ Décodage inverse</h3>
        <p>
          Vous avez un code HS mais vous ne savez pas ce qu'il désigne ?
          Le décodage inverse remonte la hiérarchie complète à partir du code.
        </p>
        <div class="decode-example">
          <div class="decode-input">
            <span class="decode-label">Vous saisissez</span>
            <code>610910</code>
          </div>
          <div class="decode-output">
            <span class="decode-label">TCI retourne</span>
            <ul>
              <li>Section XI — Matières textiles et ouvrages en ces matières</li>
              <li>Chapitre 61 — Vêtements et accessoires du vêtement en bonneterie</li>
              <li>Position 6109 — T-shirts et maillots de corps, en bonneterie</li>
              <li><strong>Sous-position 610910 — De coton</strong></li>
            </ul>
          </div>
        </div>
        <p class="help-note">
          Le décodage accepte 2, 4, 6 ou 10 chiffres. Il est disponible via le menu
          <strong>Positions tarifaires → Décodage</strong> et ne consomme que 2 ou 5 crédits
          (sans appel IA).
        </p>
      </section>

      <!-- Conseil -->
      <section class="help-section help-tip">
        <h3>💡 Conseils pour de meilleurs résultats</h3>
        <ul>
          <li>Décrivez le produit avec sa <strong>matière principale</strong> et son <strong>usage</strong> (ex : "chaussures de sport en cuir pour homme").</li>
          <li>Évitez les noms de marque — préférez la description technique.</li>
          <li>Plus la description est précise, plus le code retourné sera fiable.</li>
          <li>En cas de doute sur le résultat, utilisez le <strong>décodage inverse</strong> pour vérifier la hiérarchie.</li>
        </ul>
      </section>
    </div>
  `,
  styles: [`
    :host {
      --neu-bg: var(--neu-bg, #E0E5EC);
      --neu-extruded: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      --neu-extruded-hover: var(--neu-extruded-hover, 12px 12px 20px rgba(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6));
      --neu-extruded-sm: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.5), -5px -5px 10px rgba(255,255,255,0.4));
      --neu-inset: var(--neu-inset, inset 4px 4px 8px rgba(163,177,198,0.5), inset -4px -4px 8px rgba(255,255,255,0.4));
      --neu-radius-container: var(--neu-radius-container, 32px);
      --neu-radius-inner: var(--neu-radius-inner, 12px);
      --neu-accent: var(--neu-accent, #6C63FF);
      --neu-accent-secondary: var(--neu-accent-secondary, #38B2AC);
      --neu-accent-danger: var(--neu-accent-danger, #E53E3E);
      --neu-accent-warning: var(--neu-accent-warning, #ED8936);
      --neu-text-primary: var(--neu-text-primary, #3D4852);
      --neu-text-muted: var(--neu-text-muted, #6B7280);
      --neu-text-heading: var(--neu-text-heading, #2D3748);
      --font-display: var(--font-display, 'Plus Jakarta Sans', sans-serif);
    }

    .help-page {
      max-width: 760px;
      padding: 1.5rem 0 3rem;
      background: var(--neu-bg);
    }
    .help-page h2 {
      font-family: var(--font-display);
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--neu-text-heading);
      margin-bottom: 0.5rem;
    }
    .help-intro {
      color: var(--neu-text-muted);
      margin-bottom: 2rem;
      font-size: 0.95rem;
    }

    /* Sections as extruded cards */
    .help-section {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      box-shadow: var(--neu-extruded);
      border-radius: var(--neu-radius-container);
      padding: 1.75rem;
      margin-bottom: 1.5rem;
      transition: box-shadow 0.3s ease, transform 0.3s ease;
    }
    .help-section:hover {
      box-shadow: var(--neu-extruded-hover);
      transform: translateY(-2px);
      background: var(--neu-card-bg-hover, linear-gradient(145deg, #EDF0F5, #DCE1E8));
    }
    .help-section h3 {
      font-family: var(--font-display);
      font-size: 1rem;
      font-weight: 700;
      color: var(--neu-text-heading);
      margin: 0 0 1rem;
    }
    .help-section p {
      color: var(--neu-text-primary);
      font-size: 0.875rem;
      line-height: 1.6;
      margin: 0 0 0.75rem;
    }

    /* Notes / tips as inset containers */
    .help-note {
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      padding: 0.75rem 1rem;
      border-radius: var(--neu-radius-inner);
      font-size: 0.82rem !important;
      color: var(--neu-accent) !important;
    }

    /* Credits table — separate spacing, extruded cells */
    .credits-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0 0.5rem;
      font-size: 0.85rem;
      margin: 0.75rem 0;
    }
    .credits-table th {
      text-align: left;
      padding: 0.6rem 0.85rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      color: var(--neu-text-heading);
      font-weight: 600;
      border-radius: var(--neu-radius-inner);
    }
    .credits-table td {
      padding: 0.6rem 0.85rem;
      color: var(--neu-text-primary);
      background: var(--neu-bg);
      box-shadow: var(--neu-extruded-sm);
    }
    .credits-table td:first-child {
      border-radius: var(--neu-radius-inner) 0 0 var(--neu-radius-inner);
    }
    .credits-table td:last-child {
      border-radius: 0 var(--neu-radius-inner) var(--neu-radius-inner) 0;
    }
    .credits-table td strong {
      color: var(--neu-accent);
    }

    /* Hierarchy — monochrome accent shades */
    .hierarchy-visual {
      margin: 0.75rem 0;
    }
    .hierarchy-level {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
      padding: 0.6rem 0.85rem;
      border-radius: var(--neu-radius-inner);
      font-size: 0.82rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-extruded-sm);
      margin-bottom: 0.25rem;
    }
    .level-label {
      font-weight: 600;
      min-width: 160px;
      flex-shrink: 0;
    }
    .level-example { color: var(--neu-text-muted); }
    .level-section  { color: var(--neu-accent); opacity: 1; }
    .level-chapter  { color: var(--neu-accent); opacity: 0.88; }
    .level-pos4     { color: var(--neu-accent); opacity: 0.76; }
    .level-pos6     { color: var(--neu-accent); opacity: 0.64; }
    .level-pos10    { color: var(--neu-accent); opacity: 0.52; }
    .hierarchy-arrow {
      text-align: center;
      color: var(--neu-text-muted);
      font-size: 0.75rem;
      padding: 0.1rem 0;
    }

    /* Decode example */
    .decode-example {
      display: flex;
      gap: 1.5rem;
      margin: 0.75rem 0;
      flex-wrap: wrap;
    }
    .decode-input, .decode-output {
      flex: 1;
      min-width: 200px;
    }
    .decode-label {
      display: block;
      font-size: 0.75rem;
      color: var(--neu-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.4rem;
    }
    .decode-input code {
      font-size: 1.1rem;
      color: var(--neu-accent);
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      padding: 0.35rem 0.7rem;
      border-radius: var(--neu-radius-inner);
    }
    .decode-output ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .decode-output li {
      color: var(--neu-text-muted);
      font-size: 0.82rem;
      padding: 0.25rem 0 0.25rem 0.6rem;
      margin-bottom: 0.2rem;
      box-shadow: inset 2px 0 0 0 rgba(108, 99, 255, 0.25);
    }
    .decode-output li strong { color: var(--neu-text-heading); }

    /* Tip section as inset container */
    .help-tip {
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
    }
    .help-tip:hover {
      box-shadow: var(--neu-inset);
      transform: none;
    }
    .help-tip h3 { color: var(--neu-accent-secondary); }
    .help-tip ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .help-tip li {
      color: var(--neu-text-primary);
      font-size: 0.875rem;
      padding: 0.3rem 0;
      padding-left: 1rem;
      position: relative;
    }
    .help-tip li::before {
      content: '\\2192';
      position: absolute;
      left: 0;
      color: var(--neu-accent-secondary);
    }

    @media (max-width: 768px) {
      .help-page {
        padding: 1rem 0.5rem 2rem;
      }
      .help-section {
        padding: 1.25rem;
        border-radius: var(--neu-radius-inner);
      }
      .hierarchy-level {
        flex-direction: column;
        gap: 0.25rem;
      }
      .level-label {
        min-width: auto;
      }
      .decode-example {
        flex-direction: column;
      }
    }
  `]
})
export class HelpComponent {}
