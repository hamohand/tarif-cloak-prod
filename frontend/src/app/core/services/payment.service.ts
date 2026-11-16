import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
  publishableKey?: string;
  manualInvoiceFallback?: boolean;
  message?: string;
}

export interface CreateCheckoutRequest {
  pricingPlanId: number;
  invoiceId?: number;
  successUrl?: string;
  cancelUrl?: string;
}

export interface PaymentProvidersStatus {
  chargilyConfigured: boolean;
  stripeConfigured: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/payments`;
  private providersStatus$?: Observable<PaymentProvidersStatus>;

  createCheckout(request: CreateCheckoutRequest): Observable<CheckoutSessionResponse> {
    return this.http.post<CheckoutSessionResponse>(`${this.apiUrl}/checkout`, request);
  }

  getProvidersStatus(): Observable<PaymentProvidersStatus> {
    if (!this.providersStatus$) {
      this.providersStatus$ = this.http.get<PaymentProvidersStatus>(`${this.apiUrl}/providers-status`).pipe(
        catchError(() => of({ chargilyConfigured: true, stripeConfigured: false })),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.providersStatus$;
  }
}
