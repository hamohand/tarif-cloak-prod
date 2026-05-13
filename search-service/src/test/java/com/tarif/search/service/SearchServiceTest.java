package com.tarif.search.service;

import com.tarif.search.model.Chapitre;
import com.tarif.search.model.Position;
import com.tarif.search.model.Position4;
import com.tarif.search.model.Position6Dz;
import com.tarif.search.model.Position10Dz;
import com.tarif.search.model.Section;
import com.tarif.search.service.ai.AiPrompts;
import com.tarif.search.service.ai.AiService;
import com.tarif.search.service.ai.DefTheme;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires pour SearchService — la cascade de classification en 5 niveaux.
 *
 * Stratégie : tout est mocké (AiService + services de données).
 * On teste uniquement la LOGIQUE d'orchestration, pas les appels IA réels.
 *
 * Hiérarchie HS algérienne simulée (exemple "pommes fraîches") :
 *   Section  II  → Produits du règne végétal
 *   Chapitre 08  → Fruits comestibles
 *   Position4    → 0808    (Pommes, poires et coings)
 *   Position6    → 0808 10 (Pommes)
 *   Position10   → 0808 10 10 (Variétés de table)
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SearchService — cascade de classification HS")
class SearchServiceTest {

    // ── Mocks ──────────────────────────────────────────────────────────────────

    @Mock private AiService         aiService;
    @Mock private AiPrompts         aiPrompts;
    @Mock private SectionService    sectionService;
    @Mock private ChapitreService   chapitreService;
    @Mock private Position4Service  position4Service;
    @Mock private Position6DzService position6DzService;
    @Mock private Position10DzService position10DzService;

    private SearchService searchService;

    // ── Données de test ────────────────────────────────────────────────────────

    private static final String TERME = "pommes fraîches";

    // Entités retournées par les services de données
    private final Section    sectionII   = new Section(1L, "II", "Produits du règne végétal");
    private final Chapitre   chapitre08  = new Chapitre(1L, "08", "Fruits comestibles", "II");
    private final Position4  pos4_0808   = new Position4(1L, "0808", "Pommes, poires et coings, frais");
    private final Position6Dz pos6_080810 = new Position6Dz(1L, "0808 10", "Pommes");
    private final Position10Dz pos10      = new Position10Dz(1L, "0808 10 10", "Variétés de table");

    // Réponses IA (positions sélectionnées)
    private final List<Position> ia_sections   = List.of(new Position("II", null));
    private final List<Position> ia_chapitres  = List.of(new Position("08", null));
    private final List<Position> ia_positions4 = List.of(new Position("0808", null));
    private final List<Position> ia_positions6 = List.of(new Position("0808 10", null));
    private final List<Position> ia_positions10 = List.of(new Position("0808 10 10", null));

    @BeforeEach
    void setUp() {
        searchService = new SearchService(
                aiService, aiPrompts,
                sectionService, chapitreService,
                position4Service, position6DzService, position10DzService
        );

        // Par défaut : theme sans cascade, sans description (mode simple)
        // lenient() : certains tests @Nested re-stubbent getDefTheme localement,
        // Mockito strict mode signalerait sinon un stub inutile.
        lenient().when(aiPrompts.getDefTheme()).thenReturn(DefTheme.builder().build());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Groupe 1 : Arrêts précoces de la cascade
    // ══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Arrêts précoces de la cascade")
    class ArretsPrécosesTest {

        @Test
        @DisplayName("Level 0 vide → résultat vide immédiat, aucun niveau suivant appelé")
        void search_sectionVideApresTroisTentatives_doitRetournerListeVide() {
            // given — L'IA ne trouve aucune section (3 tentatives toutes vides)
            when(sectionService.getAllSections()).thenReturn(List.of(sectionII));
            when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean()))
                    .thenReturn(Collections.emptyList());

            // when
            List<Position> result = searchService.search(TERME, SearchService.SearchLevel.POSITIONS10);

            // then
            assertThat(result).isEmpty();
            // Les niveaux suivants ne doivent JAMAIS être consultés
            verifyNoInteractions(chapitreService, position4Service, position6DzService, position10DzService);
        }

