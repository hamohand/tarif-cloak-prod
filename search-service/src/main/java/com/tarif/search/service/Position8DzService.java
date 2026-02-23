package com.tarif.search.service;

import com.tarif.search.model.Position8Dz;
import com.tarif.search.repository.Position8DzRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class Position8DzService {

    private final Position8DzRepository position8DzRepository;

    public Optional<Position8Dz> getPositionByCode(String code) {
        return position8DzRepository.findByCode(code);
    }

    public String getDescription(String code) {
        return position8DzRepository.findByCode(code)
                .map(Position8Dz::getDescription)
                .orElse(null);
    }

    public List<Position8Dz> getPosition8DzsByPrefix(String prefix) {
        return position8DzRepository.findAllByPrefix(prefix);
    }

    public boolean existsByCode(String code) {
        return position8DzRepository.existsByCode(code);
    }
}
