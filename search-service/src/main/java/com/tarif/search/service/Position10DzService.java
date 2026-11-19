package com.tarif.search.service;

import com.tarif.search.model.Position10Dz;
import com.tarif.search.repository.Position10DzRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class Position10DzService {

    private final Position10DzRepository position10DzRepository;
    private final Map<String, List<Position10Dz>> prefixContextCache = new ConcurrentHashMap<>();
    private final Map<String, Optional<String>> descriptionCache = new ConcurrentHashMap<>();

    public Optional<Position10Dz> getPositionByCode(String code) {
        return position10DzRepository.findByCode(code);
    }

    public String getDescription(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        String key = code.trim();
        return descriptionCache.computeIfAbsent(key,
                k -> position10DzRepository.findByCode(k).map(Position10Dz::getDescription))
                .orElse(null);
    }

    public List<Position10Dz> getPosition10DzsByPrefix(String prefix) {
        return position10DzRepository.findAllByPrefix(prefix);
    }

    public List<Position10Dz> getPosition10DzsWithContextByPrefix(String prefix) {
        if (prefix == null) {
            return List.of();
        }
        List<Position10Dz> cached = prefixContextCache.get(prefix);
        if (cached != null) {
            return cached;
        }
        List<Position10Dz> result = position10DzRepository.findAllWithContextByPrefix(prefix);
        if (result != null && !result.isEmpty()) {
            List<Position10Dz> copy = List.copyOf(result);
            prefixContextCache.put(prefix, copy);
            for (Position10Dz p : copy) {
                if (p.getCode() != null && !p.getCode().isBlank() && p.getDescription() != null) {
                    descriptionCache.putIfAbsent(p.getCode().trim(), Optional.of(p.getDescription()));
                }
            }
            return copy;
        }
        return result != null ? result : List.of();
    }

    public boolean existsByCode(String code) {
        return position10DzRepository.existsByCode(code);
    }
}
