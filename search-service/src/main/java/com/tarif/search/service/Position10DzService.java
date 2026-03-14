package com.tarif.search.service;

import com.tarif.search.model.Position10Dz;
import com.tarif.search.repository.Position10DzRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class Position10DzService {

    private final Position10DzRepository position10DzRepository;

    public Optional<Position10Dz> getPositionByCode(String code) {
        return position10DzRepository.findByCode(code);
    }

    public String getDescription(String code) {
        return position10DzRepository.findByCode(code)
                .map(Position10Dz::getDescription)
                .orElse(null);
    }

    public List<Position10Dz> getPosition10DzsByPrefix(String prefix) {
        return position10DzRepository.findAllByPrefix(prefix);
    }

    public boolean existsByCode(String code) {
        return position10DzRepository.existsByCode(code);
    }
}
