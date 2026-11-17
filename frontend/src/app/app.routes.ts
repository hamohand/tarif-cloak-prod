import { Routes } from '@angular/router';
import { RouterModule } from '@angular/router';

import { HomeComponent } from './shared/home/home.component';
import { authGuard } from './core/guards/auth.guard';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import {TarifComponent} from './tarif/home/tarif.component';
import {TARIF_ROUTES} from './tarif/tarif.routes';
import { StatsComponent } from './features/admin/stats/stats.component';
import { OrganizationsComponent } from './features/admin/organizations/organizations.component';
import { UserDashboardComponent } from './features/user/dashboard/dashboard.component';
import { AlertsComponent } from './features/user/alerts/alerts.component';
import { OrganizationAccountComponent } from './features/organization/organization-account.component';
import { OrganizationStatsComponent } from './features/organization/organization-stats.component';
import { collaboratorGuard } from './core/guards/collaborator.guard';
import { organizationGuard } from './core/guards/organization.guard';
import { planRequiredGuard } from './core/guards/plan-required.guard';
import { AccessExpiredComponent } from './features/access-expired/access-expired.component';
import { HelpComponent } from './features/help/help.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'auth',
    children: AUTH_ROUTES
  },
  {
    path: 'access-expired',
    component: AccessExpiredComponent
  },
  {
    path: 'aide',
    component: HelpComponent
  },
  {
    path: 'recherche',
    children: TARIF_ROUTES,
    component: TarifComponent,
    canActivate: [authGuard, collaboratorGuard, planRequiredGuard]
  },
  {
    path: 'dashboard',
    component: UserDashboardComponent,
    canActivate: [authGuard, collaboratorGuard, planRequiredGuard]
  },
  {
    path: 'alerts',
    component: AlertsComponent,
    canActivate: [authGuard, collaboratorGuard, planRequiredGuard]
  },
  {
    path: 'organization/account',
    component: OrganizationAccountComponent,
    canActivate: [authGuard, organizationGuard]
  },
  {
    path: 'organization/stats',
    component: OrganizationStatsComponent,
    canActivate: [authGuard, organizationGuard]
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
  { path: '**', redirectTo: '' }
];

export const AppRoutingModule = RouterModule.forRoot(routes, {
  onSameUrlNavigation: 'reload',
  scrollPositionRestoration: 'enabled'
});


