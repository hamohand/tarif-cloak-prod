import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BatchSearchService,
  SearchItem,
  BatchStatusResponse,
  BatchResultsResponse,
  ParsedHsCode,
  UserBatchSummary,
  BatchApiError
} from '../services/batch-search.service';
import { SearchStateService, TariffSearchEndpoint, TariffZone } from '../services/search-state.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';

interface BatchInfo {
  batchId: string;
  ownerUserId?: string;
  submittedAt: Date;
  endpoint?: TariffSearchEndpoint;
  zone?: TariffZone;
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

  // Subscriptions pour le polling, la zone active et l'utilisateur connecté
  private pollingSubscriptions: Map<string, Subscription> = new Map();
  private zoneSub?: Subscription;
  private authSub?: Subscription;
  private currentUserId: string | null = null;
  currentZone: TariffZone = 'DZ';

  constructor(
    private batchSearchService: BatchSearchService,
    private notificationService: NotificationService,
    private authService: AuthService,
    public state: SearchStateService
  ) {
    this.currentZone = this.state.zone;
  }

  ngOnInit(): void {
    // Supprimer définitivement l'ancienne clé globale partagée non rattachée à un utilisateur
    this.purgeLegacySharedStorage();

    this.zoneSub = this.state.selectedZone$.subscribe(zone => {
      this.currentZone = zone;
    });

    this.switchActiveUser(this.authService.getCurrentUserId());

    this.authSub = this.authService.isAuthenticated().subscribe(isAuth => {
      const uid = isAuth ? this.authService.getCurrentUserId() : null;
      if (uid !== this.currentUserId) {
        this.switchActiveUser(uid);
      }
    });
  }

  ngOnDestroy(): void {
    this.zoneSub?.unsubscribe();
    this.authSub?.unsubscribe();
    this.stopAllPolling();
  }

  private purgeLegacySharedStorage(): void {
    try {
      localStorage.removeItem('batches');
    } catch {
      // Ignorer erreurs localStorage
    }
  }

  private getUserStorageKey(userId: string | null): string | null {
    if (!userId || !userId.trim()) {
      return null;
    }
    return `tci_batches_u_${userId.trim()}`;
  }

  private stopAllPolling(): void {
    this.pollingSubscriptions.forEach(sub => sub.unsubscribe());
    this.pollingSubscriptions.clear();
  }

  private switchActiveUser(userId: string | null): void {
    this.purgeLegacySharedStorage();
    this.stopAllPolling();
    this.currentUserId = userId;
    this.batches = [];
    this.selectedBatch = null;

    if (!userId) {
      return;
    }

    this.loadBatchesFromStorage(userId);
    this.resumePollingForInProgressBatches();
    this.syncMyBatchesFromServer(userId);
  }

