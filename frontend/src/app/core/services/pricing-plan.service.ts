import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PricingPlan {
  id: number;
  name: string;
  description?: string;
  pricePerMonth?: number | null; // null pour les plans facturés à la requête
  pricePerRequest?: number | null; // null pour les plans mensuels
  monthlyQuota?: number | null; // null = quota illimité ou plan facturé à la requête
  trialPeriodDays?: number | null; // null si pas un plan d'essai
  features?: string;
  isActive: boolean;
  displayOrder: number;
  marketVersion?: string; // DEFAULT, DZ, etc.
  currency?: string; // EUR, DZD, etc.
  isCustom?: boolean; // true pour les plans créés via devis
  organizationId?: number | null; // Pour les plans personnalisés
}

export interface ChangePricingPlanRequest {
  pricingPlanId: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class PricingPlanService {
  private apiUrl = `${environment.apiUrl}/pricing-plans`;

  constructor(private http: HttpClient) {}

  /**
   * Récupère tous les plans tarifaires actifs.
   * @param marketVersion Version de marché (ex: 'DZ', 'DEFAULT'). Si non fourni, récupère tous les plans.
   */
  getActivePricingPlans(marketVersion?: string): Observable<PricingPlan[]> {
    let params = new HttpParams();
    if (marketVersion && marketVersion.trim() !== '') {
      params = params.set('marketVersion', marketVersion.trim());
      console.log('📤 Envoi de la requête avec marketVersion:', marketVersion.trim());
    } else {
      console.log('📤 Envoi de la requête sans marketVersion (récupération de tous les plans)');
    }
    return this.http.get<PricingPlan[]>(this.apiUrl, { params });
  }

  /**
   * Récupère un plan tarifaire par ID.
   */
  getPricingPlanById(id: number): Observable<PricingPlan> {
    return this.http.get<PricingPlan>(`${this.apiUrl}/${id}`);
  }

  /**
   * Change le plan tarifaire de l'organisation de l'utilisateur connecté.
   */
  changeMyOrganizationPricingPlan(pricingPlanId: number | null): Observable<any> {
    return this.http.put(`${environment.apiUrl}/user/organization/pricing-plan`, {
      pricingPlanId
    });
  }
}

