import {Component, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Article} from "../shared/model/articles";
import {SearchService} from "../services/search.service";
import * as Papa from "papaparse";
import {
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
    tap
} from "rxjs";
import {OAuthService} from 'angular-oauth2-oidc';

@Component({
  selector: 'app-search-list-lots',
  standalone: true,
    imports: [CommonModule],
  templateUrl: './search-list-lots.component.html',
  styleUrl: './search-list-lots.component.css'
})
export class SearchListLotsComponent {
    lesarticles: Article[] = [];
    fileName: string = '';
    reponse: string = ''
    isLoading: boolean = false;
    error: string | null = null;
    isSearchComplete: boolean = false;
    isSaved: boolean = false;

    completedCount: number = 0;
    totalCount: number = 0;

    // Réglages basés sur votre analyse : 5 requêtes par minute
    private readonly BATCH_SIZE = 5; // Liste par lots de 5 d'articles
    private readonly DELAY_BETWEEN_BATCHES = 61000; // 61 secondes entre les recherches Ai de 2 lots de 5 d'articles

    //constructor(private searchService: SearchService) {}
  private searchService = inject(SearchService);
  private oauthService = inject(OAuthService);

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
     * Lance la recherche en respectant une limite de 5 requêtes par minute.
     */
    search(): void {
      // Vérifier l'authentification
      console.log('Vérification de l\'authentification...');
      console.log('Token valide:', this.oauthService.hasValidAccessToken());
      console.log('Token:', this.oauthService.getAccessToken());

      if (!this.oauthService.hasValidAccessToken()) {
        this.error = 'Vous devez être connecté pour effectuer une recherche.';
        console.log('Utilisateur non authentifié');
        return;
      }
      //
        if (!this.lesarticles?.length) return;

        this.isLoading = true;
        this.error = null;
        this.isSearchComplete = false;
        this.completedCount = 0;

        from(this.lesarticles).pipe(
            // 1. Crée des paquets de 5 articles
            bufferCount(this.BATCH_SIZE),

            // 2. Traite chaque paquet l'un après l'autre
            concatMap((batchOfArticles: Article[], index: number) => {
                console.log(`Traitement du paquet n°${index + 1} (${batchOfArticles.length} articles)...`);

                // Chaque observable mute directement l'article (référence vers lesarticles[i])
                const searchRequests$ = batchOfArticles.map(article =>
                    this.createArticleSearchObservable(article).pipe(
                        tap((results: {code: string, description: string}[]) => {
                            article.code = results[0]?.code || '';
                            article.description = results[0]?.description || '';
                            article.options = results.length > 1 ? results : undefined;
                            this.completedCount++;
                        })
                    )
                );

                return forkJoin(searchRequests$).pipe(
                    tap(() => {
                        if ((index + 1) * this.BATCH_SIZE < this.totalCount) {
                            console.log(`Paquet n°${index + 1} traité. Pause de 61 secondes avant le prochain...`);
                        }
                    }),
                    delay(this.DELAY_BETWEEN_BATCHES)
                );
            }),

            // 3. Se déclenche quand TOUT est terminé
            finalize(() => {
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

    private createArticleSearchObservable(article: Article): Observable<{code: string, description: string}[]> {
        if (!article.article || !article.article.trim()) {
            return of([{code: article.code || '', description: article.description || ''}]).pipe(delay(0));
        }
        return this.searchService.searchCodes(article.article).pipe(
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
                    this.error = 'Certaines requêtes ont échoué. Les codes originaux sont conservés.';
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
        const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const baseFileName = this.fileName.substring(0, this.fileName.lastIndexOf('.')) || this.fileName;
        link.setAttribute("href", url);
        link.setAttribute("download", `resultat-all-${baseFileName}.tsv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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

        const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        // On s'assure que le nom du fichier de sortie a TOUJOURS l'extension .tsv
        const baseFileName = this.fileName.substring(0, this.fileName.lastIndexOf('.')) || this.fileName;
        link.setAttribute("href", url);
        link.setAttribute("download", `resultat-${baseFileName}.tsv`);

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.isSaved = true;
    }

  // ---- TEST TEMPORAIRE — à supprimer après validation ----
  loadTestData(): void {
    this.lesarticles = [
      { article: 'câble électrique', code: '8544.42', description: 'Conducteurs électriques pour tension ≤ 1000V', options: [
          { code: '8544.42', description: 'Conducteurs électriques pour tension ≤ 1000V' },
          { code: '8544.49', description: 'Autres conducteurs électriques' },
          { code: '7312.10', description: 'Torons et câbles en acier inoxydable' }
      ]},
      { article: 'huile', code: '1509.10', description: "Huile d'olive vierge", options: [
          { code: '1509.10', description: "Huile d'olive vierge" },
          { code: '2710.19', description: 'Huiles minérales légères' }
      ]},
      { article: 'sel', code: '2501.00', description: 'Sel, y compris le sel préparé pour la table' },
      { article: 'voitures diesel', code: '8703.23', description: 'Véhicules à moteur diesel, cylindrée > 1500 cm³' },
    ] as Article[];
    this.fileName = 'test-demo.tsv';
    this.totalCount = this.lesarticles.length;
    this.completedCount = this.lesarticles.length;
    this.isSearchComplete = true;
    this.isLoading = false;
    this.error = null;
    this.isSaved = false;
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


