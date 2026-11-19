package com.tarif.search.service;

import com.tarif.search.model.Chapitre;
import com.tarif.search.repository.ChapitreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChapitreService {

    private final ChapitreRepository chapitreRepository;

    private volatile List<Chapitre> allChapitresCache = List.of();
    private final Map<String, Chapitre> byCodeCache = new ConcurrentHashMap<>();
    private final Map<String, List<Chapitre>> bySectionCache = new ConcurrentHashMap<>();
    private volatile boolean cacheLoaded = false;

    public List<Chapitre> getAllChapitres() {
        ensureCacheLoaded();
        return cacheLoaded ? allChapitresCache : List.of();
    }

    public Optional<Chapitre> getChapitreById(Long id) {
        return chapitreRepository.findById(id);
    }

    public Optional<Chapitre> getChapitreByCode(String code) {
        if (code == null || code.isBlank()) {
            return Optional.empty();
        }
        ensureCacheLoaded();
        if (!cacheLoaded) {
            return chapitreRepository.findByCode(code.trim());
        }
        String trimmed = code.trim();
        Chapitre found = byCodeCache.get(trimmed);
        if (found == null && trimmed.length() == 1 && Character.isDigit(trimmed.charAt(0))) {
            found = byCodeCache.get("0" + trimmed);
        }
        if (found == null) {
            String stripped = trimmed.replaceFirst("^0+", "");
            if (!stripped.isEmpty()) {
                found = byCodeCache.get(stripped);
            }
        }
        return Optional.ofNullable(found);
    }

    public String getDescription(String code) {
        return getChapitreByCode(code)
                .map(Chapitre::getDescription)
                .orElse(null);
    }

    /**
     * Retourne la note explicative du chapitre (extrait du tarif DGD).
     * Retourne null si aucune note n'a été saisie pour ce chapitre.
     */
    public String getNote(String code) {
        return getChapitreByCode(code)
                .map(Chapitre::getNote)
                .filter(n -> !n.isBlank())
                .orElse(null);
    }

    public List<Chapitre> getChapitresBySection(String sectionCode) {
        if (sectionCode == null || sectionCode.isBlank()) {
            return List.of();
        }
        ensureCacheLoaded();
        if (!cacheLoaded) {
            List<Chapitre> result = chapitreRepository.findBySection(sectionCode);
            if (result.isEmpty()) {
                String stripped = sectionCode.replaceFirst("^0+", "");
                if (!stripped.equals(sectionCode)) {
                    result = chapitreRepository.findBySection(stripped);
                }
            }
            return result;
        }
        String trimmed = sectionCode.trim();
        List<Chapitre> list = bySectionCache.get(trimmed);
        if (list == null) {
            String stripped = trimmed.replaceFirst("^0+", "");
            if (!stripped.isEmpty()) {
                list = bySectionCache.get(stripped);
            }
        }
        return list != null ? list : List.of();
    }

    public boolean existsByCode(String code) {
        return getChapitreByCode(code).isPresent();
    }

    private synchronized void ensureCacheLoaded() {
        if (cacheLoaded) {
            return;
        }
        List<Chapitre> chapitres = chapitreRepository.findAll();
        if (chapitres == null || chapitres.isEmpty()) {
            return;
        }
        Map<String, Chapitre> codeMap = new ConcurrentHashMap<>();
        Map<String, List<Chapitre>> sectionGroups = new LinkedHashMap<>();

        for (Chapitre c : chapitres) {
            if (c.getCode() != null) {
                String trimmed = c.getCode().trim();
                codeMap.put(trimmed, c);
                if (trimmed.length() == 1 && Character.isDigit(trimmed.charAt(0))) {
                    codeMap.putIfAbsent("0" + trimmed, c);
                }
                String stripped = trimmed.replaceFirst("^0+", "");
                if (!stripped.isEmpty()) {
                    codeMap.putIfAbsent(stripped, c);
                }
            }
            if (c.getSection() != null && !c.getSection().isBlank()) {
                String sec = c.getSection().trim();
                Set<String> keys = new LinkedHashSet<>();
                keys.add(sec);
                String stripped = sec.replaceFirst("^0+", "");
                if (!stripped.isEmpty()) {
                    keys.add(stripped);
                }
                if (sec.length() == 1 && Character.isDigit(sec.charAt(0))) {
                    keys.add("0" + sec);
                }
                for (String key : keys) {
                    sectionGroups.computeIfAbsent(key, k -> new ArrayList<>()).add(c);
                }
            }
        }

        byCodeCache.clear();
        byCodeCache.putAll(codeMap);
        bySectionCache.clear();
        sectionGroups.forEach((k, v) -> bySectionCache.put(k, List.copyOf(v)));
        allChapitresCache = List.copyOf(chapitres);
        cacheLoaded = true;
        log.info("Cache chapitres chargé : {} entrée(s)", allChapitresCache.size());
    }
}
