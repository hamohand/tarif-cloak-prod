import { Injectable } from '@angular/core';
import { DecodeResult } from './search.service';

@Injectable({ providedIn: 'root' })
export class SearchStateService {

  // SearchComponent — positions6
  searchTerm_hs: string = '';
  searchResults_hs: any[] | null = null;

  // SearchComponent — positions10
  searchTerm_p10: string = '';
  searchResults_p10: any[] | null = null;

  // DecodeComponent
  decodeInput: string = '';
  decodeResult: DecodeResult | null = null;

  // DecodeP10Component
  decodeP10Input: string = '';
  decodeP10Result: DecodeResult | null = null;
}
