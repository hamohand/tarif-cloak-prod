import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, Organization, OrganizationUser, CreateOrganizationRequest, UpdateOrganizationRequest, UpdateQuotaRequest, AddUserToOrganizationRequest } from '../../../core/services/admin.service';

@Component({
  selector: 'app-organizations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="organizations-container">
      <h2>🏢 Gestion des Organisations</h2>

      <!-- Bouton pour créer une nouvelle organisation -->
      <div class="actions-bar">
        <button class="btn btn-primary" (click)="showCreateForm = true">+ Créer une organisation</button>
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
        } @else if (organizations.length === 0) {
          <p class="empty-message">Aucune organisation trouvée.</p>
        } @else {
          @for (org of organizations; track org.id) {
            <div class="organization-card">
              <div class="org-header">
                <div class="org-info">
                  <h3>{{ org.name }}</h3>
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
                    <span class="quota-value">
                      {{ org.monthlyQuota !== null && org.monthlyQuota !== undefined ? org.monthlyQuota : 'Illimité' }}
                    </span>
                    <button class="btn btn-sm btn-secondary" (click)="startQuotaEdit(org)">✏️</button>
                  </div>
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
                          <th>Date d'ajout</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (user of organizationUsers; track user.id) {
                          <tr>
                            <td>{{ truncateUserId(user.keycloakUserId) }}</td>
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
    .organizations-container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    h2 {
      color: #2c3e50;
      margin-bottom: 2rem;
    }

    .actions-bar {
      margin-bottom: 2rem;
    }

    .organizations-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .organization-card {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .org-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .org-info h3 {
      margin: 0 0 0.5rem 0;
      color: #2c3e50;
    }

    .org-email {
      color: #666;
      margin: 0.25rem 0;
    }

    .org-meta {
      color: #888;
      font-size: 0.9rem;
      margin: 0.25rem 0;
    }

    .org-actions {
      display: flex;
      gap: 0.5rem;
    }

    .quota-section {
      margin: 1rem 0;
      padding: 1rem;
      background: white;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .quota-section label {
      font-weight: 600;
    }

    .quota-edit {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .quota-edit input {
      width: 150px;
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
    }

    .quota-display {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .quota-value {
      font-weight: 600;
      color: #2c3e50;
    }

    .form-card, .edit-form {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: #2c3e50;
    }

    .form-group input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
    }

    .users-section {
      margin-top: 1.5rem;
      padding: 1.5rem;
      background: white;
      border-radius: 8px;
    }

    .users-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }

    .users-table th,
    .users-table td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }

    .users-table th {
      background: #f8f9fa;
      font-weight: 600;
      color: #2c3e50;
    }

    .add-user-form {
      margin-top: 1.5rem;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 4px;
    }

    .btn {
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
    }

    .btn-primary {
      background: #3498db;
      color: white;
    }

    .btn-primary:hover {
      background: #2980b9;
    }

    .btn-secondary {
      background: #95a5a6;
      color: white;
    }

    .btn-secondary:hover {
      background: #7f8c8d;
    }

    .btn-info {
      background: #17a2b8;
      color: white;
    }

    .btn-info:hover {
      background: #138496;
    }

    .btn-danger {
      background: #e74c3c;
      color: white;
    }

    .btn-danger:hover {
      background: #c0392b;
    }

    .btn-sm {
      padding: 0.4rem 0.8rem;
      font-size: 0.9rem;
    }

    .empty-message {
      color: #888;
      font-style: italic;
      text-align: center;
      padding: 2rem;
    }

    .error-message {
      background: #e74c3c;
      color: white;
      padding: 1rem;
      border-radius: 4px;
      margin-top: 1rem;
    }

    .loading {
      text-align: center;
      padding: 2rem;
      color: #666;
    }
  `]
})
export class OrganizationsComponent implements OnInit {
  private adminService = inject(AdminService);

  organizations: Organization[] = [];
  loading = false;
  errorMessage = '';

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

  ngOnInit() {
    this.loadOrganizations();
  }

  loadOrganizations() {
    this.loading = true;
    this.errorMessage = '';
    this.adminService.getOrganizations().subscribe({
      next: (orgs) => {
        this.organizations = orgs;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du chargement des organisations: ' + (err.error?.message || err.message);
        this.loading = false;
      }
    });
  }

  createOrganization() {
    if (!this.newOrganization.name.trim()) {
      this.errorMessage = 'Le nom est obligatoire';
      return;
    }

    this.adminService.createOrganization(this.newOrganization).subscribe({
      next: () => {
        this.showCreateForm = false;
        this.newOrganization = { name: '', email: null };
        this.loadOrganizations();
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors de la création: ' + (err.error?.message || err.message);
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
      this.errorMessage = 'Le nom est obligatoire';
      return;
    }

    this.adminService.updateOrganization(id, this.editingOrg).subscribe({
      next: () => {
        this.cancelEdit();
        this.loadOrganizations();
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors de la mise à jour: ' + (err.error?.message || err.message);
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
        this.cancelQuotaEdit();
        this.loadOrganizations();
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors de la mise à jour du quota: ' + (err.error?.message || err.message);
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
    this.adminService.getOrganizationUsers(organizationId).subscribe({
      next: (users) => {
        this.organizationUsers = users;
        this.loadingUsers = false;
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du chargement des utilisateurs: ' + (err.error?.message || err.message);
        this.loadingUsers = false;
      }
    });
  }

  hideUsers() {
    this.showingUsersId = null;
    this.organizationUsers = [];
    this.newUserId = '';
  }

  addUser(organizationId: number) {
    if (!this.newUserId.trim()) {
      this.errorMessage = 'L\'ID utilisateur est obligatoire';
      return;
    }

    const request: AddUserToOrganizationRequest = { keycloakUserId: this.newUserId.trim() };
    this.adminService.addUserToOrganization(organizationId, request).subscribe({
      next: () => {
        this.newUserId = '';
        this.loadUsers(organizationId);
        this.loadOrganizations(); // Rafraîchir pour mettre à jour le userCount
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors de l\'ajout de l\'utilisateur: ' + (err.error?.message || err.message);
      }
    });
  }

  removeUser(organizationId: number, keycloakUserId: string) {
    if (!confirm(`Êtes-vous sûr de vouloir retirer l'utilisateur ${keycloakUserId} de cette organisation ?`)) {
      return;
    }

    this.adminService.removeUserFromOrganization(organizationId, keycloakUserId).subscribe({
      next: () => {
        this.loadUsers(organizationId);
        this.loadOrganizations(); // Rafraîchir pour mettre à jour le userCount
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors du retrait de l\'utilisateur: ' + (err.error?.message || err.message);
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
}

