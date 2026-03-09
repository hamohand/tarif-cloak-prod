import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
  publishableKey?: string;
}

export interface CreateCheckoutRequest {
  pricingPlanId: number;
  invoiceId?: number;
  successUrl?: string;
  cancelUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/payments`;

  createCheckout(request: CreateCheckoutRequest): Observable<CheckoutSessionResponse> {
    return this.http.post<CheckoutSessionResponse>(`${this.apiUrl}/checkout`, request);
  }
}
