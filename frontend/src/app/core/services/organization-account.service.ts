import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OrganizationInfo {
  id: number;
  name: string;
  email: string;
  address: string;
  country: string;
  phone: string;
  monthlyQuota?: number | null;
  pricingPlanId?: number | null;
  trialExpiresAt?: string | null;
  createdAt?: string | null;
  userCount?: number | null;
  currentMonthUsage?: number | null;
}

export interface OrganizationCollaborator {
  id: number;
  organizationId: number;
  organizationName: string;
  keycloakUserId: string;
  username: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  joinedAt?: string | null;
}

export interface CollaboratorsResponse {
  organization: OrganizationInfo;
  collaborators: OrganizationCollaborator[];
}

export interface InviteCollaboratorRequest {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface InviteCollaboratorResponse {
  message: string;
  tokenExpiresAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class OrganizationAccountService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/organization/account`;

  getMyOrganization(): Observable<OrganizationInfo> {
    return this.http.get<OrganizationInfo>(`${this.baseUrl}/me`);
  }

  getMyCollaborators(): Observable<CollaboratorsResponse> {
    return this.http.get<CollaboratorsResponse>(`${this.baseUrl}/collaborators`);
  }

  inviteCollaborator(request: InviteCollaboratorRequest): Observable<InviteCollaboratorResponse> {
    return this.http.post<InviteCollaboratorResponse>(`${this.baseUrl}/collaborators`, request);
  }

  disableCollaborator(keycloakUserId: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.baseUrl}/collaborators/${keycloakUserId}/disable`, {});
  }

  deleteCollaborator(keycloakUserId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/collaborators/${keycloakUserId}`);
  }
}

