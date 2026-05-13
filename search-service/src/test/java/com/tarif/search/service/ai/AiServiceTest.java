package com.tarif.search.service.ai;

import com.tarif.search.model.Position;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires pour AiService.
 *
 * Stratégie : on mock les 3 providers (OpenAi / Anthropic / Ollama) et on
 * vérifie le comportement d'AiService sans aucun appel réseau réel.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AiService — orchestration des providers IA")
class AiServiceTest {

    @Mock
    private OpenAiService    openAiService;
    @Mock
    private AnthropicService anthropicService;
    @Mock
    private OllamaService    ollamaService;

    private AiService aiService;

    /** Crée un AiService configuré sur openai (défaut). */
    @BeforeEach
    void setUp() {
        aiService = new AiService(openAiService, anthropicService, ollamaService, "openai");
    }

    // ─── Sélection du provider ────────────────────────────────────────────────

    @Test
    @DisplayName("Provider 'openai' → OpenAiService est appelé")
    void promptEtReponse_avecProviderOpenai_doitAppelerOpenAiService() {
        // given
        String reponseJson = "[{\"code\":\"0808 10\",\"justification\":\"Pommes\"}]";
        when(openAiService.demanderAiAide(anyString(), anyString(), anyBoolean(), anyString()))
                .thenReturn(reponseJson);

        List<Position> positions = listeDeTest();

        // when
        List<Position> result = aiService.promptEtReponse("POSITIONS6", "pommes fraîches", positions, true);

        // then
        verify(openAiService, times(1)).demanderAiAide(anyString(), anyString(), eq(true), anyString());
        verifyNoInteractions(anthropicService, ollamaService);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCode()).isEqualTo("0808 10");
    }

    @Test
    @DisplayName("Provider 'anthropic' → AnthropicService est appelé")
    void promptEtReponse_avecProviderAnthropic_doitAppelerAnthropicService() {
        // given
        aiService = new AiService(openAiService, anthropicService, ollamaService, "anthropic");
        when(anthropicService.demanderAiAide(anyString(), anyString(), anyBoolean(), anyString()))
                .thenReturn("[{\"code\":\"08\"}]");

        // when
        aiService.promptEtReponse("SECTIONS", "fruit", listeDeTest(), false);

        // then
        verify(anthropicService, times(1)).demanderAiAide(anyString(), anyString(), eq(false), anyString());
        verifyNoInteractions(openAiService, ollamaService);
    }

    @Test
    @DisplayName("Provider 'ollama' → OllamaService est appelé")
    void promptEtReponse_avecProviderOllama_doitAppelerOllamaService() {
        // given
        aiService = new AiService(openAiService, anthropicService, ollamaService, "ollama");
        when(ollamaService.demanderAiAide(anyString(), anyString(), anyBoolean(), anyString()))
                .thenReturn("[{\"code\":\"08\"}]");

        // when
        aiService.promptEtReponse("SECTIONS", "fruit", listeDeTest(), false);

        // then
        verify(ollamaService, times(1)).demanderAiAide(anyString(), anyString(), eq(false), anyString());
        verifyNoInteractions(openAiService, anthropicService);
    }

    @Test
    @DisplayName("Provider inconnu → OpenAiService est utilisé par défaut")
    void promptEtReponse_avecProviderInconnu_doitFallbackSurOpenAi() {
        // given
        aiService = new AiService(openAiService, anthropicService, ollamaService, "unknown-provider");
        when(openAiService.demanderAiAide(anyString(), anyString(), anyBoolean(), anyString()))
                .thenReturn("[{\"code\":\"08\"}]");

        // when
        aiService.promptEtReponse("SECTIONS", "fruit", listeDeTest(), false);

        // then
        verify(openAiService, times(1)).demanderAiAide(anyString(), anyString(), anyBoolean(), anyString());
    }

    // ─── Réponse IA invalide ─────────────────────────────────────────────────

    @Test
    @DisplayName("Réponse IA non-JSON → liste vide retournée sans exception")
    void promptEtReponse_avecReponseNonJson_doitRetournerListeVide() {
        // given
        when(openAiService.demanderAiAide(anyString(), anyString(), anyBoolean(), anyString()))
                .thenReturn("Désolé, je ne comprends pas votre demande.");

        // when / then — cleanJsonString lève RuntimeException, capturée en liste vide
        assertThatThrownBy(() ->
                aiService.promptEtReponse("SECTIONS", "pommes", listeDeTest(), false)
        ).isInstanceOf(RuntimeException.class);
    }

    @Test
    @DisplayName("Réponse IA = tableau vide [] → liste vide retournée")
    void promptEtReponse_avecTableauVide_doitRetournerListeVide() throws Exception {
        // given
        when(openAiService.demanderAiAide(anyString(), anyString(), anyBoolean(), anyString()))
                .thenReturn("[]");

        // when
        List<Position> result = aiService.promptEtReponse("SECTIONS", "produit inexistant", listeDeTest(), false);

        // then
        assertThat(result).isEmpty();
    }

    // ─── Contenu du prompt envoyé ────────────────────────────────────────────

    @Test
    @DisplayName("Le prompt envoyé à l'IA doit contenir le terme de recherche")
    void promptEtReponse_doitEnvoyer_termeDeRechercheAuProvider() {
        // given
        String terme = "pommes fraîches";
        when(openAiService.demanderAiAide(anyString(), anyString(), anyBoolean(), anyString()))
                .thenAnswer(inv -> {
                    String prompt = inv.getArgument(1);
                    // Assertion dans la lambda : le terme doit être dans le prompt
                    assertThat(prompt).contains(terme);
                    return "[{\"code\":\"0808 10\"}]";
                });

        // when
        aiService.promptEtReponse("POSITIONS6", terme, listeDeTest(), false);

        // then — verify que demanderAiAide a bien été appelé
        verify(openAiService).demanderAiAide(anyString(), anyString(), anyBoolean(), anyString());
    }

    // ─── formatterListeReponsesPourAffichage ─────────────────────────────────

    @Test
    @DisplayName("Liste non vide → les codes sont inclus dans la sortie")
    void formatterListeReponsesPourAffichage_avecPositions_doitContenir_lesCodes() {
        List<Position> positions = List.of(
                new Position("0808 10", "Pommes", "Correspond au produit car fruit frais"),
                new Position("0808 10 10", "Pommes Golden", null)
        );

        String resultat = aiService.formatterListeReponsesPourAffichage("TEST", positions).toString();

        assertThat(resultat).contains("0808 10");
        assertThat(resultat).contains("Pommes");
        assertThat(resultat).contains("Correspond au produit car fruit frais");
        assertThat(resultat).contains("0808 10 10");
    }

    @Test
    @DisplayName("Liste vide → message d'absence retourné")
    void formatterListeReponsesPourAffichage_avecListeVide_doitRetourner_messageAbsence() {
        String resultat = aiService.formatterListeReponsesPourAffichage("TEST", List.of()).toString();

        assertThat(resultat).containsIgnoringCase("aucune réponse");
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private List<Position> listeDeTest() {
        return List.of(
                new Position("0808 10", "Pommes"),
                new Position("0808 10 10", "Pommes de table")
        );
    }
}
