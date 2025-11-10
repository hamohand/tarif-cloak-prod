import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PricingPlan {
  id: number;
  name: string;
  description?: string;
  pricePerMonth: number;
  monthlyQuota?: number | null; // null = quota illimité
  features?: string;
  isActive: boolean;
  displayOrder: number;
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
   */
  getActivePricingPlans(): Observable<PricingPlan[]> {
    return this.http.get<PricingPlan[]>(this.apiUrl);
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

