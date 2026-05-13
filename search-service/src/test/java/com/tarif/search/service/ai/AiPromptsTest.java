package com.tarif.search.service.ai;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.*;

/**
 * Tests unitaires pour AiPrompts.
 * Aucune dépendance Spring — exécution ultra-rapide.
 */
@DisplayName("AiPrompts — buildUserPrompt")
class AiPromptsTest {

    private static final String RAG_POMMES = """
             - Code = 08 -
               _Description : Fruits comestibles

             - Code = 0808 -
               _Description : Pommes, poires et coings, frais

             - Code = 0808 10 -
               _Description : Pommes
            """;

    // ── Structure du prompt ──────────────────────────────────────────────────

    @Test
    @DisplayName("Le prompt doit contenir les balises XML <codes_douaniers>")
    void buildUserPrompt_doitContenir_balisesXml() {
        String prompt = AiPrompts.buildUserPrompt(RAG_POMMES, "pommes fraîches");

        assertThat(prompt).contains("<codes_douaniers>");
        assertThat(prompt).contains("</codes_douaniers>");
    }

    @Test
    @DisplayName("Le terme de recherche doit apparaître au moins deux fois dans le prompt")
    void buildUserPrompt_doitRepeter_termeDeRecherche() {
        String terme = "pommes fraîches";
        String prompt = AiPrompts.buildUserPrompt(RAG_POMMES, terme);

        // Une fois en en-tête, une fois dans la question finale
        int firstIndex  = prompt.indexOf(terme);
        int secondIndex = prompt.lastIndexOf(terme);
        assertThat(firstIndex).isNotEqualTo(-1);
        assertThat(firstIndex).isNotEqualTo(secondIndex);
    }

    @Test
    @DisplayName("Le prompt doit exiger une réponse JSON uniquement")
    void buildUserPrompt_doitDemander_reponseJsonUniquement() {
        String prompt = AiPrompts.buildUserPrompt(RAG_POMMES, "smartphone");

        assertThat(prompt).containsIgnoringCase("tableau JSON");
        assertThat(prompt).containsIgnoringCase("sans aucun texte avant ou après");
    }

    @Test
    @DisplayName("Le contexte RAG doit être inclus entre les balises")
    void buildUserPrompt_doitInclure_contexteRag() {
        String ragContext = "- Code = 8517 -\n  _Description : Téléphones";
        String prompt = AiPrompts.buildUserPrompt(ragContext, "smartphone");

        // Le RAG se retrouve entre les deux balises
        int debutBalise = prompt.indexOf("<codes_douaniers>");
        int finBalise   = prompt.indexOf("</codes_douaniers>");
        String contenuBalise = prompt.substring(debutBalise, finBalise);

        assertThat(contenuBalise).contains("8517");
    }

    // ── Cas limites ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("RAG vide ne doit pas lever d'exception")
    void buildUserPrompt_avecRagVide_neDoitPasPlanter() {
        assertThatNoException()
                .isThrownBy(() -> AiPrompts.buildUserPrompt("", "smartphone"));
    }

    @ParameterizedTest(name = "terme = \"{0}\"")
    @ValueSource(strings = {"pommes", "frozen chicken wings", "هاتف ذكي", "Laptop 15 pouces"})
    @DisplayName("Le prompt doit être généré quelle que soit la langue du terme")
    void buildUserPrompt_doitFonctionner_quelqueSoitLaLangue(String terme) {
        assertThatNoException()
                .isThrownBy(() -> AiPrompts.buildUserPrompt(RAG_POMMES, terme));
    }

    @Test
    @DisplayName("Le prompt ne doit pas être vide")
    void buildUserPrompt_neDoitPas_retournerPromptVide() {
        String prompt = AiPrompts.buildUserPrompt("", "");
        assertThat(prompt).isNotBlank();
    }

    // ── getSystemMessage ─────────────────────────────────────────────────────

    @Test
    @DisplayName("getSystemMessage(true) doit contenir 'justification'")
    void getSystemMessage_avecJustification_doitContenir_motJustification() {
        String msg = AiPrompts.getSystemMessage(true);
        assertThat(msg).containsIgnoringCase("justification");
    }

    @Test
    @DisplayName("getSystemMessage(false) ne doit PAS contenir 'justification' dans la clé JSON")
    void getSystemMessage_sansJustification_neDoit_PasContenir_cleJustification() {
        String msg = AiPrompts.getSystemMessage(false);
        // Le mode simple n'expose que la clé `code`
        assertThat(msg).contains("`code`");
        assertThat(msg).doesNotContain("`justification`");
    }

    @Test
    @DisplayName("Les deux variantes du system message ne doivent pas contenir de placeholder non remplacé")
    void getSystemMessage_neDoit_PasContenir_placeholder() {
        assertThat(AiPrompts.getSystemMessage(true))
                .doesNotContain("{instruction_details}")
                .doesNotContain("{format_example}")
                .doesNotContain("{json_keys}")
                .doesNotContain("{examples}");

        assertThat(AiPrompts.getSystemMessage(false))
                .doesNotContain("{instruction_details}")
                .doesNotContain("{format_example}")
                .doesNotContain("{json_keys}")
                .doesNotContain("{examples}");
    }
}
