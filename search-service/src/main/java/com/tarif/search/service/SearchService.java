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
    private final Position10DzService position10DzService;

    public enum SearchLevel {
        SECTIONS, CHAPITRES, POSITIONS4, POSITIONS6, POSITIONS10
    }

    public List<Position> search(String termeRecherche, SearchLevel maxLevel) {
        log.info("Recherche cascade pour '{}' (niveau max: {})", termeRecherche, maxLevel);

        List<Position> reponseList = new ArrayList<>();
        List<Position> reponseListLevel = new ArrayList<>();
        List<Position> positions;
        List<Position> ragNiveau;
        int tentativesMax = 2;

        // Level 0 : Sections — 3 tentatives car c'est le point d'entrée critique
        ragNiveau = ragSections();
        log.debug("Level 0 (Sections) - RAG size: {}", ragNiveau.size());

        positions = executeWithRetry(SearchLevel.SECTIONS.toString(), termeRecherche, ragNiveau, 3, maxLevel == SearchLevel.SECTIONS);

        if (positions == null || positions.isEmpty()) {
            log.info("Level 0 - Aucun résultat après 3 tentatives, arrêt cascade");
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

        positions = executeWithRetry(SearchLevel.CHAPITRES.toString(), termeRecherche, ragNiveau, tentativesMax, maxLevel == SearchLevel.CHAPITRES);

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

        positions = executeWithRetry(SearchLevel.POSITIONS4.toString(), termeRecherche, ragNiveau, tentativesMax, maxLevel == SearchLevel.POSITIONS4);
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

        positions = executeWithRetry(SearchLevel.POSITIONS6.toString(), termeRecherche, ragNiveau, tentativesMax, maxLevel == SearchLevel.POSITIONS6);

        if (positions == null || positions.isEmpty()) {
            log.info("Level 3 - Aucun résultat, utilisation Level 2");
            positions = positionsLevel2;
        }

        enrichWithDescriptions(positions, SearchLevel.POSITIONS6);
        reponseListLevel.addAll(positions);
        List<Position> positionsLevel3 = new ArrayList<>(reponseListLevel);

        if (aiPrompts.getDefTheme().isWithCascade()) {
            reponseList.addAll(reponseListLevel);
        }

        if (maxLevel == SearchLevel.POSITIONS6) {
            return aiPrompts.getDefTheme().isWithCascade() ? reponseList : reponseListLevel;
        }

        // Level 4 : Positions 10
        reponseListLevel.clear();
        ragNiveau = ragPositions10(positions);
        log.debug("Level 4 (Positions10) - RAG size: {}", ragNiveau.size());

        if (!ragNiveau.isEmpty()) {
            positions = executeWithRetry(SearchLevel.POSITIONS10.toString(), termeRecherche, ragNiveau, tentativesMax, true);

            if (positions != null && !positions.isEmpty()) {
                enrichWithDescriptions(positions, SearchLevel.POSITIONS10);
                reponseListLevel.addAll(positions);

                if (aiPrompts.getDefTheme().isWithCascade()) {
                    reponseList.addAll(reponseListLevel);
                }
            }
        }

        if (reponseListLevel.isEmpty()) {
            log.info("Level 4 - Aucun résultat, utilisation Level 3");
            reponseListLevel.addAll(positionsLevel3);
        }

        return aiPrompts.getDefTheme().isWithCascade() ? reponseList : reponseListLevel;
    }

    private List<Position> executeWithRetry(String niveau, String terme, List<Position> rag, int maxTentatives, boolean withJustification) {
        int tentatives = 0;
        Exception lastException = null;

        while (tentatives < maxTentatives) {
            tentatives++;
            log.debug("{} - Tentative {}/{}", niveau, tentatives, maxTentatives);
            try {
                List<Position> result = aiService.promptEtReponse(niveau, terme, rag, withJustification);
                if (!result.isEmpty()) {
                    return result;
                }
                log.debug("{} - Réponse vide (tentative {})", niveau, tentatives);
            } catch (Exception e) {
                lastException = e;
                log.warn("{} - Erreur technique tentative {}/{}: {}", niveau, tentatives, maxTentatives, e.getMessage());
            }
        }

        if (lastException != null) {
            log.error("{} - Toutes les tentatives ont échoué (erreur technique)", niveau);
        }
        return new ArrayList<>();
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
                case POSITIONS10 -> position10DzService.getDescription(code);
            };
            position.setDescription(description);
        }
    }

    private List<Position> ragSections() {
        List<Section> sections = sectionService.getAllSections();
        List<Position> rag = new ArrayList<>();

        for (Section section : sections) {
            // Injecter la note de section comme contexte légal
            // (code null = ligne de contexte, non sélectionnable par l'IA)
            String note = sectionService.getNote(section.getCode());
            if (note != null && !note.isBlank()) {
                rag.add(new Position(null, "[Note de la Section " + section.getCode() + "] " + note));
                log.debug("Level 0 - Note section {} injectée ({} chars)", section.getCode(), note.length());
            }
            rag.add(new Position(section.getCode(), section.getDescription()));
        }

        return rag;
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
        List<Position> rag = new ArrayList<>();

        for (Position chapitre : chapitresSelectionnes) {
            // Injecter la note explicative du chapitre comme contexte légal
            // (code null = ligne de contexte, non sélectionnable par l'IA)
            String note = chapitreService.getNote(chapitre.getCode());
            if (note != null && !note.isBlank()) {
                String contexte = "[Note du chapitre " + chapitre.getCode() + "] " + note;
                rag.add(new Position(null, contexte));
                log.debug("Level 2 - Note du chapitre {} injectée ({} chars)", chapitre.getCode(), note.length());
            }

            // Ajouter les positions 4 chiffres du chapitre
            position4Service.getPosition4sByPrefix(chapitre.getCode() + "%").stream()
                    .map(pos -> new Position(pos.getCode(), pos.getDescription()))
                    .forEach(rag::add);
        }

        return rag;
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

    private List<Position> ragPositions10(List<Position> positions6Selectionnees) {
        return positions6Selectionnees.stream()
                .flatMap(p -> {
                    String prefix = p.getCode() + "%";
                    return position10DzService.getPosition10DzsWithContextByPrefix(prefix).stream();
                })
                .map(pos -> new Position(pos.getCode(), pos.getDescription()))
                .collect(Collectors.toList());
    }
}
