package com.tarif.search.service;

import com.tarif.search.model.Chapitre;
import com.tarif.search.model.Position;
import com.tarif.search.model.Section;
import com.tarif.search.service.ai.AiPrompts;
import com.tarif.search.service.ai.AiService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
public class SearchService {

    private final AiService aiService;
    private final AiPrompts aiPrompts;
    private final SectionService sectionService;
    private final ChapitreService chapitreService;
    private final Position4Service position4Service;
    private final Position6DzService position6DzService;
    private final Position10DzService position10DzService;
    private final boolean directChapterSearch;

    @Autowired
    public SearchService(
            AiService aiService,
            AiPrompts aiPrompts,
            SectionService sectionService,
            ChapitreService chapitreService,
            Position4Service position4Service,
            Position6DzService position6DzService,
            Position10DzService position10DzService,
            @Value("${ai.search.direct-chapter-search:true}") boolean directChapterSearch) {
        this.aiService = aiService;
        this.aiPrompts = aiPrompts;
        this.sectionService = sectionService;
        this.chapitreService = chapitreService;
        this.position4Service = position4Service;
        this.position6DzService = position6DzService;
        this.position10DzService = position10DzService;
        this.directChapterSearch = directChapterSearch;
        log.info("SearchService initialisé (directChapterSearch={})", directChapterSearch);
    }

    public SearchService(
            AiService aiService,
            AiPrompts aiPrompts,
            SectionService sectionService,
            ChapitreService chapitreService,
            Position4Service position4Service,
            Position6DzService position6DzService,
            Position10DzService position10DzService) {
        this(aiService, aiPrompts, sectionService, chapitreService, position4Service, position6DzService, position10DzService, false);
    }

    public enum SearchLevel {
        SECTIONS, CHAPITRES, POSITIONS4, POSITIONS6, POSITIONS10
    }

