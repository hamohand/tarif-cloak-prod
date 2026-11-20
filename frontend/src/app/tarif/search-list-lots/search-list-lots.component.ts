import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Article} from "../shared/model/articles";
import {SearchService} from "../services/search.service";
import {SearchStateService, TariffSearchEndpoint, TariffZone} from "../services/search-state.service";
import {environment} from "../../../environments/environment";
import * as Papa from "papaparse";
import {
    Subscription,
    bufferCount,
    catchError,
    concatMap,
    delay,
    finalize,
    forkJoin,
    from,
    map,
    Observable,
    of,
    switchMap,
    tap,
    timer
} from "rxjs";
import {OAuthService} from 'angular-oauth2-oidc';

@Component({
  selector: 'app-search-list-lots',
  standalone: true,
    imports: [CommonModule, FormsModule],
  templateUrl: './search-list-lots.component.html',
  styleUrl: './search-list-lots.component.css'
})
export class SearchListLotsComponent implements OnInit, OnDestroy {
    lesarticles: Article[] = [];
    fileName: string = '';
    lastSavedFileName: string = '';
    reponse: string = ''
    isLoading: boolean = false;
    error: string | null = null;
    isSearchComplete: boolean = false;
    isSaved: boolean = false;

    completedCount: number = 0;
    totalCount: number = 0;

    // Paramètres configurables (valeurs initiales issues de l'environnement, modifiables avant lancement)
    batchSize: number = environment.listBatchSize ?? 5;
    delaySeconds: number = environment.listBatchDelaySeconds ?? 2;
    isWaitingBetweenBatches: boolean = false;

    public state = inject(SearchStateService);
    private searchService = inject(SearchService);
    private oauthService = inject(OAuthService);
    private zoneSub?: Subscription;

    currentZone: TariffZone = this.state.zone;
    executedEndpoint: TariffSearchEndpoint = this.state.listSearchEndpoint;
    executedZone: TariffZone = this.state.zone;

    ngOnInit(): void {
        this.zoneSub = this.state.selectedZone$.subscribe(zone => {
            this.currentZone = zone;
        });
    }

    ngOnDestroy(): void {
        this.zoneSub?.unsubscribe();
    }

    get searchEndpoint(): TariffSearchEndpoint {
        return this.state.listSearchEndpoint;
    }

    set searchEndpoint(val: TariffSearchEndpoint) {
        this.state.listSearchEndpoint = val;
    }

