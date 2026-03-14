package com.tarif.search.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarif.search.model.Position10Dz;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class Position10DataLoader implements CommandLineRunner {

    private final Position10DzService position10DzService;
    private final ObjectMapper objectMapper;

    @Override
    public void run(String... args) throws Exception {
        if (position10DzService.count() > 0) {
            log.info("Position10Dz déjà chargés ({} entrées), import ignoré.", position10DzService.count());
            return;
        }

        log.info("Chargement des codes Position10Dz depuis les fichiers JSON...");

        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        Resource[] resources = resolver.getResources("classpath:data/position10/chapitres_*.json");

        List<Position10Dz> toInsert = new ArrayList<>();

        for (Resource resource : resources) {
            log.debug("Lecture de {}", resource.getFilename());
            List<Map<String, String>> entries = objectMapper.readValue(
                    resource.getInputStream(),
                    new TypeReference<>() {}
            );

            for (Map<String, String> entry : entries) {
                String code = entry.get("code");
                String description = entry.get("description");
                if (code != null && code.matches("\\d{10}") && description != null && !description.isBlank()) {
                    toInsert.add(new Position10Dz(null, code, description));
                }
            }
        }

        position10DzService.saveAll(toInsert);
        log.info("Import Position10Dz terminé : {} codes chargés.", toInsert.size());
    }
}
