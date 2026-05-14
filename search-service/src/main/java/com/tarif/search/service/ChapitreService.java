package com.tarif.search.service;

import com.tarif.search.model.Chapitre;
import com.tarif.search.repository.ChapitreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ChapitreService {

    private final ChapitreRepository chapitreRepository;

    public List<Chapitre> getAllChapitres() {
        return chapitreRepository.findAll();
    }

    public Optional<Chapitre> getChapitreById(Long id) {
        return chapitreRepository.findById(id);
    }

    public Optional<Chapitre> getChapitreByCode(String code) {
        return chapitreRepository.findByCode(code);
    }

    public String getDescription(String code) {
        return chapitreRepository.findByCode(code)
                .map(Chapitre::getDescription)
                .orElse(null);
    }

    /**
     * Retourne la note explicative du chapitre (extrait du tarif DGD).
     * Retourne null si aucune note n'a été saisie pour ce chapitre.
     */
    public String getNote(String code) {
        return chapitreRepository.findByCode(code)
                .map(Chapitre::getNote)
                .orElse(null);
    }

    public List<Chapitre> getChapitresBySection(String sectionCode) {
        // La table section stocke "07" (zero-padded) mais la table chapitre stocke "7"
        // On essaie les deux formats pour gérer le décalage
        List<Chapitre> result = chapitreRepository.findBySection(sectionCode);
        if (result.isEmpty() && sectionCode != null) {
            String stripped = sectionCode.replaceFirst("^0+", "");
            if (!stripped.equals(sectionCode)) {
                result = chapitreRepository.findBySection(stripped);
            }
        }
        return result;
    }

    public boolean existsByCode(String code) {
        return chapitreRepository.existsByCode(code);
    }
}
