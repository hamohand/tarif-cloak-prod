import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import {AsyncPipe} from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, AsyncPipe],
  template: `
    <nav class="navbar">
      <div class="nav-brand">
        <a routerLink="/">Enclume-Numérique</a>
      </div>

      <div class="nav-links">
        <a routerLink="/" class="nav-link">Accueil</a>
        @if (isAuthenticated$ | async) {
          <a routerLink="/recherche" class="nav-link">Tariff</a>
        }
      </div>

      <div class="nav-auth">
        @if (isAuthenticated$ | async) {
          <span class="user-info">Bienvenue {{ getUserInfo()?.preferred_username }}</span>
          <button (click)="logout()" class="btn btn-outline">Déconnexion</button>
        } @else {
          <button (click)="login()" class="btn btn-primary">Connexion</button>
        }
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      position: relative;
      z-index: 1000;
    }

    .navbar::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #3498db, #2ecc71, #3498db);
      background-size: 200% 100%;
      animation: shimmer 3s linear infinite;
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .nav-brand a {
      color: white;
      text-decoration: none;
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      transition: all 0.3s ease;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .nav-brand a:hover {
      transform: translateY(-2px);
      text-shadow: 2px 4px 8px rgba(0, 0, 0, 0.3);
    }

    .nav-links {
      display: flex;
      gap: 1rem;
    }

    .nav-link {
      color: white;
      text-decoration: none;
      padding: 0.6rem 1.2rem;
      border-radius: 6px;
      transition: all 0.3s ease;
      position: relative;
      font-weight: 500;
      overflow: hidden;
    }

    .nav-link::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.5s ease;
    }

    .nav-link:hover::before {
      left: 100%;
    }

    .nav-link:hover {
      background-color: rgba(255, 255, 255, 0.15);
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }

    .nav-auth {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .user-info {
      margin-right: 1rem;
      font-weight: 500;
      padding: 0.5rem 1rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .btn {
      padding: 0.6rem 1.4rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-weight: 600;
      letter-spacing: 0.3px;
      position: relative;
      overflow: hidden;
    }

    .btn::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      transform: translate(-50%, -50%);
      transition: width 0.6s, height 0.6s;
    }

    .btn:hover::before {
      width: 300px;
      height: 300px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(52, 152, 219, 0.4);
    }

    .btn-outline {
      background-color: transparent;
      border: 2px solid white;
      color: white;
      box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
    }

    .btn-outline:hover {
      background-color: rgba(255, 255, 255, 0.15);
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(255, 255, 255, 0.2);
    }

    .btn:active {
      transform: translateY(0);
    }
  `]
})
export class NavbarComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  isAuthenticated$!: Observable<boolean>;

  ngOnInit() {
    this.isAuthenticated$ = this.authService.isAuthenticated();
  }
  login() {
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
}
