import { Routes } from '@angular/router';
import { SearchComponent } from './search/search.component';
import { SearchListLotsComponent } from './search-list-lots/search-list-lots.component';
import { BatchSearchComponent } from './batch-search/batch-search.component';
import { DecodeComponent } from './decode/decode.component';
import { DecodeP10Component } from './decode-p10/decode-p10.component';
import { authGuard } from '../core/guards/auth.guard';
import { collaboratorGuard } from '../core/guards/collaborator.guard';
import { planRequiredGuard } from '../core/guards/plan-required.guard';

export const TARIF_ROUTES: Routes = [
  { path: '', redirectTo: 'search-position10', pathMatch: 'full' },
  { path: 'search', component: SearchComponent },
  { path: 'search-position10', component: SearchComponent, data: { mode: 'position10' } },
  {
    path: 'searchListLots',
    component: SearchListLotsComponent,
    canActivate: [authGuard, collaboratorGuard, planRequiredGuard]
  },
  {
    path: 'batch-search',
    component: BatchSearchComponent,
    canActivate: [authGuard, collaboratorGuard, planRequiredGuard]
  },
  { path: 'decode', component: DecodeComponent },
  { path: 'decode-p10', component: DecodeP10Component },
  { path: '**', redirectTo: 'search-position10' }
];