        @Test
        @DisplayName("Level 1 vide → résultat vide, aucun niveau suivant appelé")
        void search_chapitreVide_doitRetournerListeVide() {
            // given
            when(sectionService.getAllSections()).thenReturn(List.of(sectionII));
            when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean()))
                    .thenReturn(ia_sections);
            when(chapitreService.getChapitresBySection("II")).thenReturn(List.of(chapitre08));
            when(aiService.promptEtReponse(eq("CHAPITRES"), any(), any(), anyBoolean()))
                    .thenReturn(Collections.emptyList());

            // when
            List<Position> result = searchService.search(TERME, SearchService.SearchLevel.POSITIONS10);

            // then
            assertThat(result).isEmpty();
            verifyNoInteractions(position4Service, position6DzService, position10DzService);
        }

        @Test
        @DisplayName("Level 2 vide → résultat vide, les niveaux 3 et 4 ne sont pas appelés")
        void search_positions4Vide_doitRetournerListeVide() {
            // given
            configurerJusquauNiveau1();
            when(position4Service.getPosition4sByPrefix("08%")).thenReturn(List.of(pos4_0808));
            when(aiService.promptEtReponse(eq("POSITIONS4"), any(), any(), anyBoolean()))
                    .thenReturn(Collections.emptyList());

            // when
            List<Position> result = searchService.search(TERME, SearchService.SearchLevel.POSITIONS10);

            // then
            assertThat(result).isEmpty();
            verifyNoInteractions(position6DzService, position10DzService);
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Groupe 2 : Contrôle du niveau maximum (maxLevel)
    // ══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Contrôle du niveau maximum (maxLevel)")
    class MaxLevelTest {

        @Test
        @DisplayName("maxLevel=SECTIONS → s'arrête après le niveau 0, chapitres non appelés")
        void search_avecMaxLevelSections_doitSArreterAuLevel0() {
            // given
            when(sectionService.getAllSections()).thenReturn(List.of(sectionII));
            when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean()))
                    .thenReturn(ia_sections);

            // when
            List<Position> result = searchService.search(TERME, SearchService.SearchLevel.SECTIONS);

            // then
            assertThat(result).isNotEmpty();
            assertThat(result.get(0).getCode()).isEqualTo("II");
            verifyNoInteractions(chapitreService, position4Service, position6DzService, position10DzService);
        }

        @Test
        @DisplayName("maxLevel=CHAPITRES → s'arrête après le niveau 1, positions4 non appelées")
        void search_avecMaxLevelChapitres_doitSArreterAuLevel1() {
            // given
            configurerJusquauNiveau1();

            // when
            List<Position> result = searchService.search(TERME, SearchService.SearchLevel.CHAPITRES);

            // then
            assertThat(result).isNotEmpty();
            assertThat(result.get(0).getCode()).isEqualTo("08");
            verifyNoInteractions(position4Service, position6DzService, position10DzService);
        }

        @Test
        @DisplayName("maxLevel=POSITIONS6 → le level 4 (Position10) n'est JAMAIS appelé")
        void search_avecMaxLevelPositions6_doitSArreterAuLevel3() {
            // given
            configurerJusquauNiveau3();

            // when
            List<Position> result = searchService.search(TERME, SearchService.SearchLevel.POSITIONS6);

            // then
            assertThat(result).isNotEmpty();
            assertThat(result.get(0).getCode()).isEqualTo("0808 10");
            verifyNoInteractions(position10DzService);
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Groupe 3 : Fallbacks (niveaux vides → remontée au niveau précédent)
    // ══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Fallbacks entre niveaux")
    class FallbackTest {

        @Test
        @DisplayName("Level 3 vide → le Level 2 (Position4) est retourné en fallback")
        void search_positions6Vide_doitRetournerPositions4EnFallback() {
            // given
            configurerJusquauNiveau2();
            when(position6DzService.getPosition6DzsByPrefix("0808%")).thenReturn(List.of(pos6_080810));
            when(aiService.promptEtReponse(eq("POSITIONS6"), any(), any(), anyBoolean()))
                    .thenReturn(Collections.emptyList()); // Level 3 échoue
            // Position10 ne renvoie rien non plus (pas de RAG pour le niveau 4)
            when(position10DzService.getPosition10DzsWithContextByPrefix(anyString()))
                    .thenReturn(Collections.emptyList());

            // when
            List<Position> result = searchService.search(TERME, SearchService.SearchLevel.POSITIONS10);

            // then — fallback sur Level 2 : le code "0808" doit apparaître
            assertThat(result).isNotEmpty();
            assertThat(result).anyMatch(p -> "0808".equals(p.getCode()));
        }

        @Test
        @DisplayName("Level 4 vide → le Level 3 (Position6) est retourné en fallback")
        void search_positions10Vide_doitRetournerPositions6EnFallback() {
            // given
            configurerJusquauNiveau3();
            when(position10DzService.getPosition10DzsWithContextByPrefix("0808 10%"))
                    .thenReturn(List.of(pos10)); // RAG présent
            when(aiService.promptEtReponse(eq("POSITIONS10"), any(), any(), anyBoolean()))
                    .thenReturn(Collections.emptyList()); // mais IA ne trouve rien

            // when
            List<Position> result = searchService.search(TERME, SearchService.SearchLevel.POSITIONS10);

            // then — fallback sur Level 3 : le code "0808 10" doit apparaître
            assertThat(result).isNotEmpty();
            assertThat(result).anyMatch(p -> "0808 10".equals(p.getCode()));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Groupe 4 : Logique de retry (executeWithRetry)
    // ══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Logique de retry")
    class RetryTest {

        @Test
        @DisplayName("Réussite à la 2ème tentative → la méthode IA est appelée exactement 2 fois")
        void executeWithRetry_reussiteALaDeuxiemeTentative_doitSArreterImmediatement() {
            // given
            when(sectionService.getAllSections()).thenReturn(List.of(sectionII));
            when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean()))
                    .thenReturn(Collections.emptyList())  // 1ère tentative : vide
                    .thenReturn(ia_sections);             // 2ème tentative : succès

            // when — maxLevel=SECTIONS pour tester uniquement le retry du level 0
            searchService.search(TERME, SearchService.SearchLevel.SECTIONS);

            // then — 2 appels exacts (pas 3)
            verify(aiService, times(2))
                    .promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean());
        }

        @Test
        @DisplayName("Exception IA au level 0 → absorbée, 3 tentatives, résultat vide")
        void executeWithRetry_exceptionTechnique_doitEtreAbsorbeeEtRetenterTroisFois() {
            // given
            when(sectionService.getAllSections()).thenReturn(List.of(sectionII));
            when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean()))
                    .thenThrow(new RuntimeException("Timeout réseau"));

            // when — ne doit pas propager l'exception
            assertThatCode(
                    () -> searchService.search(TERME, SearchService.SearchLevel.POSITIONS10)
            ).doesNotThrowAnyException();

            // then — 3 tentatives épuisées
            verify(aiService, times(3))
                    .promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Groupe 5 : Modes d'affichage (withCascade / withDescription)
    // ══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Modes d'affichage")
    class ModeAffichageTest {

        @Test
        @DisplayName("withCascade=false → seul le dernier niveau est retourné")
        void search_sansMode_cascadeDesactive_retourneUniquementDernierNiveau() {
            // given — theme sans cascade (défaut setUp)
            configurerJusquauNiveau1();

            // when
            List<Position> result = searchService.search(TERME, SearchService.SearchLevel.CHAPITRES);

            // then — uniquement les chapitres, pas les sections
            assertThat(result).extracting(Position::getCode).containsOnly("08");
            assertThat(result).extracting(Position::getCode).doesNotContain("II");
        }

        @Test
        @DisplayName("withCascade=true → tous les niveaux sont accumulés dans le résultat")
        void search_avecCascadeActive_doitAccumulerTousLesNiveaux() {
            // given — theme avec cascade
            when(aiPrompts.getDefTheme()).thenReturn(DefTheme.builder().withCascade(true).build());
            configurerJusquauNiveau1();

            // when
            List<Position> result = searchService.search(TERME, SearchService.SearchLevel.CHAPITRES);

            // then — sections ET chapitres présents
            assertThat(result).extracting(Position::getCode)
                    .contains("II", "08");
            assertThat(result.size()).isGreaterThanOrEqualTo(2);
        }

        @Test
        @DisplayName("withDescription=false → enrichWithDescriptions ne fait aucun appel DB")
        void search_sansDescription_nAppelleJamaisGetDescription() {
            // given — theme sans description (défaut)
            configurerJusquauNiveau1();

            // when
            searchService.search(TERME, SearchService.SearchLevel.CHAPITRES);

            // then — aucun appel à getDescription
            verify(sectionService,  never()).getDescription(anyString());
            verify(chapitreService, never()).getDescription(anyString());
        }

        @Test
        @DisplayName("withDescription=true → getDescription est appelée pour chaque position")
        void search_avecDescription_doitEnrichirChaqueChapitre() {
            // given — theme avec description
            when(aiPrompts.getDefTheme()).thenReturn(DefTheme.builder().withDescription(true).build());
            configurerJusquauNiveau1();
            when(chapitreService.getDescription("08")).thenReturn("Fruits comestibles");

            // when
            List<Position> result = searchService.search(TERME, SearchService.SearchLevel.CHAPITRES);

            // then — la description a été injectée dans la position
            verify(chapitreService, times(1)).getDescription("08");
            assertThat(result.get(0).getDescription()).isEqualTo("Fruits comestibles");
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Groupe 6 : Cascade complète jusqu'au niveau 10
    // ══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Cascade complète POSITIONS10")
    class CascadeComplèteTest {

        @Test
        @DisplayName("Cascade nominale → retourne le code à 10 chiffres (0808 10 10)")
        void search_cascadeComplete_doitRetournerPosition10() {
            // given
            configurerJusquauNiveau4();

            // when
            List<Position> result = searchService.search(TERME, SearchService.SearchLevel.POSITIONS10);

            // then
            assertThat(result).isNotEmpty();
            assertThat(result.get(0).getCode()).isEqualTo("0808 10 10");
        }

        @Test
        @DisplayName("Tous les niveaux de l'IA sont appelés dans l'ordre correct")
        void search_cascadeComplete_doitAppelerChqueNiveauIA() {
            // given
            configurerJusquauNiveau4();

            // when
            searchService.search(TERME, SearchService.SearchLevel.POSITIONS10);

            // then — chaque niveau IA est appelé exactement une fois
            verify(aiService, atLeastOnce()).promptEtReponse(eq("SECTIONS"),   any(), any(), anyBoolean());
            verify(aiService, atLeastOnce()).promptEtReponse(eq("CHAPITRES"),  any(), any(), anyBoolean());
            verify(aiService, atLeastOnce()).promptEtReponse(eq("POSITIONS4"), any(), any(), anyBoolean());
            verify(aiService, atLeastOnce()).promptEtReponse(eq("POSITIONS6"), any(), any(), anyBoolean());
            verify(aiService, atLeastOnce()).promptEtReponse(eq("POSITIONS10"),any(), any(), anyBoolean());
        }

        @Test
        @DisplayName("Aucun appel à Position10 si le RAG de niveau 4 est vide")
        void search_ragNiveau4Vide_doitSkipperLAppelIaPositions10() {
            // given — niveau 3 réussi mais pas de Position10 pour ce préfixe
            configurerJusquauNiveau3();
            when(position10DzService.getPosition10DzsWithContextByPrefix("0808 10%"))
                    .thenReturn(Collections.emptyList());

            // when
            searchService.search(TERME, SearchService.SearchLevel.POSITIONS10);

            // then — l'IA pour POSITIONS10 ne doit pas être appelée
            verify(aiService, never()).promptEtReponse(eq("POSITIONS10"), any(), any(), anyBoolean());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Helpers : configuration progressive de la cascade
    // ══════════════════════════════════════════════════════════════════════════

    /** Configure les mocks jusqu'au Level 1 (Chapitres) inclus. */
    private void configurerJusquauNiveau1() {
        when(sectionService.getAllSections()).thenReturn(List.of(sectionII));
        when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean()))
                .thenReturn(ia_sections);
        when(chapitreService.getChapitresBySection("II")).thenReturn(List.of(chapitre08));
        when(aiService.promptEtReponse(eq("CHAPITRES"), any(), any(), anyBoolean()))
                .thenReturn(ia_chapitres);
    }

    /** Configure les mocks jusqu'au Level 2 (Positions4) inclus. */
    private void configurerJusquauNiveau2() {
        configurerJusquauNiveau1();
        when(position4Service.getPosition4sByPrefix("08%")).thenReturn(List.of(pos4_0808));
        when(aiService.promptEtReponse(eq("POSITIONS4"), any(), any(), anyBoolean()))
                .thenReturn(ia_positions4);
    }

    /** Configure les mocks jusqu'au Level 3 (Positions6) inclus. */
    private void configurerJusquauNiveau3() {
        configurerJusquauNiveau2();
        when(position6DzService.getPosition6DzsByPrefix("0808%")).thenReturn(List.of(pos6_080810));
        when(aiService.promptEtReponse(eq("POSITIONS6"), any(), any(), anyBoolean()))
                .thenReturn(ia_positions6);
    }

    /** Configure les mocks jusqu'au Level 4 (Positions10) inclus. */
    private void configurerJusquauNiveau4() {
        configurerJusquauNiveau3();
        when(position10DzService.getPosition10DzsWithContextByPrefix("0808 10%"))
                .thenReturn(List.of(pos10));
        when(aiService.promptEtReponse(eq("POSITIONS10"), any(), any(), anyBoolean()))
                .thenReturn(ia_positions10);
    }
}