  private syncMyBatchesFromServer(userId: string): void {
    this.batchSearchService.getMyBatches().subscribe({
      next: (serverBatches: UserBatchSummary[]) => {
        if (this.currentUserId !== userId || !Array.isArray(serverBatches)) {
          return;
        }
        const byId = new Map<string, BatchInfo>();
        for (const existing of this.batches) {
          byId.set(existing.batchId, existing);
        }

        for (const sb of serverBatches) {
          if (!sb?.batchId) continue;
          let termsMap: Map<string, string> | undefined;
          if (sb.searchTerms && typeof sb.searchTerms === 'object') {
            termsMap = new Map<string, string>();
            for (const [k, v] of Object.entries(sb.searchTerms)) {
              termsMap.set(k, String(v ?? ''));
            }
          }
          const endpoint: TariffSearchEndpoint = sb.endpoint === 'positions10' ? 'positions10' : 'positions6';
          const zone: TariffZone = sb.zone === 'EU' ? 'EU' : 'DZ';
          const local = byId.get(sb.batchId);
          if (local) {
            local.ownerUserId = userId;
            local.endpoint = local.endpoint || endpoint;
            local.zone = local.zone || zone;
            if ((!local.searchTermsMap || local.searchTermsMap.size === 0) && termsMap) {
              local.searchTermsMap = termsMap;
            }
          } else {
            byId.set(sb.batchId, {
              batchId: sb.batchId,
              ownerUserId: userId,
              submittedAt: sb.submittedAt ? new Date(sb.submittedAt) : new Date(),
              endpoint,
              zone,
              searchTermsMap: termsMap
            });
          }
        }

        this.batches = Array.from(byId.values()).sort(
          (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()
        );
        this.saveBatchesToStorage();
        this.resumePollingForInProgressBatches();
      },
      error: (err) => {
        console.debug('Synchronisation serveur des batches ignorée:', err?.message || err);
      }
    });
  }

  private evictForbiddenBatch(batchId: string): void {
    this.stopPollingForBatch(batchId);
    this.batches = this.batches.filter(b => b.batchId !== batchId);
    if (this.selectedBatch?.batchId === batchId) {
      this.selectedBatch = null;
    }
    this.saveBatchesToStorage();
  }

  get searchEndpoint(): TariffSearchEndpoint {
    return this.state.batchSearchEndpoint;
  }

  set searchEndpoint(val: TariffSearchEndpoint) {
    this.state.batchSearchEndpoint = val;
  }

  setSearchEndpoint(endpoint: TariffSearchEndpoint): void {
    if (this.isSubmitting) {
      return;
    }
    this.searchEndpoint = endpoint;
  }

  get nationalCodeShortLabel(): string {
    return this.currentZone === 'EU' ? 'NC8 (UE)' : 'P10 (DZ)';
  }

  get nationalCodeDigitsLabel(): string {
    return this.currentZone === 'EU'
      ? '8 chiffres · Nomenclature Combinée UE'
      : '10 chiffres · Tarif douanier algérien';
  }

  getBatchModeBadge(batch: BatchInfo | null | undefined): string {
    const ep = batch?.endpoint || 'positions6';
    const zn = batch?.zone || 'DZ';
    if (ep === 'positions10') {
      return zn === 'EU' ? 'NC8 · UE' : 'P10 · DZ';
    }
    return 'HS-06';
  }

  getBatchCodeLabel(batch: BatchInfo | null | undefined): string {
    const ep = batch?.endpoint || 'positions6';
    const zn = batch?.zone || 'DZ';
    if (ep === 'positions10') {
      return zn === 'EU' ? 'Code NC8 (UE)' : 'Code P10 (DZ)';
    }
    return 'Code HS-06';
  }

  private getBatchModeSlug(batch: BatchInfo): string {
    const ep = batch.endpoint || 'positions6';
    const zn = batch.zone || 'DZ';
    if (ep === 'positions10') {
      return zn === 'EU' ? 'nc8-ue' : 'p10-dz';
    }
    return 'hs6';
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

    const ownerUserId = this.authService.getCurrentUserId();
    if (!ownerUserId) {
      this.notificationService.error('Veuillez vous connecter pour soumettre un batch.');
      return;
    }
    if (this.currentUserId !== ownerUserId) {
      this.switchActiveUser(ownerUserId);
    }

    const endpoint: TariffSearchEndpoint = this.searchEndpoint;
    const zone: TariffZone = this.currentZone;

    // Créer les items de recherche et le mapping customId -> searchTerm
    const searchTermsMap = new Map<string, string>();
    const searches: SearchItem[] = searchTerms.map((term, index) => {
      const customId = `search-${Date.now()}-${index}`;
      searchTermsMap.set(customId, term);
      return {
        customId: customId,
        searchTerm: term,
        ragContext: this.buildDefaultRagContext(endpoint, zone)
      };
    });

    // Soumettre le batch
    this.isSubmitting = true;

    this.batchSearchService.submitBatch(searches, endpoint, zone).subscribe({
      next: (response) => {
        console.log('Batch soumis avec succès:', response);

        // Créer une entrée de batch rattachée strictement à l'utilisateur connecté
        const batchInfo: BatchInfo = {
          batchId: response.batchId,
          ownerUserId: ownerUserId,
          submittedAt: new Date(),
          endpoint: endpoint,
          zone: zone,
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

    if (!batch.status || (batch.status.status === 'ended' && !batch.status.resultsAvailable && !batch.results)) {
      this.refreshBatchStatus(batch.batchId);
    } else if (batch.status.status === 'ended' && batch.status.resultsAvailable && !batch.results) {
      this.loadBatchResults(batch.batchId);
    }
  }

  /**
   * Charge les résultats d'un batch terminé.
   */
  loadBatchResults(batchId: string): void {
    this.isLoadingResults = true;
    const existingBatch = this.batches.find(b => b.batchId === batchId);
    const endpoint: TariffSearchEndpoint = existingBatch?.endpoint || 'positions6';
    const zone: TariffZone = existingBatch?.zone || 'DZ';

    this.batchSearchService.getBatchResults(batchId, endpoint, zone).subscribe({
      next: (results) => {
        const hydrated = this.hydrateResults(results);
        const batch = this.batches.find(b => b.batchId === batchId);
        if (batch) {
          batch.results = hydrated;
          batch.error = undefined;
          if (this.selectedBatch?.batchId === batchId) {
            this.selectedBatch = batch;
          }
          this.saveBatchesToStorage();
        }
        this.isLoadingResults = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des résultats:', error);
        if (error instanceof BatchApiError && error.status === 403) {
          this.evictForbiddenBatch(batchId);
          this.isLoadingResults = false;
          return;
        }
        const batch = this.batches.find(b => b.batchId === batchId);
        if (batch) {
          batch.error = error.message;
        }
        this.isLoadingResults = false;
      }
    });
  }

  /**
   * Pré-parse une seule fois le contenu JSON des résultats pour l'affichage et l'export CSV.
   */
  private hydrateResults(results: BatchResultsResponse): BatchResultsResponse {
    if (results && Array.isArray(results.results)) {
      results.results = results.results.map(r => ({
        ...r,
        parsedCodes: r.resultType === 'succeeded' && r.content
          ? this.parseResultContent(r.content)
          : []
      }));
    }
    return results;
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
          if (this.selectedBatch?.batchId === batchId) {
            this.selectedBatch = batch;
          }
          this.saveBatchesToStorage();

          if (status.status === 'ended') {
            this.stopPollingForBatch(batchId);
            if (status.resultsAvailable && !batch.results) {
              this.loadBatchResults(batchId);
            }
          }
        }
      },
      error: (error) => {
        console.error('Erreur lors du rafraîchissement du statut:', error);
        if (error instanceof BatchApiError && error.status === 403) {
          this.evictForbiddenBatch(batchId);
        }
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
          if (this.selectedBatch?.batchId === batchId) {
            this.selectedBatch = batch;
          }
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
        if (error instanceof BatchApiError && error.status === 403) {
          this.evictForbiddenBatch(batchId);
          return;
        }
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
   * Reprend le polling pour les batches en cours ou sans statut initial.
   */
  private resumePollingForInProgressBatches(): void {
    this.batches
      .filter(b => !b.status || b.status.status === 'in_progress')
      .forEach(b => this.startPollingForBatch(b.batchId));
  }

  /**
   * Parse le contenu d'un résultat JSON.
   */
  parseResultContent(content: string): ParsedHsCode[] {
    return this.batchSearchService.parseResultContent(content) || [];
  }

  /**
   * Récupère le terme de recherche associé à un customId en gérant Map et objet désérialisé.
   */
  getSearchTerm(batch: BatchInfo | null | undefined, customId: string): string {
    if (!batch?.searchTermsMap || !customId) {
      return '';
    }
    const mapOrObj: unknown = batch.searchTermsMap;
    if (mapOrObj instanceof Map) {
      const val = mapOrObj.get(customId);
      return val !== undefined && val !== null ? String(val) : '';
    }
    if (typeof mapOrObj === 'object' && mapOrObj !== null) {
      const record = mapOrObj as Record<string, unknown>;
      const val = record[customId];
      return val !== undefined && val !== null ? String(val) : '';
    }
    return '';
  }

  /**
   * Sauvegarde les batches dans localStorage sous une clé propre à l'utilisateur connecté.
   */
  private saveBatchesToStorage(): void {
    try {
      const storageKey = this.getUserStorageKey(this.currentUserId);
      if (!storageKey || !this.currentUserId) {
        return;
      }
      const ownerId = this.currentUserId;
      // Ne sauvegarder que les métadonnées essentielles appartenant à cet utilisateur
      const batchesToSave = this.batches
        .filter(b => !b.ownerUserId || b.ownerUserId === ownerId)
        .map(b => {
          let serializedMap: Record<string, string> | undefined;
          if (b.searchTermsMap instanceof Map) {
            serializedMap = Object.fromEntries(b.searchTermsMap);
          } else if (b.searchTermsMap && typeof b.searchTermsMap === 'object') {
            serializedMap = b.searchTermsMap as unknown as Record<string, string>;
          }
          return {
            batchId: b.batchId,
            ownerUserId: ownerId,
            submittedAt: b.submittedAt,
            endpoint: b.endpoint || 'positions6',
            zone: b.zone || 'DZ',
            status: b.status,
            searchTermsMap: serializedMap
          };
        });
      localStorage.setItem(storageKey, JSON.stringify(batchesToSave));
    } catch (e) {
      console.warn('Impossible de sauvegarder les batches dans localStorage:', e);
    }
  }

  /**
   * Charge uniquement les batches appartenant à l'utilisateur donné depuis localStorage.
   */
  private loadBatchesFromStorage(userId: string): void {
    try {
      const storageKey = this.getUserStorageKey(userId);
      if (!storageKey) {
        this.batches = [];
        return;
      }
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        this.batches = JSON.parse(saved)
          .filter((b: any) => b && b.ownerUserId === userId)
          .map((b: any): BatchInfo => {
            let restoredMap: Map<string, string> | undefined;
            if (Array.isArray(b.searchTermsMap)) {
              restoredMap = new Map<string, string>();
              for (const entry of b.searchTermsMap) {
                if (Array.isArray(entry) && entry.length >= 2) {
                  restoredMap.set(String(entry[0]), String(entry[1] ?? ''));
                }
              }
            } else if (b.searchTermsMap && typeof b.searchTermsMap === 'object') {
              restoredMap = new Map<string, string>();
              for (const [k, v] of Object.entries(b.searchTermsMap as Record<string, unknown>)) {
                restoredMap.set(k, String(v ?? ''));
              }
            }
            const endpoint: TariffSearchEndpoint = b.endpoint === 'positions10' ? 'positions10' : 'positions6';
            const zone: TariffZone = b.zone === 'EU' ? 'EU' : 'DZ';
            return {
              ...b,
              ownerUserId: userId,
              endpoint,
              zone,
              submittedAt: new Date(b.submittedAt),
              searchTermsMap: restoredMap
            };
          });
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

    let parsedTerms: string[];
    // Excel et ODS sont convertis en TSV dans readFile(), donc on les traite comme TSV
    if (extension === 'tsv' || extension === 'xls' || extension === 'xlsx' || extension === 'ods') {
      parsedTerms = content
        .split(/\r?\n/)
        .map(line => {
          const columns = line.split('\t');
          return columns[0].trim();
        })
        .filter(term => term.length > 0);
    } else if (extension === 'csv') {
      parsedTerms = content
        .split(/\r?\n/)
        .map(line => {
          const columns = line.split(',');
          return columns[0].trim().replace(/^["']|["']$/g, '');
        })
        .filter(term => term.length > 0);
    } else {
      parsedTerms = content
        .split(/\r?\n/)
        .map(term => term.trim())
        .filter(term => term.length > 0);
    }

    if (parsedTerms.length > 1) {
      const firstHeader = parsedTerms[0].toLowerCase();
      if (firstHeader === 'article' || firstHeader === 'articles') {
        parsedTerms = parsedTerms.slice(1);
      }
    }
    return parsedTerms;
  }

  /**
   * Construit un marqueur de contexte indiquant le type et la zone du batch.
   */
  private buildDefaultRagContext(endpoint: TariffSearchEndpoint, zone: TariffZone): string {
    if (endpoint === 'positions10') {
      return zone === 'EU'
        ? 'RAG pour la recherche des : POSITIONS10 (NC8 UE)\n\n'
        : 'RAG pour la recherche des : POSITIONS10 (P10 DZ)\n\n';
    }
    return 'RAG pour la recherche des : POSITIONS6\n\n';
  }

  private escapeCsvField(value: unknown): string {
    if (value === null || value === undefined) {
      return '""';
    }
    const str = String(value).replace(/\r?\n/g, ' ').replace(/"/g, '""');
    return `"${str}"`;
  }

  /**
   * Télécharge les résultats en CSV (UTF-8 avec BOM pour compatibilité Excel).
   */
  downloadResultsAsCsv(batch: BatchInfo | null): void {
    if (!batch || !batch.results || !Array.isArray(batch.results.results)) {
      this.notificationService.error('Aucun résultat disponible à télécharger pour ce batch.');
      return;
    }

    if (batch.results.results.length === 0) {
      this.notificationService.warning('Le batch ne contient aucune ligne de résultat.');
      return;
    }

    try {
      const modeBadge = this.getBatchModeBadge(batch);
      const zoneLabel = (batch.zone || 'DZ') === 'EU' ? 'UE' : 'DZ';
      const csvLines: string[] = [
        'ID,Terme de recherche,Type,Zone,Statut,Code douanier,Description officielle,Justification,Input Tokens,Output Tokens'
      ];

      batch.results.results.forEach(result => {
        const customId = result.customId || '';
        const searchTerm = this.getSearchTerm(batch, customId);

        if (result.resultType === 'succeeded' && result.content) {
          const codes = result.parsedCodes ?? this.parseResultContent(result.content);
          if (codes.length > 0) {
            codes.forEach(code => {
              csvLines.push([
                this.escapeCsvField(customId),
                this.escapeCsvField(searchTerm),
                this.escapeCsvField(modeBadge),
                this.escapeCsvField(zoneLabel),
                this.escapeCsvField('Succès'),
                this.escapeCsvField(code?.code ?? ''),
                this.escapeCsvField(code?.description ?? ''),
                this.escapeCsvField(code?.justification ?? ''),
                String(result.inputTokens ?? 0),
                String(result.outputTokens ?? 0)
              ].join(','));
            });
          } else {
            csvLines.push([
              this.escapeCsvField(customId),
              this.escapeCsvField(searchTerm),
              this.escapeCsvField(modeBadge),
              this.escapeCsvField(zoneLabel),
              this.escapeCsvField('Aucun code trouvé'),
              '""',
              '""',
              this.escapeCsvField(result.content),
              String(result.inputTokens ?? 0),
              String(result.outputTokens ?? 0)
            ].join(','));
          }
        } else {
          csvLines.push([
            this.escapeCsvField(customId),
            this.escapeCsvField(searchTerm),
            this.escapeCsvField(modeBadge),
            this.escapeCsvField(zoneLabel),
            this.escapeCsvField('Erreur'),
            '""',
            '""',
            this.escapeCsvField(result.errorMessage || result.errorType || 'Erreur lors du traitement'),
            '0',
            '0'
          ].join(','));
        }
      });

      // BOM UTF-8 + CRLF (RFC 4180) pour ouverture directe dans Excel
      const csvContent = '\uFEFF' + csvLines.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const safeBatchId = String(batch.batchId || 'export').replace(/[^a-zA-Z0-9_-]/g, '_');
      const slug = this.getBatchModeSlug(batch);
      const filename = `batch-${slug}-${safeBatchId}-results.csv`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
        window.URL.revokeObjectURL(url);
      }, 5000);

      this.notificationService.success(`Export CSV téléchargé (${filename})`);
    } catch (err) {
      console.error('Erreur lors de la génération du CSV batch:', err);
      this.notificationService.error('Erreur lors de la génération du fichier CSV.');
    }
  }
}
