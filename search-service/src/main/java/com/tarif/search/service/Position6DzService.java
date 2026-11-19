package com.tarif.search.service;

import com.tarif.search.model.Position6Dz;
import com.tarif.search.repository.Position6DzRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class Position6DzService {

    private final Position6DzRepository position6DzRepository;
    private final Map<String, List<Position6Dz>> prefixCache = new ConcurrentHashMap<>();
    private final Map<String, Optional<String>> descriptionCache = new ConcurrentHashMap<>();

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
        if (code == null || code.isBlank()) {
            return null;
        }
        String key = code.trim();
        return descriptionCache.computeIfAbsent(key,
                k -> position6DzRepository.findByCode(k).map(Position6Dz::getDescription))
                .orElse(null);
    }

    public List<Position6Dz> getPosition6DzsByPrefix(String prefix) {
        if (prefix == null) {
            return List.of();
        }
        List<Position6Dz> cached = prefixCache.get(prefix);
        if (cached != null) {
            return cached;
        }
        List<Position6Dz> result = position6DzRepository.findAllByPrefix(prefix);
        if (result != null && !result.isEmpty()) {
            List<Position6Dz> copy = List.copyOf(result);
            prefixCache.put(prefix, copy);
            for (Position6Dz p : copy) {
                if (p.getCode() != null && p.getDescription() != null) {
                    descriptionCache.putIfAbsent(p.getCode().trim(), Optional.of(p.getDescription()));
                }
            }
            return copy;
        }
        return result != null ? result : List.of();
    }

    public boolean existsByCode(String code) {
        return position6DzRepository.existsByCode(code);
    }
}
