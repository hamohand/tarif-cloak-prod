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
    private String niveau; // "CHAPITRE" | "POSITION4" | "POSITION6" | "POSITION10"

    private CodeItem section;
    private CodeItem chapitre;
    private CodeItem position4;          // null si niveau == CHAPITRE
    private List<CodeItem> positions6;   // vide si CHAPITRE, plusieurs si POSITION4, 1 si POSITION6+
    private List<CodeItem> positions10;       // null sauf si niveau == POSITION6 ou POSITION10
    private List<String> titresPosition10;   // titres hiérarchiques précédant le code P10 (du plus général au plus spécifique)

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class CodeItem {
        private String code;
        private String description;
    }
}
