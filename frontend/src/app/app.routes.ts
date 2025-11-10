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
import { StatsComponent } from './features/admin/stats/stats.component';
import { OrganizationsComponent } from './features/admin/organizations/organizations.component';
import { UserDashboardComponent } from './features/user/dashboard/dashboard.component';
import { AlertsComponent } from './features/user/alerts/alerts.component';
import { InvoicesComponent } from './features/user/invoices/invoices.component';
import { InvoiceDetailComponent } from './features/user/invoices/invoice-detail.component';
import { InvoicesAdminComponent } from './features/admin/invoices/invoices-admin.component';
import { InvoiceDetailAdminComponent } from './features/admin/invoices/invoice-detail-admin.component';
import { PricingPlansComponent } from './features/pricing/pricing-plans.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'pricing', component: PricingPlansComponent },
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
  {
    path: 'dashboard',
    component: UserDashboardComponent,
    canActivate: [authGuard]
  },
  {
    path: 'alerts',
    component: AlertsComponent,
    canActivate: [authGuard]
  },
  {
    path: 'invoices',
    component: InvoicesComponent,
    canActivate: [authGuard]
  },
  {
    path: 'invoices/:id',
    component: InvoiceDetailComponent,
    canActivate: [authGuard]
  },
  {
    path: 'admin/stats',
    component: StatsComponent,
    canActivate: [authGuard]
  },
  {
    path: 'admin/organizations',
    component: OrganizationsComponent,
    canActivate: [authGuard]
  },
  {
    path: 'admin/invoices',
    component: InvoicesAdminComponent,
    canActivate: [authGuard]
  },
  {
    path: 'admin/invoices/:id',
    component: InvoiceDetailAdminComponent,
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: '' }
];


