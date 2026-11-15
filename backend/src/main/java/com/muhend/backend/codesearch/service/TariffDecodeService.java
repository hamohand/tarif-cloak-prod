package com.muhend.backend.codesearch.service;

import com.muhend.backend.codesearch.model.*;
import com.muhend.backend.codesearch.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Service unifié et gratuit (requêtes SQL pures sans IA ni consommation de crédits)
 * de décodage des codes douaniers (2, 4, 6, 8 ou 10 chiffres) multi-zones.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TariffDecodeService {

    private static final int MAX_DECODE_REQ_PER_MIN = 60;
    private static final long WINDOW_MS = 60_000L;

    private final ChapitreRepository chapitreRepository;
    private final SectionRepository sectionRepository;
    private final Position4Repository position4Repository;
    private final Position6DzRepository position6DzRepository;
    private final TariffPositionRepository tariffPositionRepository;
    private final TariffGlossaryService tariffGlossaryService;

    private final Map<String, RateWindow> rateLimiters = new ConcurrentHashMap<>();

    private record RateWindow(long windowStartMs, int count) {}
    private record StackEntry(int level, String description) {}

    public void checkRateLimit(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return;
        }
        long now = System.currentTimeMillis();
        if (rateLimiters.size() > 10_000) {
            rateLimiters.entrySet().removeIf(e -> now - e.getValue().windowStartMs() > WINDOW_MS);
        }
        RateWindow updated = rateLimiters.compute(clientIp, (k, prev) -> {
            if (prev == null || now - prev.windowStartMs() >= WINDOW_MS) {
                return new RateWindow(now, 1);
            }
            return new RateWindow(prev.windowStartMs(), prev.count() + 1);
        });
        if (updated.count() > MAX_DECODE_REQ_PER_MIN) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Trop de requêtes de décodage. Veuillez patienter une minute.");
        }
    }

    public DecodeResult decode(String code, String zone, boolean includeNationalLevels) {
        String normZone = (zone == null || zone.isBlank())
                ? "DZ"
                : zone.trim().toUpperCase(Locale.ROOT);
        String normalized = code == null ? "" : code.replaceAll("[^0-9]", "");
        int len = normalized.length();

        boolean validLen = includeNationalLevels
                ? (len == 2 || len == 4 || len == 6 || len == 8 || len == 10)
                : (len == 2 || len == 4 || len == 6 || len == 10);
        if (!validLen) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    includeNationalLevels
                            ? "Le code doit faire 2, 4, 6, 8 ou 10 chiffres après normalisation. Reçu : " + len + " chiffre(s)."
                            : "Le code HS doit faire 2, 4, 6 ou 10 chiffres après normalisation. Reçu : " + len + " chiffre(s).");
        }

        String chapCode = normalized.substring(0, 2);
        Chapitre chapitre = chapitreRepository.findByCode(chapCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Chapitre introuvable pour le code : " + chapCode));

        String sectionCode = chapitre.getSection() != null ? chapitre.getSection().trim() : "";
        if (sectionCode.length() == 1) {
            sectionCode = "0" + sectionCode;
        }
        final String resolvedSectionCode = sectionCode;
        Section section = sectionRepository.findByCode(resolvedSectionCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Section introuvable pour : " + resolvedSectionCode));

        DecodeResult.CodeItem sectionItem = new DecodeResult.CodeItem(
                section.getCode(), section.getDescription(), section.getNote());
        DecodeResult.CodeItem chapitreItem = new DecodeResult.CodeItem(
                chapitre.getCode(), chapitre.getDescription(), chapitre.getNote());

        if (len == 2) {
            List<DecodeResult.CodeItem> positions4 = position4Repository.findAllByPrefix(chapCode + "%")
                    .stream()
                    .map(p -> new DecodeResult.CodeItem(p.getCode(), p.getDescription()))
                    .collect(Collectors.toList());
            return DecodeResult.builder()
                    .zone(normZone)
                    .codeRecherche(code)
                    .niveau("CHAPITRE")
                    .section(sectionItem)
                    .chapitre(chapitreItem)
                    .positions6(positions4)
                    .build();
        }

        String pos4Code = normalized.substring(0, 4);
        DecodeResult.CodeItem position4Item = position4Repository.findByCode(pos4Code)
                .map(p -> new DecodeResult.CodeItem(p.getCode(), p.getDescription()))
                .orElseGet(() -> {
                    if (includeNationalLevels) {
                        Optional<TariffPosition> zonePos4 = tariffPositionRepository
                                .findByZoneCodeAndCode(normZone, pos4Code);
                        if (zonePos4.isPresent()) {
                            return new DecodeResult.CodeItem(pos4Code, zonePos4.get().getDescription());
                        }
                    }
                    throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Position4 introuvable pour : " + pos4Code);
                });

        if (len == 4) {
            Map<String, DecodeResult.CodeItem> mergedPos6 = new LinkedHashMap<>();
            position6DzRepository.findAllByPrefix(pos4Code + "%").stream()
                    .filter(p -> p.getCode() != null && p.getCode().length() == 6)
                    .forEach(p -> mergedPos6.putIfAbsent(
                            p.getCode(),
                            new DecodeResult.CodeItem(p.getCode(), p.getDescription())));
            if (includeNationalLevels) {
                List<TariffPosition> rowsForPos4 = tariffPositionRepository
                        .findByZoneCodeAndPos4CodeOrderByRowOrderAsc(normZone, pos4Code);
                extractDistinctHs6Items(rowsForPos4, position4Item.getDescription())
                        .forEach(item -> mergedPos6.putIfAbsent(item.getCode(), item));
            }
            return DecodeResult.builder()
                    .zone(normZone)
                    .codeRecherche(code)
                    .niveau("POSITION4")
                    .section(sectionItem)
                    .chapitre(chapitreItem)
                    .position4(position4Item)
                    .positions6(new ArrayList<>(mergedPos6.values()))
                    .build();
        }

        String pos6Code = normalized.substring(0, 6);
        List<TariffPosition> pos4Rows = includeNationalLevels
                ? tariffPositionRepository.findByZoneCodeAndPos4CodeOrderByRowOrderAsc(normZone, pos4Code)
                : Collections.emptyList();

        DecodeResult.CodeItem position6Item = position6DzRepository.findByCode(pos6Code)
                .or(() -> pos6Code.endsWith("00") ? position6DzRepository.findByCode(pos4Code) : Optional.empty())
                .map(p6 -> new DecodeResult.CodeItem(pos6Code, p6.getDescription()))
                .orElseGet(() -> {
                    boolean hasZoneRows = pos4Rows.stream()
                            .anyMatch(r -> pos6Code.equals(r.getHs6Code()));
                    if (!hasZoneRows && !pos6Code.endsWith("00")) {
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                                "Code HS introuvable : " + pos6Code);
                    }
                    String hs6Desc = pos4Rows.stream()
                            .filter(r -> pos6Code.equals(r.getHs6Code()) && Boolean.TRUE.equals(r.getIsTitle()))
                            .map(TariffPosition::getDescription)
                            .findFirst()
                            .orElse(position4Item.getDescription());
                    return new DecodeResult.CodeItem(pos6Code, hs6Desc);
                });

        if (!includeNationalLevels) {
            return DecodeResult.builder()
                    .zone(normZone)
                    .codeRecherche(code)
                    .niveau("POSITION6")
                    .section(sectionItem)
                    .chapitre(chapitreItem)
                    .position4(position4Item)
                    .positions6(Collections.singletonList(position6Item))
                    .build();
        }

        Map<String, List<String>> titlesByCode = new LinkedHashMap<>();
        Map<String, TariffPosition> leavesByCode = new LinkedHashMap<>();
        computePos4Hierarchy(pos4Rows, titlesByCode, leavesByCode);

        if (len == 6) {
            List<TariffPosition> matchingLeaves = pos4Rows.stream()
                    .filter(r -> !Boolean.TRUE.equals(r.getIsTitle()) && pos6Code.equals(r.getHs6Code()))
                    .collect(Collectors.toList());

            List<DecodeResult.CodeItem> positions10 = matchingLeaves.stream()
                    .map(this::toCodeItem)
                    .collect(Collectors.toList());

            Map<String, List<String>> titresParCode = new LinkedHashMap<>();
            for (TariffPosition leaf : matchingLeaves) {
                titresParCode.put(leaf.getCode(),
                        titlesByCode.getOrDefault(leaf.getCode(), Collections.emptyList()));
            }

            Map<String, String> glossary = tariffGlossaryService.buildGlossaryForItems(normZone, positions10);
            return DecodeResult.builder()
                    .zone(normZone)
                    .codeRecherche(code)
                    .niveau("POSITION6")
                    .section(sectionItem)
                    .chapitre(chapitreItem)
                    .position4(position4Item)
                    .positions6(Collections.singletonList(position6Item))
                    .positions10(positions10)
                    .titresParPosition10(titresParCode)
                    .glossary(glossary.isEmpty() ? null : glossary)
                    .build();
        }

        TariffPosition target = leavesByCode.get(normalized);
        if (target == null) {
            target = tariffPositionRepository.findByZoneCodeAndCode(normZone, normalized)
                    .filter(t -> !Boolean.TRUE.equals(t.getIsTitle()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Code national (" + normZone + ") introuvable : " + normalized));
        }

        DecodeResult.CodeItem targetItem = toCodeItem(target);
        List<String> titres = titlesByCode.getOrDefault(normalized, Collections.emptyList());
        Map<String, String> glossary = tariffGlossaryService.buildGlossaryForItems(normZone, List.of(targetItem));
        String niveau = (len == 8) ? "POSITION8" : "POSITION10";

        return DecodeResult.builder()
                .zone(normZone)
                .codeRecherche(code)
                .niveau(niveau)
                .section(sectionItem)
                .chapitre(chapitreItem)
                .position4(position4Item)
                .positions6(Collections.singletonList(position6Item))
                .positions10(Collections.singletonList(targetItem))
                .titresPosition10(titres)
                .glossary(glossary.isEmpty() ? null : glossary)
                .build();
    }

    public Hs6ComparisonResult compareHs6(String code) {
        String digits = code == null ? "" : code.replaceAll("[^0-9]", "");
        if (digits.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Le comparateur requiert un code d'au moins 6 chiffres (HS6, NC8 ou P10). Reçu : "
                            + digits.length() + " chiffre(s).");
        }
        String hs6 = digits.substring(0, 6);
        DecodeResult dz = decodeOptional(hs6, "DZ");
        DecodeResult eu = decodeOptional(hs6, "EU");
        if (dz == null && eu == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Code HS6 introuvable dans les nomenclatures DZ et UE : " + hs6);
        }
        DecodeResult ref = dz != null ? dz : eu;
        DecodeResult.CodeItem pos6 = (ref.getPositions6() != null && !ref.getPositions6().isEmpty())
                ? ref.getPositions6().get(0)
                : null;
        return Hs6ComparisonResult.builder()
                .hs6(hs6)
                .section(ref.getSection())
                .chapitre(ref.getChapitre())
                .position4(ref.getPosition4())
                .position6(pos6)
                .dz(dz)
                .eu(eu)
                .build();
    }

    private DecodeResult decodeOptional(String code, String zone) {
        try {
            return decode(code, zone, true);
        } catch (ResponseStatusException ex) {
            if (ex.getStatusCode() == HttpStatus.NOT_FOUND) {
                return null;
            }
            throw ex;
        }
    }

    private List<DecodeResult.CodeItem> extractDistinctHs6Items(List<TariffPosition> pos4Rows, String fallbackDesc) {
        Map<String, String> byHs6 = new LinkedHashMap<>();
        for (TariffPosition row : pos4Rows) {
            String hs6 = row.getHs6Code();
            if (hs6 == null || hs6.length() != 6) {
                continue;
            }
            if (Boolean.TRUE.equals(row.getIsTitle())) {
                byHs6.putIfAbsent(hs6, row.getDescription());
            } else {
                byHs6.putIfAbsent(hs6, row.getDescription() != null ? row.getDescription() : fallbackDesc);
            }
        }
        return byHs6.entrySet().stream()
                .map(e -> new DecodeResult.CodeItem(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }

    /**
     * Parcourt les lignes d'une position 4 chiffres dans l'ordre du tarif (row_order ASC)
     * et construit pour chaque code feuille la pile exacte des intitulés parents (y compris 1 tiret),
     * tout en ignorant les en-têtes de page sans tiret (ex: "Désignation des Produits").
     */
    private void computePos4Hierarchy(
            List<TariffPosition> pos4Rows,
            Map<String, List<String>> titlesByCode,
            Map<String, TariffPosition> leavesByCode) {
        List<StackEntry> stack = new ArrayList<>();

        for (TariffPosition row : pos4Rows) {
            String rowCode = row.getCode() != null ? row.getCode().trim() : "";
            int level = (row.getDashLevel() != null && row.getDashLevel() > 0)
                    ? row.getDashLevel()
                    : countDashes(row.getDescription());

            if (rowCode.length() == 4) {
                stack.clear();
                continue;
            }

            if (rowCode.isEmpty() || Boolean.TRUE.equals(row.getIsTitle())) {
                if (level <= 0) {
                    // En-tête de page sans tiret (ex: "Désignation des Produits") -> ne modifie pas la pile
                    continue;
                }
                while (!stack.isEmpty() && stack.get(stack.size() - 1).level() >= level) {
                    stack.remove(stack.size() - 1);
                }
                stack.add(new StackEntry(level, row.getDescription()));
                continue;
            }

            List<String> ancestors = stack.stream()
                    .filter(e -> level <= 0 || e.level() < level)
                    .map(StackEntry::description)
                    .collect(Collectors.toList());
            titlesByCode.put(rowCode, ancestors);
            leavesByCode.put(rowCode, row);
        }
    }

    private DecodeResult.CodeItem toCodeItem(TariffPosition tp) {
        return DecodeResult.CodeItem.builder()
                .code(tp.getCode())
                .description(tp.getDescription())
                .formattedCode(tp.getFormattedCode() != null ? tp.getFormattedCode() : formatCode(tp.getCode()))
                .checkDigit(tp.getCheckDigit())
                .regulatoryData(tp.getRegulatoryData())
                .enriched(Boolean.TRUE.equals(tp.getEnriched()))
                .build();
    }

    public static String formatCode(String code) {
        if (code == null) return null;
        if (code.length() == 10) {
            return code.substring(0, 4) + "." + code.substring(4, 6) + "." + code.substring(6, 8) + "." + code.substring(8, 10);
        }
        if (code.length() == 8) {
            return code.substring(0, 4) + "." + code.substring(4, 6) + "." + code.substring(6, 8);
        }
        return code;
    }

    public static int countDashes(String description) {
        if (description == null) return 0;
        int count = 0;
        for (int i = 0; i < description.length(); i++) {
            char c = description.charAt(i);
            if (c == '-') {
                count++;
            } else if (c != ' ') {
                break;
            }
        }
        return count;
    }
}
