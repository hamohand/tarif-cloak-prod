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

    private String zone; // "DZ", "EU", ...
    private String codeRecherche;
    private String niveau; // "CHAPITRE" | "POSITION4" | "POSITION6" | "POSITION8" | "POSITION10"

    private CodeItem section;
    private CodeItem chapitre;
    private CodeItem position4;          // null si niveau == CHAPITRE
    private List<CodeItem> positions6;   // vide si CHAPITRE, plusieurs si POSITION4, 1 si POSITION6+
    private List<CodeItem> positions10;           // null sauf si niveau >= POSITION6 (avec positions nationales)
    private List<String> titresPosition10;        // titres pour un code unique (POSITION8 / POSITION10)
    private java.util.Map<String, List<String>> titresParPosition10; // titres par code (POSITION6)
    private java.util.Map<String, String> glossary; // sigles FAP / UQN / taxes résolus pour la zone

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CodeItem {
        private String code;
        private String description;
        private String note;
        private String formattedCode;
        private String checkDigit;
        private java.util.Map<String, Object> regulatoryData;
        private boolean enriched;

        public CodeItem(String code, String description) {
            this.code = code;
            this.description = description;
        }

        public CodeItem(String code, String description, String note) {
            this.code = code;
            this.description = description;
            this.note = note;
        }
    }
}
