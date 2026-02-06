import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { NotificationsComponent } from './shared/components/notifications/notifications.component';
import { AuthService } from './core/services/auth.service';
import { AsyncPipe, CommonModule } from '@angular/common';
import { combineLatest } from 'rxjs';
import { filter, map } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, NotificationsComponent, AsyncPipe, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('saas-frontend');
  private authService = inject(AuthService);
  private router = inject(Router);

  hasOrganizationSidebar$ = combineLatest([
    this.authService.isAuthenticated(),
    this.authService.isOrganizationAccount()
  ]).pipe(
    map(([isAuth, isOrg]) => isAuth && isOrg)
  );

  ngOnInit() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        // Le binding avec hasOrganizationSidebar$ se mettra à jour automatiquement
      });
  }
}
