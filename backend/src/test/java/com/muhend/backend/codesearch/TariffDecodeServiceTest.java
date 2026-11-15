package com.muhend.backend.codesearch;

import com.muhend.backend.codesearch.model.*;
import com.muhend.backend.codesearch.repository.*;
import com.muhend.backend.codesearch.service.TariffDecodeService;
import com.muhend.backend.codesearch.service.TariffGlossaryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TariffDecodeServiceTest {

    private ChapitreRepository chapitreRepository;
    private SectionRepository sectionRepository;
    private Position4Repository position4Repository;
    private Position6DzRepository position6DzRepository;
    private TariffPositionRepository tariffPositionRepository;
    private TariffGlossaryRepository tariffGlossaryRepository;
    private TariffDecodeService decodeService;

    @BeforeEach
    void setUp() {
        chapitreRepository = mock(ChapitreRepository.class);
        sectionRepository = mock(SectionRepository.class);
        position4Repository = mock(Position4Repository.class);
        position6DzRepository = mock(Position6DzRepository.class);
        tariffPositionRepository = mock(TariffPositionRepository.class);
        tariffGlossaryRepository = mock(TariffGlossaryRepository.class);

        when(sectionRepository.findByCode("01")).thenReturn(
                Optional.of(new Section(1L, "01", "ANIMAUX VIVANTS ET PRODUITS DU REGNE ANIMAL", "Note section 01")));
        when(chapitreRepository.findByCode("01")).thenReturn(
                Optional.of(new Chapitre(1L, "01", "Animaux vivants", "01", "Note chapitre 01")));
        when(position4Repository.findByCode("0101")).thenReturn(
                Optional.of(new Position4(1L, "0101", "Chevaux, ânes, mulets et bardots, vivants.")));
        when(position6DzRepository.findByCode("010121")).thenReturn(
                Optional.of(new Position6Dz(1L, "010121", "- Chevaux : Reproducteurs de race pure")));

        when(tariffGlossaryRepository.findByZoneCode("DZ")).thenReturn(List.of(
                TariffGlossary.builder().zoneCode("DZ").category("FAP").code("I.S.V")
                        .label("Inspection Sanitaire Vétérinaire").description("Contrôle vétérinaire").build(),
                TariffGlossary.builder().zoneCode("DZ").category("FAP").code("D.S.V")
                        .label("Dérogation Sanitaire Vétérinaire").description("Autorisation DSV").build(),
                TariffGlossary.builder().zoneCode("DZ").category("UQN").code("U")
                        .label("Unité / Pièce").description("Comptage unitaire").build(),
                TariffGlossary.builder().zoneCode("DZ").category("TAX").code("DD")
                        .label("Droit de Douane").description("Taux ad valorem").build()
        ));

        List<TariffPosition> rows0101 = List.of(
                TariffPosition.builder().id(1L).zoneCode("DZ").code("0101").pos4Code("0101").chapterCode("01")
                        .description("Chevaux, ânes, mulets et bardots, vivants.").dashLevel(0).isTitle(true).rowOrder(1).build(),
                TariffPosition.builder().id(2L).zoneCode("DZ").code("").pos4Code("0101").chapterCode("01")
                        .description("Désignation des Produits").dashLevel(0).isTitle(true).rowOrder(2).build(),
                TariffPosition.builder().id(3L).zoneCode("DZ").code("").pos4Code("0101").chapterCode("01")
                        .description("- Chevaux :").dashLevel(1).isTitle(true).rowOrder(3).build(),
                TariffPosition.builder().id(4L).zoneCode("DZ").code("").pos4Code("0101").chapterCode("01")
                        .description("- - Reproducteurs de race pure :").dashLevel(2).isTitle(true).rowOrder(4).build(),
                TariffPosition.builder().id(5L).zoneCode("DZ").code("").pos4Code("0101").chapterCode("01")
                        .description("- - - Autres que de course :").dashLevel(3).isTitle(true).rowOrder(5).build(),
                TariffPosition.builder().id(6L).zoneCode("DZ").code("0101219100").formattedCode("0101.21.91.00").checkDigit("L")
                        .chapterCode("01").pos4Code("0101").hs6Code("010121")
                        .description("- - - - De pur sang arabe").dashLevel(4).isTitle(false).rowOrder(6)
                        .regulatoryData(Map.of(
                                "dd", "5",
                                "tva", "9",
                                "autres", "-",
                                "uqn", "U",
                                "gu", "1",
                                "fap", List.of("I.S.V", "D.S.V")
                        ))
                        .enriched(true)
                        .build(),
                TariffPosition.builder().id(7L).zoneCode("DZ").code("0101219900").formattedCode("0101.21.99.00")
                        .chapterCode("01").pos4Code("0101").hs6Code("010121")
                        .description("- - - - Autres").dashLevel(4).isTitle(false).rowOrder(7)
                        .enriched(false)
                        .build()
        );
        when(tariffPositionRepository.findByZoneCodeAndPos4CodeOrderByRowOrderAsc("DZ", "0101")).thenReturn(rows0101);

        when(tariffGlossaryRepository.findByZoneCode("EU")).thenReturn(List.of(
                TariffGlossary.builder().zoneCode("EU").category("TAX").code("DD")
                        .label("Droit conventionnel TDC (Pays tiers)").description("Tarif Douanier Commun").build(),
                TariffGlossary.builder().zoneCode("EU").category("UQN").code("p/st")
                        .label("Nombre de pièces").description("Comptage par pièce").build()
        ));

        List<TariffPosition> euRows0101 = List.of(
                TariffPosition.builder().id(101L).zoneCode("EU").code("0101").pos4Code("0101").chapterCode("01")
                        .description("Chevaux, ânes, mulets et bardots, vivants:").dashLevel(0).isTitle(true).rowOrder(1).build(),
                TariffPosition.builder().id(102L).zoneCode("EU").code("").pos4Code("0101").chapterCode("01")
                        .description("- Chevaux:").dashLevel(1).isTitle(true).rowOrder(2).build(),
                TariffPosition.builder().id(103L).zoneCode("EU").code("01012100").formattedCode("0101.21.00")
                        .chapterCode("01").pos4Code("0101").hs6Code("010121")
                        .description("- - reproducteurs de race pure").dashLevel(2).isTitle(false).rowOrder(3)
                        .regulatoryData(Map.of("dd", "0 % (Exemption)", "uqn", "p/st", "fap", List.of()))
                        .enriched(true)
                        .build()
        );
        when(tariffPositionRepository.findByZoneCodeAndPos4CodeOrderByRowOrderAsc("EU", "0101")).thenReturn(euRows0101);

        TariffGlossaryService glossaryService = new TariffGlossaryService(tariffGlossaryRepository);
        decodeService = new TariffDecodeService(
                chapitreRepository,
                sectionRepository,
                position4Repository,
                position6DzRepository,
                tariffPositionRepository,
                glossaryService
        );
    }

    @Test
    void decodeFormattedP10IncludesOneDashTitleSkipsPageHeaderAndResolvesGlossary() {
        DecodeResult res = decodeService.decode("0101.21.91.00 L", "DZ", true);

        assertEquals("DZ", res.getZone());
        assertEquals("POSITION10", res.getNiveau());
        assertEquals(List.of(
                "- Chevaux :",
                "- - Reproducteurs de race pure :",
                "- - - Autres que de course :"
        ), res.getTitresPosition10());

        assertNotNull(res.getPositions10());
        assertEquals(1, res.getPositions10().size());
        DecodeResult.CodeItem item = res.getPositions10().get(0);
        assertEquals("0101219100", item.getCode());
        assertEquals("0101.21.91.00", item.getFormattedCode());
        assertEquals("L", item.getCheckDigit());
        assertTrue(item.isEnriched());
        assertEquals("5", item.getRegulatoryData().get("dd"));
        assertEquals("9", item.getRegulatoryData().get("tva"));

        assertNotNull(res.getGlossary());
        assertTrue(res.getGlossary().containsKey("I.S.V"));
        assertTrue(res.getGlossary().containsKey("U"));
        assertTrue(res.getGlossary().containsKey("DD"));
    }

    @Test
    void decodeHs6ReturnsChildP10LeavesAndTitlesMap() {
        DecodeResult res = decodeService.decode("010121", "DZ", true);

        assertEquals("POSITION6", res.getNiveau());
        assertNotNull(res.getPositions10());
        assertEquals(2, res.getPositions10().size());
        assertEquals("0101219100", res.getPositions10().get(0).getCode());
        assertEquals("0101219900", res.getPositions10().get(1).getCode());

        assertNotNull(res.getTitresParPosition10());
        assertEquals(3, res.getTitresParPosition10().get("0101219100").size());
        assertEquals("- Chevaux :", res.getTitresParPosition10().get("0101219100").get(0));
    }

    @Test
    void decodeEuCn8ReturnsPosition8HierarchyAndEuGlossary() {
        DecodeResult res = decodeService.decode("0101.21.00", "EU", true);

        assertEquals("EU", res.getZone());
        assertEquals("POSITION8", res.getNiveau());
        assertEquals(List.of("- Chevaux:"), res.getTitresPosition10());
        assertNotNull(res.getPositions10());
        assertEquals(1, res.getPositions10().size());
        DecodeResult.CodeItem item = res.getPositions10().get(0);
        assertEquals("01012100", item.getCode());
        assertEquals("0101.21.00", item.getFormattedCode());
        assertNull(item.getCheckDigit());
        assertEquals("0 % (Exemption)", item.getRegulatoryData().get("dd"));
        assertEquals("p/st", item.getRegulatoryData().get("uqn"));
        assertTrue(res.getGlossary().containsKey("DD"));
        assertTrue(res.getGlossary().containsKey("p/st"));
    }

    @Test
    void compareHs6ReturnsSideBySideDzAndEuOnCommonHs6() {
        Hs6ComparisonResult cmp = decodeService.compareHs6("0101.21.91.00 L");

        assertEquals("010121", cmp.getHs6());
        assertEquals("0101", cmp.getPosition4().getCode());
        assertEquals("010121", cmp.getPosition6().getCode());

        assertNotNull(cmp.getDz());
        assertEquals(2, cmp.getDz().getPositions10().size());
        assertEquals("0101219100", cmp.getDz().getPositions10().get(0).getCode());

        assertNotNull(cmp.getEu());
        assertEquals(1, cmp.getEu().getPositions10().size());
        assertEquals("01012100", cmp.getEu().getPositions10().get(0).getCode());
    }

    @Test
    void compareHs6HandlesSingleZoneHs2022Fallback() {
        when(chapitreRepository.findByCode("88")).thenReturn(
                Optional.of(new Chapitre(88L, "88", "Navigation aérienne ou spatiale", "17", null)));
        when(sectionRepository.findByCode("17")).thenReturn(
                Optional.of(new Section(17L, "17", "MATERIEL DE TRANSPORT", null)));
        TariffPosition eu8806 = TariffPosition.builder().id(201L).zoneCode("EU").code("8806")
                .pos4Code("8806").chapterCode("88").description("Aéronefs sans équipage à bord")
                .dashLevel(0).isTitle(true).rowOrder(1).build();
        TariffPosition eu880621Title = TariffPosition.builder().id(202L).zoneCode("EU").code("")
                .pos4Code("8806").chapterCode("88").hs6Code("880621").description("- - uniquement à vol télécommandé:")
                .dashLevel(2).isTitle(true).rowOrder(2).build();
        TariffPosition eu88062100 = TariffPosition.builder().id(203L).zoneCode("EU").code("88062100")
                .formattedCode("8806.21.00").pos4Code("8806").chapterCode("88").hs6Code("880621")
                .description("- - - avec une masse maximale au décollage n'excédant pas 250 g")
                .dashLevel(3).isTitle(false).rowOrder(3)
                .regulatoryData(Map.of("dd", "2,7 %", "uqn", "p/st", "fap", List.of()))
                .enriched(true).build();
        when(tariffPositionRepository.findByZoneCodeAndCode("EU", "8806")).thenReturn(Optional.of(eu8806));
        when(tariffPositionRepository.findByZoneCodeAndPos4CodeOrderByRowOrderAsc("EU", "8806"))
                .thenReturn(List.of(eu8806, eu880621Title, eu88062100));

        Hs6ComparisonResult cmp = decodeService.compareHs6("880621");

        assertEquals("880621", cmp.getHs6());
        assertNull(cmp.getDz());
        assertNotNull(cmp.getEu());
        assertEquals("8806", cmp.getPosition4().getCode());
        assertEquals("- - uniquement à vol télécommandé:", cmp.getPosition6().getDescription());
        assertEquals("88062100", cmp.getEu().getPositions10().get(0).getCode());
    }

    @Test
    void rateLimitBlocksAboveSixtyRequestsPerMinuteForSameIp() {
        for (int i = 0; i < 60; i++) {
            decodeService.checkRateLimit("203.0.113.10");
        }
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> decodeService.checkRateLimit("203.0.113.10"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatusCode());

        // Une autre IP n'est pas bloquée
        assertDoesNotThrow(() -> decodeService.checkRateLimit("203.0.113.11"));
    }
}
