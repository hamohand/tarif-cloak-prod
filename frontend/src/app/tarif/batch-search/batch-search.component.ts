import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BatchSearchService,
  SearchItem,
  BatchStatusResponse,
  BatchResultsResponse
} from '../services/batch-search.service';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';

interface BatchInfo {
  batchId: string;
  submittedAt: Date;
  status?: BatchStatusResponse;
  results?: BatchResultsResponse;
  error?: string;
  searchTermsMap?: Map<string, string>; // customId -> searchTerm
}

@Component({
  selector: 'app-batch-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './batch-search.component.html',
  styleUrls: ['./batch-search.component.css']
})
export class BatchSearchComponent implements OnInit, OnDestroy {
  // État de l'upload de fichier
  selectedFile: File | null = null;
  fileContent: string = '';

  // Terme de recherche manuel (pour test rapide)
  manualSearchTerms: string = '';

  // Liste des batches soumis
  batches: BatchInfo[] = [];

  // Batch actuellement sélectionné pour affichage
  selectedBatch: BatchInfo | null = null;

  // État de chargement
  isSubmitting: boolean = false;
  isLoadingResults: boolean = false;

  // Subscriptions pour le polling
  private pollingSubscriptions: Map<string, Subscription> = new Map();

  constructor(private batchSearchService: BatchSearchService) {}

  ngOnInit(): void {
    // Charger les batches depuis localStorage si disponible
    this.loadBatchesFromStorage();

    // Reprendre le polling pour les batches en cours
    this.resumePollingForInProgressBatches();
  }

  ngOnDestroy(): void {
    // Nettoyer toutes les subscriptions de polling
    this.pollingSubscriptions.forEach(sub => sub.unsubscribe());
    this.pollingSubscriptions.clear();
  }

  /**
   * Gère la sélection d'un fichier.
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.readFile();
    }
  }

  /**
   * Lit le contenu du fichier sélectionné.
   * Pour Excel/ODS: utilise ArrayBuffer
   * Pour TXT/CSV/TSV: utilise Text
   */
  private readFile(): void {
    if (!this.selectedFile) return;

    const extension = this.selectedFile.name.split('.').pop()?.toLowerCase();
    const isExcelOrOds = ['xls', 'xlsx', 'ods'].includes(extension || '');

    const reader = new FileReader();

    if (isExcelOrOds) {
      // Pour Excel/ODS: lire comme ArrayBuffer
      reader.onload = (e) => {
        const data = e.target?.result as ArrayBuffer;
        if (data) {
          try {
            const workbook = XLSX.read(data, { type: 'array' });
            // Prendre la première feuille
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            // Convertir en CSV (avec tabulation comme séparateur)
            this.fileContent = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
          } catch (error) {
            console.error('Erreur lors de la lecture du fichier Excel/ODS:', error);
            alert('Erreur lors de la lecture du fichier. Assurez-vous que c\'est un fichier Excel/ODS valide.');
          }
        }
      };
      reader.readAsArrayBuffer(this.selectedFile);
    } else {
      // Pour TXT/CSV/TSV: lire comme texte
      reader.onload = (e) => {
        this.fileContent = e.target?.result as string;
      };
      reader.readAsText(this.selectedFile);
    }
  }

  /**
   * Soumet un batch de recherches depuis le fichier ou le texte manuel.
   */
  submitBatch(): void {
    // Déterminer la source des termes de recherche
    let searchTerms: string[] = [];

    if (this.manualSearchTerms.trim()) {
      // Mode manuel : split par ligne
      searchTerms = this.manualSearchTerms
        .split('\n')
        .map(term => term.trim())
        .filter(term => term.length > 0);
    } else if (this.fileContent) {
      // Mode fichier : détecter le format et parser en conséquence
      searchTerms = this.parseFileContent(this.fileContent, this.selectedFile?.name || '');
    }

    if (searchTerms.length === 0) {
      alert('Veuillez saisir des termes de recherche ou sélectionner un fichier.');
      return;
    }

    if (searchTerms.length > 1000) {
      alert('Maximum 1000 recherches par batch. Veuillez réduire la liste.');
      return;
    }

    // Créer les items de recherche et le mapping customId -> searchTerm
    const searchTermsMap = new Map<string, string>();
    const searches: SearchItem[] = searchTerms.map((term, index) => {
      const customId = `search-${Date.now()}-${index}`;
      searchTermsMap.set(customId, term);
      return {
        customId: customId,
        searchTerm: term,
        ragContext: this.buildDefaultRagContext() // RAG simplifié pour l'exemple
      };
    });

    // Soumettre le batch
    this.isSubmitting = true;

    this.batchSearchService.submitBatch(searches).subscribe({
      next: (response) => {
        console.log('Batch soumis avec succès:', response);

        // Créer une entrée de batch avec le mapping des termes de recherche
        const batchInfo: BatchInfo = {
          batchId: response.batchId,
          submittedAt: new Date(),
          searchTermsMap: searchTermsMap
        };

        this.batches.unshift(batchInfo);
        this.selectedBatch = batchInfo;
        this.saveBatchesToStorage();

        // Démarrer le polling pour ce batch
        this.startPollingForBatch(response.batchId);

        // Réinitialiser le formulaire
        this.manualSearchTerms = '';
        this.fileContent = '';
        this.selectedFile = null;

        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Erreur lors de la soumission du batch:', error);
        alert('Erreur lors de la soumission: ' + error.message);
        this.isSubmitting = false;
      }
    });
  }