    @Cacheable(
        value = "aiSearchResults",
        key = "#maxLevel.name() + ':' + (#termeRecherche == null ? '' : #termeRecherche.trim().toLowerCase().replaceAll('\\s+', ' '))",
        unless = "#result == null || #result.isEmpty()"
    )
    public List<Position> search(String termeRecherche, SearchLevel maxLevel) {
        long startMs = System.currentTimeMillis();
        log.info("Recherche cascade pour '{}' (niveau max: {}, directChapter={})", termeRecherche, maxLevel, directChapterSearch);

        boolean withCascade = aiPrompts.getDefTheme().isWithCascade();
        List<Position> reponseList = new ArrayList<>();
        List<Position> reponseListLevel = new ArrayList<>();
        List<Position> positions = null;
        List<Position> ragNiveau;
        int tentativesMax = 2;

        boolean useSectionsStep = (maxLevel == SearchLevel.SECTIONS) || withCascade || !directChapterSearch;

        if (useSectionsStep) {
            // Level 0 : Sections — 3 tentatives car c'est le point d'entrée critique
            ragNiveau = ragSections();
            log.info("[DIAG] Level 0 (Sections) - RAG size: {}", ragNiveau.size());

            positions = executeWithRetry(SearchLevel.SECTIONS.toString(), termeRecherche, ragNiveau, 3, maxLevel == SearchLevel.SECTIONS);

            if (positions == null || positions.isEmpty()) {
                log.info("Level 0 - Aucun résultat après 3 tentatives, arrêt cascade");
                return finishSearch(startMs, maxLevel, new ArrayList<>());
            }

            enrichWithDescriptions(positions, ragNiveau, SearchLevel.SECTIONS);
            reponseListLevel.addAll(positions);

            if (withCascade) {
                reponseList.addAll(reponseListLevel);
            }

            if (maxLevel == SearchLevel.SECTIONS) {
                return finishSearch(startMs, maxLevel, withCascade ? reponseList : reponseListLevel);
            }

            ragNiveau = ragChapitres(positions);
        } else {
            // Entrée directe au Level 1 (Chapitres regroupés par section) : supprime l'appel IA Sections
            ragNiveau = ragAllChapitresGroupedBySection();
            log.info("[PERF] Entrée directe Level 1 (Chapitres) - RAG size: {}", ragNiveau.size());
        }

        // Level 1 : Chapitres
        reponseListLevel.clear();
        int chapTentatives = useSectionsStep ? tentativesMax : 3;
        log.info("[DIAG] Level 1 (Chapitres) - RAG size: {} - sections choisies: {}",
                ragNiveau.size(),
                positions != null ? positions.stream().map(p -> p.getCode() + ":" + p.getDescription()).toList() : "direct");

        positions = executeWithRetry(SearchLevel.CHAPITRES.toString(), termeRecherche, ragNiveau, chapTentatives, maxLevel == SearchLevel.CHAPITRES);

        if (positions == null || positions.isEmpty()) {
            log.info("Level 1 - Aucun résultat, arrêt cascade");
            return finishSearch(startMs, maxLevel, new ArrayList<>());
        }

        normalizeChapterCodes(positions);
        enrichWithDescriptions(positions, ragNiveau, SearchLevel.CHAPITRES);
        reponseListLevel.addAll(positions);

        if (withCascade) {
            reponseList.addAll(reponseListLevel);
        }

        if (maxLevel == SearchLevel.CHAPITRES) {
            return finishSearch(startMs, maxLevel, withCascade ? reponseList : reponseListLevel);
        }

        // Level 2 : Positions 4
        reponseListLevel.clear();
        ragNiveau = ragPositions4(positions);
        log.info("[DIAG] Level 2 (Positions4) - RAG size: {} - chapitres choisis: {}", ragNiveau.size(), positions.stream().map(p -> p.getCode()+":"+p.getDescription()).toList());

        positions = executeWithRetry(SearchLevel.POSITIONS4.toString(), termeRecherche, ragNiveau, tentativesMax, maxLevel == SearchLevel.POSITIONS4);

        if (positions == null || positions.isEmpty()) {
            log.info("Level 2 - Aucun résultat, arrêt cascade");
            return finishSearch(startMs, maxLevel, new ArrayList<>());
        }

        // Fix : si l'IA retourne un code chapitre (≤2 chiffres) au lieu de codes position4,
        // on l'expande en toutes les positions4 de ce chapitre
        positions = expandChapterCodesToPosition4(positions);

        enrichWithDescriptions(positions, ragNiveau, SearchLevel.POSITIONS4);
        List<Position> positionsLevel2 = new ArrayList<>(positions);
        reponseListLevel.addAll(positions);

        if (withCascade) {
            reponseList.addAll(reponseListLevel);
        }

        if (maxLevel == SearchLevel.POSITIONS4) {
            return finishSearch(startMs, maxLevel, withCascade ? reponseList : reponseListLevel);
        }

        // Level 3 : Positions 6
        reponseListLevel.clear();
        ragNiveau = ragPositions6(positions);
        log.info("[DIAG] Level 3 (Positions6) - RAG size: {} - pos4 choisies: {}", ragNiveau.size(), positions.stream().map(Position::getCode).toList());

        // Protection : si le RAG est trop volumineux (terme trop générique),
        // on retourne les résultats Level 2 plutôt que de risquer un timeout IA
        if (ragNiveau.size() > 80) {
            log.info("Level 3 - RAG trop volumineux ({} items), retour des résultats Level 2", ragNiveau.size());
            return finishSearch(startMs, maxLevel, withCascade ? reponseList : positionsLevel2);
        }

        List<Position> shortCircuitedPos6 = tryShortCircuitNonSubdividedPos6(ragNiveau, maxLevel);
        if (shortCircuitedPos6 != null) {
            positions = shortCircuitedPos6;
        } else {
            positions = executeWithRetry(SearchLevel.POSITIONS6.toString(), termeRecherche, ragNiveau, tentativesMax, maxLevel == SearchLevel.POSITIONS6);

            if (positions == null || positions.isEmpty()) {
                log.info("Level 3 - Aucun résultat, utilisation Level 2");
                positions = positionsLevel2;
            }
        }

        enrichWithDescriptions(positions, ragNiveau, SearchLevel.POSITIONS6);
        reponseListLevel.addAll(positions);
        List<Position> positionsLevel3 = new ArrayList<>(reponseListLevel);

        if (withCascade) {
            reponseList.addAll(reponseListLevel);
        }

        if (maxLevel == SearchLevel.POSITIONS6) {
            return finishSearch(startMs, maxLevel, withCascade ? reponseList : reponseListLevel);
        }

        // Level 4 : Positions 10
        reponseListLevel.clear();
        ragNiveau = ragPositions10(positions);
        log.debug("Level 4 (Positions10) - RAG size: {}", ragNiveau.size());

        if (!ragNiveau.isEmpty()) {
            positions = executeWithRetry(SearchLevel.POSITIONS10.toString(), termeRecherche, ragNiveau, tentativesMax, true);

            if (positions != null && !positions.isEmpty()) {
                enrichWithDescriptions(positions, ragNiveau, SearchLevel.POSITIONS10);
                reponseListLevel.addAll(positions);

                if (withCascade) {
                    reponseList.addAll(reponseListLevel);
                }
            }
        }

        if (reponseListLevel.isEmpty()) {
            log.info("Level 4 - Aucun résultat, utilisation Level 3");
            reponseListLevel.addAll(positionsLevel3);
        }

        return finishSearch(startMs, maxLevel, withCascade ? reponseList : reponseListLevel);
    }

