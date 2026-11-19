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
    @Mock private TariffPositionService tariffPositionService;

    private SearchService searchService;

    // ── Données de test ────────────────────────────────────────────────────────

    private static final String TERME = "pommes fraîches";

    // Entités retournées par les services de données
    private final Section    sectionII   = new Section(1L, "II", "Produits du règne végétal", null);
    private final Chapitre   chapitre08  = new Chapitre(1L, "08", "Fruits comestibles", "II", null);
    private final Position4  pos4_0808   = new Position4(1L, "0808", "Pommes, poires et coings, frais");
    private final Position6Dz pos6_080810 = new Position6Dz(1L, "080810", "Pommes");
    private final Position10Dz pos10      = new Position10Dz(1L, "0808101000", "Variétés de table");

    // Réponses IA (positions sélectionnées — même avec espaces, elles sont normalisées)
    private final List<Position> ia_sections   = List.of(new Position("II", null));
    private final List<Position> ia_chapitres  = List.of(new Position("08", null));
    private final List<Position> ia_positions4 = List.of(new Position("0808", null));
    private final List<Position> ia_positions6 = List.of(new Position("0808 10", null));
    private final List<Position> ia_positions10 = List.of(new Position("0808 10 10 00", null));

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
            // given — L'IA ne trouve aucune section (tentative 1 fast-model + tentatives 2-3 modèle principal)
            when(sectionService.getAllSections()).thenReturn(List.of(sectionII));
            when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean(), eq(true)))
                    .thenReturn(Collections.emptyList());
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
            when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean(), eq(true)))
                    .thenReturn(ia_sections);
            when(chapitreService.getChapitresBySection("II")).thenReturn(List.of(chapitre08));
            when(aiService.promptEtReponse(eq("CHAPITRES"), any(), any(), anyBoolean(), eq(true)))
                    .thenReturn(Collections.emptyList());
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
            when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean(), eq(true)))
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
            assertThat(result.get(0).getCode()).isEqualTo("080810");
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
        @DisplayName("Level 3 vide → le Level 2 (Position4) est expandé en Position6 correspondante")
        void search_positions6Vide_doitRetournerPositions4ExpandeesEnFallback() {
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

            // then — fallback Level 2 expandé en 6 chiffres : "080810"
            assertThat(result).isNotEmpty();
            assertThat(result).anyMatch(p -> "080810".equals(p.getCode()));
        }

        @Test
        @DisplayName("Level 4 vide → le Level 3 (Position6) est retourné en fallback")
        void search_positions10Vide_doitRetournerPositions6EnFallback() {
            // given
            configurerJusquauNiveau3();
            when(position10DzService.getPosition10DzsWithContextByPrefix("080810%"))
                    .thenReturn(List.of(pos10)); // RAG présent
            when(aiService.promptEtReponse(eq("POSITIONS10"), any(), any(), anyBoolean()))
                    .thenReturn(Collections.emptyList()); // mais IA ne trouve rien

            // when
            List<Position> result = searchService.search(TERME, SearchService.SearchLevel.POSITIONS10);

            // then — fallback sur Level 3 : le code normalisé "080810" doit apparaître
            assertThat(result).isNotEmpty();
            assertThat(result).anyMatch(p -> "080810".equals(p.getCode()));
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Groupe 4 : Logique de retry (executeWithRetry)
    // ══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Logique de retry")
    class RetryTest {

        @Test
        @DisplayName("Réussite à la 2ème tentative → tentative 1 fast-model + tentative 2 modèle principal")
        void executeWithRetry_reussiteALaDeuxiemeTentative_doitSArreterImmediatement() {
            // given
            when(sectionService.getAllSections()).thenReturn(List.of(sectionII));
            when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean(), eq(true)))
                    .thenReturn(Collections.emptyList()); // 1ère tentative (modèle rapide) : vide
            when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean()))
                    .thenReturn(ia_sections);             // 2ème tentative (modèle principal) : succès

            // when — maxLevel=SECTIONS pour tester uniquement le retry du level 0
            searchService.search(TERME, SearchService.SearchLevel.SECTIONS);

            // then — 2 appels exacts (1 fast-model + 1 modèle principal)
            verify(aiService, times(1))
                    .promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean(), eq(true));
            verify(aiService, times(1))
                    .promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean());
        }

        @Test
        @DisplayName("Exception IA au level 0 → absorbée, 3 tentatives (1 fast + 2 principal), résultat vide")
        void executeWithRetry_exceptionTechnique_doitEtreAbsorbeeEtRetenterTroisFois() {
            // given
            when(sectionService.getAllSections()).thenReturn(List.of(sectionII));
            when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean(), eq(true)))
                    .thenThrow(new RuntimeException("Timeout réseau"));
            when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean()))
                    .thenThrow(new RuntimeException("Timeout réseau"));

            // when — ne doit pas propager l'exception
            assertThatCode(
                    () -> searchService.search(TERME, SearchService.SearchLevel.POSITIONS10)
            ).doesNotThrowAnyException();

            // then — 3 tentatives épuisées (1 fast-model + 2 modèle principal)
            verify(aiService, times(1))
                    .promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean(), eq(true));
            verify(aiService, times(2))
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
        @DisplayName("Cascade nominale → retourne le code à 10 chiffres normalisé (0808101000)")
        void search_cascadeComplete_doitRetournerPosition10() {
            // given
            configurerJusquauNiveau4();

            // when
            List<Position> result = searchService.search(TERME, SearchService.SearchLevel.POSITIONS10);

            // then
            assertThat(result).isNotEmpty();
            assertThat(result.get(0).getCode()).isEqualTo("0808101000");
        }

        @Test
        @DisplayName("Tous les niveaux de l'IA sont appelés dans l'ordre correct")
        void search_cascadeComplete_doitAppelerChqueNiveauIA() {
            // given
            configurerJusquauNiveau4();

            // when
            searchService.search(TERME, SearchService.SearchLevel.POSITIONS10);

            // then — chaque niveau IA est appelé exactement une fois
            verify(aiService, atLeastOnce()).promptEtReponse(eq("SECTIONS"),   any(), any(), anyBoolean(), eq(true));
            verify(aiService, atLeastOnce()).promptEtReponse(eq("CHAPITRES"),  any(), any(), anyBoolean(), eq(true));
            verify(aiService, atLeastOnce()).promptEtReponse(eq("POSITIONS4"), any(), any(), anyBoolean());
            verify(aiService, atLeastOnce()).promptEtReponse(eq("POSITIONS6"), any(), any(), anyBoolean());
            verify(aiService, atLeastOnce()).promptEtReponse(eq("POSITIONS10"),any(), any(), anyBoolean());
        }

        @Test
        @DisplayName("Aucun appel à Position10 si le RAG de niveau 4 est vide")
        void search_ragNiveau4Vide_doitSkipperLAppelIaPositions10() {
            // given — niveau 3 réussi mais pas de Position10 pour ce préfixe
            configurerJusquauNiveau3();
            when(position10DzService.getPosition10DzsWithContextByPrefix("080810%"))
                    .thenReturn(Collections.emptyList());

            // when
            searchService.search(TERME, SearchService.SearchLevel.POSITIONS10);

            // then — l'IA pour POSITIONS10 ne doit pas être appelée
            verify(aiService, never()).promptEtReponse(eq("POSITIONS10"), any(), any(), anyBoolean());
        }

        @Test
        @DisplayName("Terme égal à l'intitulé d'une Position4 (ex: 1806) → retourne 1806 en P10 et les 5 codes HS6 en P6")
        void search_intituleExactPosition4_doitRetournerBrancheComplete() {
            when(aiPrompts.getDefTheme()).thenReturn(DefTheme.builder().withDescription(true).build());
            String terme1806 = "Chocolat et autres préparations alimentaires contenant du cacao";
            Section sec04 = new Section(4L, "04", "Produits des industries alimentaires", null);
            Chapitre chap18 = new Chapitre(18L, "18", "Cacao et ses préparations", "04", null);
            Position4 pos1806 = new Position4(1806L, "1806", "Chocolat et autres préparations alimentaires contenant du cacao:");

            when(sectionService.getAllSections()).thenReturn(List.of(sec04));
            when(sectionService.getDescription("04")).thenReturn(sec04.getDescription());
            when(chapitreService.getChapitresBySection("04")).thenReturn(List.of(chap18));
            when(chapitreService.getDescription("18")).thenReturn(chap18.getDescription());
            when(position4Service.getPosition4sByPrefix("18%")).thenReturn(List.of(pos1806));
            when(position4Service.getDescription("1806")).thenReturn(pos1806.getDescription());

            when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean(), eq(true)))
                    .thenReturn(List.of(new Position("04", null)));
            when(aiService.promptEtReponse(eq("CHAPITRES"), any(), any(), anyBoolean(), eq(true)))
                    .thenReturn(List.of(new Position("18", null)));
            when(aiService.promptEtReponse(eq("POSITIONS4"), any(), any(), anyBoolean()))
                    .thenReturn(List.of(new Position("1806", null)));

            // 1. En mode POSITIONS10 : retourne directement "1806" sans appeler Level 3 ni Level 4
            List<Position> resP10 = searchService.search(terme1806, SearchService.SearchLevel.POSITIONS10);
            assertThat(resP10).extracting(Position::getCode).containsExactly("1806");
            verify(aiService, never()).promptEtReponse(eq("POSITIONS6"), any(), any(), anyBoolean());
            verify(aiService, never()).promptEtReponse(eq("POSITIONS10"), any(), any(), anyBoolean());

            // 2. En mode POSITIONS6 : retourne les 5 sous-positions SH6 de 1806
            List<Position6Dz> hs6List = List.of(
                    new Position6Dz(1L, "180610", "Poudre de cacao sucrée"),
                    new Position6Dz(2L, "180620", "Autres préparations > 2 kg"),
                    new Position6Dz(3L, "180631", "Tablettes fourrées"),
                    new Position6Dz(4L, "180632", "Tablettes non fourrées"),
                    new Position6Dz(5L, "180690", "Autres")
            );
            when(position6DzService.getPosition6DzsByPrefix("1806%")).thenReturn(hs6List);
            for (Position6Dz p6 : hs6List) {
                when(position6DzService.getDescription(p6.getCode())).thenReturn(p6.getDescription());
            }

            List<Position> resP6 = searchService.search(terme1806, SearchService.SearchLevel.POSITIONS6);
            assertThat(resP6).extracting(Position::getCode)
                    .containsExactly("180610", "180620", "180631", "180632", "180690");
        }
    }

    @Nested
    @DisplayName("Zone EU — conservation des codes NC8 à 8 chiffres")
    class ZoneEuNc8Test {

        @Test
        @DisplayName("search(EU, POSITIONS10) conserve les codes NC8 à 8 chiffres sans troncature ni suffixe 00")
        void searchEu_pos10_conserveCodeNc8HuitChiffres() {
            SearchService euSearchService = new SearchService(
                    aiService, aiPrompts,
                    sectionService, chapitreService,
                    position4Service, position6DzService, position10DzService,
                    tariffPositionService
            );

            when(aiPrompts.getDefTheme()).thenReturn(DefTheme.builder().withDescription(true).build());

            when(sectionService.getAllSections()).thenReturn(List.of(sectionII));
            when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean(), eq(true))).thenReturn(ia_sections);

            when(chapitreService.getChapitresBySection("II")).thenReturn(List.of(chapitre08));
            when(aiService.promptEtReponse(eq("CHAPITRES"), any(), any(), anyBoolean(), eq(true))).thenReturn(ia_chapitres);

            when(position4Service.getPosition4sByPrefix("08%")).thenReturn(List.of(pos4_0808));
            when(position4Service.getDescription("0808")).thenReturn("Pommes, poires et coings, frais");
            when(aiService.promptEtReponse(eq("POSITIONS4"), any(), any(), anyBoolean())).thenReturn(ia_positions4);

            when(tariffPositionService.getDistinctHs6ForPos4("EU", "0808"))
                    .thenReturn(List.of(new Position("080810", "Pommes")));
            when(tariffPositionService.getHs6Description("EU", "080810")).thenReturn("Pommes");
            when(aiService.promptEtReponse(eq("POSITIONS6"), any(), any(), anyBoolean())).thenReturn(ia_positions6);

            when(tariffPositionService.getContextPositionsForHs6("EU", "080810")).thenReturn(List.of(
                    new Position("08081010", "À cidre"),
                    new Position("08081080", "Autres")
            ));
            when(aiService.promptEtReponse(eq("POSITIONS10"), any(), any(), anyBoolean()))
                    .thenReturn(List.of(new Position("0808 10 80", null, "Pommes de table")));
            when(tariffPositionService.getDescription("EU", "08081080")).thenReturn("Autres");

            List<Position> result = euSearchService.search(TERME, SearchService.SearchLevel.POSITIONS10, "EU");

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getCode()).isEqualTo("08081080");
            assertThat(result.get(0).getDescription()).isEqualTo("Autres");
            assertThat(result.get(0).getJustification()).isEqualTo("Pommes de table");
            verifyNoInteractions(position10DzService);
        }
    }

    @Nested
    @DisplayName("Optimisations latence (accès direct chapitres & court-circuit .00)")
    class OptimisationsLatenceTest {

        @Test
        @DisplayName("directChapterSearch=true → saute l'appel IA SECTIONS et appelle CHAPITRES directement")
        void search_directChapterSearchActive_sauteAppelIaSections() {
            SearchService fastSearchService = new SearchService(
                    aiService, aiPrompts,
                    sectionService, chapitreService,
                    position4Service, position6DzService, position10DzService,
                    tariffPositionService,
                    true
            );

            when(sectionService.getAllSections()).thenReturn(List.of(sectionII));
            when(chapitreService.getAllChapitres()).thenReturn(List.of(chapitre08));
            when(chapitreService.getChapitresBySection("II")).thenReturn(List.of(chapitre08));
            when(aiService.promptEtReponse(eq("CHAPITRES"), any(), any(), anyBoolean(), eq(true)))
                    .thenReturn(ia_chapitres);

            List<Position> result = fastSearchService.search(TERME, SearchService.SearchLevel.CHAPITRES);

            assertThat(result).extracting(Position::getCode).containsExactly("08");
            verify(aiService, never()).promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean(), anyBoolean());
            verify(aiService, never()).promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean());
            verify(aiService, times(1)).promptEtReponse(eq("CHAPITRES"), any(), any(), anyBoolean(), eq(true));
        }

        @Test
        @DisplayName("Sous-position unique .00 en mode POSITIONS10 → court-circuite l'appel IA POSITIONS6")
        void search_sousPositionUniqueTermineePar00_courtCircuitePositions6() {
            Position4 pos4_1206 = new Position4(1206L, "1206", "Graines de tournesol");
            Position6Dz pos6_120600 = new Position6Dz(1L, "120600", "Graines de tournesol");
            Position10Dz pos10_1206001000 = new Position10Dz(1L, "1206001000", "De semence");

            configurerJusquauNiveau1();
            when(position4Service.getPosition4sByPrefix("08%")).thenReturn(List.of(pos4_1206));
            when(aiService.promptEtReponse(eq("POSITIONS4"), any(), any(), anyBoolean()))
                    .thenReturn(List.of(new Position("1206", null)));
            when(position6DzService.getPosition6DzsByPrefix("1206%")).thenReturn(List.of(pos6_120600));
            when(position10DzService.getPosition10DzsWithContextByPrefix("120600%"))
                    .thenReturn(List.of(pos10_1206001000));
            when(aiService.promptEtReponse(eq("POSITIONS10"), any(), any(), anyBoolean()))
                    .thenReturn(List.of(new Position("1206001000", null)));

            List<Position> result = searchService.search("graines de tournesol de semence", SearchService.SearchLevel.POSITIONS10);

            assertThat(result).extracting(Position::getCode).containsExactly("1206001000");
            verify(aiService, never()).promptEtReponse(eq("POSITIONS6"), any(), any(), anyBoolean());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Helpers : configuration progressive de la cascade
    // ══════════════════════════════════════════════════════════════════════════

    /** Configure les mocks jusqu'au Level 1 (Chapitres) inclus. */
    private void configurerJusquauNiveau1() {
        when(sectionService.getAllSections()).thenReturn(List.of(sectionII));
        when(aiService.promptEtReponse(eq("SECTIONS"), any(), any(), anyBoolean(), eq(true)))
                .thenReturn(ia_sections);
        when(chapitreService.getChapitresBySection("II")).thenReturn(List.of(chapitre08));
        when(aiService.promptEtReponse(eq("CHAPITRES"), any(), any(), anyBoolean(), eq(true)))
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
        when(position10DzService.getPosition10DzsWithContextByPrefix("080810%"))
                .thenReturn(List.of(pos10));
        when(aiService.promptEtReponse(eq("POSITIONS10"), any(), any(), anyBoolean()))
                .thenReturn(ia_positions10);
    }
}
