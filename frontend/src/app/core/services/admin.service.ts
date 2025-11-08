import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UsageStats {
  totalRequests: number;
  totalCostUsd: number;
  totalTokens: number;
  statsByOrganization?: OrganizationStats[];
  statsByUser?: UserStats[];
  recentUsage?: UsageLog[];
}

export interface OrganizationStats {
  organizationId: number;
  organizationName: string;
  requestCount: number;
  totalCostUsd: number;
  totalTokens: number;
}

export interface UserStats {
  keycloakUserId: string;
  requestCount: number;
  totalCostUsd: number;
  totalTokens: number;
}

export interface UsageLog {
  id: number;
  keycloakUserId: string;
  organizationId: number | null;
  endpoint: string;
  searchTerm: string;
  tokensUsed: number;
  costUsd: number | null;
  timestamp: string;
}

export interface UsageLogsResponse {
  total: number;
  totalCostUsd: number;
  totalTokens: number;
  logs: UsageLog[];
}

export interface Organization {
  id: number;
  name: string;
  createdAt: string;
  userCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  /**
   * Récupère les statistiques d'utilisation.
   * @param organizationId ID de l'organisation (optionnel)
   * @param startDate Date de début (optionnel, format: YYYY-MM-DD)
   * @param endDate Date de fin (optionnel, format: YYYY-MM-DD)
   */
  getUsageStats(organizationId?: number, startDate?: string, endDate?: string): Observable<UsageStats> {
    let params = new HttpParams();
    
    // Ne pas inclure le paramètre si la valeur est null, undefined, ou NaN
    // Vérifier explicitement que c'est un nombre valide (y compris 0)
    if (organizationId !== null && organizationId !== undefined && 
        !isNaN(organizationId) && typeof organizationId === 'number') {
      params = params.set('organizationId', organizationId.toString());
    }
    if (startDate && startDate.trim() !== '' && startDate !== 'null') {
      params = params.set('startDate', startDate);
    }
    if (endDate && endDate.trim() !== '' && endDate !== 'null') {
      params = params.set('endDate', endDate);
    }

    return this.http.get<UsageStats>(`${this.apiUrl}/usage/stats`, { params });
  }

  /**
   * Récupère les logs d'utilisation.
   * @param userId ID de l'utilisateur Keycloak (optionnel)
   * @param organizationId ID de l'organisation (optionnel)
   * @param startDate Date de début (optionnel, format: YYYY-MM-DD)
   * @param endDate Date de fin (optionnel, format: YYYY-MM-DD)
   */
  getUsageLogs(userId?: string, organizationId?: number, startDate?: string, endDate?: string): Observable<UsageLogsResponse> {
    let params = new HttpParams();
    
    if (userId) {
      params = params.set('userId', userId);
    }
    if (organizationId) {
      params = params.set('organizationId', organizationId.toString());
    }
    if (startDate) {
      params = params.set('startDate', startDate);
    }
    if (endDate) {
      params = params.set('endDate', endDate);
    }

    return this.http.get<UsageLogsResponse>(`${this.apiUrl}/usage-logs`, { params });
  }

  /**
   * Récupère toutes les organisations.
   */
  getOrganizations(): Observable<Organization[]> {
    return this.http.get<Organization[]>(`${this.apiUrl}/organizations`);
  }
}

