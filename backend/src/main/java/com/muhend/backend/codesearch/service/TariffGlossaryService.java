package com.muhend.backend.codesearch.service;

import com.muhend.backend.codesearch.model.DecodeResult;
import com.muhend.backend.codesearch.model.TariffGlossary;
import com.muhend.backend.codesearch.repository.TariffGlossaryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Résout les sigles réglementaires (FAP, UQN, taxes, GU) pour une zone tarifaire
 * à partir de la table tariff_glossary avec mise en cache légère par zone.
 */
@Service
@RequiredArgsConstructor
public class TariffGlossaryService {

    private final TariffGlossaryRepository glossaryRepository;
    private final Map<String, Map<String, TariffGlossary>> cacheByZone = new ConcurrentHashMap<>();

    public Map<String, String> buildGlossaryForItems(String zone, List<DecodeResult.CodeItem> items) {
        if (items == null || items.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, TariffGlossary> zoneDict = loadZoneDictionary(zone);
        if (zoneDict.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<String, String> resolved = new LinkedHashMap<>();
        for (DecodeResult.CodeItem item : items) {
            Map<String, Object> reg = item.getRegulatoryData();
            if (reg == null || reg.isEmpty()) {
                continue;
            }
            addIfPresent(resolved, zoneDict, "TAX", "DD", reg.get("dd"));
            addIfPresent(resolved, zoneDict, "TAX", "TVA", reg.get("tva"));
            addIfPresent(resolved, zoneDict, "GU", "GU", reg.get("gu"));

            Object autresObj = reg.get("autres");
            if (autresObj != null) {
                String autresUpper = autresObj.toString().toUpperCase(Locale.ROOT);
                if (autresUpper.contains("DAPS")) {
                    addEntry(resolved, zoneDict, "TAX", "DAPS");
                }
                if (autresUpper.contains("TIC") || autresUpper.contains("T.I.C")) {
                    addEntry(resolved, zoneDict, "TAX", "TIC");
                }
            }

            Object uqnObj = reg.get("uqn");
            if (uqnObj != null) {
                String uqn = uqnObj.toString().trim();
                if (!uqn.isEmpty() && !"-".equals(uqn)) {
                    addEntry(resolved, zoneDict, "UQN", uqn);
                }
            }

            Object fapObj = reg.get("fap");
            if (fapObj instanceof Collection<?> fapList) {
                for (Object f : fapList) {
                    if (f != null) {
                        addEntry(resolved, zoneDict, "FAP", f.toString().trim());
                    }
                }
            }
        }
        return resolved;
    }

    private void addIfPresent(Map<String, String> out, Map<String, TariffGlossary> dict,
                              String category, String code, Object val) {
        if (val == null) return;
        String s = val.toString().trim();
        if (!s.isEmpty() && !"-".equals(s)) {
            addEntry(out, dict, category, code);
        }
    }

    private void addEntry(Map<String, String> out, Map<String, TariffGlossary> dict,
                          String category, String code) {
        if (code == null || code.isEmpty()) return;
        TariffGlossary entry = dict.get(key(category, code));
        if (entry == null && "UQN".equals(category)) {
            entry = dict.get(key(category, code.toLowerCase(Locale.ROOT)));
        }
        if (entry != null) {
            String desc = entry.getDescription() != null && !entry.getDescription().isBlank()
                    ? entry.getLabel() + " — " + entry.getDescription()
                    : entry.getLabel();
            out.putIfAbsent(code, desc);
        }
    }

    private Map<String, TariffGlossary> loadZoneDictionary(String zone) {
        String normZone = zone == null ? "DZ" : zone.trim().toUpperCase(Locale.ROOT);
        return cacheByZone.computeIfAbsent(normZone, z -> {
            List<TariffGlossary> entries = glossaryRepository.findByZoneCode(z);
            Map<String, TariffGlossary> map = new HashMap<>();
            for (TariffGlossary e : entries) {
                map.put(key(e.getCategory(), e.getCode()), e);
                if ("UQN".equalsIgnoreCase(e.getCategory())) {
                    map.put(key(e.getCategory(), e.getCode().toLowerCase(Locale.ROOT)), e);
                }
            }
            return map;
        });
    }

    private static String key(String category, String code) {
        return category.toUpperCase(Locale.ROOT) + ":" + code.toUpperCase(Locale.ROOT);
    }
}
