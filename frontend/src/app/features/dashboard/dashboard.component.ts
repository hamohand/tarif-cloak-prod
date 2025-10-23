import { Component, OnInit, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [JsonPipe],
  template: `
    <div class="dashboard-container">
      <h2>Tableau de bord</h2>

      <div class="user-info-card">
        <h3>Informations utilisateur</h3>
        Prénom Nom : {{ userInfo.name }}<br>
        Username : {{ userInfo.username }}<br>
        Email : {{ userInfo.email}}
        <pre>{{ userInfo | json }}</pre>
      </div>

      <div class="stats-container">
        <div class="stat-card">
          <h4>📈 Projets</h4>
          <p>5 projets actifs</p>
        </div>

        <div class="stat-card">
          <h4>👥 Utilisateurs</h4>
          <p>12 membres</p>
        </div>

        <div class="stat-card">
          <h4>✅ Tâches</h4>
          <p>24 tâches terminées</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 2rem;
    }

    h2 {
      color: #2c3e50;
      margin-bottom: 2rem;
    }

    .user-info-card {
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
    }

    .user-info-card h3 {
      margin-top: 0;
      color: #2c3e50;
    }

    pre {
      background: white;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }

    .stats-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-top: 2rem;
    }

    .stat-card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }

    .stat-card h4 {
      color: #2c3e50;
      margin-bottom: 0.5rem;
    }
  `]
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  userInfo: any;

  ngOnInit() {
    this.userInfo = this.authService.getUserInfo();
  }
}