    private List<Position> finishSearch(long startMs, SearchLevel maxLevel, List<Position> result) {
        long elapsedMs = System.currentTimeMillis() - startMs;
        List<Position> copy = result != null ? new ArrayList<>(result) : new ArrayList<>();
        log.info("[PERF] Recherche terminée (maxLevel={}) en {} ms -> {} résultat(s)", maxLevel, elapsedMs, copy.size());
        return copy;
    }

    private List<Position> tryShortCircuitNonSubdividedPos6(List<Position> ragNiveau, SearchLevel maxLevel) {
        if (maxLevel == SearchLevel.POSITIONS6 || ragNiveau == null || ragNiveau.isEmpty()) {
            return null;
        }
        List<Position> selectable = ragNiveau.stream()
                .filter(p -> p.getCode() != null && !p.getCode().isBlank())
                .toList();
        if (selectable.size() != 1) {
            return null;
        }
        Position onlyPos = selectable.get(0);
        String digits = onlyPos.getCode().replaceAll("[^0-9]", "");
        if (digits.length() == 6 && digits.endsWith("00")) {
            log.info("[PERF] Level 3 - Sous-position unique non subdivisée '{}', saut de l'appel IA POSITIONS6", onlyPos.getCode());
            return new ArrayList<>(List.of(new Position(onlyPos.getCode(), onlyPos.getDescription())));
        }
        return null;
    }

