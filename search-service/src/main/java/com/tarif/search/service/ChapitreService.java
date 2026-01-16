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

    public List<Chapitre> getChapitresBySection(String sectionCode) {
        return chapitreRepository.findBySection(sectionCode);
    }

    public boolean existsByCode(String code) {
        return chapitreRepository.existsByCode(code);
    }
}