  /**
   * Sélectionne un batch pour afficher ses détails.
   */
  selectBatch(batch: BatchInfo): void {
    this.selectedBatch = batch;

    // Si le batch est terminé mais n'a pas de résultats, les charger
    if (batch.status?.status === 'ended' && batch.status.resultsAvailable && !batch.results) {
      this.loadBatchResults(batch.batchId);
    }
  }

  /**
   * Charge les résultats d'un batch terminé.
   */
  loadBatchResults(batchId: string): void {
    this.isLoadingResults = true;

    this.batchSearchService.getBatchResults(batchId).subscribe({
      next: (results) => {
        const batch = this.batches.find(b => b.batchId === batchId);
        if (batch) {
          batch.results = results;
          this.saveBatchesToStorage();
        }
        this.isLoadingResults = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des résultats:', error);
        const batch = this.batches.find(b => b.batchId === batchId);
        if (batch) {
          batch.error = error.message;
        }
        this.isLoadingResults = false;
      }
    });
  }

  /**
   * Annule un batch en cours.
   */
  cancelBatch(batchId: string): void {
    if (!confirm('Êtes-vous sûr de vouloir annuler ce batch ?')) {
      return;
    }

    this.batchSearchService.cancelBatch(batchId).subscribe({
      next: (response) => {
        console.log('Batch annulé:', response);
        // Arrêter le polling
        this.stopPollingForBatch(batchId);
        // Recharger le statut
        this.refreshBatchStatus(batchId);
      },
      error: (error) => {
        console.error('Erreur lors de l\'annulation:', error);
        alert('Erreur lors de l\'annulation: ' + error.message);
      }
    });
  }

  /**
   * Rafraîchit le statut d'un batch.
   */
  refreshBatchStatus(batchId: string): void {
    this.batchSearchService.getBatchStatus(batchId).subscribe({
      next: (status) => {
        const batch = this.batches.find(b => b.batchId === batchId);
        if (batch) {
          batch.status = status;
          this.saveBatchesToStorage();
        }
      },
      error: (error) => {
        console.error('Erreur lors du rafraîchissement du statut:', error);
      }
    });
  }

  /**
   * Démarre le polling pour un batch.
   */
  private startPollingForBatch(batchId: string): void {
    // Éviter les doublons
    if (this.pollingSubscriptions.has(batchId)) {
      return;
    }

    const subscription = this.batchSearchService.pollBatchStatus(batchId, 30000).subscribe({
      next: (status) => {
        const batch = this.batches.find(b => b.batchId === batchId);
        if (batch) {
          batch.status = status;
          this.saveBatchesToStorage();

          // Si terminé, arrêter le polling et charger les résultats
          if (status.status === 'ended') {
            this.stopPollingForBatch(batchId);
            if (status.resultsAvailable) {
              this.loadBatchResults(batchId);
            }
          }
        }
      },
      error: (error) => {
        console.error('Erreur lors du polling:', error);
        this.stopPollingForBatch(batchId);
      }
    });

    this.pollingSubscriptions.set(batchId, subscription);
  }

  /**
   * Arrête le polling pour un batch.
   */
  private stopPollingForBatch(batchId: string): void {
    const subscription = this.pollingSubscriptions.get(batchId);
    if (subscription) {
      subscription.unsubscribe();
      this.pollingSubscriptions.delete(batchId);
    }
  }

  /**
   * Reprend le polling pour les batches en cours.
   */
  private resumePollingForInProgressBatches(): void {
    this.batches
      .filter(b => b.status?.status === 'in_progress')
      .forEach(b => this.startPollingForBatch(b.batchId));
  }

  /**
   * Parse le contenu d'un résultat JSON.
   */
  parseResultContent(content: string): any[] {
    return this.batchSearchService.parseResultContent(content) || [];
  }

