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
        Intradia classe vos produits dans la nomenclature douanière (système harmonisé).
        Voici l'essentiel pour bien démarrer.
      </p>

      <!-- Crédits -->
      <section class="help-section">
        <h3>💳 Crédits et quota</h3>
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
              <td>Recherche Position10 (avec IA)</td>
              <td><strong>15 crédits</strong></td>
            </tr>
            <tr>
              <td>Recherche HS-code Position6 (avec IA)</td>
              <td><strong>10 crédits</strong></td>
            </tr>
            <tr>
              <td>Décodage inverse Position10</td>
              <td><strong>5 crédits</strong></td>
            </tr>
            <tr>
              <td>Décodage inverse HS-code</td>
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
          Un code HS est structuré en niveaux hiérarchiques. Intradia retourne la position
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
            <span class="decode-label">Intradia retourne</span>
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
    .help-page {
      max-width: 760px;
      padding: 1.5rem 0 3rem;
    }
    .help-page h2 {
      font-size: 1.4rem;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 0.5rem;
    }
    .help-intro {
      color: #94a3b8;
      margin-bottom: 2rem;
      font-size: 0.95rem;
    }
    .help-section {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .help-section h3 {
      font-size: 1rem;
      font-weight: 700;
      color: #e2e8f0;
      margin: 0 0 1rem;
    }
    .help-section p {
      color: #94a3b8;
      font-size: 0.875rem;
      line-height: 1.6;
      margin: 0 0 0.75rem;
    }
    .help-note {
      background: rgba(99,102,241,0.08);
      border-left: 3px solid #6366f1;
      padding: 0.6rem 0.8rem;
      border-radius: 0 6px 6px 0;
      font-size: 0.82rem !important;
      color: #a5b4fc !important;
    }

    /* Crédits table */
    .credits-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      margin: 0.75rem 0;
    }
    .credits-table th {
      text-align: left;
      padding: 0.5rem 0.75rem;
      background: rgba(255,255,255,0.05);
      color: #cbd5e1;
      font-weight: 600;
    }
    .credits-table td {
      padding: 0.5rem 0.75rem;
      border-top: 1px solid rgba(255,255,255,0.06);
      color: #94a3b8;
    }
    .credits-table tr:hover td {
      background: rgba(255,255,255,0.02);
    }

    /* Hiérarchie */
    .hierarchy-visual {
      margin: 0.75rem 0;
    }
    .hierarchy-level {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-size: 0.82rem;
    }
    .level-label {
      font-weight: 600;
      min-width: 160px;
      flex-shrink: 0;
    }
    .level-example { color: #94a3b8; }
    .level-section  { background: rgba(99,102,241,0.1); color: #a5b4fc; }
    .level-chapter  { background: rgba(59,130,246,0.1); color: #93c5fd; }
    .level-pos4     { background: rgba(16,185,129,0.1); color: #6ee7b7; }
    .level-pos6     { background: rgba(245,158,11,0.1); color: #fcd34d; }
    .level-pos10    { background: rgba(239,68,68,0.1);  color: #fca5a5; }
    .hierarchy-arrow {
      text-align: center;
      color: #475569;
      font-size: 0.75rem;
      padding: 0.1rem 0;
    }

    /* Décodage */
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
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.4rem;
    }
    .decode-input code {
      font-size: 1.1rem;
      color: #fcd34d;
      background: rgba(245,158,11,0.1);
      padding: 0.3rem 0.6rem;
      border-radius: 6px;
    }
    .decode-output ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .decode-output li {
      color: #94a3b8;
      font-size: 0.82rem;
      padding: 0.2rem 0;
      border-left: 2px solid rgba(255,255,255,0.08);
      padding-left: 0.6rem;
      margin-bottom: 0.2rem;
    }
    .decode-output li strong { color: #e2e8f0; }

    /* Tip */
    .help-tip {
      border-color: rgba(34,197,94,0.2);
      background: rgba(34,197,94,0.04);
    }
    .help-tip h3 { color: #86efac; }
    .help-tip ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .help-tip li {
      color: #94a3b8;
      font-size: 0.875rem;
      padding: 0.3rem 0;
      padding-left: 1rem;
      position: relative;
    }
    .help-tip li::before {
      content: '→';
      position: absolute;
      left: 0;
      color: #4ade80;
    }
  `]
})
export class HelpComponent {}
