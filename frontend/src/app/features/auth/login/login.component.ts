// features/auth/login/login.component.ts
import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h2>Connexion</h2>
        <p>Connectez-vous pour accéder à votre espace</p>

        <button (click)="login()" class="login-button">
          Se connecter avec Keycloak
        </button>

        <div class="login-footer">
          <p>Pas encore de compte ? <a routerLink="/auth/register">Créer un compte</a></p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 70vh;
    }

    .login-card {
      background: white;
      padding: 3rem;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 400px;
      width: 100%;
    }

    h2 {
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    p {
      color: #7f8c8d;
      margin-bottom: 2rem;
    }

    .login-button {
      background-color: #3498db;
      color: white;
      padding: 1rem 2rem;
      font-size: 1rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      width: 100%;
      transition: background-color 0.3s;
    }

    .login-button:hover {
      background-color: #2980b9;
    }

    .login-footer {
      margin-top: 2rem;
    }

    .login-footer a {
      color: #3498db;
      text-decoration: none;
    }

    .login-footer a:hover {
      text-decoration: underline;
    }
  `]
})
export class LoginComponent {
  private authService = inject(AuthService);

  login() {
    this.authService.login();
  }
}
