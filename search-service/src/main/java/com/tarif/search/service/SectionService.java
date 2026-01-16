package com.tarif.search.service;

import com.tarif.search.model.Section;
import com.tarif.search.repository.SectionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SectionService {

    private final SectionRepository sectionRepository;

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

    public boolean existsByCode(String code) {
        return sectionRepository.existsByCode(code);
    }
}
