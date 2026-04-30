import { Component, OnInit, inject, OnDestroy, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Observable, interval, Subscription, combineLatest } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { InvoiceService } from '../../../core/services/invoice.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MarketProfileService } from '../../../core/services/market-profile.service';
import { OrganizationAccountService, OrganizationInfo } from '../../../core/services/organization-account.service';
import { PaymentService } from '../../../core/services/payment.service';
import { UserService } from '../../../core/services/user.service';
import { environment } from '../../../../environments/environment';
import { AsyncPipe, CommonModule } from '@angular/common';
import { take, map, catchError, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, AsyncPipe],
  template: `
    <nav class="navbar">
      <div class="nav-brand">
        <a routerLink="/">
          Enclume-Numérique
          @if (countryCode$ | async; as countryCode) {
            <span class="brand-country-code">{{ countryCode }}</span>
          }
        </a>
        <span class="env-badge" [class.env-prod]="isBetaMode" [class.env-staging]="!isBetaMode">
          {{ isBetaMode ? 'PROD' : 'STAGING' }}
        </span>
      </div>

      <button class="hamburger" (click)="toggleMobileMenu()" [class.active]="mobileMenuOpen()">
        <span></span><span></span><span></span>
      </button>

      <div class="nav-links" [class.mobile-open]="mobileMenuOpen()">
        @if (isAuthenticated$ | async) {
          @if (isOrganizationAccount$ | async) {
            @if (canMakeRequests$ | async) {
              <a routerLink="/" class="nav-link hscode-link" (click)="closeMobileMenu()">Positions tarifaires</a>
            } @else {
              <button class="nav-link hscode-link-blocked" (click)="openRenewalModal(); closeMobileMenu()">Positions tarifaires ⚠️</button>
            }
          } @else if (isCollaboratorAccount$ | async) {
            @if (canMakeRequests$ | async) {
              <a routerLink="/" class="nav-link hscode-link" (click)="closeMobileMenu()">Positions tarifaires</a>
            }
          } @else {
            <a routerLink="/" class="nav-link" (click)="closeMobileMenu()">Accueil إستقبال</a>
          }
        } @else {
          <a routerLink="/" class="nav-link" (click)="closeMobileMenu()">Accueil إستقبال</a>
        }
        @if (!(isCollaboratorAccount$ | async) && !isBetaMode) {
          <a routerLink="/pricing" class="nav-link pricing-link" (click)="closeMobileMenu()">
            💳 Tarifs
          </a>
        }
        <button class="nav-link contact-btn" (click)="toggleContactPopup(); closeMobileMenu()">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Contact اتصال
        </button>
        @if ((isAuthenticated$ | async) && !isBetaMode) {
          @if (isOrganizationAccount$ | async) {
            @if (alertCount > 0) {
              <a routerLink="/alerts" class="nav-link alerts-link" (click)="closeMobileMenu()">
                🔔 Alertes
                <span class="alert-badge">{{ alertCount }}</span>
              </a>
            }
          } @else if (isCollaboratorAccount$ | async) {
            @if (!isAdmin()) {
              <a routerLink="/dashboard" class="nav-link" (click)="closeMobileMenu()">Tableau de bord</a>
            }
            @if (alertCount > 0) {
              <a routerLink="/alerts" class="nav-link alerts-link" (click)="closeMobileMenu()">
                🔔 Alertes
                <span class="alert-badge">{{ alertCount }}</span>
              </a>
            }
          }
        }

        <!-- Auth buttons inside mobile menu -->
        <div class="nav-auth-mobile">
          @if (isAuthenticated$ | async) {
            <span class="user-info">
              Bienvenue {{ getUserInfo()?.preferred_username }}
            </span>
            <button (click)="logout(); closeMobileMenu()" class="btn btn-outline">Déconnexion</button>
          } @else {
            <button (click)="goToRegister(); closeMobileMenu()" class="btn btn-secondary">Créer un compte إنشاء حساب</button>
            <button (click)="login(); closeMobileMenu()" class="btn btn-primary">Connexion اتصال</button>
          }
        </div>
      </div>

      <div class="nav-auth">
        @if (isAuthenticated$ | async) {
          <span class="user-info">
            Bienvenue {{ getUserInfo()?.preferred_username }}
          </span>
          <button (click)="logout()" class="btn btn-outline">Déconnexion</button>
        } @else {
          <button (click)="goToRegister()" class="btn btn-secondary">Créer un compte إنشاء حساب</button>
          <button (click)="login()" class="btn btn-primary">Connexion اتصال</button>
        }
      </div>
    </nav>
    
    <!-- Modal renouvellement / changement de plan -->
    @if (showRenewalModal) {
      <div class="renewal-modal-overlay" (click)="closeRenewalModal()">
        <div class="renewal-modal" (click)="$event.stopPropagation()">
          <button class="modal-close-btn" (click)="closeRenewalModal()">✕</button>
          
          @if (isBetaMode) {
            <h3>Quota Épuisé</h3>
            <p>Merci pour votre participation. Veuillez contacter l'administrateur si vous souhaitez continuer à tester.</p>
            <div class="renewal-modal-actions">
              <button class="btn-modal btn-modal-primary" (click)="toggleContactPopup(); closeRenewalModal()">
                💬 Contacter l'administrateur
              </button>
            </div>
          } @else {
            <h3>Accès Positions tarifaires suspendu</h3>
            <p>Votre plan est expiré ou votre quota de crédits est épuisé.</p>
            <div class="renewal-modal-actions">
              <a routerLink="/choose-plan" class="btn-modal btn-modal-primary" (click)="closeRenewalModal()">
                Gérer mon plan
              </a>
            </div>
          }
          
        </div>
      </div>
    }

    @if (showContactPopup) {
      <div class="contact-overlay" (click)="toggleContactPopup()">
        <div class="contact-popup" (click)="$event.stopPropagation()">
          <button class="modal-close-btn" (click)="toggleContactPopup()">✕</button>
          <h3>Nous contacter</h3>
          <p class="contact-tagline">Développement d'applications pour les entreprises</p>
          <div class="contact-info">
            <p>🏢 <strong>Auto-entreprise Hamroun</strong></p>
            <p>✉️ <a href="mailto:mohhamroun@gmail.com">mohhamroun&#64;gmail.com</a></p>
            <p>📱 <a href="https://wa.me/33622563841" target="_blank">WhatsApp : +213 5 60 96 80 66</a></p>
          </div>
        </div>
      </div>
    }

    @if ((isAuthenticated$ | async) && (isOrganizationAccount$ | async)) {
      @if (!(canMakeRequests$ | async)) {
        <div class="trial-expired-banner">
          @if (isBetaMode) {
            <div class="banner-beta-message">
              <p class="banner-beta-thanks">🙏 Merci pour votre participation à la phase bêta d'TCI !</p>
              <p class="banner-beta-sub">Si vous désirez continuer, contactez l'administrateur.</p>
            </div>
            <div class="banner-actions">
              <button class="btn-banner btn-banner-primary" (click)="toggleContactPopup()">
                💬 Contacter l'administrateur
              </button>
            </div>
          } @else {
            <p>⚠️ L'accès Positions tarifaires est suspendu (plan expiré ou quota épuisé).</p>
            <div class="banner-actions">
              <a routerLink="/choose-plan" class="btn-banner btn-banner-primary">Gérer mon plan</a>
            </div>
          }
        </div>
      }
      <nav class="organization-navbar">
        <div class="org-nav-links">
          <a routerLink="/dashboard" routerLinkActive="router-link-active" class="org-nav-link">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12L12 3l9 9"/><path d="M5 10v11h5v-6h4v6h5V10"/></svg>
            <span>Tableau de bord</span>
          </a>
          <a routerLink="/organization/account" routerLinkActive="router-link-active" class="org-nav-link">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            <span>Mon organisation</span>
          </a>
          <a routerLink="/organization/stats" routerLinkActive="router-link-active" class="org-nav-link">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>
            <span>Crédits</span>
          </a>
          @if (orgQuota !== null) {
            <div class="credits-counter" [class.credits-low]="creditsRatio <= 0.2" [class.credits-medium]="creditsRatio > 0.2 && creditsRatio <= 0.5">
              <div class="credits-label">
                <span>Crédits restants</span>
                <span class="credits-numbers">{{ creditsRemaining }} / {{ orgQuota }}</span>
              </div>
              <div class="credits-bar-track">
                <div class="credits-bar-fill" [style.width.%]="creditsRatio * 100"></div>
              </div>
            </div>
          }
          @if (!isBetaMode) {
            <a routerLink="/organization/invoices" routerLinkActive="router-link-active" class="org-nav-link invoices-link">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
              <span>Factures</span>
              @if (newInvoicesCount > 0 || overdueInvoicesCount > 0) {
                <span class="invoice-badge" [class.overdue-badge]="overdueInvoicesCount > 0">
                  {{ overdueInvoicesCount > 0 ? overdueInvoicesCount : newInvoicesCount }}
                </span>
              }
            </a>
            <a routerLink="/organization/quote-requests" routerLinkActive="router-link-active" class="org-nav-link">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M12 12v3M10.5 13.5h3"/></svg>
              <span>Demandes de devis</span>
            </a>
          }
          <a routerLink="/aide" routerLinkActive="router-link-active" class="org-nav-link">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><path d="M12 6v6M12 15h.01"/></svg>
            <span>Aide</span>
          </a>
        </div>
      </nav>
    }
    
    @if (isAuthenticated$ | async) {
      @if (isAdmin()) {
        <nav class="admin-navbar">
          <div class="admin-nav-links">
            <a routerLink="/admin/stats" class="admin-nav-link">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
              Stats
            </a>
            <a routerLink="/admin/organizations" class="admin-nav-link">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18M2 22h20M10 7h.01M14 7h.01M10 11h.01M14 11h.01M10 15h.01M14 15h.01"/></svg>
              Organisations
            </a>
            <a routerLink="/admin/invoices" class="admin-nav-link">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
              Factures
            </a>
            <a routerLink="/admin/quote-requests" routerLinkActive="router-link-active" class="admin-nav-link">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M12 12v3M10.5 13.5h3"/></svg>
              Demandes de devis
            </a>
            <a routerLink="/admin/pending-registrations" class="admin-nav-link">
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              Inscriptions en attente
            </a>
          </div>
        </nav>
      }
    }
  `,
  styles: [`
    /* ═══ ENVIRONMENT BADGE ═══ */
    .env-badge {
      font-size: 0.6rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
      margin-left: 0.5rem;
      vertical-align: middle;
    }
    .env-prod {
      background: #22c55e;
      color: white;
    }
    .env-staging {
      background: #ef4444;
      color: white;
      animation: staging-pulse 2s infinite;
    }
    @keyframes staging-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    /* ═══ NAVBAR — Neumorphism ═══ */
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 2rem;
      height: var(--navbar-height, 72px);
      background: var(--neu-bg, #E0E5EC);
      color: var(--neu-text-primary, #3D4852);
      box-shadow: 0 4px 12px rgba(163,177,198,0.5), 0 -2px 8px rgba(255,255,255,0.4);
      position: sticky;
      top: 0;
      z-index: 1000;
    }

    .nav-brand a {
      color: var(--neu-text-heading, #2D3748);
      text-decoration: none;
      font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      transition: all var(--neu-transition, 0.3s ease-out);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .nav-brand a:hover { opacity: 0.85; }

    .brand-country-code {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--neu-bg, #E0E5EC);
      font-weight: 700;
      font-size: 0.75rem;
      color: var(--neu-accent, #6C63FF);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
    }

    /* ─── Hamburger ─── */
    .hamburger {
      display: none;
      flex-direction: column;
      justify-content: center;
      gap: 5px;
      width: 44px;
      height: 44px;
      padding: 10px;
      background: var(--neu-bg, #E0E5EC);
      border: none;
      border-radius: var(--neu-radius-inner, 12px);
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
      cursor: pointer;
      transition: all var(--neu-transition, 0.3s ease-out);
      z-index: 1002;
    }

    .hamburger span {
      display: block;
      width: 22px;
      height: 2px;
      background: var(--neu-text-primary, #3D4852);
      border-radius: 2px;
      transition: all var(--neu-transition, 0.3s ease-out);
    }

    .hamburger.active {
      box-shadow: var(--neu-inset-sm, inset 3px 3px 6px rgba(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5));
    }

    .hamburger.active span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    .hamburger.active span:nth-child(2) { opacity: 0; }
    .hamburger.active span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

    /* ─── Nav Links ─── */
    .nav-links {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .nav-link {
      color: var(--neu-text-primary, #3D4852);
      text-decoration: none;
      padding: 0.6rem 1.1rem;
      border-radius: var(--neu-radius-inner, 12px);
      transition: all var(--neu-transition, 0.3s ease-out);
      font-weight: 500;
      font-size: 0.9rem;
      background: transparent;
      border: none;
      cursor: pointer;
      min-height: var(--touch-target, 44px);
      display: inline-flex;
      align-items: center;
    }

    .nav-link:hover {
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
      transform: translateY(-1px);
    }

    .nav-link:active {
      box-shadow: var(--neu-inset-sm, inset 3px 3px 6px rgba(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5));
      transform: translateY(0);
    }

    .hscode-link {
      font-weight: 700;
      color: var(--neu-accent-secondary, #2DD4BF);
      background: var(--neu-bg, #E0E5EC);
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
      border-radius: var(--neu-radius-button, 16px);
    }

    .hscode-link:hover {
      box-shadow: var(--neu-extruded-hover, 12px 12px 20px rgba(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6));
    }

    .hscode-link-blocked {
      color: var(--neu-accent-danger, #E53E3E);
      font-weight: 700;
      background: var(--neu-bg, #E0E5EC);
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
      border-radius: var(--neu-radius-button, 16px);
      border: none;
      padding: 0.6rem 1.1rem;
      cursor: pointer;
      transition: all var(--neu-transition, 0.3s ease-out);
      min-height: var(--touch-target, 44px);
    }

    .hscode-link-blocked:hover {
      box-shadow: var(--neu-inset-sm, inset 3px 3px 6px rgba(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5));
    }

    .contact-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 0.9rem;
      color: var(--neu-text-primary, #3D4852);
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .pricing-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .alerts-link, .invoices-link { position: relative; }

    .alert-badge, .invoice-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: var(--neu-accent-danger, #E53E3E);
      color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      font-weight: 700;
      box-shadow: var(--neu-extruded-sm);
      animation: pulse 2s infinite;
    }

    .invoice-badge { background: var(--neu-accent-secondary, #2DD4BF); }
    .invoice-badge.overdue-badge { background: var(--neu-accent-danger, #E53E3E); }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    /* ─── Nav Auth (desktop) ─── */
    .nav-auth {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .nav-auth-mobile { display: none; }

    .user-info {
      font-weight: 500;
      font-size: 0.85rem;
      padding: 0.5rem 1rem;
      background: var(--neu-bg, #E0E5EC);
      border-radius: var(--neu-radius-pill, 9999px);
      box-shadow: var(--neu-inset-sm, inset 3px 3px 6px rgba(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5));
      color: var(--neu-text-muted, #6B7280);
    }

    .btn {
      padding: 0.6rem 1.4rem;
      border: none;
      border-radius: var(--neu-radius-button, 16px);
      cursor: pointer;
      transition: all var(--neu-transition, 0.3s ease-out);
      font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
      font-weight: 600;
      font-size: 0.85rem;
      min-height: var(--touch-target, 44px);
    }

    .btn-primary {
      background: var(--neu-accent, #6C63FF);
      color: white;
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: var(--neu-extruded-hover, 12px 12px 20px rgba(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6));
      background: var(--neu-accent-hover, #5A52D5);
    }

    .btn-primary:active {
      transform: translateY(0.5px);
      box-shadow: var(--neu-inset-sm);
    }

    .btn-outline, .btn-secondary {
      background: var(--neu-bg, #E0E5EC);
      color: var(--neu-accent, #6C63FF);
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
    }

    .btn-outline:hover, .btn-secondary:hover {
      transform: translateY(-1px);
      box-shadow: var(--neu-extruded-hover);
    }

    .btn-outline:active, .btn-secondary:active {
      transform: translateY(0.5px);
      box-shadow: var(--neu-inset-sm);
    }

    /* ═══ TRIAL EXPIRED BANNER ═══ */
    .trial-expired-banner {
      background: var(--neu-bg-dark, #D1D9E6);
      color: var(--neu-text-primary, #3D4852);
      padding: 0.75rem 2rem;
      text-align: center;
      box-shadow: var(--neu-inset, inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5));
      z-index: 997;
      position: relative;
    }

    .banner-beta-message { margin-bottom: 0.5rem; }
    .banner-beta-thanks { margin: 0; font-weight: 700; font-size: 0.95rem; color: var(--neu-text-heading, #2D3748); }
    .banner-beta-sub { margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--neu-text-muted, #6B7280); }
    .trial-expired-banner p { margin: 0; font-weight: 600; font-size: 0.95rem; }
    .trial-expired-banner a { color: var(--neu-accent, #6C63FF); text-decoration: underline; font-weight: 700; }
    .trial-expired-banner a:hover { text-decoration: none; }

    .banner-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
      margin-top: 0.5rem;
      flex-wrap: wrap;
    }

    .btn-banner {
      padding: 0.5rem 1.25rem;
      border-radius: var(--neu-radius-button, 16px);
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      text-decoration: none;
      border: none;
      transition: all var(--neu-transition, 0.3s ease-out);
      display: inline-block;
      min-height: var(--touch-target, 44px);
    }

    .btn-banner-primary {
      background: var(--neu-accent, #6C63FF);
      color: white;
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-banner-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--neu-extruded-hover); }
    .btn-banner-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-banner-secondary {
      background: var(--neu-bg, #E0E5EC);
      color: var(--neu-accent, #6C63FF);
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-banner-secondary:hover { transform: translateY(-1px); box-shadow: var(--neu-extruded-hover); }

    /* ═══ ADMIN NAVBAR ═══ */
    .admin-navbar {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 0.5rem 2rem;
      background: var(--neu-bg, #E0E5EC);
      box-shadow: 0 3px 8px rgba(163,177,198,0.4);
      position: relative;
      z-index: 999;
    }

    .admin-nav-links {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .admin-nav-link {
      color: var(--neu-text-primary, #3D4852);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: var(--neu-radius-inner, 12px);
      transition: all var(--neu-transition, 0.3s ease-out);
      font-weight: 500;
      font-size: 0.9rem;
      min-height: var(--touch-target, 44px);
      display: inline-flex;
      align-items: center;
    }

    .admin-nav-link:hover {
      box-shadow: var(--neu-extruded-sm);
      transform: translateY(-1px);
    }

    .admin-nav-link:active,
    .admin-nav-link.router-link-active {
      box-shadow: var(--neu-inset-sm);
      color: var(--neu-accent-secondary, #2DD4BF);
    }

    /* ═══ ORGANIZATION SIDEBAR ═══ */
    .organization-navbar {
      position: fixed;
      left: 0;
      top: 0;
      width: var(--sidebar-width, 240px);
      height: 100vh;
      padding: 1rem 0;
      background: var(--neu-bg, #E0E5EC);
      box-shadow: 6px 0 16px rgba(163,177,198,0.5), -2px 0 8px rgba(255,255,255,0.3);
      z-index: 998;
      overflow-y: auto;
      padding-top: calc(var(--navbar-height, 72px) + 12px);
      box-sizing: border-box;
    }

    .org-nav-links {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0 0.75rem;
    }

    .nav-icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .admin-nav-link {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .org-nav-link {
      color: var(--neu-text-primary, #3D4852);
      text-decoration: none;
      padding: 0.7rem 1rem;
      border-radius: var(--neu-radius-inner, 12px);
      transition: all var(--neu-transition, 0.3s ease-out);
      font-weight: 500;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      width: 100%;
      box-sizing: border-box;
      min-height: var(--touch-target, 44px);
    }

    .org-nav-link:hover {
      box-shadow: var(--neu-extruded-sm, 5px 5px 10px rgba(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5));
      transform: translateX(2px);
    }

    .org-nav-link:active {
      box-shadow: var(--neu-inset-sm);
      transform: translateX(0);
    }

    .org-nav-link.router-link-active {
      box-shadow: var(--neu-inset, inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5));
      color: var(--neu-accent-secondary, #2DD4BF);
      font-weight: 600;
    }

    /* ─── Credits counter (sidebar) ─── */
    .credits-counter {
      margin: 0.5rem 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--neu-bg, #E0E5EC);
      border-radius: var(--neu-radius-inner, 12px);
      box-shadow: var(--neu-inset, inset 6px 6px 10px rgba(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5));
      box-sizing: border-box;
      --cc: var(--neu-accent-secondary, #38B2AC);
    }
    .credits-counter.credits-medium { --cc: var(--neu-accent-warning, #ED8936); }
    .credits-counter.credits-low { --cc: var(--neu-accent-danger, #E53E3E); }
    .credits-label { display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: var(--neu-text-muted, #6B7280); margin-bottom: 0.4rem; }
    .credits-numbers { font-weight: 700; font-size: 0.8rem; color: var(--cc); font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif); }
    .credits-bar-track { height: 6px; background: var(--neu-bg-dark, #D1D9E6); border-radius: var(--neu-radius-pill, 9999px); overflow: hidden; box-shadow: var(--neu-inset-sm); }
    .credits-bar-fill { height: 100%; background: var(--cc); border-radius: var(--neu-radius-pill, 9999px); transition: width 0.4s ease-out; }

    /* ═══ MODALS ═══ */
    .renewal-modal-overlay, .contact-overlay {
      position: fixed;
      inset: 0;
      background: rgba(61, 72, 82, 0.35);
      backdrop-filter: blur(8px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .renewal-modal, .contact-popup {
      background: var(--neu-bg, #E0E5EC);
      border-radius: var(--neu-radius-container, 32px);
      box-shadow: var(--neu-extruded-hover, 12px 12px 20px rgba(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6));
      padding: 2rem;
      max-width: 420px;
      width: 90%;
      text-align: center;
      color: var(--neu-text-primary, #3D4852);
      position: relative;
      border: none;
    }

    .renewal-modal h3 { margin-bottom: 0.75rem; font-size: 1.25rem; color: var(--neu-accent-danger, #E53E3E); font-family: var(--font-display); }
    .renewal-modal p { color: var(--neu-text-muted, #6B7280); margin-bottom: 1.5rem; }

    .renewal-modal-actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .btn-modal {
      padding: 0.75rem 1.5rem;
      border-radius: var(--neu-radius-button, 16px);
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      text-decoration: none;
      border: none;
      transition: all var(--neu-transition, 0.3s ease-out);
      display: block;
      min-height: var(--touch-target, 44px);
    }

    .btn-modal-primary {
      background: var(--neu-accent, #6C63FF);
      color: white;
      box-shadow: var(--neu-extruded-sm);
    }
    .btn-modal-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--neu-extruded-hover); }
    .btn-modal-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-modal-secondary { background: var(--neu-bg, #E0E5EC); color: var(--neu-accent, #6C63FF); box-shadow: var(--neu-extruded-sm); }
    .btn-modal-secondary:hover { transform: translateY(-1px); box-shadow: var(--neu-extruded-hover); }

    .modal-close-btn {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: var(--neu-bg, #E0E5EC);
      border: none;
      color: var(--neu-text-muted, #6B7280);
      font-size: 1.1rem;
      cursor: pointer;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--neu-extruded-sm);
      transition: all var(--neu-transition, 0.3s ease-out);
    }
    .modal-close-btn:hover { box-shadow: var(--neu-inset-sm); color: var(--neu-text-primary, #3D4852); }

    .contact-popup h3 { color: var(--neu-accent, #6C63FF); font-size: 1.3rem; margin: 0 0 0.5rem; font-family: var(--font-display); }
    .contact-tagline { color: var(--neu-text-muted, #6B7280); font-size: 0.9rem; margin: 0 0 1.5rem; font-style: italic; }
    .contact-info p { margin: 0.6rem 0; font-size: 1rem; color: var(--neu-text-primary, #3D4852); text-align: left; }
    .contact-info a { color: var(--neu-accent, #6C63FF); text-decoration: none; font-weight: 600; }
    .contact-info a:hover { color: var(--neu-accent-hover, #5A52D5); }

    /* ═══ RESPONSIVE ═══ */
    @media (max-width: 768px) {
      .navbar {
        padding: 0 1rem;
        height: var(--navbar-height, 60px);
      }

      .hamburger { display: flex; }

      .nav-links {
        display: none;
        position: fixed;
        top: var(--navbar-height, 60px);
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--neu-bg, #E0E5EC);
        flex-direction: column;
        padding: 1.5rem;
        gap: 0.5rem;
        z-index: 1001;
        overflow-y: auto;
        box-shadow: 0 8px 24px rgba(163,177,198,0.6);
      }

      .nav-links.mobile-open { display: flex; }

      .nav-link, .contact-btn, .hscode-link, .hscode-link-blocked {
        width: 100%;
        text-align: left;
        padding: 0.85rem 1.25rem;
        font-size: 1rem;
        min-height: var(--touch-target, 44px);
      }

      .nav-auth { display: none; }
      .nav-auth-mobile {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-top: 1rem;
        padding-top: 1rem;
      }

      .nav-auth-mobile .btn {
        width: 100%;
        text-align: center;
        padding: 0.85rem;
      }

      .organization-navbar {
        position: fixed;
        left: -100%;
        width: 280px;
        transition: left var(--neu-transition, 0.3s ease-out);
        padding-top: calc(var(--navbar-height, 60px) + 12px);
      }

      .admin-navbar { padding: 0.5rem 1rem; }
      .admin-nav-links { gap: 0.25rem; }
      .admin-nav-link { padding: 0.5rem 0.75rem; font-size: 0.8rem; }
    }

    @media (min-width: 769px) {
      .hamburger { display: none; }
      .nav-auth-mobile { display: none; }
    }

    @media (max-width: 1024px) and (min-width: 769px) {
      .nav-link { padding: 0.5rem 0.85rem; font-size: 0.85rem; }
      .btn { padding: 0.5rem 1rem; font-size: 0.8rem; }
    }
  `]
})
export class NavbarComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private invoiceService = inject(InvoiceService);
  private notificationService = inject(NotificationService);
  private marketProfileService = inject(MarketProfileService);
  private organizationAccountService = inject(OrganizationAccountService);
  private paymentService = inject(PaymentService);
  private userService = inject(UserService);

  showRenewalModal = false;
  isRenewing = false;
  showContactPopup = false;
  mobileMenuOpen = signal(false);

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleContactPopup(): void {
    this.showContactPopup = !this.showContactPopup;
  }

  isBetaMode = environment.betaMode === true; // Pour basculer facilement plus tard

  orgPricingPlanId: number | null = null;

  isAuthenticated$!: Observable<boolean>;
  isOrganizationAccount$!: Observable<boolean>;
  isCollaboratorAccount$!: Observable<boolean>;
  countryCode$!: Observable<string | null>;
  canMakeRequests$!: Observable<boolean>;
  alertCount = 0;
  newInvoicesCount = 0;
  overdueInvoicesCount = 0;
  orgQuota: number | null = null;
  creditsRemaining = 0;
  creditsRatio = 1;
  private previousInvoicesCount: number | null = null;
  private previousOverdueInvoicesCount: number | null = null;
  private refreshSubscription?: Subscription;

  ngOnInit() {
    this.isAuthenticated$ = this.authService.isAuthenticated();
    this.isOrganizationAccount$ = this.authService.isOrganizationAccount();
    this.isCollaboratorAccount$ = this.authService.isCollaboratorAccount();

    // Vérifier si l'organisation peut faire des requêtes (essai non expiré)
    // Par défaut, on suppose que les requêtes sont autorisées
    this.canMakeRequests$ = combineLatest([
      this.isOrganizationAccount$,
      this.isCollaboratorAccount$
    ]).pipe(
      switchMap(([isOrg, isCollab]) => {
        const hasOrgOrCollabAccount = isOrg || isCollab;
        if (!hasOrgOrCollabAccount) {
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
      })
    );

    // Charger le code pays du profil de marché configuré dans l'environnement
    // Le profil de marché est défini par la variable d'environnement MARKET_VERSION
    if (environment.marketVersion) {
      this.countryCode$ = this.marketProfileService.getMarketProfileByVersion(environment.marketVersion).pipe(
        map(profile => profile.countryCodeIsoAlpha2),
        catchError(err => {
          console.error('Erreur lors du chargement du profil de marché:', err);
          return of(null);
        })
      );
    } else {
      this.countryCode$ = of(null);
    }

    this.loadAlertCount();
    this.loadNewInvoicesCount();
    this.loadOverdueInvoicesCount();
    this.loadOrgQuota();
    // Rafraîchir les compteurs toutes les 30 secondes
    this.refreshSubscription = interval(30000).subscribe(() => {
      this.loadAlertCount();
      this.loadNewInvoicesCount();
      this.loadOverdueInvoicesCount();
      this.loadOrgQuota();
    });
  }

  ngOnDestroy() {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  loadAlertCount() {
    // Charger les alertes pour les comptes organisation et collaborateur
    this.isOrganizationAccount$.pipe(take(1)).subscribe(isOrganization => {
      if (isOrganization) {
        this.alertService.getMyAlertsCount().subscribe({
          next: (response) => {
            this.alertCount = response.count;
          },
          error: (err) => {
            console.error('Erreur lors du chargement du compteur d\'alertes:', err);
            this.alertCount = 0;
          }
        });
      } else {
        // Vérifier si c'est un collaborateur
        this.isCollaboratorAccount$.pipe(take(1)).subscribe(isCollaborator => {
          if (isCollaborator) {
            this.alertService.getMyAlertsCount().subscribe({
              next: (response) => {
                this.alertCount = response.count;
              },
              error: (err) => {
                console.error('Erreur lors du chargement du compteur d\'alertes:', err);
                this.alertCount = 0;
              }
            });
          } else {
            this.alertCount = 0;
          }
        });
      }
    });
  }

  loadOrgQuota() {
    this.isOrganizationAccount$.pipe(take(1)).subscribe(isOrganization => {
      if (!isOrganization) return;
      this.organizationAccountService.getMyOrganization().subscribe({
        next: (org: OrganizationInfo) => {
          if (org.monthlyQuota != null) {
            this.orgQuota = org.monthlyQuota;
            const used = org.currentMonthUsage ?? 0;
            this.creditsRemaining = Math.max(0, this.orgQuota - used);
            this.creditsRatio = this.orgQuota > 0 ? this.creditsRemaining / this.orgQuota : 0;
          } else {
            this.orgQuota = null;
          }
        },
        error: () => { this.orgQuota = null; }
      });
    });
  }

  loadNewInvoicesCount() {
    this.isOrganizationAccount$.pipe(take(1)).subscribe(isOrganization => {
      if (isOrganization) {
        this.invoiceService.getNewInvoicesCount().subscribe({
          next: (response) => {
            const newCount = response.count;

            // Afficher une notification si une nouvelle facture est détectée
            // (seulement après la première vérification, pour éviter de notifier au chargement initial)
            if (this.previousInvoicesCount !== null && newCount > this.previousInvoicesCount) {
              const diff = newCount - this.previousInvoicesCount;
              if (diff === 1) {
                this.notificationService.info(`Une nouvelle facture est disponible !`);
              } else {
                this.notificationService.info(`${diff} nouvelles factures sont disponibles !`);
              }
            }

            this.newInvoicesCount = newCount;
            // Initialiser ou mettre à jour le compteur précédent
            if (this.previousInvoicesCount === null) {
              // Première vérification : initialiser sans notifier
              this.previousInvoicesCount = newCount;
            } else {
              // Mettre à jour pour les vérifications suivantes
              this.previousInvoicesCount = newCount;
            }
          },
          error: (err) => {
            console.error('Erreur lors du chargement du compteur de factures:', err);
            this.newInvoicesCount = 0;
          }
        });
      } else {
        this.newInvoicesCount = 0;
        this.previousInvoicesCount = null;
      }
    });
  }

  loadOverdueInvoicesCount() {
    this.isOrganizationAccount$.pipe(take(1)).subscribe(isOrganization => {
      if (isOrganization) {
        this.invoiceService.getOverdueInvoicesCount().subscribe({
          next: (response) => {
            const newCount = response.count;

            // Afficher une notification si une nouvelle facture en retard est détectée
            if (this.previousOverdueInvoicesCount !== null && newCount > this.previousOverdueInvoicesCount) {
              const diff = newCount - this.previousOverdueInvoicesCount;
              if (diff === 1) {
                this.notificationService.warning(`Une facture est maintenant en retard !`);
              } else {
                this.notificationService.warning(`${diff} factures sont maintenant en retard !`);
              }
            }

            this.overdueInvoicesCount = newCount;
            if (this.previousOverdueInvoicesCount === null) {
              this.previousOverdueInvoicesCount = newCount;
            } else {
              this.previousOverdueInvoicesCount = newCount;
            }
          },
          error: (err) => {
            console.error('Erreur lors du chargement du compteur de factures en retard:', err);
            this.overdueInvoicesCount = 0;
          }
        });
      } else {
        this.overdueInvoicesCount = 0;
        this.previousOverdueInvoicesCount = null;
      }
    });
  }

  openRenewalModal() {
    if (!this.orgPricingPlanId) {
      this.userService.getMyOrganization().pipe(take(1)).subscribe({
        next: (org) => {
          this.orgPricingPlanId = org?.pricingPlanId ?? null;
          this.showRenewalModal = true;
        },
        error: () => { this.showRenewalModal = true; }
      });
    } else {
      this.showRenewalModal = true;
    }
  }

  closeRenewalModal() {
    this.showRenewalModal = false;
  }

  renewCurrentPlan() {
    if (!this.orgPricingPlanId) {
      this.router.navigate(['/organization/stats']);
      this.closeRenewalModal();
      return;
    }
    this.isRenewing = true;
    this.paymentService.createCheckout({
      pricingPlanId: this.orgPricingPlanId,
      successUrl: `${window.location.origin}/organization/stats`,
      cancelUrl: `${window.location.origin}/organization/stats`
    }).subscribe({
      next: (response) => { window.location.href = response.url; },
      error: () => {
        this.isRenewing = false;
        this.router.navigate(['/organization/stats']);
        this.closeRenewalModal();
      }
    });
  }

  login() {
    this.router.navigate(['/auth/login']);
  }

  goToRegister() {
    this.router.navigate(['/auth/login']);
  }

  logout() {
    this.authService.logout();
  }

  /*login() {
    this.authService.login();
  }
  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }*/

  getUserInfo() {
    return this.authService.getUserInfo();
  }

  isAdmin(): boolean {
    return this.authService.hasRole('ADMIN');
  }
}
