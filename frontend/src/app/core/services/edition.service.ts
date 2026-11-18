import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class EditionService {
  readonly edition = signal<string>(environment.appEdition || 'saas-conference');

  constructor() {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      fetch('/edition.json', { cache: 'no-store' })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data?.edition && typeof data.edition === 'string') {
            this.edition.set(data.edition);
          }
        })
        .catch(() => {});
    }
  }
}
