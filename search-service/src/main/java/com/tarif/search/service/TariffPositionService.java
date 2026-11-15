package com.tarif.search.service;

import com.tarif.search.model.Position;
import com.tarif.search.model.TariffPosition;
import com.tarif.search.repository.TariffPositionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Fournit les sous-positions nationales (P10 DZ / NC8 EU) avec leurs titres ancêtres
 * reconstitués pour alimenter le contexte RAG du niveau 4 multi-zones.
 */
@Service
@RequiredArgsConstructor
public class TariffPositionService {

    private final TariffPositionRepository tariffPositionRepository;

    private record StackEntry(int level, String description, boolean emitted) {
        StackEntry markEmitted() {
            return new StackEntry(level, description, true);
        }
    }

    public String getDescription(String zone, String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        String normZone = normalizeZone(zone);
        String digits = code.replaceAll("[^0-9]", "");
        String lookup = digits.length() >= 4 ? digits : code.replaceAll("\\s+", "");
        return tariffPositionRepository.findByZoneCodeAndCode(normZone, lookup)
                .map(TariffPosition::getDescription)
                .orElse(null);
    }

    public List<Position> getPos4HeadingsForChapter(String zone, String chapterCode) {
        if (chapterCode == null || chapterCode.isBlank()) {
            return Collections.emptyList();
        }
        String normZone = normalizeZone(zone);
        String normChap = chapterCode.replaceAll("[^0-9]", "");
        if (normChap.length() == 1) {
            normChap = "0" + normChap;
        }
        if (normChap.length() != 2) {
            return Collections.emptyList();
        }
        return tariffPositionRepository.findPos4HeadingsByZoneAndChapter(normZone, normChap).stream()
                .map(t -> new Position(t.getCode(), t.getDescription()))
                .toList();
    }

    public List<Position> getDistinctHs6ForPos4(String zone, String pos4Code) {
        if (pos4Code == null) {
            return Collections.emptyList();
        }
        String cleanPos4 = pos4Code.replaceAll("[^0-9]", "");
        if (cleanPos4.length() < 4) {
            return Collections.emptyList();
        }
        String normZone = normalizeZone(zone);
        List<TariffPosition> pos4Rows = tariffPositionRepository
                .findByZoneCodeAndPos4CodeOrderByRowOrderAsc(normZone, cleanPos4.substring(0, 4));
        if (pos4Rows.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, String> byHs6 = new LinkedHashMap<>();
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
                    continue;
                }
                while (!stack.isEmpty() && stack.get(stack.size() - 1).level() >= level) {
                    stack.remove(stack.size() - 1);
                }
                stack.add(new StackEntry(level, row.getDescription(), false));
                String hs6 = row.getHs6Code();
                if (hs6 != null && hs6.length() == 6 && !byHs6.containsKey(hs6)) {
                    byHs6.put(hs6, joinStackDescriptions(stack, level, null));
                }
                continue;
            }

            String hs6 = row.getHs6Code();
            if (hs6 != null && hs6.length() == 6 && !byHs6.containsKey(hs6)) {
                byHs6.put(hs6, joinStackDescriptions(stack, level, row.getDescription()));
            }
        }

        List<Position> result = new ArrayList<>(byHs6.size());
        for (Map.Entry<String, String> e : byHs6.entrySet()) {
            result.add(new Position(e.getKey(), e.getValue()));
        }
        return result;
    }

    public String getHs6Description(String zone, String hs6Code) {
        if (hs6Code == null) {
            return null;
        }
        String cleanHs6 = hs6Code.replaceAll("[^0-9]", "");
        if (cleanHs6.length() < 6) {
            return null;
        }
        String target = cleanHs6.substring(0, 6);
        return getDistinctHs6ForPos4(zone, target.substring(0, 4)).stream()
                .filter(p -> target.equals(p.getCode()))
                .map(Position::getDescription)
                .findFirst()
                .orElse(null);
    }

    private static String joinStackDescriptions(List<StackEntry> stack, int currentLevel, String leafDesc) {
        StringBuilder sb = new StringBuilder();
        for (StackEntry entry : stack) {
            if (leafDesc != null && entry.level() >= currentLevel) {
                continue;
            }
            if (entry.description() != null && !entry.description().isBlank()) {
                if (sb.length() > 0) sb.append(' ');
                sb.append(entry.description().trim());
            }
        }
        if (leafDesc != null && !leafDesc.isBlank()) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(leafDesc.trim());
        }
        return sb.toString();
    }

    public List<Position> getContextPositionsForHs6(String zone, String hs6Code) {
        if (hs6Code == null) {
            return Collections.emptyList();
        }
        String cleanHs6 = hs6Code.replaceAll("[^0-9]", "");
        if (cleanHs6.length() < 4) {
            return Collections.emptyList();
        }
        String normZone = normalizeZone(zone);
        String pos4 = cleanHs6.substring(0, 4);
        String targetHs6 = cleanHs6.length() >= 6 ? cleanHs6.substring(0, 6) : cleanHs6;

        List<TariffPosition> pos4Rows = tariffPositionRepository
                .findByZoneCodeAndPos4CodeOrderByRowOrderAsc(normZone, pos4);
        if (pos4Rows.isEmpty()) {
            return Collections.emptyList();
        }

        List<Position> result = new ArrayList<>();
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
                    continue;
                }
                while (!stack.isEmpty() && stack.get(stack.size() - 1).level() >= level) {
                    stack.remove(stack.size() - 1);
                }
                stack.add(new StackEntry(level, row.getDescription(), false));
                continue;
            }

            if (targetHs6.equals(row.getHs6Code())) {
                for (int i = 0; i < stack.size(); i++) {
                    StackEntry entry = stack.get(i);
                    if ((level <= 0 || entry.level() < level) && !entry.emitted()) {
                        result.add(new Position("", entry.description()));
                        stack.set(i, entry.markEmitted());
                    }
                }
                result.add(new Position(rowCode, row.getDescription()));
            }
        }

        return result;
    }

    private String normalizeZone(String zone) {
        return (zone == null || zone.isBlank()) ? "DZ" : zone.trim().toUpperCase(Locale.ROOT);
    }

    private static int countDashes(String description) {
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
