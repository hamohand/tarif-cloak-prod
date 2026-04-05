import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, Organization, OrganizationUser, CreateOrganizationRequest, UpdateOrganizationRequest, UpdateQuotaRequest, AddUserToOrganizationRequest } from '../../../core/services/admin.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-organizations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="organizations-container">
      <h2>🏢 Gestion des Organisations</h2>

      <!-- Barre d'actions et recherche -->
      <div class="actions-bar">
        <button class="btn btn-primary" (click)="showCreateForm = true">+ Créer une organisation</button>
        <div class="search-bar">
          <input type="text" 
                 [(ngModel)]="searchTerm" 
                 (input)="filterOrganizations()" 
                 placeholder="Rechercher par nom ou email..." 
                 class="search-input" />
          <select [(ngModel)]="viewMode" (change)="filterOrganizations()" class="view-select">
            <option value="cards">Vue cartes</option>
            <option value="table">Vue tableau</option>
          </select>
        </div>
      </div>

      <!-- Formulaire de création -->
      @if (showCreateForm) {
        <div class="form-card">
          <h3>Créer une nouvelle organisation</h3>
          <form (ngSubmit)="createOrganization()">
            <div class="form-group">
              <label for="newName">Nom *</label>
              <input type="text" id="newName" [(ngModel)]="newOrganization.name" name="newName" required />
            </div>
            <div class="form-group">
              <label for="newEmail">Email</label>
              <input type="email" id="newEmail" [(ngModel)]="newOrganization.email" name="newEmail" />
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Créer</button>
              <button type="button" class="btn btn-secondary" (click)="cancelCreate()">Annuler</button>
            </div>
          </form>
        </div>
      }

      <!-- Liste des organisations -->
      <div class="organizations-list">
        @if (loading) {
          <p>Chargement...</p>
        } @else if (filteredOrganizations.length === 0) {
          <p class="empty-message">Aucune organisation trouvée.</p>
        } @else if (viewMode === 'table') {
          <!-- Vue tableau -->
          <table class="organizations-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Statut</th>
                <th>Email</th>
                <th>Utilisateurs</th>
                <th>Quota mensuel (crédits)</th>
                <th>Utilisation ce mois (crédits)</th>
                <th>% Utilisé</th>
                <th>Date de création</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (org of filteredOrganizations; track org.id) {
                <tr [class.org-disabled]="org.enabled === false">
                  <td><strong>{{ org.name }}</strong></td>
                  <td>
                    @if (org.enabled === false) {
                      <span class="status-badge status-disabled">Désactivée</span>
                    } @else {
                      <span class="status-badge status-active">Active</span>
                    }
                  </td>
                  <td>{{ org.email || '-' }}</td>
                  <td>{{ org.userCount || 0 }}</td>
                  <td>
                    {{ org.monthlyQuota !== null && org.monthlyQuota !== undefined ? org.monthlyQuota : 'Illimité' }}
                  </td>
                  <td>
                    <span [class.quota-warning]="getQuotaPercentage(org) >= 80" 
                          [class.quota-danger]="getQuotaPercentage(org) >= 100">
                      {{ org.currentMonthUsage || 0 }}
                    </span>
                  </td>
                  <td>
                    @if (org.monthlyQuota !== null && org.monthlyQuota !== undefined) {
                      <div class="quota-progress-mini">
                        <div class="quota-progress-bar-mini">
                          <div class="quota-progress-fill-mini" 
                               [style.width.%]="getQuotaPercentage(org)"
                               [class.quota-warning]="getQuotaPercentage(org) >= 80"
                               [class.quota-danger]="getQuotaPercentage(org) >= 100">
                          </div>
                        </div>
                        <span>{{ getQuotaPercentage(org).toFixed(1) }}%</span>
                      </div>
                    } @else {
                      <span>-</span>
                    }
                  </td>
                  <td>{{ formatDate(org.createdAt) }}</td>
                  <td>
                    <button class="btn btn-sm btn-secondary" (click)="toggleEdit(org)">✏️</button>
                    <button class="btn btn-sm btn-info" (click)="toggleUsers(org.id)">👥</button>
                    @if ((org.trialRenewCount ?? 0) < 1) {
                      <button class="btn btn-sm btn-primary" (click)="resetOrganizationPlan(org)" title="Réinitialiser le plan">🔄</button>
                    } @else {
                      <span class="badge badge-renewed" title="Déjà renouvelé une fois">✅ Renouvelé</span>
                    }
                    @if (org.enabled === false) {
                      <button class="btn btn-sm btn-success" (click)="enableOrganization(org)" title="Réactiver">✅</button>
                    } @else {
                      <button class="btn btn-sm btn-warning" (click)="disableOrganization(org)" title="Désactiver">⛔</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <!-- Vue cartes -->
          @for (org of filteredOrganizations; track org.id) {
            <div class="organization-card" [class.org-disabled]="org.enabled === false">
              <div class="org-header">
                <div class="org-info">
                  <h3>
                    {{ org.name }}
                    @if (org.enabled === false) {
                      <span class="status-badge status-disabled">Désactivée</span>
                    }
                  </h3>
                  @if (org.email) {
                    <p class="org-email">📧 {{ org.email }}</p>
                  }
                  <p class="org-meta">
                    Créée le {{ formatDate(org.createdAt) }}
                    @if (org.userCount !== undefined) {
                      • {{ org.userCount }} utilisateur(s)
                    }
                  </p>
                </div>
                <div class="org-actions">
                  <button class="btn btn-sm btn-secondary" (click)="toggleEdit(org)">✏️ Modifier</button>
                  <button class="btn btn-sm btn-info" (click)="toggleUsers(org.id)">👥 Utilisateurs</button>
                  @if ((org.trialRenewCount ?? 0) < 1) {
                    <button class="btn btn-sm btn-primary" (click)="resetOrganizationPlan(org)">🔄 Réinitialiser</button>
                  } @else {
                    <span class="badge badge-renewed">✅ Déjà renouvelé</span>
                  }
                  @if (org.enabled === false) {
                    <button class="btn btn-sm btn-success" (click)="enableOrganization(org)">✅ Réactiver</button>
                  } @else {
                    <button class="btn btn-sm btn-warning" (click)="disableOrganization(org)">⛔ Désactiver</button>
                  }
                </div>
              </div>

              <!-- Quota -->
              <div class="quota-section">
                <label>Quota mensuel:</label>
                @if (editingQuotaId === org.id) {
                  <div class="quota-edit">
                    <input type="number" [(ngModel)]="editingQuota" min="0" placeholder="Illimité" />
                    <button class="btn btn-sm btn-primary" (click)="saveQuota(org.id)">💾</button>
                    <button class="btn btn-sm btn-secondary" (click)="cancelQuotaEdit()">✖️</button>
                  </div>
                } @else {
                  <div class="quota-display">
                    <div class="quota-info">
                      <span class="quota-value">
                        {{ org.monthlyQuota !== null && org.monthlyQuota !== undefined ? org.monthlyQuota : 'Illimité' }}
                      </span>
                      @if (org.monthlyQuota !== null && org.monthlyQuota !== undefined) {
                        <span class="quota-usage" 
                              [class.quota-warning]="getQuotaPercentage(org) >= 80"
                              [class.quota-danger]="getQuotaPercentage(org) >= 100">
                          ({{ org.currentMonthUsage || 0 }}/{{ org.monthlyQuota }} crédits - {{ getQuotaPercentage(org).toFixed(1) }}%)
                        </span>
                      } @else {
                        <span class="quota-usage">({{ org.currentMonthUsage || 0 }} crédits ce mois)</span>
                      }
                    </div>
                    <button class="btn btn-sm btn-secondary" (click)="startQuotaEdit(org)">✏️</button>
                  </div>
                  @if (org.monthlyQuota !== null && org.monthlyQuota !== undefined) {
                    <div class="quota-progress-bar-card">
                      <div class="quota-progress-fill-card" 
                           [style.width.%]="getQuotaPercentage(org)"
                           [class.quota-warning]="getQuotaPercentage(org) >= 80"
                           [class.quota-danger]="getQuotaPercentage(org) >= 100">
                      </div>
                    </div>
                  }
                }
              </div>

              <!-- Formulaire d'édition -->
              @if (editingId === org.id) {
                <div class="edit-form">
                  <h4>Modifier l'organisation</h4>
                  <form (ngSubmit)="updateOrganization(org.id)">
                    <div class="form-group">
                      <label for="editName-{{org.id}}">Nom *</label>
                      <input type="text" id="editName-{{org.id}}" [(ngModel)]="editingOrg.name" name="editName" required />
                    </div>
                    <div class="form-group">
                      <label for="editEmail-{{org.id}}">Email</label>
                      <input type="email" id="editEmail-{{org.id}}" [(ngModel)]="editingOrg.email" name="editEmail" />
                    </div>
                    <div class="form-actions">
                      <button type="submit" class="btn btn-primary">Enregistrer</button>
                      <button type="button" class="btn btn-secondary" (click)="cancelEdit()">Annuler</button>
                    </div>
                  </form>
                </div>
              }

              <!-- Liste des utilisateurs -->
              @if (showingUsersId === org.id) {
                <div class="users-section">
                  <h4>Utilisateurs de l'organisation</h4>
                  @if (loadingUsers) {
                    <p>Chargement des utilisateurs...</p>
                  } @else if (organizationUsers.length === 0) {
                    <p class="empty-message">Aucun utilisateur dans cette organisation.</p>
                  } @else {
                    <table class="users-table">
                      <thead>
                        <tr>
                          <th>ID Utilisateur Keycloak</th>
                          <th>Nom d'utilisateur</th>
                          <th>Date d'ajout</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (user of organizationUsers; track user.id) {
                          <tr>
                            <td>{{ truncateUserId(user.keycloakUserId) }}</td>
                            <td><strong>{{ user.username || 'N/A' }}</strong></td>
                            <td>{{ formatDate(user.joinedAt) }}</td>
                            <td>
                              <button class="btn btn-sm btn-danger" (click)="removeUser(org.id, user.keycloakUserId)">Retirer</button>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  }
                  
                  <!-- Formulaire d'ajout d'utilisateur -->
                  <div class="add-user-form">
                    <h5>Ajouter un utilisateur</h5>
                    @if (userErrorMessage) {
                      <div class="error-message">{{ userErrorMessage }}</div>
                    }
                    <form (ngSubmit)="addUser(org.id)">
                      <div class="form-group">
                        <label for="newUserId-{{org.id}}">ID Utilisateur Keycloak *</label>
                        <input type="text" id="newUserId-{{org.id}}" [(ngModel)]="newUserId" name="newUserId" required />
                      </div>
                      <button type="submit" class="btn btn-primary">Ajouter</button>
                    </form>
                  </div>
                  
                  <button class="btn btn-secondary" (click)="hideUsers()">Fermer</button>
                </div>
              }
            </div>
          }
        }
      </div>

      <!-- Messages d'erreur -->
      @if (errorMessage) {
        <div class="error-message">{{ errorMessage }}</div>
      }
    </div>
  `,
  styles: [`
    :host {
      --neu-bg: var(--neu-bg, #E0E5EC);
      --neu-extruded: var(--neu-extruded, 9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5));
      --neu-extruded-sm: var(--neu-extruded-sm, 4px 4px 8px rgba(163,177,198,0.6), -4px -4px 8px rgba(255,255,255,0.5));
      --neu-extruded-hover: var(--neu-extruded-hover, 12px 12px 20px rgba(163,177,198,0.6), -12px -12px 20px rgba(255,255,255,0.5));
      --neu-inset: var(--neu-inset, inset 4px 4px 8px rgba(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.5));
      --neu-inset-deep: var(--neu-inset-deep, inset 6px 6px 12px rgba(163,177,198,0.6), inset -6px -6px 12px rgba(255,255,255,0.5));
      --neu-radius-container: var(--neu-radius-container, 32px);
      --neu-radius-inner: var(--neu-radius-inner, 12px);
      --neu-accent: var(--neu-accent, #6C63FF);
      --neu-accent-secondary: var(--neu-accent-secondary, #38B2AC);
      --neu-accent-danger: var(--neu-accent-danger, #E53E3E);
      --neu-accent-warning: var(--neu-accent-warning, #ED8936);
      --neu-text-primary: var(--neu-text-primary, #3D4852);
      --neu-text-muted: var(--neu-text-muted, #6B7280);
      --neu-text-heading: var(--neu-text-heading, #2D3748);
      --font-display: var(--font-display, 'Inter', sans-serif);
    }

    .organizations-container {
      padding: 2rem;
      max-width: 100%;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
      background: var(--neu-bg);
      min-height: 100vh;
    }

    @media (min-width: 1200px) {
      .organizations-container {
        max-width: 1200px;
      }
    }

    @media (min-width: 1600px) {
      .organizations-container {
        max-width: 1400px;
      }
    }

    h2 {
      color: var(--neu-text-heading);
      margin-bottom: 2rem;
      font-family: var(--font-display);
    }

    .actions-bar {
      margin-bottom: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .search-bar {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .search-input {
      padding: 0.625rem 1rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 1rem;
      min-width: 250px;
      color: var(--neu-text-primary);
      min-height: 44px;
      transition: box-shadow 0.2s ease;
    }

    .search-input:focus {
      outline: none;
      box-shadow: var(--neu-inset-deep), 0 0 0 2px var(--neu-accent);
    }

    .view-select {
      padding: 0.625rem 1rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 1rem;
      cursor: pointer;
      color: var(--neu-text-primary);
      min-height: 44px;
      transition: box-shadow 0.2s ease;
    }

    .view-select:focus {
      outline: none;
      box-shadow: var(--neu-inset-deep), 0 0 0 2px var(--neu-accent);
    }

    .organizations-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .organization-card {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      border-radius: var(--neu-radius-container);
      padding: 1.5rem 2rem;
      box-shadow: var(--neu-extruded);
      transition: box-shadow 0.3s ease, background 0.3s ease;
    }

    .organization-card:hover {
      background: var(--neu-card-bg-hover, linear-gradient(145deg, #EDF0F5, #DCE1E8));
      box-shadow: var(--neu-extruded-hover);
    }

    .org-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .org-info h3 {
      margin: 0 0 0.5rem 0;
      color: var(--neu-text-heading);
      font-family: var(--font-display);
    }

    .org-email {
      color: var(--neu-text-muted);
      margin: 0.25rem 0;
    }

    .org-meta {
      color: var(--neu-text-muted);
      font-size: 0.9rem;
      margin: 0.25rem 0;
    }

    .org-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .quota-section {
      margin: 1rem 0;
      padding: 1rem 1.5rem;
      background: var(--neu-bg);
      border-radius: var(--neu-radius-inner);
      display: flex;
      align-items: center;
      gap: 1rem;
      box-shadow: var(--neu-inset);
      flex-wrap: wrap;
    }

    .quota-section label {
      font-weight: 600;
      color: var(--neu-text-primary);
    }

    .quota-edit {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .quota-edit input {
      width: 150px;
      padding: 0.625rem 0.75rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border: none;
      border-radius: var(--neu-radius-inner);
      color: var(--neu-text-primary);
      min-height: 44px;
      transition: box-shadow 0.2s ease;
    }

    .quota-edit input:focus {
      outline: none;
      box-shadow: var(--neu-inset-deep), 0 0 0 2px var(--neu-accent);
    }

    .quota-display {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
    }

    .quota-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .quota-value {
      font-weight: 600;
      color: var(--neu-text-heading);
      font-family: var(--font-display);
    }

    .quota-usage {
      font-size: 0.85rem;
      color: var(--neu-text-muted);
    }

    .quota-usage.quota-warning {
      color: var(--neu-accent-warning);
      font-weight: 600;
    }

    .quota-usage.quota-danger {
      color: var(--neu-accent-danger);
      font-weight: 600;
    }

    .quota-progress-bar-card {
      width: 100%;
      height: 8px;
      background: var(--neu-bg);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 0.5rem;
      box-shadow: var(--neu-inset);
    }

    .quota-progress-fill-card {
      height: 100%;
      background: var(--neu-accent-secondary);
      transition: width 0.3s ease;
      border-radius: 4px;
    }

    .quota-progress-fill-card.quota-warning {
      background: var(--neu-accent-warning);
    }

    .quota-progress-fill-card.quota-danger {
      background: var(--neu-accent-danger);
    }

    .organizations-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0 0.5rem;
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      border-radius: var(--neu-radius-container);
      overflow-x: auto;
      box-shadow: var(--neu-extruded);
      display: block;
      padding: 1rem;
    }

    @media (min-width: 768px) {
      .organizations-table {
        display: table;
      }
    }

    .organizations-table th {
      padding: 0.75rem 1rem;
      text-align: left;
      font-weight: 600;
      color: var(--neu-text-muted);
      background: transparent;
    }

    .organizations-table td {
      padding: 0.75rem 1rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-extruded-sm);
      color: var(--neu-text-primary);
    }

    .organizations-table td:first-child {
      border-radius: var(--neu-radius-inner) 0 0 var(--neu-radius-inner);
    }

    .organizations-table td:last-child {
      border-radius: 0 var(--neu-radius-inner) var(--neu-radius-inner) 0;
    }

    .organizations-table tr:hover td {
      box-shadow: var(--neu-extruded);
    }

    .quota-progress-mini {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .quota-progress-bar-mini {
      width: 80px;
      height: 6px;
      background: var(--neu-bg);
      border-radius: 3px;
      overflow: hidden;
      box-shadow: var(--neu-inset);
    }

    .quota-progress-fill-mini {
      height: 100%;
      background: var(--neu-accent-secondary);
      transition: width 0.3s ease;
      border-radius: 3px;
    }

    .quota-progress-fill-mini.quota-warning {
      background: var(--neu-accent-warning);
    }

    .quota-progress-fill-mini.quota-danger {
      background: var(--neu-accent-danger);
    }

    .quota-warning {
      color: var(--neu-accent-warning);
    }

    .quota-danger {
      color: var(--neu-accent-danger);
    }

    .form-card, .edit-form {
      background: var(--neu-card-bg, linear-gradient(145deg, #E8ECF2, #D8DDE4));
      padding: 1.5rem 2rem;
      border-radius: var(--neu-radius-container);
      margin-bottom: 1.5rem;
      box-shadow: var(--neu-extruded);
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: var(--neu-text-primary);
    }

    .form-group input {
      width: 100%;
      padding: 0.75rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-inset);
      border: none;
      border-radius: var(--neu-radius-inner);
      font-size: 1rem;
      color: var(--neu-text-primary);
      min-height: 44px;
      transition: box-shadow 0.2s ease;
    }

    .form-group input:focus {
      outline: none;
      box-shadow: var(--neu-inset-deep), 0 0 0 2px var(--neu-accent);
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
    }

    .users-section {
      margin-top: 1.5rem;
      padding: 1.5rem 2rem;
      background: var(--neu-bg);
      border-radius: var(--neu-radius-inner);
      box-shadow: var(--neu-inset);
    }

    .users-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0 0.5rem;
      margin: 1rem 0;
      overflow-x: auto;
      display: block;
    }

    @media (min-width: 768px) {
      .users-table {
        display: table;
      }
    }

    .users-table th {
      padding: 0.75rem 1rem;
      text-align: left;
      font-weight: 600;
      color: var(--neu-text-muted);
      background: transparent;
    }

    .users-table td {
      padding: 0.75rem 1rem;
      background: var(--neu-bg);
      box-shadow: var(--neu-extruded-sm);
      color: var(--neu-text-primary);
    }

    .users-table td:first-child {
      border-radius: var(--neu-radius-inner) 0 0 var(--neu-radius-inner);
    }

    .users-table td:last-child {
      border-radius: 0 var(--neu-radius-inner) var(--neu-radius-inner) 0;
    }

    .add-user-form {
      margin-top: 1.5rem;
      padding: 1rem 1.5rem;
      background: var(--neu-bg);
      border-radius: var(--neu-radius-inner);
      box-shadow: var(--neu-inset);
    }

    .btn {
      padding: 0.625rem 1.2rem;
      border: none;
      border-radius: var(--neu-radius-inner);
      cursor: pointer;
      font-weight: 600;
      min-height: 44px;
      transition: box-shadow 0.2s ease;
    }

    .btn-primary {
      background: var(--neu-accent);
      color: white;
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-primary:hover {
      box-shadow: var(--neu-extruded);
    }

    .btn-primary:active {
      box-shadow: var(--neu-inset);
    }

    .btn-secondary {
      background: var(--neu-bg);
      color: var(--neu-text-muted);
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-secondary:hover {
      box-shadow: var(--neu-extruded);
    }

    .btn-secondary:active {
      box-shadow: var(--neu-inset);
    }

    .btn-info {
      background: var(--neu-accent-secondary);
      color: white;
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-info:hover {
      box-shadow: var(--neu-extruded);
    }

    .btn-info:active {
      box-shadow: var(--neu-inset);
    }

    .btn-danger {
      background: var(--neu-accent-danger);
      color: white;
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-danger:hover {
      box-shadow: var(--neu-extruded);
    }

    .btn-danger:active {
      box-shadow: var(--neu-inset);
    }

    .btn-success {
      background: var(--neu-accent-secondary);
      color: white;
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-success:hover {
      box-shadow: var(--neu-extruded);
    }

    .btn-success:active {
      box-shadow: var(--neu-inset);
    }

    .btn-warning {
      background: var(--neu-accent-warning);
      color: white;
      box-shadow: var(--neu-extruded-sm);
    }

    .btn-warning:hover {
      box-shadow: var(--neu-extruded);
    }

    .btn-warning:active {
      box-shadow: var(--neu-inset);
    }

    .btn-sm {
      padding: 0.4rem 0.8rem;
      font-size: 0.9rem;
      min-height: 36px;
    }

    .empty-message {
      color: var(--neu-text-muted);
      font-style: italic;
      text-align: center;
      padding: 2rem;
    }

    .error-message {
      background: var(--neu-accent-danger);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: var(--neu-radius-inner);
      margin-top: 1rem;
      box-shadow: var(--neu-extruded-sm);
    }

    .loading {
      text-align: center;
      padding: 2rem;
      color: var(--neu-text-muted);
    }

    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      box-shadow: var(--neu-extruded-sm);
    }

    .status-active {
      background: var(--neu-bg);
      color: var(--neu-accent-secondary);
    }

    .status-disabled {
      background: var(--neu-bg);
      color: var(--neu-accent-danger);
    }

    .badge-renewed {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      background: var(--neu-bg);
      color: var(--neu-accent-secondary);
      box-shadow: var(--neu-extruded-sm);
    }

    .org-disabled {
      opacity: 0.7;
      border-left: 5px solid var(--neu-accent-danger);
    }

    tr.org-disabled td {
      opacity: 0.6;
    }

    @media (max-width: 768px) {
      .organizations-container {
        padding: 1rem;
      }

      .actions-bar {
        flex-direction: column;
        align-items: stretch;
      }

      .search-bar {
        flex-direction: column;
      }

      .search-input {
        min-width: auto;
        width: 100%;
      }

      .org-header {
        flex-direction: column;
        gap: 1rem;
      }

      .org-actions {
        flex-wrap: wrap;
      }
    }

    @media (max-width: 1024px) {
      .organizations-table {
        overflow-x: auto;
      }
    }
  `]
})
export class OrganizationsComponent implements OnInit {
  private adminService = inject(AdminService);
  private notificationService = inject(NotificationService);

  organizations: Organization[] = [];
  filteredOrganizations: Organization[] = [];
  loading = false;
  errorMessage = '';
  searchTerm = '';
  viewMode: 'cards' | 'table' = 'cards';

  // Création
  showCreateForm = false;
  newOrganization: CreateOrganizationRequest = { name: '', email: null };

  // Édition
  editingId: number | null = null;
  editingOrg: UpdateOrganizationRequest = { name: '', email: null };

  // Quota
  editingQuotaId: number | null = null;
  editingQuota: number | null = null;

  // Utilisateurs
  showingUsersId: number | null = null;
  organizationUsers: OrganizationUser[] = [];
  loadingUsers = false;
  newUserId = '';
  userErrorMessage = '';

  ngOnInit() {
    this.loadOrganizations();
  }

  loadOrganizations() {
    this.loading = true;
    this.errorMessage = '';
    this.adminService.getOrganizations().subscribe({
      next: (orgs) => {
        this.organizations = orgs;
        this.filterOrganizations();
        this.loading = false;
      },
      error: (err) => {
        const message = err.error?.message || err.message || "Erreur lors du chargement des organisations";
        this.errorMessage = message;
        this.loading = false;
        this.notificationService.error(message);
      }
    });
  }

  filterOrganizations() {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      this.filteredOrganizations = this.organizations;
    } else {
      const search = this.searchTerm.toLowerCase().trim();
      this.filteredOrganizations = this.organizations.filter(org => 
        org.name.toLowerCase().includes(search) || 
        (org.email && org.email.toLowerCase().includes(search))
      );
    }
  }

  getQuotaPercentage(org: Organization): number {
    if (!org.monthlyQuota || org.monthlyQuota === 0) {
      return 0;
    }
    const usage = org.currentMonthUsage || 0;
    return (usage / org.monthlyQuota) * 100;
  }

  createOrganization() {
    if (!this.newOrganization.name.trim()) {
      this.notificationService.error("Le nom est obligatoire");
      return;
    }

    this.adminService.createOrganization(this.newOrganization).subscribe({
      next: () => {
        this.notificationService.success('Organisation créée avec succès');
        this.showCreateForm = false;
        this.newOrganization = { name: '', email: null };
        this.loadOrganizations();
        this.searchTerm = ''; // Réinitialiser la recherche
        this.errorMessage = '';
      },
      error: (err) => {
        const message = err.error?.message || err.message || "Erreur lors de la création";
        this.errorMessage = message;
        this.notificationService.error(message);
      }
    });
  }

  cancelCreate() {
    this.showCreateForm = false;
    this.newOrganization = { name: '', email: null };
    this.errorMessage = '';
  }

  toggleEdit(org: Organization) {
    if (this.editingId === org.id) {
      this.cancelEdit();
    } else {
      this.editingId = org.id;
      this.editingOrg = { name: org.name, email: org.email || null };
    }
  }

  updateOrganization(id: number) {
    if (!this.editingOrg.name?.trim()) {
      this.notificationService.error("Le nom est obligatoire");
      return;
    }

    this.adminService.updateOrganization(id, this.editingOrg).subscribe({
      next: () => {
        this.notificationService.success('Organisation mise à jour avec succès');
        this.cancelEdit();
        this.loadOrganizations();
        this.filterOrganizations(); // Re-filtrer après mise à jour
        this.errorMessage = '';
      },
      error: (err) => {
        const message = err.error?.message || err.message || "Erreur lors de la mise à jour";
        this.errorMessage = message;
        this.notificationService.error(message);
      }
    });
  }

  cancelEdit() {
    this.editingId = null;
    this.editingOrg = { name: '', email: null };
    this.errorMessage = '';
  }

  startQuotaEdit(org: Organization) {
    this.editingQuotaId = org.id;
    this.editingQuota = org.monthlyQuota || null;
  }

  saveQuota(id: number) {
    const request: UpdateQuotaRequest = { monthlyQuota: this.editingQuota };
    this.adminService.updateQuota(id, request).subscribe({
      next: () => {
        this.notificationService.success('Quota mis à jour avec succès');
        this.cancelQuotaEdit();
        this.loadOrganizations();
        this.filterOrganizations(); // Re-filtrer après mise à jour
      },
      error: (err) => {
        const message = err.error?.message || err.message || "Erreur lors de la mise à jour du quota";
        this.errorMessage = message;
        this.notificationService.error(message);
      }
    });
  }

  cancelQuotaEdit() {
    this.editingQuotaId = null;
    this.editingQuota = null;
    this.errorMessage = '';
  }

  toggleUsers(organizationId: number) {
    if (this.showingUsersId === organizationId) {
      this.hideUsers();
    } else {
      this.showingUsersId = organizationId;
      this.loadUsers(organizationId);
    }
  }

  loadUsers(organizationId: number) {
    this.loadingUsers = true;
    this.organizationUsers = [];
    this.userErrorMessage = '';
    this.adminService.getOrganizationUsers(organizationId).subscribe({
      next: (users) => {
        this.organizationUsers = users;
        this.loadingUsers = false;
      },
      error: (err) => {
        const message = "Erreur lors du chargement des utilisateurs: " + (err.error?.message || err.message);
        this.userErrorMessage = message;
        this.loadingUsers = false;
        this.notificationService.error(message);
      }
    });
  }

  hideUsers() {
    this.showingUsersId = null;
    this.organizationUsers = [];
    this.newUserId = '';
    this.userErrorMessage = '';
  }

  addUser(organizationId: number) {
    if (!this.newUserId.trim()) {
      this.notificationService.warning("L'ID utilisateur Keycloak est obligatoire");
      return;
    }

    const request: AddUserToOrganizationRequest = { keycloakUserId: this.newUserId.trim() };
    this.adminService.addUserToOrganization(organizationId, request).subscribe({
      next: () => {
        this.notificationService.success('Utilisateur ajouté avec succès');
        this.newUserId = '';
        this.loadUsers(organizationId);
        this.loadOrganizations(); // Rafraîchir pour mettre à jour le userCount
        this.userErrorMessage = '';
      },
      error: (err) => {
        const message = err.error?.message || err.message || "Erreur lors de l'ajout de l'utilisateur";
        this.userErrorMessage = message;
        this.notificationService.error(message);
      }
    });
  }

  removeUser(organizationId: number, keycloakUserId: string) {
    if (!confirm(`Êtes-vous sûr de vouloir retirer l'utilisateur ${keycloakUserId} de cette organisation ?`)) {
      return;
    }

    this.adminService.removeUserFromOrganization(organizationId, keycloakUserId).subscribe({
      next: () => {
        this.notificationService.success('Utilisateur retiré avec succès');
        this.loadUsers(organizationId);
        this.loadOrganizations(); // Rafraîchir pour mettre à jour le userCount
        this.userErrorMessage = '';
      },
      error: (err) => {
        const message = err.error?.message || err.message || "Erreur lors du retrait de l'utilisateur";
        this.userErrorMessage = message;
        this.notificationService.error(message);
      }
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  truncateUserId(userId: string): string {
    if (userId.length > 40) {
      return userId.substring(0, 37) + '...';
    }
    return userId;
  }

  disableOrganization(org: Organization) {
    if (!confirm(`Êtes-vous sûr de vouloir désactiver l'organisation "${org.name}" ?\n\nTous les collaborateurs de cette organisation ne pourront plus utiliser l'application.`)) {
      return;
    }

    this.adminService.disableOrganization(org.id).subscribe({
      next: () => {
        this.notificationService.success(`Organisation "${org.name}" désactivée avec succès`);
        this.loadOrganizations();
      },
      error: (err) => {
        const message = err.error?.message || err.message || "Erreur lors de la désactivation";
        this.errorMessage = message;
        this.notificationService.error(message);
      }
    });
  }

  enableOrganization(org: Organization) {
    if (!confirm(`Êtes-vous sûr de vouloir réactiver l'organisation "${org.name}" ?\n\nLes collaborateurs pourront à nouveau utiliser l'application.`)) {
      return;
    }

    this.adminService.enableOrganization(org.id).subscribe({
      next: () => {
        this.notificationService.success(`Organisation "${org.name}" réactivée avec succès`);
        this.loadOrganizations();
      },
      error: (err) => {
        const message = err.error?.message || err.message || "Erreur lors de la réactivation";
        this.errorMessage = message;
        this.notificationService.error(message);
      }
    });
  }

  resetOrganizationPlan(org: Organization) {
    if (!confirm(`Êtes-vous sûr de vouloir réinitialiser le plan de l'organisation "${org.name}" ?\n\nCela va :\n- Prolonger l'accès de 30 jours\n- Remettre son quota de crédits consommés à zéro\n- Réactiver l'organisation si elle était bloquée par manque de quota.`)) {
      return;
    }

    this.adminService.resetOrganizationPlan(org.id).subscribe({
      next: () => {
        this.notificationService.success(`Le plan de "${org.name}" a été réinitialisé avec succès`);
        this.loadOrganizations();
      },
      error: (err) => {
        const message = err.error?.message || err.message || "Erreur lors de la réinitialisation du plan";
        this.errorMessage = message;
        this.notificationService.error(message);
      }
    });
  }
}

