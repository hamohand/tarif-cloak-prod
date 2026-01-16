package com.tarif.search.service;

import com.tarif.search.model.Position6Dz;
import com.tarif.search.repository.Position6DzRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class Position6DzService {

    private final Position6DzRepository position6DzRepository;

    public List<Position6Dz> getAllPositions() {
        return position6DzRepository.findAll();
    }

    public Optional<Position6Dz> getPositionById(Long id) {
        return position6DzRepository.findById(id);
    }

    public Optional<Position6Dz> getPositionByCode(String code) {
        return position6DzRepository.findByCode(code);
    }

    public String getDescription(String code) {
        return position6DzRepository.findByCode(code)
                .map(Position6Dz::getDescription)
                .orElse(null);
    }

    public List<Position6Dz> getPosition6DzsByPrefix(String prefix) {
        return position6DzRepository.findAllByPrefix(prefix);
    }

    public boolean existsByCode(String code) {
        return position6DzRepository.existsByCode(code);
    }
}