  /**
   * Sauvegarde les batches dans localStorage.
   */
  private saveBatchesToStorage(): void {
    try {
      // Ne sauvegarder que les métadonnées essentielles (pas les résultats complets)
      const batchesToSave = this.batches.map(b => ({
        batchId: b.batchId,
        submittedAt: b.submittedAt,
        status: b.status,
        // Convertir Map en objet pour la sérialisation JSON
        searchTermsMap: b.searchTermsMap ? Object.fromEntries(b.searchTermsMap) : undefined
      }));
      localStorage.setItem('batches', JSON.stringify(batchesToSave));
    } catch (e) {
      console.warn('Impossible de sauvegarder les batches dans localStorage:', e);
    }
  }

  /**
   * Charge les batches depuis localStorage.
   */
  private loadBatchesFromStorage(): void {
    try {
      const saved = localStorage.getItem('batches');
      if (saved) {
        this.batches = JSON.parse(saved).map((b: any) => ({
          ...b,
          submittedAt: new Date(b.submittedAt),
          // Reconvertir l'objet en Map
          searchTermsMap: b.searchTermsMap ? new Map(Object.entries(b.searchTermsMap)) : undefined
        }));
      }
    } catch (e) {
      console.warn('Impossible de charger les batches depuis localStorage:', e);
    }
  }

  /**
   * Parse le contenu d'un fichier selon son extension.
   * Supporte .txt, .csv, .tsv, .xls, .xlsx, .ods
   */
  private parseFileContent(content: string, fileName: string): string[] {
    const extension = fileName.split('.').pop()?.toLowerCase();

    // Excel et ODS sont convertis en TSV dans readFile(), donc on les traite comme TSV
    if (extension === 'tsv' || extension === 'xls' || extension === 'xlsx' || extension === 'ods') {
      // Fichier TSV/Excel/ODS : extraire la première colonne de chaque ligne
      return content
        .split('\n')
        .map(line => {
          const columns = line.split('\t');
          // Prendre la première colonne (ou toute la ligne si pas de tabulation)
          return columns[0].trim();
        })
        .filter(term => term.length > 0);
    } else if (extension === 'csv') {
      // Fichier CSV : extraire la première colonne de chaque ligne
      // Note: pour un parsing CSV plus robuste (avec guillemets, etc.),
      // utilisez une bibliothèque comme PapaParse
      return content
        .split('\n')
        .map(line => {
          // Simple parsing CSV : split par virgule
          const columns = line.split(',');
          return columns[0].trim().replace(/^["']|["']$/g, ''); // Enlever les guillemets
        })
        .filter(term => term.length > 0);
    } else {
      // Fichier TXT ou autre : une ligne = un terme
      return content
        .split('\n')
        .map(term => term.trim())
        .filter(term => term.length > 0);
    }
  }

  /**
   * Construit un contexte RAG par défaut simplifié.
   * En production, vous devriez récupérer le vrai RAG depuis le backend.
   */
  private buildDefaultRagContext(): string {
    return 'RAG pour la recherche des : POSITIONS6\n\n';
  }

  /**
   * Télécharge les résultats en CSV.
   */
  downloadResultsAsCsv(batch: BatchInfo): void {
    if (!batch.results) return;

    const csvLines: string[] = [
      'ID,Terme de recherche,Statut,Code HS,Justification,Input Tokens,Output Tokens'
    ];

    batch.results.results.forEach(result => {
      // Récupérer le terme de recherche original depuis le mapping
      const searchTerm = batch.searchTermsMap?.get(result.customId) || '';

      if (result.resultType === 'succeeded' && result.content) {
        const codes = this.parseResultContent(result.content);
        codes.forEach(code => {
          csvLines.push([
            result.customId,
            `"${searchTerm.replace(/"/g, '""')}"`, // Échapper les guillemets pour CSV
            'Succès',
            code.code || '',
            `"${(code.justification || '').replace(/"/g, '""')}"`, // Échapper les guillemets
            result.inputTokens || 0,
            result.outputTokens || 0
          ].join(','));
        });
      } else {
        csvLines.push([
          result.customId,
          `"${searchTerm.replace(/"/g, '""')}"`, // Terme de recherche aussi pour les erreurs
          'Erreur',
          '',
          `"${(result.errorMessage || '').replace(/"/g, '""')}"`, // Échapper les guillemets
          0,
          0
        ].join(','));
      }
    });

    const csvContent = csvLines.join('\n');
    // Ajouter le BOM UTF-8 pour que les accents s'affichent correctement dans Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `batch-${batch.batchId}-results.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
