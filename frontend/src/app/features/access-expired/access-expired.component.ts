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
    .expired-page {
      min-height: 100vh;
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }
    .expired-container {
      max-width: 520px;
      width: 100%;
      background: white;
      border-radius: 16px;
      padding: 3rem 2.5rem;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
      text-align: center;
    }
    .expired-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    .expired-title {
      font-size: 1.6rem;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 1rem;
    }
    .expired-message {
      color: #475569;
      font-size: 1rem;
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }
    .expired-contact-intro {
      color: #64748b;
      font-size: 0.95rem;
      margin-bottom: 1rem;
    }
    .contact-links {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 2rem;
    }
    .contact-item {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.875rem 1.5rem;
      border-radius: 10px;
      font-weight: 600;
      text-decoration: none;
      transition: opacity 0.2s;
    }
    .contact-item:hover { opacity: 0.85; }
    .email-link {
      background: #f1f5f9;
      color: #1e293b;
      border: 1px solid #e2e8f0;
    }
    .whatsapp-link {
      background: #dcfce7;
      color: #166534;
    }
    .contact-icon { font-size: 1.2rem; }
    .expired-footer {
      font-size: 0.8rem;
      color: #94a3b8;
      margin: 0;
    }
  `]
})
export class AccessExpiredComponent {}