    setSearchEndpoint(endpoint: TariffSearchEndpoint): void {
        if (this.isLoading) {
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

    get selectedModeSummary(): string {
        if (this.searchEndpoint === 'positions10') {
            return this.currentZone === 'EU'
                ? 'NC8 (UE) — 8 chiffres'
                : 'P10 (DZ) — 10 chiffres';
        }
        return 'HS-06 International — 6 chiffres';
    }

    get creditsPerArticle(): number {
        return this.searchEndpoint === 'positions10' ? 15 : 10;
    }

    get estimatedTotalCredits(): number {
        return this.totalCount * this.creditsPerArticle;
    }

    get executedCodeColumnHeader(): string {
        if (this.executedEndpoint === 'positions10') {
            return this.executedZone === 'EU' ? 'Code NC8 (UE)' : 'Code P10 (DZ)';
        }
        return 'Code HS-06';
    }

    get executedModeSummary(): string {
        if (this.executedEndpoint === 'positions10') {
            return this.executedZone === 'EU'
                ? 'NC8 (UE) · 8 chiffres'
                : 'P10 (DZ) · 10 chiffres';
        }
        return 'HS-06 International · 6 chiffres';
    }

    private getExportModeSlug(): string {
        if (this.executedEndpoint === 'positions10') {
            return this.executedZone === 'EU' ? 'nc8-ue' : 'p10-dz';
        }
        return 'hs6';
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        const file = input.files[0];
        this.fileName = file.name;
        this.isLoading = true;
        this.lesarticles = [];
        this.error = null;
        this.isSearchComplete = false;
        this.isSaved = false;
        this.completedCount = 0;
        this.totalCount = 0;

        const fileName = file.name.toLowerCase();

        // Pour les fichiers .xls, .xlsx, .ods, on les envoie au backend pour conversion en TSV.
        if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx') || fileName.endsWith('.ods')) {
            this.searchService.convertFile(file).subscribe({
                next: (tsvContent: string) => {
                    this.parseCsvData(tsvContent);
                },
                error: (err: { error: any; message: any; }) => {
                    this.error = `Erreur lors de la conversion du fichier : ${err.error || err.message}`;
                    this.isLoading = false;
                }
            });
            // Pour les fichiers .csv, .tsv et .txt, on les lit directement.
        } else if (fileName.endsWith('.csv') || fileName.endsWith('.tsv') || fileName.endsWith('.txt')) {
            const reader = new FileReader();
            reader.onload = () => {
                const fileContent = reader.result as string;
                this.parseCsvData(fileContent);
            };
            reader.onerror = () => {
                this.error = "Impossible de lire le fichier sélectionné.";
                this.isLoading = false;
            };
            reader.readAsText(file, 'UTF-8');
        } else {
            this.error = "Format de fichier non supporté. Veuillez sélectionner un fichier .txt, .csv, .tsv, .xls, .xlsx, ou .ods.";
            this.isLoading = false;
        }
    }

    private parseCsvData(csvContent: string): void {
        Papa.parse<any>(csvContent, {
            header: true,
            skipEmptyLines: true,
            delimiter: "\t",
            transformHeader: (header: string) => {
                const normalizedHeader = header.toLowerCase().trim();
                if (normalizedHeader === 'articles') return 'article';
                return normalizedHeader;
            },
            complete: (results: { errors: any[]; data: any[]; }) => {
                const hasArticleColumn = results.data.length > 0 && 'article' in results.data[0];
                if (hasArticleColumn) {
                    this.lesarticles = (results.data as Article[]).filter(a => a.article?.trim());
                    this.totalCount = this.lesarticles.length;
                    this.isLoading = false;
                } else {
                    // Format simplifié : une ligne = un article, pas d'en-tête requis
                    this.parsePlainText(csvContent);
                }
            },
            error: (err: any) => {
                this.error = `Erreur de lecture : ${err.message}`;
                this.isLoading = false;
            }
        });
    }

    private parsePlainText(content: string): void {
        const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) {
            this.error = "Le fichier est vide ou ne contient aucun article.";
            this.isLoading = false;
            return;
        }
        this.lesarticles = lines.map(line => ({ article: line, code: '', description: '' }));
        this.totalCount = this.lesarticles.length;
        this.isLoading = false;
    }

