import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError, shareReplay, tap } from 'rxjs/operators';
import { MarketProfileService } from './market-profile.service';
import { environment } from '../../../environments/environment';

export type MarketCode = 'DZ' | 'DEFAULT';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private marketProfileService = inject(MarketProfileService);
  private readonly STORAGE_KEY = 'tci_selected_market';
  private cachedCurrency: string | null = null;
  private cachedSymbol$: Observable<string> | null = null;

  readonly selectedMarket$ = new BehaviorSubject<MarketCode>(this.readInitialMarket());

  private readInitialMarket(): MarketCode {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(this.STORAGE_KEY) : null;
      if (saved === 'DZ' || saved === 'DEFAULT') {
        return saved;
      }
    } catch {
      // Ignorer les erreurs d'accès stockage
    }
    const envMarket = (environment.marketVersion || '').toString().trim().toUpperCase();
    return envMarket === 'DZ' ? 'DZ' : 'DEFAULT';
  }

  getSelectedMarket(): MarketCode {
    return this.selectedMarket$.value;
  }

  setSelectedMarket(market: MarketCode): void {
    const normalized: MarketCode = market === 'DZ' ? 'DZ' : 'DEFAULT';
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, normalized);
      }
    } catch {
      // Ignorer
    }
    this.cachedCurrency = normalized === 'DZ' ? 'DZD' : 'EUR';
    this.cachedSymbol$ = null;
    if (this.selectedMarket$.value !== normalized) {
      this.selectedMarket$.next(normalized);
    }
  }

  /**
   * Récupère le symbole de devise du marché actuel.
   */
  getCurrencySymbol(): Observable<string> {
    if (this.cachedSymbol$) {
      return this.cachedSymbol$;
    }

    if (this.cachedCurrency) {
      const symbol = this.getSymbolForCurrency(this.cachedCurrency);
      this.cachedSymbol$ = of(symbol).pipe(shareReplay(1));
      return this.cachedSymbol$;
    }

    const marketVersion = this.getSelectedMarket();
    this.cachedSymbol$ = this.marketProfileService.getMarketProfileByVersion(marketVersion).pipe(
      map(profile => {
        const currency = profile.currencyCode || (marketVersion === 'DZ' ? 'DZD' : 'EUR');
        this.cachedCurrency = currency;
        return this.getSymbolForCurrency(currency);
      }),
      catchError(() => {
        const fallbackCurrency = marketVersion === 'DZ' ? 'DZD' : 'EUR';
        this.cachedCurrency = fallbackCurrency;
        const defaultSymbol = this.getSymbolForCurrency(fallbackCurrency);
        this.cachedSymbol$ = of(defaultSymbol).pipe(shareReplay(1));
        return of(defaultSymbol);
      }),
      shareReplay(1)
    );

    return this.cachedSymbol$;
  }

  /**
   * Récupère le code de devise du marché actuel.
   */
  getCurrencyCode(): Observable<string> {
    if (this.cachedCurrency) {
      return of(this.cachedCurrency);
    }

    const marketVersion = this.getSelectedMarket();
    return this.marketProfileService.getMarketProfileByVersion(marketVersion).pipe(
      map(profile => {
        const currency = profile.currencyCode || (marketVersion === 'DZ' ? 'DZD' : 'EUR');
        this.cachedCurrency = currency;
        return currency;
      }),
      catchError(() => {
        const fallback = marketVersion === 'DZ' ? 'DZD' : 'EUR';
        this.cachedCurrency = fallback;
        return of(fallback);
      })
    );
  }

  /**
   * Convertit un code de devise en symbole.
   */
  public getSymbolForCurrency(currency?: string | null): string {
    if (!currency) {
      return '€';
    }
    const currencyMap: { [key: string]: string } = {
      'EUR': '€',
      'DZD': 'DA',
      'USD': '$',
      'GBP': '£',
      'JPY': '¥',
      'CNY': '¥',
      'CHF': 'CHF',
      'CAD': 'C$',
      'AUD': 'A$',
      'MAD': 'DH'
    };
    return currencyMap[currency.toUpperCase()] || currency;
  }

  /**
   * Formate un montant avec la devise du marché.
   */
  formatAmount(amount: number, currencyCode?: string): Observable<string> {
    if (currencyCode) {
      return of(this.formatWithCurrency(amount, currencyCode));
    }

    return this.getCurrencyCode().pipe(
      map(code => this.formatWithCurrency(amount, code))
    );
  }

  /**
   * Formate un montant avec un code de devise spécifique.
   */
  private formatWithCurrency(amount: number, currencyCode: string): string {
    const symbol = this.getSymbolForCurrency(currencyCode);
    
    // Pour certaines devises, le symbole est placé après le montant
    if (currencyCode === 'DZD' || currencyCode === 'MAD') {
      return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
    }
    
    // Pour les autres devises, le symbole est placé avant
    return `${symbol}${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

