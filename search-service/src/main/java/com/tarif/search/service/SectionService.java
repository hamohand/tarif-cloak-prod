package com.tarif.search.service;

import com.tarif.search.model.Section;
import com.tarif.search.repository.SectionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class SectionService {

    private final SectionRepository sectionRepository;

    /** Caches en mémoire des sections (données de référence statiques en lecture seule). */
    private volatile List<Section> allSectionsCache = List.of();
    private final Map<String, Section> byCodeCache = new ConcurrentHashMap<>();
    private volatile boolean cacheLoaded = false;

    public SectionService(SectionRepository sectionRepository) {
        this.sectionRepository = sectionRepository;
    }

    public List<Section> getAllSections() {
        ensureCacheLoaded();
        return cacheLoaded ? allSectionsCache : List.of();
    }

    public Optional<Section> getSectionById(Long id) {
        return sectionRepository.findById(id);
    }

    public Optional<Section> getSectionByCode(String code) {
        if (code == null || code.isBlank()) {
            return Optional.empty();
        }
        ensureCacheLoaded();
        if (!cacheLoaded) {
            return sectionRepository.findByCode(code.trim());
        }
        String trimmed = code.trim();
        Section found = byCodeCache.get(trimmed);
        if (found == null) {
            String stripped = trimmed.replaceFirst("^0+", "");
            if (!stripped.isEmpty()) {
                found = byCodeCache.get(stripped);
            }
        }
        return Optional.ofNullable(found);
    }

    public String getDescription(String code) {
        return getSectionByCode(code)
                .map(Section::getDescription)
                .orElse(null);
    }

    /**
     * Retourne la note explicative de la section (extrait du tarif DGD).
     * Utilise un cache en mémoire : les sections sont chargées une seule fois
     * depuis la base, puis servies directement en O(1).
     * Retourne null si aucune note n'a été saisie pour cette section.
     */
    public String getNote(String code) {
        return getSectionByCode(code)
                .map(Section::getNote)
                .filter(n -> !n.isBlank())
                .orElse(null);
    }

    private synchronized void ensureCacheLoaded() {
        if (cacheLoaded) {
            return;
        }
        List<Section> sections = sectionRepository.findAll();
        if (sections == null || sections.isEmpty()) {
            return;
        }
        Map<String, Section> map = new ConcurrentHashMap<>();
        for (Section s : sections) {
            if (s.getCode() != null) {
                String trimmed = s.getCode().trim();
                map.put(trimmed, s);
                String stripped = trimmed.replaceFirst("^0+", "");
                if (!stripped.isEmpty()) {
                    map.putIfAbsent(stripped, s);
                }
            }
        }
        byCodeCache.clear();
        byCodeCache.putAll(map);
        allSectionsCache = List.copyOf(sections);
        cacheLoaded = true;
        log.info("Cache sections chargé : {} entrée(s)", allSectionsCache.size());
    }

    public boolean existsByCode(String code) {
        return getSectionByCode(code).isPresent();
    }
}
