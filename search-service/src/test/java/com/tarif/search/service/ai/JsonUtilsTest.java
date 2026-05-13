package com.tarif.search.service.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.tarif.search.model.Position;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.*;

/**
 * Tests unitaires pour JsonUtils.
 * Couvre les trois méthodes publiques : cleanJsonString, isValidJson,
 * conversionReponseIaToList.
 */
@DisplayName("JsonUtils — nettoyage et parsing JSON")
class JsonUtilsTest {

    // ── isValidJson ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("Tableau JSON valide est reconnu")
    void isValidJson_avecTableauValide_retourneTrue() {
        assertThat(JsonUtils.isValidJson("[{\"code\":\"08\"}]")).isTrue();
    }

    @Test
    @DisplayName("Objet JSON valide est reconnu")
    void isValidJson_avecObjetValide_retourneTrue() {
        assertThat(JsonUtils.isValidJson("{\"code\":\"08\"}")).isTrue();
    }

    @Test
    @DisplayName("Texte non-JSON retourne false")
    void isValidJson_avecTexteLibre_retourneFalse() {
        assertThat(JsonUtils.isValidJson("Je suis un assistant douanier.")).isFalse();
    }

    @Test
    @DisplayName("JSON tronqué (fermeture manquante) retourne false")
    void isValidJson_avecJsonTronque_retourneFalse() {
        assertThat(JsonUtils.isValidJson("[{\"code\":\"08\"")).isFalse();
    }

    // ── removeEnclosingBackticks ─────────────────────────────────────────────

    @Test
    @DisplayName("Backticks de début et de fin sont supprimés")
    void removeEnclosingBackticks_doitSupprimerBackticks() {
        String result = JsonUtils.removeEnclosingBackticks("```[{\"code\":\"08\"}]```");
        assertThat(result).isEqualTo("[{\"code\":\"08\"}]");
    }

    @Test
    @DisplayName("Chaîne sans backticks reste inchangée")
    void removeEnclosingBackticks_sansBacktick_restInchangee() {
        String json = "[{\"code\":\"08\"}]";
        assertThat(JsonUtils.removeEnclosingBackticks(json)).isEqualTo(json);
    }

    // ── cleanJsonString ──────────────────────────────────────────────────────

    @Test
    @DisplayName("JSON propre est retourné tel quel")
    void cleanJsonString_avecJsonPropre_retourneJsonInchange() {
        String json = "[{\"code\":\"08\"}]";
        assertThat(JsonUtils.cleanJsonString(json)).isEqualTo(json);
    }

    @Test
    @DisplayName("Préfixe 'json' (markdown) est retiré")
    void cleanJsonString_avecPrefixeMarkdown_retirerPrefixe() {
        // Format typique : ```json\n[...]\n```
        String brut = "json\n[{\"code\":\"0808 10\"}]";
        String result = JsonUtils.cleanJsonString(brut);
        assertThat(result).startsWith("[");
        assertThat(JsonUtils.isValidJson(result)).isTrue();
    }

    @Test
    @DisplayName("JSON null lève RuntimeException")
    void cleanJsonString_avecNull_leveeException() {
        assertThatThrownBy(() -> JsonUtils.cleanJsonString(null))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    @DisplayName("JSON vide lève RuntimeException")
    void cleanJsonString_avecChaineVide_leveeException() {
        assertThatThrownBy(() -> JsonUtils.cleanJsonString("   "))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    @DisplayName("Texte non-JSON lève RuntimeException")
    void cleanJsonString_avecTexteLibre_leveeException() {
        assertThatThrownBy(() -> JsonUtils.cleanJsonString("Désolé, je ne peux pas identifier de code."))
                .isInstanceOf(RuntimeException.class);
    }

    // ── conversionReponseIaToList ────────────────────────────────────────────

    @Test
    @DisplayName("Tableau JSON avec code et justification est converti correctement")
    void conversionReponseIaToList_avecTableauComplet_doitParsercorrectement() throws JsonProcessingException {
        String json = """
                [
                  {"code": "0808 10", "justification": "Pommes fraîches"},
                  {"code": "0808 10 10", "justification": "Variétés de table"}
                ]
                """;

        List<Position> positions = JsonUtils.conversionReponseIaToList(json);

        assertThat(positions).hasSize(2);
        assertThat(positions.get(0).getCode()).isEqualTo("0808 10");
        assertThat(positions.get(0).getJustification()).isEqualTo("Pommes fraîches");
        assertThat(positions.get(1).getCode()).isEqualTo("0808 10 10");
    }

    @Test
    @DisplayName("Objet JSON seul (sans tableau) est encapsulé automatiquement")
    void conversionReponseIaToList_avecObjetSeul_doitEnvelopperEnTableau() throws JsonProcessingException {
        String json = "{\"code\": \"08\", \"justification\": \"Fruits comestibles\"}";

        List<Position> positions = JsonUtils.conversionReponseIaToList(json);

        assertThat(positions).hasSize(1);
        assertThat(positions.get(0).getCode()).isEqualTo("08");
    }

    @Test
    @DisplayName("JSON avec uniquement le champ 'code' est converti (justification null)")
    void conversionReponseIaToList_avecCodeSeulement_doitConverter() throws JsonProcessingException {
        String json = "[{\"code\": \"0808\"}]";

        List<Position> positions = JsonUtils.conversionReponseIaToList(json);

        assertThat(positions).hasSize(1);
        assertThat(positions.get(0).getCode()).isEqualTo("0808");
        assertThat(positions.get(0).getJustification()).isNull();
    }
}
