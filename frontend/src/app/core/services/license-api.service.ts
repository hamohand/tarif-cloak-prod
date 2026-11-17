import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LicenseStatus {
  valid: boolean;
  state: string;
  licenseId?: string | null;
  boxId?: string | null;
  organizationName?: string | null;
  planName?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  daysRemaining?: number | null;
  offlineGraceDaysRemaining?: number | null;
  maxUsers?: number | null;
  monthlyQuota?: number | null;
  lastHeartbeatAt?: string | null;
  message?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class LicenseApiService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/license`;

  getStatus(): Observable<LicenseStatus> {
    return this.http.get<LicenseStatus>(`${this.baseUrl}/status`);
  }

  activateLicense(token: string): Observable<LicenseStatus> {
    return this.http.post<LicenseStatus>(`${this.baseUrl}/activate`, { token });
  }
}
