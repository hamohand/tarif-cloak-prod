import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface RegulatoryData {
  dd?: string;
  tva?: string;
  autres?: string;
  uqn?: string;
  gu?: string;
  fap?: string[];
}

export interface DecodeCodeItem {
  code: string;
  description: string;
  note?: string;
  formattedCode?: string;
  checkDigit?: string;
  regulatoryData?: RegulatoryData;
  enriched?: boolean;
}

export interface DecodeResult {
  zone?: string;
  codeRecherche: string;
  niveau: 'CHAPITRE' | 'POSITION4' | 'POSITION6' | 'POSITION8' | 'POSITION10';
  section: DecodeCodeItem;
  chapitre: DecodeCodeItem;
  position4: DecodeCodeItem | null;
  positions6: DecodeCodeItem[];
  positions10: DecodeCodeItem[] | null;
  titresPosition10: string[] | null;
  titresParPosition10: Record<string, string[]> | null;
  glossary?: Record<string, string>;
}

export interface Hs6ComparisonResult {
  hs6: string;
  section: DecodeCodeItem;
  chapitre: DecodeCodeItem;
  position4?: DecodeCodeItem | null;
  position6?: DecodeCodeItem | null;
  dz: DecodeResult | null;
  eu: DecodeResult | null;
}

export interface GuestQuotaStatus {
  allowed: boolean;
  remaining: number;
  limit: number;
  reason?: string | null;
}