    /**
     * Lance la recherche par paquets avec taille et pause paramétrables.
     */
    search(): void {
      if (!this.oauthService.hasValidAccessToken()) {
        this.error = 'Vous devez être connecté pour effectuer une recherche.';
        console.log('Utilisateur non authentifié');
        return;
      }
      if (!this.lesarticles?.length) return;

      const effectiveBatchSize = Math.max(1, Math.min(15, Math.floor(Number(this.batchSize) || 5)));
      const rawDelay = Number(this.delaySeconds);
      const effectiveDelayMs = Number.isFinite(rawDelay) && rawDelay >= 0 ? rawDelay * 1000 : 2000;
      this.batchSize = effectiveBatchSize;
      this.delaySeconds = effectiveDelayMs / 1000;

      const endpointToRun: TariffSearchEndpoint = this.searchEndpoint;
      const zoneToRun: TariffZone = this.currentZone;
      this.executedEndpoint = endpointToRun;
      this.executedZone = zoneToRun;

      this.isLoading = true;
      this.isWaitingBetweenBatches = false;
      this.error = null;
      this.isSearchComplete = false;
      this.isSaved = false;
      this.completedCount = 0;

      from(this.lesarticles).pipe(
          // 1. Crée des paquets de taille paramétrable (1 à 15 pour respecter le burst Traefik)
          bufferCount(effectiveBatchSize),

          // 2. Traite chaque paquet l'un après l'autre
          concatMap((batchOfArticles: Article[], index: number) => {
              console.log(`Traitement du paquet n°${index + 1} (${batchOfArticles.length} articles, mode=${endpointToRun}, zone=${zoneToRun})...`);

              // Chaque observable mute directement l'article (référence vers lesarticles[i])
              const searchRequests$ = batchOfArticles.map(article =>
                  this.createArticleSearchObservable(article, endpointToRun, zoneToRun).pipe(
                      tap((results: {code: string, description: string}[]) => {
                          article.code = results[0]?.code || '';
                          article.description = results[0]?.description || '';
                          article.options = results.length > 1 ? results : undefined;
                          this.completedCount++;
                      })
                  )
              );

              const hasMoreBatches = (index + 1) * effectiveBatchSize < this.totalCount;
              return forkJoin(searchRequests$).pipe(
                  switchMap(res => {
                      if (hasMoreBatches && effectiveDelayMs > 0) {
                          this.isWaitingBetweenBatches = true;
                          console.log(`Paquet n°${index + 1} traité. Pause de ${this.delaySeconds} seconde(s) avant le prochain...`);
                          return timer(effectiveDelayMs).pipe(
                              tap(() => { this.isWaitingBetweenBatches = false; }),
                              map(() => res)
                          );
                      }
                      return of(res);
                  })
              );
          }),

          // 3. Se déclenche quand TOUT est terminé
          finalize(() => {
              this.isWaitingBetweenBatches = false;
              this.isLoading = false;
              this.isSearchComplete = true;
              console.log("Traitement de tous les paquets terminé.", this.lesarticles);
          })
      ).subscribe({
          next: () => {},
          error: (err: any) => {
              this.error = err?.message || 'Une erreur majeure est survenue pendant le traitement des paquets.';
              console.error(err);
          }
      });
    }

    private createArticleSearchObservable(
        article: Article,
        endpoint: TariffSearchEndpoint,
        zone: TariffZone
    ): Observable<{code: string, description: string}[]> {
        if (!article.article || !article.article.trim()) {
            return of([{code: article.code || '', description: article.description || ''}]).pipe(delay(0));
        }
        return this.searchService.searchCodes(article.article, endpoint, zone).pipe(
            map((results: any[]) => {
                if (Array.isArray(results) && results.length > 0) {
                    const valid = results
                        .filter(r => r.code && r.code.trim() !== '')
                        .map(r => ({code: r.code as string, description: (r.description || '') as string}));
                    if (valid.length > 0) return valid;
                }
                return [{code: article.code || '', description: article.description || ''}];
            }),
            catchError((err: any) => {
                console.error(err);
                if (!this.error) {
                    this.error = err?.message || 'Certaines requêtes ont échoué. Les codes originaux sont conservés.';
                }
                return of([{code: article.code || '', description: article.description || ''}]);
            })
        );
    }

    saveAndDownloadAll(): void {
        if (!this.lesarticles?.length) return;

        const data: {article: string, code: string, description: string}[] = [];
        for (const art of this.lesarticles) {
            if (art.options && art.options.length > 1) {
                for (const opt of art.options) {
                    data.push({ article: art.article, code: opt.code, description: opt.description });
                }
            } else {
                data.push({ article: art.article, code: art.code, description: art.description });
            }
        }

        const tsvContent = Papa.unparse(data, { delimiter: "\t", header: true });
        const blob = new Blob(['\uFEFF' + tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        const baseFileName = this.fileName.substring(0, this.fileName.lastIndexOf('.')) || this.fileName || 'export';
        const slug = this.getExportModeSlug();
        const outName = `resultat-all-${slug}-${baseFileName}.tsv`;
        link.href = url;
        link.download = outName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (link.parentNode) {
                link.parentNode.removeChild(link);
            }
            window.URL.revokeObjectURL(url);
        }, 1000);
        this.lastSavedFileName = outName;
        this.isSaved = true;
    }

