import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { MarketProfileService } from './market-profile.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private marketProfileService = inject(MarketProfileService);
  private cachedCurrency: string | null = null;

  /**
   * Récupère le symbole de devise du marché actuel.
   */
  getCurrencySymbol(): Observable<string> {
    // Si on a déjà la devise en cache, la retourner
    if (this.cachedCurrency) {
      return of(this.getSymbolForCurrency(this.cachedCurrency));
    }

    // Récupérer la version de marché depuis l'environnement
    let marketVersion: string | undefined = undefined;
    
    if ((environment as any).marketVersion) {
      marketVersion = (environment as any).marketVersion;
    } else if ((environment as any)['marketVersion']) {
      marketVersion = (environment as any)['marketVersion'];
    }

    if (!marketVersion) {
      // Valeur par défaut si marketVersion n'est pas défini
      const isProduction = (environment as any).production === true;
      marketVersion = isProduction ? 'DZ' : 'DEFAULT';
    }

    // Récupérer le profil de marché et extraire la devise
    return this.marketProfileService.getMarketProfileByVersion(marketVersion).pipe(
      map(profile => {
        const currency = profile.currencyCode || 'EUR';
        this.cachedCurrency = currency;
        return this.getSymbolForCurrency(currency);
      }),
      catchError(() => {
        // En cas d'erreur, utiliser EUR par défaut
        this.cachedCurrency = 'EUR';
        return of('€');
      })
    );
  }

  /**
   * Récupère le code de devise du marché actuel.
   */
  getCurrencyCode(): Observable<string> {
    if (this.cachedCurrency) {
      return of(this.cachedCurrency);
    }

    let marketVersion: string | undefined = undefined;
    
    if ((environment as any).marketVersion) {
      marketVersion = (environment as any).marketVersion;
    } else if ((environment as any)['marketVersion']) {
      marketVersion = (environment as any)['marketVersion'];
    }

    if (!marketVersion) {
      const isProduction = (environment as any).production === true;
      marketVersion = isProduction ? 'DZ' : 'DEFAULT';
    }

    return this.marketProfileService.getMarketProfileByVersion(marketVersion).pipe(
      map(profile => {
        const currency = profile.currencyCode || 'EUR';
        this.cachedCurrency = currency;
        return currency;
      }),
      catchError(() => {
        this.cachedCurrency = 'EUR';
        return of('EUR');
      })
    );
  }

  /**
   * Convertit un code de devise en symbole.
   */
  getSymbolForCurrency(currency: string): string {
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

