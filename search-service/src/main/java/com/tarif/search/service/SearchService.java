package com.tarif.search.service;

import com.tarif.search.model.Chapitre;
import com.tarif.search.model.Position;
import com.tarif.search.model.Section;
import com.tarif.search.service.ai.AiPrompts;
import com.tarif.search.service.ai.AiService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
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
    private final TariffPositionService tariffPositionService;

    @Autowired
    public SearchService(
            AiService aiService,
            AiPrompts aiPrompts,
            SectionService sectionService,
            ChapitreService chapitreService,
            Position4Service position4Service,
            Position6DzService position6DzService,
            Position10DzService position10DzService,
            TariffPositionService tariffPositionService) {
        this.aiService = aiService;
        this.aiPrompts = aiPrompts;
        this.sectionService = sectionService;
        this.chapitreService = chapitreService;
        this.position4Service = position4Service;
        this.position6DzService = position6DzService;
        this.position10DzService = position10DzService;
        this.tariffPositionService = tariffPositionService;
    }

    public SearchService(
            AiService aiService,
            AiPrompts aiPrompts,
            SectionService sectionService,
            ChapitreService chapitreService,
            Position4Service position4Service,
            Position6DzService position6DzService,
            Position10DzService position10DzService) {
        this(aiService, aiPrompts, sectionService, chapitreService,
                position4Service, position6DzService, position10DzService, null);
    }

    public enum SearchLevel {
        SECTIONS, CHAPITRES, POSITIONS4, POSITIONS6, POSITIONS10
    }

    public List<Position> search(String termeRecherche, SearchLevel maxLevel) {
        return search(termeRecherche, maxLevel, "DZ");
    }

    public List<Position> search(String termeRecherche, SearchLevel maxLevel, String zone) {
        String normZone = (zone == null || zone.isBlank()) ? "DZ" : zone.trim().toUpperCase(Locale.ROOT);
        log.info("Recherche cascade pour '{}' (niveau max: {}, zone: {})", termeRecherche, maxLevel, normZone);

        List<Position> reponseList = new ArrayList<>();
        List<Position> reponseListLevel = new ArrayList<>();
        List<Position> positions;
        List<Position> ragNiveau;
        int tentativesMax = 2;

        // Level 0 : Sections — 3 tentatives car c'est le point d'entrée critique
        ragNiveau = ragSections();
        log.info("[DIAG] Level 0 (Sections) - RAG size: {}", ragNiveau.size());

        positions = executeWithRetry(SearchLevel.SECTIONS.toString(), termeRecherche, ragNiveau, 3, maxLevel == SearchLevel.SECTIONS, normZone);

        if (positions == null || positions.isEmpty()) {
            log.info("Level 0 - Aucun résultat après 3 tentatives, arrêt cascade");
            return new ArrayList<>();
        }

        enrichWithDescriptions(positions, SearchLevel.SECTIONS, normZone);
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
        log.info("[DIAG] Level 1 (Chapitres) - RAG size: {} - sections choisies: {}", ragNiveau.size(), positions.stream().map(p -> p.getCode()+":"+p.getDescription()).toList());

        positions = executeWithRetry(SearchLevel.CHAPITRES.toString(), termeRecherche, ragNiveau, tentativesMax, maxLevel == SearchLevel.CHAPITRES, normZone);

        if (positions == null || positions.isEmpty()) {
            log.info("Level 1 - Aucun résultat, arrêt cascade");
            return new ArrayList<>();
        }

        enrichWithDescriptions(positions, SearchLevel.CHAPITRES, normZone);
        reponseListLevel.addAll(positions);

        if (aiPrompts.getDefTheme().isWithCascade()) {
            reponseList.addAll(reponseListLevel);
        }

        if (maxLevel == SearchLevel.CHAPITRES) {
            return aiPrompts.getDefTheme().isWithCascade() ? reponseList : reponseListLevel;
        }

        // Level 2 : Positions 4
        reponseListLevel.clear();
        ragNiveau = ragPositions4(positions, normZone);
        log.info("[DIAG] Level 2 (Positions4) - RAG size: {} - chapitres choisis: {}", ragNiveau.size(), positions.stream().map(p -> p.getCode()+":"+p.getDescription()).toList());

        positions = executeWithRetry(SearchLevel.POSITIONS4.toString(), termeRecherche, ragNiveau, tentativesMax, maxLevel == SearchLevel.POSITIONS4, normZone);

        if (positions == null || positions.isEmpty()) {
            log.info("Level 2 - Aucun résultat, arrêt cascade");
            return new ArrayList<>();
        }

        // Fix : si l'IA retourne un code chapitre (≤2 chiffres) au lieu de codes position4,
        // on l'expande en toutes les positions4 de ce chapitre
        positions = expandChapterCodesToPosition4(positions, normZone);

        enrichWithDescriptions(positions, SearchLevel.POSITIONS4, normZone);
        List<Position> positionsLevel2 = new ArrayList<>(positions);
        reponseListLevel.addAll(positions);

        if (aiPrompts.getDefTheme().isWithCascade()) {
            reponseList.addAll(reponseListLevel);
        }

        if (maxLevel == SearchLevel.POSITIONS4) {
            return aiPrompts.getDefTheme().isWithCascade() ? reponseList : reponseListLevel;
        }

        // Correspondance directe avec l'intitulé d'une Position à 4 chiffres (indépendant du modèle IA) :
        // Ex: "Chocolat et autres préparations alimentaires contenant du cacao" -> Position 1806 entière
        String normQuery = normalizeForExactMatch(termeRecherche);
        if (!normQuery.isEmpty()) {
            List<Position> exactP4 = positionsLevel2.stream()
                    .filter(p -> p.getDescription() != null && normalizeForExactMatch(p.getDescription()).equals(normQuery))
                    .map(p -> new Position(
                            p.getCode(),
                            p.getDescription(),
                            "Correspond à l'intitulé de la position " + p.getCode() + " : " + p.getDescription()))
                    .toList();
            if (!exactP4.isEmpty()) {
                log.info("[DIAG] Correspondance directe avec l'intitulé Position4 : {}", exactP4.stream().map(Position::getCode).toList());
                if (maxLevel == SearchLevel.POSITIONS6) {
                    List<Position> expanded6 = new ArrayList<>(expandPosition4CodesToPosition6(exactP4, normZone));
                    enrichWithDescriptions(expanded6, SearchLevel.POSITIONS6, normZone);
                    if (aiPrompts.getDefTheme().isWithCascade()) {
                        reponseList.addAll(expanded6);
                        return reponseList;
                    }
                    return expanded6;
                }
                if (aiPrompts.getDefTheme().isWithCascade()) {
                    reponseList.addAll(exactP4);
                    return reponseList;
                }
                return new ArrayList<>(exactP4);
            }
        }

        // Level 3 : Positions 6
        reponseListLevel.clear();
        ragNiveau = ragPositions6(positions, normZone);
        log.info("[DIAG] Level 3 (Positions6) - RAG size: {} - pos4 choisies: {}", ragNiveau.size(), positions.stream().map(p -> p.getCode()).toList());

        // Protection : si le RAG est trop volumineux (terme trop générique),
        // on retourne les résultats Level 2 plutôt que de risquer un timeout IA
        if (ragNiveau.size() > 80) {
            log.info("Level 3 - RAG trop volumineux ({} items), retour des résultats Level 2", ragNiveau.size());
            return aiPrompts.getDefTheme().isWithCascade() ? reponseList : reponseListLevel.isEmpty() ? new ArrayList<>(positionsLevel2) : reponseListLevel;
        }

        positions = executeWithRetry(SearchLevel.POSITIONS6.toString(), termeRecherche, ragNiveau, tentativesMax, maxLevel == SearchLevel.POSITIONS6, normZone);

        if (positions == null || positions.isEmpty()) {
            log.info("Level 3 - Aucun résultat, utilisation Level 2");
            positions = positionsLevel2;
        }

        positions = expandPosition4CodesToPosition6(positions, normZone);

        enrichWithDescriptions(positions, SearchLevel.POSITIONS6, normZone);
        reponseListLevel.addAll(positions);
        List<Position> positionsLevel3 = new ArrayList<>(reponseListLevel);

        if (aiPrompts.getDefTheme().isWithCascade()) {
            reponseList.addAll(reponseListLevel);
        }

        if (maxLevel == SearchLevel.POSITIONS6) {
            return aiPrompts.getDefTheme().isWithCascade() ? reponseList : reponseListLevel;
        }

        // Level 4 : Positions nationales (P10 DZ / NC8 EU)
        reponseListLevel.clear();

        // Si le terme correspond exactement à l'intitulé d'une sous-position SH6 comportant plusieurs feuilles
        // (sans correspondre à une feuille spécifique), on conserve directement le code SH6 pour restituer toute sa branche.
        int targetLeafLen = "EU".equals(normZone) ? 8 : 10;
        List<Position> directP6Matches = new ArrayList<>();
        List<Position> p6ForLevel4 = new ArrayList<>();
        for (Position p6 : positions) {
            List<Position> leafRows = getLeafRowsForHs6(normZone, p6.getCode());
            long leafCount = leafRows.stream()
                    .filter(r -> r.getCode() != null && r.getCode().replaceAll("[^0-9]", "").length() == targetLeafLen)
                    .count();
            boolean exactP6Desc = !normQuery.isEmpty()
                    && p6.getDescription() != null
                    && normalizeForExactMatch(p6.getDescription()).equals(normQuery);
            boolean exactChildLeafDesc = !normQuery.isEmpty() && leafRows.stream()
                    .filter(r -> r.getCode() != null
                            && r.getCode().replaceAll("[^0-9]", "").length() == targetLeafLen
                            && r.getDescription() != null)
                    .anyMatch(r -> normalizeForExactMatch(r.getDescription()).equals(normQuery));

            if (exactP6Desc && leafCount > 1 && !exactChildLeafDesc) {
                log.info("[DIAG] Correspondance directe avec l'intitulé Position6 '{}' ({} sous-positions {})", p6.getCode(), leafCount, normZone);
                directP6Matches.add(new Position(
                        p6.getCode(),
                        p6.getDescription(),
                        "Correspond à la sous-position SH " + p6.getCode() + " : " + p6.getDescription()));
            } else {
                p6ForLevel4.add(p6);
            }
        }

        reponseListLevel.addAll(directP6Matches);
        ragNiveau = ragPositions10(p6ForLevel4, normZone);
        log.debug("Level 4 (Positions nationales {}) - RAG size: {}", normZone, ragNiveau.size());

        if (!ragNiveau.isEmpty()) {
            positions = executeWithRetry(SearchLevel.POSITIONS10.toString(), termeRecherche, ragNiveau, tentativesMax, true, normZone);

            if (positions != null && !positions.isEmpty()) {
                enrichWithDescriptions(positions, SearchLevel.POSITIONS10, normZone);
                reponseListLevel.addAll(positions);
            }
        }

        if (!reponseListLevel.isEmpty() && aiPrompts.getDefTheme().isWithCascade()) {
            reponseList.addAll(reponseListLevel);
        }

        if (reponseListLevel.isEmpty()) {
            log.info("Level 4 - Aucun résultat, utilisation Level 3");
            reponseListLevel.addAll(positionsLevel3);
        }

        return aiPrompts.getDefTheme().isWithCascade() ? reponseList : reponseListLevel;
    }

    private List<Position> executeWithRetry(String niveau, String terme, List<Position> rag, int maxTentatives, boolean withJustification, String zone) {
        int tentatives = 0;
        Exception lastException = null;

        while (tentatives < maxTentatives) {
            tentatives++;
            log.info("[DIAG] {} - Tentative {}/{}", niveau, tentatives, maxTentatives);
            try {
                List<Position> rawResult = aiService.promptEtReponse(niveau, terme, rag, withJustification);
                List<Position> result = sanitizePositions(rawResult, niveau, zone);
                if (!result.isEmpty()) {
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

    private List<Position> sanitizePositions(List<Position> raw, String niveau, String zone) {
        if (raw == null || raw.isEmpty()) return new ArrayList<>();
        List<Position> cleaned = new ArrayList<>();
        Set<String> seenCodes = new LinkedHashSet<>();
        boolean padTwoDigits = "SECTIONS".equals(niveau) || "CHAPITRES".equals(niveau);
        boolean isEu = "EU".equals(zone);

        for (Position p : raw) {
            if (p == null || p.getCode() == null) continue;
            String digits = p.getCode().replaceAll("[^0-9]", "");
            if (digits.isEmpty()) {
                String trimmed = p.getCode().trim();
                if ("SECTIONS".equals(niveau) && !trimmed.isEmpty() && seenCodes.add(trimmed)) {
                    cleaned.add(new Position(trimmed, p.getDescription(), p.getJustification()));
                }
                continue;
            }
            if (padTwoDigits && digits.length() == 1) {
                digits = "0" + digits;
            } else if ("POSITIONS6".equals(niveau) && digits.length() > 6) {
                digits = digits.substring(0, 6);
            } else if ("POSITIONS10".equals(niveau)) {
                if (isEu) {
                    if (digits.length() > 6 && digits.length() != 8) {
                        digits = digits.substring(0, 6);
                    }
                } else {
                    if (digits.length() == 8) {
                        boolean hasP10 = (tariffPositionService != null
                                && tariffPositionService.getDescription("DZ", digits + "00") != null)
                                || position10DzService.existsByCode(digits + "00");
                        digits = hasP10 ? digits + "00" : digits.substring(0, 6);
                    } else if (digits.length() > 6 && digits.length() != 10) {
                        digits = digits.substring(0, 6);
                    }
                }
            }
            if (seenCodes.add(digits)) {
                cleaned.add(new Position(digits, p.getDescription(), p.getJustification()));
            }
        }
        return cleaned;
    }

    private String normalizeForExactMatch(String text) {
        if (text == null) return "";
        return Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("\\(\\d+\\)", " ")
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    private void enrichWithDescriptions(List<Position> positions, SearchLevel level, String zone) {
        if (!aiPrompts.getDefTheme().isWithDescription()) {
            return;
        }

        for (Position position : positions) {
            String code = position.getCode();
            if (code == null) continue;
            String description = switch (level) {
                case SECTIONS -> sectionService.getDescription(code.trim());
                case CHAPITRES -> chapitreService.getDescription(code);
                case POSITIONS4 -> {
                    String desc = position4Service.getDescription(code);
                    yield ((desc == null || desc.isBlank()) && tariffPositionService != null)
                            ? tariffPositionService.getDescription(zone, code)
                            : desc;
                }
                case POSITIONS6 -> {
                    String desc = position6DzService.getDescription(code);
                    yield ((desc == null || desc.isBlank()) && tariffPositionService != null)
                            ? tariffPositionService.getHs6Description(zone, code)
                            : desc;
                }
                case POSITIONS10 -> {
                    String cleanCode = code.replaceAll("[^0-9]", "");
                    if (!cleanCode.isEmpty()) {
                        position.setCode(cleanCode);
                    }
                    String lookup = cleanCode.isEmpty() ? code : cleanCode;
                    if (lookup.length() == 4) {
                        String desc = position4Service.getDescription(lookup);
                        yield ((desc == null || desc.isBlank()) && tariffPositionService != null)
                                ? tariffPositionService.getDescription(zone, lookup)
                                : desc;
                    } else if (lookup.length() == 6) {
                        String desc = position6DzService.getDescription(lookup);
                        yield ((desc == null || desc.isBlank()) && tariffPositionService != null)
                                ? tariffPositionService.getHs6Description(zone, lookup)
                                : desc;
                    } else {
                        String desc = tariffPositionService != null
                                ? tariffPositionService.getDescription(zone, lookup)
                                : null;
                        yield (desc == null && "DZ".equals(zone))
                                ? position10DzService.getDescription(lookup)
                                : desc;
                    }
                }
            };
            position.setDescription(description);
        }
    }

    /**
     * Si l'IA retourne un code chapitre (≤2 chiffres) au Level 2 au lieu de codes position4,
     * on l'expande en toutes les positions4 réelles de ce chapitre.
     * Cela arrive quand le terme de recherche est trop générique (ex: "matières plastiques").
     */
    private List<Position> expandChapterCodesToPosition4(List<Position> positions, String zone) {
        List<Position> expanded = new ArrayList<>();
        boolean hadExpansion = false;

        for (Position p : positions) {
            String code = p.getCode() != null ? p.getCode().trim().replaceAll("\\s", "") : "";
            if (code.length() <= 2 && !code.isEmpty()) {
                // C'est un code chapitre, pas un code position4 → expandre
                Map<String, Position> mergedPos4 = new LinkedHashMap<>();
                position4Service.getPosition4sByPrefix(code + "%").forEach(pos ->
                        mergedPos4.putIfAbsent(pos.getCode(), new Position(pos.getCode(), pos.getDescription())));
                if (tariffPositionService != null) {
                    tariffPositionService.getPos4HeadingsForChapter(zone, code)
                            .forEach(pos -> mergedPos4.putIfAbsent(pos.getCode(), pos));
                }
                List<Position> pos4List = new ArrayList<>(mergedPos4.values());
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

    /**
     * Si l'IA (ou le fallback Level 2) retourne un code à 4 chiffres au Level 3,
     * on le remplace par la ou les positions à 6 chiffres correspondantes (ex: 1206 -> 120600).
     */
    private List<Position> expandPosition4CodesToPosition6(List<Position> positions, String zone) {
        List<Position> expanded = new ArrayList<>();
        boolean hadExpansion = false;

        for (Position p : positions) {
            String code = p.getCode() != null ? p.getCode().trim().replaceAll("\\s", "") : "";
            if (code.length() == 4) {
                Map<String, Position> merged = new LinkedHashMap<>();
                position6DzService.getPosition6DzsByPrefix(code + "%").stream()
                        .filter(pos -> pos.getCode() != null && pos.getCode().replaceAll("\\s", "").length() == 6)
                        .forEach(pos -> {
                            String clean = pos.getCode().replaceAll("\\s", "");
                            merged.putIfAbsent(clean, new Position(clean, pos.getDescription(), p.getJustification()));
                        });
                if (tariffPositionService != null) {
                    tariffPositionService.getDistinctHs6ForPos4(zone, code)
                            .forEach(pos -> {
                                String clean = pos.getCode() != null ? pos.getCode().replaceAll("\\s", "") : "";
                                if (clean.length() == 6) {
                                    merged.putIfAbsent(clean, new Position(clean, pos.getDescription(), p.getJustification()));
                                }
                            });
                }
                if (!merged.isEmpty()) {
                    log.info("[DIAG] Level 3 - Code position4 '{}' expandé en {} positions6", code, merged.size());
                    expanded.addAll(merged.values());
                    hadExpansion = true;
                } else {
                    expanded.add(new Position(code + "00", p.getDescription(), p.getJustification()));
                    hadExpansion = true;
                }
            } else {
                expanded.add(p);
            }
        }

        return hadExpansion ? expanded : positions;
    }

    private List<Position> getLeafRowsForHs6(String zone, String hs6Code) {
        if (hs6Code == null || hs6Code.isBlank()) {
            return List.of();
        }
        if (tariffPositionService != null) {
            List<Position> fromUnified = tariffPositionService.getContextPositionsForHs6(zone, hs6Code);
            if (!fromUnified.isEmpty() || !"DZ".equals(zone)) {
                return fromUnified;
            }
        }
        String prefix = hs6Code + "%";
        return position10DzService.getPosition10DzsWithContextByPrefix(prefix).stream()
                .map(pos -> new Position(pos.getCode(), pos.getDescription()))
                .toList();
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

    private List<Position> ragPositions4(List<Position> chapitresSelectionnes, String zone) {
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

            // Ajouter les positions 4 chiffres du chapitre (position4 + éventuels headings HS-2022 dans tariff_position)
            Map<String, Position> mergedPos4 = new LinkedHashMap<>();
            position4Service.getPosition4sByPrefix(chapitre.getCode() + "%").forEach(pos ->
                    mergedPos4.putIfAbsent(pos.getCode(), new Position(pos.getCode(), pos.getDescription())));
            if (tariffPositionService != null) {
                tariffPositionService.getPos4HeadingsForChapter(zone, chapitre.getCode())
                        .forEach(pos -> mergedPos4.putIfAbsent(pos.getCode(), pos));
            }
            rag.addAll(mergedPos4.values());
        }

        return rag;
    }

    private List<Position> ragPositions6(List<Position> positions4Selectionnees, String zone) {
        List<Position> rag = new ArrayList<>();
        Set<String> seenHs6 = new HashSet<>();
        for (Position p : positions4Selectionnees) {
            if (p.getDescription() != null && !p.getDescription().isBlank()) {
                rag.add(new Position(null, "Position " + p.getCode() + " - " + p.getDescription()));
            }
            Map<String, Position> hs6ForPos4 = new LinkedHashMap<>();
            String prefix = p.getCode() + "%";
            position6DzService.getPosition6DzsByPrefix(prefix).stream()
                    .filter(pos -> pos.getCode() != null && pos.getCode().replaceAll("\\s", "").length() == 6)
                    .forEach(pos -> {
                        String clean = pos.getCode().replaceAll("\\s", "");
                        if (seenHs6.add(clean)) {
                            hs6ForPos4.putIfAbsent(clean, new Position(clean, pos.getDescription()));
                        }
                    });
            if (tariffPositionService != null) {
                tariffPositionService.getDistinctHs6ForPos4(zone, p.getCode())
                        .forEach(pos -> {
                            String clean = pos.getCode() != null ? pos.getCode().replaceAll("\\s", "") : "";
                            if (clean.length() == 6 && seenHs6.add(clean)) {
                                hs6ForPos4.putIfAbsent(clean, new Position(clean, pos.getDescription()));
                            }
                        });
            }
            rag.addAll(hs6ForPos4.values());
        }
        return rag;
    }

    private List<Position> ragPositions10(List<Position> positions6Selectionnees, String zone) {
        List<Position> rag = new ArrayList<>();
        Set<String> emittedPos4 = new HashSet<>();
        for (Position p : positions6Selectionnees) {
            String code6 = p.getCode();
            if (code6 == null || code6.length() < 4) continue;
            List<Position> leafRows = getLeafRowsForHs6(zone, code6);
            if (!leafRows.isEmpty()) {
                String pos4Code = code6.substring(0, 4);
                if (emittedPos4.add(pos4Code)) {
                    String pos4Desc = position4Service.getDescription(pos4Code);
                    if ((pos4Desc == null || pos4Desc.isBlank()) && tariffPositionService != null) {
                        pos4Desc = tariffPositionService.getDescription(zone, pos4Code);
                    }
                    if (pos4Desc != null && !pos4Desc.isBlank()) {
                        rag.add(new Position(null, "Position " + pos4Code + " - " + pos4Desc));
                    }
                }
                if (p.getDescription() != null && !p.getDescription().isBlank()) {
                    rag.add(new Position(null, "Sous-position SH6 " + code6 + " - " + p.getDescription()));
                }
                leafRows.stream()
                        .filter(pos -> pos.getCode() == null || pos.getCode().isEmpty()
                                || pos.getCode().replaceAll("\\s", "").length() != 4)
                        .map(pos -> new Position(pos.getCode(), pos.getDescription()))
                        .forEach(rag::add);
            }
        }
        return rag;
    }
}
