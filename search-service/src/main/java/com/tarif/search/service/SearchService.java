package com.tarif.search.service;

import com.tarif.search.model.Chapitre;
import com.tarif.search.model.Position;
import com.tarif.search.model.Section;
import com.tarif.search.service.ai.AiPrompts;
import com.tarif.search.service.ai.AiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SearchService {

    private final AiService aiService;
    private final AiPrompts aiPrompts;
    private final SectionService sectionService;
    private final ChapitreService chapitreService;
    private final Position4Service position4Service;
    private final Position6DzService position6DzService;

    public enum SearchLevel {
        SECTIONS, CHAPITRES, POSITIONS4, POSITIONS6
    }

    public List<Position> search(String termeRecherche, SearchLevel maxLevel) {
        log.info("Recherche cascade pour '{}' (niveau max: {})", termeRecherche, maxLevel);

        List<Position> reponseList = new ArrayList<>();
        List<Position> reponseListLevel = new ArrayList<>();
        List<Position> positions;
        List<Position> ragNiveau;
        int tentativesMax = 2;

        // Level 0 : Sections
        ragNiveau = ragSections();
        log.debug("Level 0 (Sections) - RAG size: {}", ragNiveau.size());

        positions = executeWithRetry(SearchLevel.SECTIONS.toString(), termeRecherche, ragNiveau, tentativesMax);

        if (positions == null || positions.isEmpty()) {
            log.info("Level 0 - Aucun résultat, arrêt cascade");
            return new ArrayList<>();
        }

        enrichWithDescriptions(positions, SearchLevel.SECTIONS);
        reponseListLevel.addAll(positions);

        if (aiPrompts.getDefTheme().isWithCascade()) {
            reponseList.addAll(reponseListLevel);
        }

        if (maxLevel == SearchLevel.SECTIONS) {
            return aiPrompts.getDefTheme().isWithCascade() ? reponseList : reponseListLevel;
        }

        // Level 1 : Chapitres
        reponseListLevel.clear();
        ragNiveau = ragChapitres(positions);
        log.debug("Level 1 (Chapitres) - RAG size: {}", ragNiveau.size());

        positions = executeWithRetry(SearchLevel.CHAPITRES.toString(), termeRecherche, ragNiveau, tentativesMax);

        if (positions == null || positions.isEmpty()) {
            log.info("Level 1 - Aucun résultat, arrêt cascade");
            return new ArrayList<>();
        }

        enrichWithDescriptions(positions, SearchLevel.CHAPITRES);
        reponseListLevel.addAll(positions);

        if (aiPrompts.getDefTheme().isWithCascade()) {
            reponseList.addAll(reponseListLevel);
        }

        if (maxLevel == SearchLevel.CHAPITRES) {
            return aiPrompts.getDefTheme().isWithCascade() ? reponseList : reponseListLevel;
        }

        // Level 2 : Positions 4
        reponseListLevel.clear();
        ragNiveau = ragPositions4(positions);
        log.debug("Level 2 (Positions4) - RAG size: {}", ragNiveau.size());

        positions = executeWithRetry(SearchLevel.POSITIONS4.toString(), termeRecherche, ragNiveau, tentativesMax);
        List<Position> positionsLevel2 = positions;

        if (positions == null || positions.isEmpty()) {
            log.info("Level 2 - Aucun résultat, arrêt cascade");
            return new ArrayList<>();
        }

        enrichWithDescriptions(positions, SearchLevel.POSITIONS4);
        reponseListLevel.addAll(positions);

        if (aiPrompts.getDefTheme().isWithCascade()) {
            reponseList.addAll(reponseListLevel);
        }

        if (maxLevel == SearchLevel.POSITIONS4) {
            return aiPrompts.getDefTheme().isWithCascade() ? reponseList : reponseListLevel;
        }

        // Level 3 : Positions 6
        reponseListLevel.clear();
        ragNiveau = ragPositions6(positions);
        log.debug("Level 3 (Positions6) - RAG size: {}", ragNiveau.size());

        positions = executeWithRetry(SearchLevel.POSITIONS6.toString(), termeRecherche, ragNiveau, tentativesMax);

        if (positions == null || positions.isEmpty()) {
            log.info("Level 3 - Aucun résultat, utilisation Level 2");
            positions = positionsLevel2;
        }

        enrichWithDescriptions(positions, SearchLevel.POSITIONS6);
        reponseListLevel.addAll(positions);

        if (aiPrompts.getDefTheme().isWithCascade()) {
            reponseList.addAll(reponseListLevel);
        }

        return aiPrompts.getDefTheme().isWithCascade() ? reponseList : reponseListLevel;
    }

    private List<Position> executeWithRetry(String niveau, String terme, List<Position> rag, int maxTentatives) {
        List<Position> result = new ArrayList<>();
        int tentatives = 0;

        do {
            tentatives++;
            log.debug("{} - Tentative {}/{}", niveau, tentatives, maxTentatives);
            result = aiService.promptEtReponse(niveau, terme, rag);
        } while (tentatives < maxTentatives && result.isEmpty());

        return result;
    }

    private void enrichWithDescriptions(List<Position> positions, SearchLevel level) {
        if (!aiPrompts.getDefTheme().isWithDescription()) {
            return;
        }

        for (Position position : positions) {
            String code = position.getCode();
            String description = switch (level) {
                case SECTIONS -> sectionService.getDescription(code.trim());
                case CHAPITRES -> chapitreService.getDescription(code);
                case POSITIONS4 -> position4Service.getDescription(code);
                case POSITIONS6 -> position6DzService.getDescription(code);
            };
            position.setDescription(description);
        }
    }

    private List<Position> ragSections() {
        List<Section> sections = sectionService.getAllSections();
        return sections.stream()
                .map(s -> new Position(s.getCode(), s.getDescription()))
                .collect(Collectors.toList());
    }

    private List<Position> ragChapitres(List<Position> sectionsSelectionnees) {
        if (sectionsSelectionnees == null || sectionsSelectionnees.isEmpty()) {
            return chapitreService.getAllChapitres().stream()
                    .map(c -> new Position(c.getCode(), c.getDescription()))
                    .collect(Collectors.toList());
        }

        return sectionsSelectionnees.stream()
                .flatMap(p -> chapitreService.getChapitresBySection(p.getCode()).stream())
                .map(c -> new Position(c.getCode(), c.getDescription()))
                .collect(Collectors.toList());
    }

    private List<Position> ragPositions4(List<Position> chapitresSelectionnes) {
        return chapitresSelectionnes.stream()
                .flatMap(p -> {
                    String prefix = p.getCode() + "%";
                    return position4Service.getPosition4sByPrefix(prefix).stream();
                })
                .map(pos -> new Position(pos.getCode(), pos.getDescription()))
                .collect(Collectors.toList());
    }

    private List<Position> ragPositions6(List<Position> positions4Selectionnees) {
        return positions4Selectionnees.stream()
                .flatMap(p -> {
                    String prefix = p.getCode() + "%";
                    return position6DzService.getPosition6DzsByPrefix(prefix).stream();
                })
                .map(pos -> new Position(pos.getCode(), pos.getDescription()))
                .collect(Collectors.toList());
    }
}