export class ApiSearchError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiSearchError';
  }
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private apiUrl = '/api/recherche';
  private conversionApiUrl = '/api/conversion';
  private decodeApiUrl = '/api/decode';
  private decodeP10ApiUrl = '/api/decode-p10';

  readonly guestTrialsRemaining$ = new BehaviorSubject<number | null>(null);
  readonly guestDecodesRemaining$ = new BehaviorSubject<number | null>(null);

  private lastGuestSearchPass: { token: string; expiresAtMs: number } | null = null;
  private decodeCache = new Map<string, Observable<DecodeResult>>();
  private decodeP10Cache = new Map<string, Observable<DecodeResult>>();
  private compareCache = new Map<string, Observable<Hs6ComparisonResult>>();

  constructor(private http: HttpClient) { }

  getGuestQuota(): Observable<GuestQuotaStatus> {
    return this.http.get<GuestQuotaStatus>(`${this.apiUrl}/guest-quota`).pipe(
      tap(status => {
        if (typeof status?.remaining === 'number' && status.remaining >= 0) {
          this.guestTrialsRemaining$.next(status.remaining);
        }
      }),
      catchError(err => this.handleError(err))
    );
  }

  getGuestDecodeQuota(): Observable<GuestQuotaStatus> {
    return this.http.get<GuestQuotaStatus>(`${this.decodeP10ApiUrl}/guest-quota`).pipe(
      tap(status => {
        if (typeof status?.remaining === 'number' && status.remaining >= 0) {
          this.guestDecodesRemaining$.next(status.remaining);
        }
      }),
      catchError(err => this.handleError(err))
    );
  }

  decodeCode(code: string, zone: string = 'DZ', forSearchEnrichment: boolean = false): Observable<DecodeResult> {
    const normZone = (zone || 'DZ').trim().toUpperCase();
    const key = `${normZone}:${code.trim().replace(/\s+/g, '')}`;
    const cached = this.decodeCache.get(key);
    if (cached) {
      return cached;
    }

    const headers = forSearchEnrichment ? this.getActiveGuestPassHeaders() : undefined;
    const req$ = this.http.get<DecodeResult>(this.decodeApiUrl, {
      params: { code, zone: normZone },
      ...(headers ? { headers } : {}),
      observe: 'response'
    }).pipe(
      tap(resp => this.captureDecodeRemainingHeader(resp)),
      map(resp => resp.body as DecodeResult),
      catchError(err => {
        this.decodeCache.delete(key);
        return this.handleError(err);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.decodeCache.set(key, req$);
    return req$;
  }

  decodeP10Code(code: string, zone: string = 'DZ', forSearchEnrichment: boolean = false): Observable<DecodeResult> {
    const normZone = (zone || 'DZ').trim().toUpperCase();
    const key = `${normZone}:${code.trim().replace(/\s+/g, '')}`;
    const cached = this.decodeP10Cache.get(key);
    if (cached) {
      return cached;
    }

    const headers = forSearchEnrichment ? this.getActiveGuestPassHeaders() : undefined;
    const req$ = this.http.get<DecodeResult>(this.decodeP10ApiUrl, {
      params: { code, zone: normZone },
      ...(headers ? { headers } : {}),
      observe: 'response'
    }).pipe(
      tap(resp => this.captureDecodeRemainingHeader(resp)),
      map(resp => resp.body as DecodeResult),
      catchError(err => {
        this.decodeP10Cache.delete(key);
        return this.handleError(err);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.decodeP10Cache.set(key, req$);
    return req$;
  }

  compareHs6(code: string): Observable<Hs6ComparisonResult> {
    const trimmed = code.trim();
    const digits = trimmed.replace(/[^0-9]/g, '');
    const key = digits.length >= 6 ? digits.slice(0, 6) : trimmed;
    const cached = this.compareCache.get(key);
    if (cached) {
      return cached;
    }

    const req$ = this.http.get<Hs6ComparisonResult>(`${this.decodeP10ApiUrl}/compare`, {
      params: { code: trimmed },
      observe: 'response'
    }).pipe(
      tap(resp => this.captureDecodeRemainingHeader(resp)),
      map(resp => resp.body as Hs6ComparisonResult),
      catchError(err => {
        this.compareCache.delete(key);
        return this.handleError(err);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.compareCache.set(key, req$);
    return req$;
  }

  searchCodes(
    searchTerm: string,
    endpoint: 'positions6' | 'positions10' = 'positions6',
    zone: string = 'DZ'
  ): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${endpoint}`, {
      params: { termeRecherche: searchTerm, zone },
      observe: 'response'
    }).pipe(
      tap((resp: HttpResponse<any[]>) => {
        const headerVal = resp.headers.get('X-Guest-Trials-Remaining');
        if (headerVal !== null) {
          const parsed = Number(headerVal);
          if (!Number.isNaN(parsed)) {
            this.guestTrialsRemaining$.next(parsed);
          }
        }
        const passVal = resp.headers.get('X-Guest-Search-Pass');
        if (passVal && passVal.trim().length > 0) {
          this.lastGuestSearchPass = {
            token: passVal.trim(),
            expiresAtMs: Date.now() + 115_000
          };
        }
      }),
      map((resp: HttpResponse<any[]>) => {
        const body = resp.body;
        if (!Array.isArray(body)) {
          console.warn('La réponse reçue du serveur n\'est pas un tableau.', body);
          return [];
        }
        return body;
      }),
      catchError(err => this.handleError(err))
    );
  }

  private getActiveGuestPassHeaders(): Record<string, string> | undefined {
    if (!this.lastGuestSearchPass) {
      return undefined;
    }
    if (Date.now() >= this.lastGuestSearchPass.expiresAtMs) {
      this.lastGuestSearchPass = null;
      return undefined;
    }
    return { 'X-Guest-Search-Pass': this.lastGuestSearchPass.token };
  }

  private captureDecodeRemainingHeader(resp: HttpResponse<any>): void {
    const headerVal = resp.headers.get('X-Guest-Decode-Remaining');
    if (headerVal !== null) {
      const parsed = Number(headerVal);
      if (!Number.isNaN(parsed)) {
        this.guestDecodesRemaining$.next(parsed);
      }
    }
  }

  convertFile(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post(`${this.conversionApiUrl}/convert`, formData, {
      responseType: 'text'
    }).pipe(
      catchError(err => this.handleError(err))
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Une erreur est survenue';
    const backendMessage = typeof error.error?.message === 'string'
      ? error.error.message
      : (typeof error.error === 'string' && error.error.trim().length > 0 && !error.error.startsWith('<')
        ? error.error
        : null);

    if (error.status === 0) {
      errorMessage = 'Impossible de contacter le serveur. Vérifiez votre connexion.';
    } else if (error.status === 401) {
      errorMessage = 'Session expirée ou authentification requise. Veuillez vous reconnecter.';
    } else if (error.status === 403) {
      errorMessage = 'Accès refusé. Vous n\'avez pas les permissions nécessaires.';
    } else if (error.status === 429) {
      if (backendMessage && backendMessage.includes('Essai gratuit')) {
        this.guestTrialsRemaining$.next(0);
        errorMessage = backendMessage;
      } else if (backendMessage && backendMessage.includes('Aperçu découverte')) {
        this.guestDecodesRemaining$.next(0);
        errorMessage = backendMessage;
      } else if (backendMessage) {
        errorMessage = backendMessage;
      } else if (environment.betaMode) {
        errorMessage = 'Merci pour votre participation. Veuillez contacter l\'administrateur si vous souhaitez continuer à tester.';
      } else {
        errorMessage = 'Quota de crédits épuisé. Veuillez renouveler votre plan ou choisir un autre plan.';
      }
    } else if (error.status === 503) {
      errorMessage = backendMessage || 'Service de vérification des quotas temporairement indisponible. Réessayez dans un instant.';
    } else if (error.status === 404) {
      errorMessage = backendMessage || 'Code douanier introuvable dans la nomenclature.';
    } else if (error.status === 400) {
      errorMessage = backendMessage || 'Code douanier invalide. Saisissez 2, 4, 6, 8 ou 10 chiffres.';
    } else if (error.status >= 500) {
      errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
    } else if (backendMessage) {
      errorMessage = backendMessage;
    }

    console.error('Erreur HTTP:', {
      status: error.status,
      message: errorMessage,
      error
    });

    return throwError(() => new ApiSearchError(errorMessage, error.status));
  }
}
