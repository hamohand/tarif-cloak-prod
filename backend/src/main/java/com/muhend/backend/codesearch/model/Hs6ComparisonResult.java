package com.muhend.backend.codesearch.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Résultat de comparaison côte à côte d'une même sous-position internationale HS6
 * entre le Tarif National Algérien (DZ · P10) et la Nomenclature Combinée UE (EU · NC8).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Hs6ComparisonResult {
    private String hs6;
    private DecodeResult.CodeItem section;
    private DecodeResult.CodeItem chapitre;
    private DecodeResult.CodeItem position4;
    private DecodeResult.CodeItem position6;
    private DecodeResult dz;
    private DecodeResult eu;
}
