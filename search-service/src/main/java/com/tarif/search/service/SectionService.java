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

    /** Cache des notes de section (ne changent jamais pendant le runtime). */
    private final Map<String, String> notesCache = new ConcurrentHashMap<>();
    private volatile boolean notesCacheLoaded = false;

    public SectionService(SectionRepository sectionRepository) {
        this.sectionRepository = sectionRepository;
    }

    public List<Section> getAllSections() {
        return sectionRepository.findAll();
    }

    public Optional<Section> getSectionById(Long id) {
        return sectionRepository.findById(id);
    }

    public Optional<Section> getSectionByCode(String code) {
        return sectionRepository.findByCode(code);
    }

    public String getDescription(String code) {
        return sectionRepository.findByCode(code.trim())
                .map(Section::getDescription)
                .orElse(null);
    }

    /**
     * Retourne la note explicative de la section (extrait du tarif DGD).
     * Utilise un cache en mémoire : les notes sont chargées une seule fois
     * depuis la base, puis servies directement.
     * Retourne null si aucune note n'a été saisie pour cette section.
     */
    public String getNote(String code) {
        if (!notesCacheLoaded) {
            loadNotesCache();
        }
        return notesCache.get(code.trim());
    }

    private synchronized void loadNotesCache() {
        if (notesCacheLoaded) return; // double-check
        List<Section> sections = sectionRepository.findAll();
        for (Section s : sections) {
            if (s.getNote() != null && !s.getNote().isBlank()) {
                notesCache.put(s.getCode().trim(), s.getNote());
            }
        }
        log.info("Cache notes de section chargé : {} entrée(s)", notesCache.size());
        notesCacheLoaded = true;
    }

    public boolean existsByCode(String code) {
        return sectionRepository.findByCode(code).isPresent();
    }
}
