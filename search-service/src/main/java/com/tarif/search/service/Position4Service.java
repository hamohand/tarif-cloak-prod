package com.tarif.search.service;

import com.tarif.search.model.Position4;
import com.tarif.search.repository.Position4Repository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class Position4Service {

    private final Position4Repository position4Repository;
    private final Map<String, List<Position4>> prefixCache = new ConcurrentHashMap<>();
    private final Map<String, Optional<String>> descriptionCache = new ConcurrentHashMap<>();

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
        if (code == null || code.isBlank()) {
            return null;
        }
        String key = code.trim();
        return descriptionCache.computeIfAbsent(key,
                k -> position4Repository.findByCode(k).map(Position4::getDescription))
                .orElse(null);
    }

    public List<Position4> getPosition4sByPrefix(String prefix) {
        if (prefix == null) {
            return List.of();
        }
        List<Position4> cached = prefixCache.get(prefix);
        if (cached != null) {
            return cached;
        }
        List<Position4> result = position4Repository.findAllByPrefix(prefix);
        if (result != null && !result.isEmpty()) {
            List<Position4> copy = List.copyOf(result);
            prefixCache.put(prefix, copy);
            for (Position4 p : copy) {
                if (p.getCode() != null && p.getDescription() != null) {
                    descriptionCache.putIfAbsent(p.getCode().trim(), Optional.of(p.getDescription()));
                }
            }
            return copy;
        }
        return result != null ? result : List.of();
    }

    public boolean existsByCode(String code) {
        return position4Repository.existsByCode(code);
    }
}
