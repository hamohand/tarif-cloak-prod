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
        log.info("[DIAG] Level 0 (Sections) - RAG size: {}", ragNiveau.size());

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
        log.info("[DIAG] Level 1 (Chapitres) - RAG size: {} - sections choisies: {}", ragNiveau.size(), positions.stream().map(p -> p.getCode()+":"+p.getDescription()).toList());

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
        log.info("[DIAG] Level 2 (Positions4) - RAG size: {} - chapitres choisis: {}", ragNiveau.size(), positions.stream().map(p -> p.getCode()+":"+p.getDescription()).toList());

        positions = executeWithRetry(SearchLevel.POSITIONS4.toString(), termeRecherche, ragNiveau, tentativesMax, maxLevel == SearchLevel.POSITIONS4);

        if (positions == null || positions.isEmpty()) {
            log.info("Level 2 - Aucun résultat, arrêt cascade");
            return new ArrayList<>();
        }

        // Fix : si l'IA retourne un code chapitre (≤2 chiffres) au lieu de codes position4,
        // on l'expande en toutes les positions4 de ce chapitre
        positions = expandChapterCodesToPosition4(positions);

        enrichWithDescriptions(positions, SearchLevel.POSITIONS4);
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
                    List<Position> expanded6 = new ArrayList<>(expandPosition4CodesToPosition6(exactP4));
                    enrichWithDescriptions(expanded6, SearchLevel.POSITIONS6);
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
        ragNiveau = ragPositions6(positions);
        log.info("[DIAG] Level 3 (Positions6) - RAG size: {} - pos4 choisies: {}", ragNiveau.size(), positions.stream().map(p -> p.getCode()).toList());

        // Protection : si le RAG est trop volumineux (terme trop générique),
        // on retourne les résultats Level 2 plutôt que de risquer un timeout IA
        if (ragNiveau.size() > 80) {
            log.info("Level 3 - RAG trop volumineux ({} items), retour des résultats Level 2", ragNiveau.size());
            return aiPrompts.getDefTheme().isWithCascade() ? reponseList : reponseListLevel.isEmpty() ? new ArrayList<>(positionsLevel2) : reponseListLevel;
        }

        positions = executeWithRetry(SearchLevel.POSITIONS6.toString(), termeRecherche, ragNiveau, tentativesMax, maxLevel == SearchLevel.POSITIONS6);

        if (positions == null || positions.isEmpty()) {
            log.info("Level 3 - Aucun résultat, utilisation Level 2");
            positions = positionsLevel2;
        }

        positions = expandPosition4CodesToPosition6(positions);

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

        // Si le terme correspond exactement à l'intitulé d'une sous-position SH6 comportant plusieurs P10
        // (sans correspondre à un P10 spécifique), on conserve directement le code SH6 pour restituer toute sa branche.
        List<Position> directP6Matches = new ArrayList<>();
        List<Position> p6ForLevel4 = new ArrayList<>();
        for (Position p6 : positions) {
            var p10Rows = position10DzService.getPosition10DzsWithContextByPrefix(p6.getCode() + "%");
            long p10Count = p10Rows.stream().filter(r -> r.getCode() != null && r.getCode().length() == 10).count();
            boolean exactP6Desc = !normQuery.isEmpty()
                    && p6.getDescription() != null
                    && normalizeForExactMatch(p6.getDescription()).equals(normQuery);
            boolean exactChildP10Desc = !normQuery.isEmpty() && p10Rows.stream()
                    .filter(r -> r.getCode() != null && r.getCode().length() == 10 && r.getDescription() != null)
                    .anyMatch(r -> normalizeForExactMatch(r.getDescription()).equals(normQuery));

            if (exactP6Desc && p10Count > 1 && !exactChildP10Desc) {
                log.info("[DIAG] Correspondance directe avec l'intitulé Position6 '{}' ({} codes P10)", p6.getCode(), p10Count);
                directP6Matches.add(new Position(
                        p6.getCode(),
                        p6.getDescription(),
                        "Correspond à la sous-position SH " + p6.getCode() + " : " + p6.getDescription()));
            } else {
                p6ForLevel4.add(p6);
            }
        }

        reponseListLevel.addAll(directP6Matches);
        ragNiveau = ragPositions10(p6ForLevel4);
        log.info("[DIAG] Level 4 (Positions10) - RAG size: {}", ragNiveau.size());

        if (!ragNiveau.isEmpty()) {
            positions = executeWithRetry(SearchLevel.POSITIONS10.toString(), termeRecherche, ragNiveau, tentativesMax, true);

            if (positions != null && !positions.isEmpty()) {
                enrichWithDescriptions(positions, SearchLevel.POSITIONS10);
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

    private List<Position> executeWithRetry(String niveau, String terme, List<Position> rag, int maxTentatives, boolean withJustification) {
        int tentatives = 0;
        Exception lastException = null;

        while (tentatives < maxTentatives) {
            tentatives++;
            log.info("[DIAG] {} - Tentative {}/{}", niveau, tentatives, maxTentatives);
            try {
                List<Position> rawResult = aiService.promptEtReponse(niveau, terme, rag, withJustification);
                List<Position> result = sanitizePositions(rawResult, niveau);
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

    private List<Position> sanitizePositions(List<Position> raw, String niveau) {
        if (raw == null || raw.isEmpty()) return new ArrayList<>();
        List<Position> cleaned = new ArrayList<>();
        java.util.Set<String> seenCodes = new java.util.LinkedHashSet<>();
        boolean padTwoDigits = "SECTIONS".equals(niveau) || "CHAPITRES".equals(niveau);

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
            } else if ("POSITIONS10".equals(niveau) && digits.length() > 6 && digits.length() != 10) {
                digits = (digits.length() == 8 && position10DzService.existsByCode(digits + "00"))
                        ? digits + "00"
                        : digits.substring(0, 6);
            }
            if (seenCodes.add(digits)) {
                cleaned.add(new Position(digits, p.getDescription(), p.getJustification()));
            }
        }
        return cleaned;
    }

    private String normalizeForExactMatch(String text) {
        if (text == null) return "";
        return java.text.Normalizer.normalize(text, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("\\(\\d+\\)", " ")
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .trim()
                .toLowerCase(java.util.Locale.ROOT);
    }

    private void enrichWithDescriptions(List<Position> positions, SearchLevel level) {
        if (!aiPrompts.getDefTheme().isWithDescription()) {
            return;
        }

        for (Position position : positions) {
            String code = position.getCode();
            if (code == null) continue;
            String description = switch (level) {
                case SECTIONS -> sectionService.getDescription(code.trim());
                case CHAPITRES -> chapitreService.getDescription(code);
                case POSITIONS4 -> position4Service.getDescription(code);
                case POSITIONS6 -> position6DzService.getDescription(code);
                case POSITIONS10 -> switch (code.length()) {
                    case 4 -> position4Service.getDescription(code);
                    case 6 -> position6DzService.getDescription(code);
                    default -> position10DzService.getDescription(code);
                };
            };
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

    /**
     * Si l'IA (ou le fallback Level 2) retourne un code à 4 chiffres au Level 3,
     * on le remplace par la ou les positions à 6 chiffres correspondantes (ex: 1206 -> 120600).
     */
    private List<Position> expandPosition4CodesToPosition6(List<Position> positions) {
        List<Position> expanded = new ArrayList<>();
        boolean hadExpansion = false;

        for (Position p : positions) {
            String code = p.getCode() != null ? p.getCode().trim().replaceAll("\\s", "") : "";
            if (code.length() == 4) {
                List<Position> pos6List = position6DzService.getPosition6DzsByPrefix(code + "%").stream()
                        .filter(pos -> pos.getCode() != null && pos.getCode().replaceAll("\\s", "").length() == 6)
                        .map(pos -> new Position(pos.getCode().replaceAll("\\s", ""), pos.getDescription(), p.getJustification()))
                        .toList();
                if (!pos6List.isEmpty()) {
                    log.info("[DIAG] Level 3 - Code position4 '{}' expandé en {} positions6", code, pos6List.size());
                    expanded.addAll(pos6List);
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
        List<Position> rag = new ArrayList<>();
        for (Position p : positions4Selectionnees) {
            if (p.getDescription() != null && !p.getDescription().isBlank()) {
                rag.add(new Position(null, "Position " + p.getCode() + " - " + p.getDescription()));
            }
            String prefix = p.getCode() + "%";
            position6DzService.getPosition6DzsByPrefix(prefix).stream()
                    .filter(pos -> pos.getCode() != null && pos.getCode().replaceAll("\\s", "").length() == 6)
                    .map(pos -> new Position(pos.getCode().replaceAll("\\s", ""), pos.getDescription()))
                    .forEach(rag::add);
        }
        return rag;
    }

    private List<Position> ragPositions10(List<Position> positions6Selectionnees) {
        List<Position> rag = new ArrayList<>();
        java.util.Set<String> emittedPos4 = new java.util.HashSet<>();
        for (Position p : positions6Selectionnees) {
            String code6 = p.getCode();
            if (code6 == null || code6.length() < 4) continue;
            String prefix = code6 + "%";
            var p10List = position10DzService.getPosition10DzsWithContextByPrefix(prefix);
            if (!p10List.isEmpty()) {
                String pos4Code = code6.substring(0, 4);
                if (emittedPos4.add(pos4Code)) {
                    String pos4Desc = position4Service.getDescription(pos4Code);
                    if (pos4Desc != null && !pos4Desc.isBlank()) {
                        rag.add(new Position(null, "Position " + pos4Code + " - " + pos4Desc));
                    }
                }
                if (p.getDescription() != null && !p.getDescription().isBlank()) {
                    rag.add(new Position(null, "Sous-position SH6 " + code6 + " - " + p.getDescription()));
                }
                p10List.stream()
                        .filter(pos -> pos.getCode() == null || pos.getCode().isEmpty() || pos.getCode().replaceAll("\\s", "").length() != 4)
                        .map(pos -> new Position(pos.getCode(), pos.getDescription()))
                        .forEach(rag::add);
            }
        }
        return rag;
    }
}
