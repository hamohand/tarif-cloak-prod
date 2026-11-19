import { Routes } from '@angular/router';
import { SearchComponent } from './search/search.component';
import {SearchListLotsComponent} from "./search-list-lots/search-list-lots.component";
import {BatchSearchComponent} from "./batch-search/batch-search.component";
import {DecodeComponent} from "./decode/decode.component";
import {DecodeP10Component} from "./decode-p10/decode-p10.component";

export const TARIF_ROUTES: Routes = [
    // Article unique
//     { path: '', redirectTo: 'search', pathMatch: 'full' },
//     { path: 'search', component: SearchComponent },
//     { path: '**', redirectTo: 'search' }

    // Liste d'articles: exécution par paquets de taille et pause paramétrables (défaut : 5 articles, pause 2 s).
    { path: '', redirectTo: 'search', pathMatch: 'full' },
    { path: 'search', component: SearchComponent },
    { path: 'search-position10', component: SearchComponent, data: { mode: 'position10' } },
    { path: 'searchListLots', component: SearchListLotsComponent },
    { path: 'batch-search', component: BatchSearchComponent }, // Recherche par lots asynchrone (Batch API)
    { path: 'decode', component: DecodeComponent },            // Recherche inverse : code HS → description
    { path: 'decode-p10', component: DecodeP10Component },    // Recherche inverse P10 : 2, 4, 6 ou 10 chiffres
    { path: '**', redirectTo: 'search'}

    ///////////////////
    // Liste d'articles
    // { path: '', redirectTo: 'searchList', pathMatch: 'full' },
    // { path: 'searchList', component: SearchListComponent },
    // { path: '**', redirectTo: 'searchList' }
];
