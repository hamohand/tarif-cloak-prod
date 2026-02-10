import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, interval } from 'rxjs';
import { catchError, map, switchMap, takeWhile, startWith } from 'rxjs/operators';

// Modèles TypeScript pour les batches
export interface SearchItem {
  customId: string;
  searchTerm: string;
  ragContext: string;
}

export interface BatchSearchRequest {
  searches: SearchItem[];
}

export interface BatchSubmitResponse {
  batchId: string;
  message: string;
  statusCode: number;
}

export interface BatchStatusResponse {
  batchId: string;
  status: string; // 'in_progress' | 'ended'
  requestCounts: {
    processing: number;
    succeeded: number;
    errored: number;
    canceled: number;
    expired: number;
  };
  createdAt: string;
  endedAt?: string;
  resultsAvailable: boolean;
  message: string;
}

export interface BatchResult {
  customId: string;
  resultType: string; // 'succeeded' | 'errored' | 'canceled' | 'expired'
  content?: string;
  inputTokens?: number;
  outputTokens?: number;
  errorType?: string;
  errorMessage?: string;
}

export interface BatchResultsResponse {
  batchId: string;
  results: BatchResult[];
  message: string;
  totalResults: number;
  successCount: number;
  errorCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class BatchSearchService {
  private apiUrl = '/api/batch-search';

  constructor(private http: HttpClient) {}

  /**
   * Soumet un batch de recherches de codes HS.
   * @param searches Liste des recherches à traiter
   * @returns Observable avec l'ID du batch créé
   */
  submitBatch(searches: SearchItem[]): Observable<BatchSubmitResponse> {
    const request: BatchSearchRequest = { searches };

    return this.http.post<BatchSubmitResponse>(`${this.apiUrl}/submit`, request).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère le statut d'un batch.
   * @param batchId L'ID du batch
   * @returns Observable avec le statut du batch
   */
  getBatchStatus(batchId: string): Observable<BatchStatusResponse> {
    return this.http.get<BatchStatusResponse>(`${this.apiUrl}/status/${batchId}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Récupère les résultats d'un batch terminé.
   * @param batchId L'ID du batch
   * @returns Observable avec les résultats du batch
   */
  getBatchResults(batchId: string): Observable<BatchResultsResponse> {
    return this.http.get<BatchResultsResponse>(`${this.apiUrl}/results/${batchId}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Annule un batch en cours de traitement.
   * @param batchId L'ID du batch à annuler
   * @returns Observable avec le résultat de l'annulation
   */
  cancelBatch(batchId: string): Observable<{ batchId: string; canceled: boolean; message: string }> {
    return this.http.post<{ batchId: string; canceled: boolean; message: string }>(
      `${this.apiUrl}/cancel/${batchId}`,
      {}
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Poll automatique du statut d'un batch jusqu'à ce qu'il soit terminé.
   * @param batchId L'ID du batch
   * @param intervalMs Intervalle de polling en millisecondes (défaut: 30 secondes)
   * @returns Observable qui émet le statut à chaque poll jusqu'à la fin
   */
  pollBatchStatus(batchId: string, intervalMs: number = 30000): Observable<BatchStatusResponse> {
    return interval(intervalMs).pipe(
      startWith(0), // Émettre immédiatement
      switchMap(() => this.getBatchStatus(batchId)),
      takeWhile(
        status => status.status === 'in_progress',
        true // Inclure la dernière émission (quand status !== 'in_progress')
      )
    );
  }

  /**
   * Parse le contenu JSON d'un résultat de batch.
   * @param content Le contenu JSON en string
   * @returns Les codes HS parsés ou null en cas d'erreur
   */
  parseResultContent(content: string): any[] | null {
    try {
      return JSON.parse(content);
    } catch (e) {
      console.error('Erreur lors du parsing du contenu:', e);
      return null;
    }
  }

  /**
   * Calcule les statistiques d'un batch.
   */
  calculateBatchStats(results: BatchResult[]): {
    total: number;
    succeeded: number;
    errored: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
  } {
    const succeeded = results.filter(r => r.resultType === 'succeeded').length;
    const errored = results.filter(r => r.resultType === 'errored').length;

    const totalInputTokens = results.reduce((sum, r) => sum + (r.inputTokens || 0), 0);
    const totalOutputTokens = results.reduce((sum, r) => sum + (r.outputTokens || 0), 0);

    return {
      total: results.length,
      succeeded,
      errored,
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens
    };
  }

  /**
   * Gestion des erreurs HTTP.
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Une erreur est survenue';

    if (error.status === 0) {
      errorMessage = 'Impossible de contacter le serveur. Vérifiez votre connexion.';
    } else if (error.status === 401) {
      errorMessage = 'Session expirée. Veuillez vous reconnecter.';
    } else if (error.status === 403) {
      errorMessage = 'Accès refusé. Vous n\'avez pas les permissions nécessaires.';
    } else if (error.status === 404) {
      errorMessage = 'Batch introuvable ou résultats non disponibles.';
    } else if (error.status >= 500) {
      errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
    } else if (error.error) {
      if (typeof error.error === 'string') {
        errorMessage = error.error;
      } else if (error.error.message) {
        errorMessage = error.error.message;
      }
    }

    console.error('Erreur HTTP Batch:', {
      status: error.status,
      message: errorMessage,
      error: error
    });

    return throwError(() => new Error(errorMessage));
  }
}
