import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  private readonly storageKey = 'tci_sidebar_collapsed';

  readonly sidebarCollapsed = signal<boolean>(this.readInitialCollapsed());
  readonly mobileSidebarOpen = signal<boolean>(false);

  toggleSidebar(): void {
    this.setSidebarCollapsed(!this.sidebarCollapsed());
  }

  setSidebarCollapsed(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, String(collapsed));
      }
    } catch {
      // Ignorer les erreurs de stockage (navigation privée / quota)
    }
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update(v => !v);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  private readInitialCollapsed(): boolean {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(this.storageKey) === 'true';
      }
    } catch {
      // Ignorer les erreurs de stockage
    }
    return false;
  }
}