    selectOption(index: number, opt: {code: string, description: string}): void {
        this.lesarticles[index].code = opt.code;
        this.lesarticles[index].description = opt.description;
    }

    get selectionCount(): number {
        return this.lesarticles.filter(a => a.options && a.options.length > 1).length;
    }

    saveAndDownload(): void {
        if (!this.lesarticles?.length) {
            return;
        }

        const data = this.lesarticles.map(({ article, code, description }) => ({ article, code, description }));
        const tsvContent = Papa.unparse(data, {
            delimiter: "\t",
            header: true,
        });

        const blob = new Blob(['\uFEFF' + tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");

        // On s'assure que le nom du fichier de sortie a TOUJOURS l'extension .tsv
        const baseFileName = this.fileName.substring(0, this.fileName.lastIndexOf('.')) || this.fileName || 'export';
        const slug = this.getExportModeSlug();
        const outName = `resultat-${slug}-${baseFileName}.tsv`;
        link.href = url;
        link.download = outName;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (link.parentNode) {
                link.parentNode.removeChild(link);
            }
            window.URL.revokeObjectURL(url);
        }, 1000);
        this.lastSavedFileName = outName;
        this.isSaved = true;
    }

  // ---- TEST TEMPORAIRE — à supprimer après validation ----
  loadTestData(): void {
    this.executedEndpoint = this.searchEndpoint;
    this.executedZone = this.currentZone;
    const isPos10 = this.executedEndpoint === 'positions10';
    const isEu = this.executedZone === 'EU';
    const fmt = (hs6: string, euSuffix: string, dzSuffix: string): string => {
      if (!isPos10) return hs6;
      return isEu ? `${hs6}${euSuffix}` : `${hs6}${dzSuffix}`;
    };

    this.lesarticles = [
      { article: 'câble électrique', code: fmt('8544.42', '.90', '.10.00'), description: 'Conducteurs électriques pour tension ≤ 1000V', options: [
          { code: fmt('8544.42', '.90', '.10.00'), description: 'Conducteurs électriques pour tension ≤ 1000V' },
          { code: fmt('8544.49', '.95', '.91.00'), description: 'Autres conducteurs électriques' },
          { code: fmt('7312.10', '.20', '.10.00'), description: 'Torons et câbles en acier inoxydable' }
      ]},
      { article: 'huile', code: fmt('1509.20', '.00', '.00.00'), description: "Huile d'olive vierge extra", options: [
          { code: fmt('1509.20', '.00', '.00.00'), description: "Huile d'olive vierge extra" },
          { code: fmt('2710.19', '.81', '.31.00'), description: 'Huiles minérales lubrifiantes' }
      ]},
      { article: 'sel', code: fmt('2501.00', '.91', '.10.00'), description: 'Sel destiné à la consommation humaine' },
      { article: 'voitures diesel', code: fmt('8703.32', '.19', '.11.00'), description: 'Véhicules à moteur diesel, cylindrée > 1500 cm³' },
    ] as Article[];
    this.fileName = 'test-demo.tsv';
    this.totalCount = this.lesarticles.length;
    this.completedCount = this.lesarticles.length;
    this.isSearchComplete = true;
    this.isLoading = false;
    this.error = null;
    this.isSaved = false;
    this.lastSavedFileName = '';
  }
  // ---- FIN TEST ----

  // En savoir plus ...
  showMore: boolean = false;
  showMoreDonnees: boolean = false;
  showMore2: boolean = false;
  showMoreResultat: boolean = false;
  toggleMoreFormatDonnees() {
    this.showMore = !this.showMore;
  }
  toggleAfficheDonnees() {
    this.showMoreDonnees = !this.showMoreDonnees;
  }
  toggleMoreFormatResultat() {
    this.showMore2 = !this.showMore2;
  }
  toggleAfficheResultat() {
    this.showMoreResultat = !this.showMoreResultat;
  }
}


