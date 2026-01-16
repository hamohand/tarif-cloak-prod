package com.tarif.search.service;

import com.tarif.search.model.Position4;
import com.tarif.search.repository.Position4Repository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class Position4Service {

    private final Position4Repository position4Repository;

    public List<Position4> getAllPositions() {
        return position4Repository.findAll();
    }

    public Optional<Position4> getPositionById(Long id) {
        return position4Repository.findById(id);
    }

    public Optional<Position4> getPositionByCode(String code) {
        return position4Repository.findByCode(code);
    }

    public String getDescription(String code) {
        return position4Repository.findByCode(code)
                .map(Position4::getDescription)
                .orElse(null);
    }

    public List<Position4> getPosition4sByPrefix(String prefix) {
        return position4Repository.findAllByPrefix(prefix);
    }

    public boolean existsByCode(String code) {
        return position4Repository.existsByCode(code);
    }
}
