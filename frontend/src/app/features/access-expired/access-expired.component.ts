import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-access-expired',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="expired-page">
      <div class="expired-container">
        <div class="expired-icon">🙏</div>
        <h1 class="expired-title">Merci pour votre participation</h1>
        <p class="expired-message">
          Votre période de test à la phase beta d'<strong>TCI</strong> est terminée.
        </p>
        <p class="expired-contact-intro">
          Pour la prolonger ou passer à un plan commercial, contactez notre équipe :
        </p>
        <div class="contact-links">
          <a href="mailto:contact@enclume-numerique.com" class="contact-item email-link">
            <span class="contact-icon">✉️</span>
            <span>contact&#64;enclume-numerique.com</span>
          </a>
          <a href="https://wa.me/213XXXXXXXXX" target="_blank" rel="noopener" class="contact-item whatsapp-link">
            <span class="contact-icon">💬</span>
            <span>WhatsApp</span>
          </a>
        </div>
        <p class="expired-footer">
          Nous vous remercions pour vos retours précieux qui nous aident à améliorer TCI.
        </p>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .expired-page {
      min-height: 100vh;
      background: var(--neu-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }

    /* Centered extruded card */
    .expired-container {
      max-width: 520px;
      width: 100%;
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      border-radius: var(--neu-radius-container);
      padding: 3rem 2.5rem;
      box-shadow: var(--neu-extruded);
      text-align: center;
    }
    .expired-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    .expired-title {
      font-family: var(--font-display);
      font-size: 1.6rem;
      font-weight: 700;
      color: var(--neu-text-heading);
      margin-bottom: 1rem;
    }
    .expired-message {
      color: var(--neu-text-primary);
      font-size: 1rem;
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }
    .expired-message strong {
      color: var(--neu-accent);
    }
    .expired-contact-intro {
      color: var(--neu-text-muted);
      font-size: 0.95rem;
      margin-bottom: 1rem;
    }
    .contact-links {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 2rem;
    }

    /* Contact links as extruded-sm pill buttons */
    .contact-item {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.875rem 1.5rem;
      border-radius: 50px;
      font-weight: 600;
      text-decoration: none;
      background: var(--neu-bg);
      box-shadow: var(--neu-extruded-sm);
      color: var(--neu-text-primary);
      transition: all 0.3s ease;
      min-height: 44px;
    }
    .contact-item:hover {
      transform: translateY(-1px);
      box-shadow: var(--neu-extruded-hover);
    }
    .contact-item:focus-visible {
      outline: 2px solid var(--neu-accent);
      outline-offset: 2px;
    }
    .email-link {
      color: var(--neu-accent);
    }
    .whatsapp-link {
      color: var(--neu-accent-secondary);
    }
    .contact-icon { font-size: 1.2rem; }
    .expired-footer {
      font-size: 0.8rem;
      color: var(--neu-text-muted);
      margin: 0;
    }

    @media (max-width: 768px) {
      .expired-container {
        padding: 2rem 1.5rem;
        border-radius: var(--neu-radius-inner);
      }
    }
  `]
})
export class AccessExpiredComponent {}
