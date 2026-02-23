import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface DecodeCodeItem {
  code: string;
  description: string;
}

export interface DecodeResult {
  codeRecherche: string;
  niveau: 'CHAPITRE' | 'POSITION4' | 'POSITION6' | 'POSITION8';
  section: DecodeCodeItem;
  chapitre: DecodeCodeItem;
  position4: DecodeCodeItem | null;
  positions6: DecodeCodeItem[];
  positions8?: DecodeCodeItem[]; // enfants à 8 chiffres (si POSITION6), ou code exact (si POSITION8)
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private apiUrl = '/api/recherche';
  private conversionApiUrl = '/api/conversion';
  private decodeApiUrl = '/api/decode';

  constructor(private http: HttpClient) { }

  decodeCode(code: string): Observable<DecodeResult> {
    return this.http.get<DecodeResult>(this.decodeApiUrl, {
      params: { code }
    }).pipe(
      catchError(this.handleError)
    );
  }

  searchCodes(searchTerm: string): Observable<any[]> {

    // Le backend produit 'application/json', on s'attend donc à recevoir du JSON.
    // 'responseType: 'json'' est le comportement par défaut de HttpClient.
    return this.http.get<any[]>(`${this.apiUrl}/positions6`, {
      params: { termeRecherche: searchTerm }
      // responseType: 'text' a été supprimé ici.
    }).pipe(
      // HttpClient parse maintenant automatiquement le JSON.
      // La réponse est directement un tableau JavaScript.
      map((response: any) => {
        // On s'assure juste que la réponse est bien un tableau.
        if (!Array.isArray(response)) {
          console.warn('La réponse reçue du serveur n\'est pas un tableau.', response);
          return [];
        }
        return response;
      }),
      catchError(this.handleError)
    );
  }

  convertFile(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post(`${this.conversionApiUrl}/convert`, formData, {
      responseType: 'text'
    }).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Une erreur est survenue';

    if (error.status === 0) {
      // Erreur réseau ou CORS
      errorMessage = 'Impossible de contacter le serveur. Vérifiez votre connexion.';
    } else if (error.status === 401) {
      errorMessage = 'Session expirée. Veuillez vous reconnecter.';
    } else if (error.status === 403) {
      errorMessage = 'Accès refusé. Vous n\'avez pas les permissions nécessaires.';
    } else if (error.status === 404) {
      errorMessage = 'Code HS introuvable dans la base de données.';
    } else if (error.status === 400) {
      const msg = error.error?.message || error.error;
      errorMessage = typeof msg === 'string' ? msg : 'Code HS invalide. Saisissez 2, 4, 6 ou 8 chiffres.';
    } else if (error.status >= 500) {
      errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
    } else if (error.error) {
      errorMessage = typeof error.error === 'string'
        ? error.error
        : JSON.stringify(error.error);
    }

    console.error('Erreur HTTP:', {
      status: error.status,
      message: errorMessage,
      error: error
    });

    return throwError(() => new Error(errorMessage));
  }
}
