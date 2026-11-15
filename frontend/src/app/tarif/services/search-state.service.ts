import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DecodeResult, Hs6ComparisonResult } from './search.service';

export type TariffZone = 'DZ' | 'EU';

export interface SearchResultItem {
  decoded: DecodeResult;
  justification: string | null;
  aiCode: string; // code original retourné par l'IA (avant décodage du parent)
}

@Injectable({ providedIn: 'root' })
export class SearchStateService {
  private readonly ZONE_STORAGE_KEY = 'tci_zone';

  readonly selectedZone$ = new BehaviorSubject<TariffZone>(this.readInitialZone());
  readonly compareMode$ = new BehaviorSubject<boolean>(false);

  // SearchComponent — positions6
  searchTerm_hs: string = '';
  searchResults_hs: any[] | null = null;
  searchDecoded_hs: SearchResultItem[] | null = null;

  // SearchComponent — positions10 / NC8 par zone
  searchTerm_p10: string = '';
  searchResults_p10: any[] | null = null;
  searchDecoded_p10: SearchResultItem[] | null = null;

  searchTerm_p10_eu: string = '';
  searchDecoded_p10_eu: SearchResultItem[] | null = null;

  // DecodeComponent
  decodeInput: string = '';
  decodeResult: DecodeResult | null = null;

  // DecodeP10Component (par zone + comparateur)
  decodeP10Input: string = '';
  decodeP10Result: DecodeResult | null = null;

  decodeP10Input_eu: string = '';
  decodeP10Result_eu: DecodeResult | null = null;

  compareHs6Input: string = '';
  compareResult: Hs6ComparisonResult | null = null;

  get zone(): TariffZone {
    return this.selectedZone$.value;
  }

  setZone(zone: TariffZone): void {
    const norm: TariffZone = zone === 'EU' ? 'EU' : 'DZ';
    if (this.selectedZone$.value !== norm) {
      this.selectedZone$.next(norm);
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.ZONE_STORAGE_KEY, norm);
      }
    } catch {
      // Ignore storage errors (private mode / SSR)
    }
  }

  get compareMode(): boolean {
    return this.compareMode$.value;
  }

  set compareMode(value: boolean) {
    if (this.compareMode$.value !== value) {
      this.compareMode$.next(value);
    }
  }

  private readInitialZone(): TariffZone {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(this.ZONE_STORAGE_KEY);
        if (stored === 'EU' || stored === 'DZ') {
          return stored;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return 'DZ';
  }
}
