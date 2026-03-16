import { Injectable } from '@angular/core';
import { DecodeResult } from './search.service';

export interface SearchResultItem {
  decoded: DecodeResult;
  justification: string | null;
  aiCode: string; // code original retourné par l'IA (avant décodage du parent)
}

@Injectable({ providedIn: 'root' })
export class SearchStateService {

  // SearchComponent — positions6
  searchTerm_hs: string = '';
  searchResults_hs: any[] | null = null;
  searchDecoded_hs: SearchResultItem[] | null = null;

  // SearchComponent — positions10
  searchTerm_p10: string = '';
  searchResults_p10: any[] | null = null;
  searchDecoded_p10: SearchResultItem[] | null = null;

  // DecodeComponent
  decodeInput: string = '';
  decodeResult: DecodeResult | null = null;

  // DecodeP10Component
  decodeP10Input: string = '';
  decodeP10Result: DecodeResult | null = null;
}
