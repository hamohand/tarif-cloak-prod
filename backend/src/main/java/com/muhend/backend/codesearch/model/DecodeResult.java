package com.muhend.backend.codesearch.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DecodeResult {

    private String codeRecherche;
    private String niveau; // "CHAPITRE" | "POSITION4" | "POSITION6" | "POSITION8"

    private CodeItem section;
    private CodeItem chapitre;
    private CodeItem position4;         // null si niveau == CHAPITRE
    private List<CodeItem> positions6;  // vide si CHAPITRE, plusieurs si POSITION4, 1 si POSITION6
    private List<CodeItem> positions8;  // enfants à 8 chiffres (si POSITION6), ou code exact (si POSITION8)

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class CodeItem {
        private String code;
        private String description;
    }
}
