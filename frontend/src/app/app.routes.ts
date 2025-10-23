import { Routes } from '@angular/router';

import { HomeComponent } from './shared/home/home.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { authGuard } from './core/guards/auth.guard';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import {RegisterComponent} from './features/auth/register/register.component';
import {LoginComponent} from './features/auth/login/login.component';
import {SearchComponent} from './tarif/search/search.component';
import {TarifComponent} from './tarif/home/tarif.component';
import {TARIF_ROUTES} from './tarif/tarif.routes';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'auth',
    children: AUTH_ROUTES
  },
  {
    path: 'recherche',
    children: TARIF_ROUTES,
    component: TarifComponent,
    //component: DashboardComponent,
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: '' }
];