    private List<Position> executeWithRetry(String niveau, String terme, List<Position> rag, int maxTentatives, boolean withJustification) {
        int tentatives = 0;
        Exception lastException = null;

        while (tentatives < maxTentatives) {
            tentatives++;
            boolean allowFastModel = (tentatives == 1);
            log.info("[DIAG] {} - Tentative {}/{} (allowFastModel={})", niveau, tentatives, maxTentatives, allowFastModel);
            try {
                List<Position> result = aiService.promptEtReponse(niveau, terme, rag, withJustification, allowFastModel);
                if (result != null && !result.isEmpty()) {
                    return result;
                }
                log.info("[DIAG] {} - Réponse vide (tentative {})", niveau, tentatives);
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

    private void normalizeChapterCodes(List<Position> positions) {
        for (Position p : positions) {
            if (p.getCode() == null) {
                continue;
            }
            String code = p.getCode().trim().replaceAll("\\s+", "");
            if (code.length() == 1 && Character.isDigit(code.charAt(0))) {
                String padded = "0" + code;
                if (chapitreService.existsByCode(padded) || !chapitreService.existsByCode(code)) {
                    code = padded;
                }
            }
            p.setCode(code);
        }
    }

    private void enrichWithDescriptions(List<Position> positions, List<Position> ragNiveau, SearchLevel level) {
        if (!aiPrompts.getDefTheme().isWithDescription()) {
            return;
        }

        Map<String, String> ragDescMap = new HashMap<>();
        if (ragNiveau != null) {
            for (Position ragItem : ragNiveau) {
                if (ragItem.getCode() != null && !ragItem.getCode().isBlank() && ragItem.getDescription() != null) {
                    String trimmed = ragItem.getCode().trim();
                    ragDescMap.putIfAbsent(trimmed, ragItem.getDescription());
                    ragDescMap.putIfAbsent(trimmed.replaceAll("\\s+", ""), ragItem.getDescription());
                }
            }
        }

        for (Position position : positions) {
            String code = position.getCode();
            if (code == null) {
                continue;
            }
            String trimmed = code.trim();
            String description = ragDescMap.get(trimmed);
            if (description == null) {
                description = ragDescMap.get(trimmed.replaceAll("\\s+", ""));
            }
            if (description == null) {
                description = switch (level) {
                    case SECTIONS -> sectionService.getDescription(trimmed);
                    case CHAPITRES -> chapitreService.getDescription(trimmed);
                    case POSITIONS4 -> position4Service.getDescription(trimmed);
                    case POSITIONS6 -> position6DzService.getDescription(trimmed);
                    case POSITIONS10 -> position10DzService.getDescription(trimmed);
                };
            }
            position.setDescription(description);
        }
    }

    /**
     * Si l'IA retourne un code chapitre (≤2 chiffres) au Level 2 au lieu de codes position4,
     * on l'expande en toutes les positions4 réelles de ce chapitre.
     * Cela arrive quand le terme de recherche est trop générique (ex: "matières plastiques").
     */
    private List<Position> expandChapterCodesToPosition4(List<Position> positions) {
        List<Position> expanded = new ArrayList<>();
        boolean hadExpansion = false;

        for (Position p : positions) {
            String code = p.getCode() != null ? p.getCode().trim().replaceAll("\\s", "") : "";
            if (code.length() <= 2 && !code.isEmpty()) {
                // C'est un code chapitre, pas un code position4 → expandre
                List<Position> pos4List = position4Service.getPosition4sByPrefix(code + "%").stream()
                        .map(pos -> new Position(pos.getCode(), pos.getDescription()))
                        .toList();
                if (!pos4List.isEmpty()) {
                    log.info("[DIAG] Level 2 - Code chapitre '{}' expandé en {} positions4", code, pos4List.size());
                    expanded.addAll(pos4List);
                    hadExpansion = true;
                } else {
                    expanded.add(p); // garder tel quel si aucune expansion trouvée
                }
            } else {
                expanded.add(p);
            }
        }

        return hadExpansion ? expanded : positions;
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

    private List<Position> ragAllChapitresGroupedBySection() {
        List<Section> sections = sectionService.getAllSections();
        List<Chapitre> allChapitres = chapitreService.getAllChapitres();
        List<Position> rag = new ArrayList<>();
        Set<String> addedChapterCodes = new HashSet<>();

        if (sections != null && !sections.isEmpty()) {
            for (Section sec : sections) {
                List<Chapitre> secChapitres = chapitreService.getChapitresBySection(sec.getCode());
                if (secChapitres != null && !secChapitres.isEmpty()) {
                    rag.add(new Position(null, "Section " + sec.getCode() + " - " + sec.getDescription()));
                    for (Chapitre c : secChapitres) {
                        rag.add(new Position(c.getCode(), c.getDescription()));
                        if (c.getCode() != null) {
                            addedChapterCodes.add(c.getCode().trim());
                        }
                    }
                }
            }
        }

        if (allChapitres != null && !allChapitres.isEmpty()) {
            String lastSection = null;
            for (Chapitre c : allChapitres) {
                String code = c.getCode() != null ? c.getCode().trim() : "";
                if (!addedChapterCodes.contains(code)) {
                    String sec = c.getSection() != null ? c.getSection().trim() : "";
                    if (!sec.isEmpty() && !sec.equals(lastSection)) {
                        String secDesc = sectionService.getDescription(sec);
                        String header = secDesc != null
                                ? "Section " + sec + " - " + secDesc
                                : "Section " + sec;
                        rag.add(new Position(null, header));
                        lastSection = sec;
                    }
                    rag.add(new Position(c.getCode(), c.getDescription()));
                    addedChapterCodes.add(code);
                }
            }
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
        Set<String> injectedSections = new HashSet<>();

        for (Position chapitre : chapitresSelectionnes) {
            String chapCode = chapitre.getCode();
            Chapitre chapEntity = chapitreService.getChapitreByCode(chapCode).orElse(null);
            String secCode = chapEntity != null && chapEntity.getSection() != null
                    ? chapEntity.getSection().trim()
                    : null;

            String chapNote = (chapEntity != null && chapEntity.getNote() != null && !chapEntity.getNote().isBlank())
                    ? chapEntity.getNote()
                    : chapitreService.getNote(chapCode);
            String secNote = secCode != null ? sectionService.getNote(secCode) : null;

            String extractedSecNote = null;
            String extractedChapNote = chapNote;
            String headerSecKey = null;

            if (chapNote != null && chapNote.contains("[Note de la Section")) {
                headerSecKey = extractSectionCodeFromNoteHeader(chapNote);
                int chapIdx = chapNote.indexOf("[Note du Chapitre");
                if (chapIdx > 0) {
                    extractedSecNote = stripLeadingBracketHeader(chapNote.substring(0, chapIdx));
                    extractedChapNote = stripLeadingBracketHeader(chapNote.substring(chapIdx));
                } else {
                    extractedSecNote = stripLeadingBracketHeader(chapNote);
                    extractedChapNote = null;
                }
            }

            String normSecKey = normalizeSectionKey(secCode != null ? secCode : headerSecKey);
            String sectionNoteToInject = (secNote != null && !secNote.isBlank()) ? secNote.trim() : extractedSecNote;
            if (sectionNoteToInject != null && !sectionNoteToInject.isBlank()) {
                String dedupKey = normSecKey != null ? normSecKey : sectionNoteToInject;
                if (injectedSections.add(dedupKey)) {
                    String labelSec = normSecKey != null ? normSecKey : "?";
                    rag.add(new Position(null, "[Note de la Section " + labelSec + "] " + sectionNoteToInject));
                    log.debug("Level 2 - Note section {} injectée ({} chars)", labelSec, sectionNoteToInject.length());
                }
            }

            if (extractedChapNote != null && !extractedChapNote.isBlank()) {
                String contexte = "[Note du chapitre " + chapCode + "] " + extractedChapNote;
                rag.add(new Position(null, contexte));
                log.debug("Level 2 - Note du chapitre {} injectée ({} chars)", chapCode, extractedChapNote.length());
            }

            // Ajouter les positions 4 chiffres du chapitre
            position4Service.getPosition4sByPrefix(chapCode + "%").stream()
                    .map(pos -> new Position(pos.getCode(), pos.getDescription()))
                    .forEach(rag::add);
        }

        return rag;
    }

    private static String normalizeSectionKey(String secCode) {
        if (secCode == null || secCode.isBlank()) {
            return null;
        }
        String trimmed = secCode.trim();
        if (trimmed.length() == 1 && Character.isDigit(trimmed.charAt(0))) {
            return "0" + trimmed;
        }
        return trimmed;
    }

    private static String extractSectionCodeFromNoteHeader(String note) {
        int start = note.indexOf("[Note de la Section");
        if (start < 0) return null;
        int end = note.indexOf(']', start);
        if (end < 0) return null;
        return normalizeSectionKey(note.substring(start + "[Note de la Section".length(), end));
    }

    private static String stripLeadingBracketHeader(String text) {
        if (text == null) return null;
        String trimmed = text.trim();
        if (trimmed.startsWith("[")) {
            int closeIdx = trimmed.indexOf(']');
            if (closeIdx >= 0) {
                return trimmed.substring(closeIdx + 1).trim();
            }
        }
        return trimmed;
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
