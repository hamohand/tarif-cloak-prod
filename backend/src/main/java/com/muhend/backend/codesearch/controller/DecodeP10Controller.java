package com.muhend.backend.codesearch.controller;

import com.muhend.backend.codesearch.model.*;
import com.muhend.backend.codesearch.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Recherche inverse P10 : à partir d'un code (2, 4, 6 ou 10 chiffres),
 * retourne la hiérarchie complète jusqu'à Position10 avec titres hiérarchiques.
 * Pure requête SQL, sans IA, sans décompte de quota.
 *
 * Route Traefik : /api/decode-p10 → backend:/decode-p10
 */
@RestController
@RequestMapping("/decode-p10")
@RequiredArgsConstructor
@Slf4j
public class DecodeP10Controller {

    private final ChapitreRepository chapitreRepository;
    private final SectionRepository sectionRepository;
    private final Position4Repository position4Repository;
    private final Position6DzRepository position6DzRepository;
    private final Position10DzRepository position10DzRepository;

    @GetMapping(produces = "application/json")
    public ResponseEntity<DecodeResult> decodeCode(@RequestParam String code) {
        String normalized = code.replaceAll("[^0-9]", "");
        log.debug("Décodage P10: '{}' → normalisé: '{}'", code, normalized);

        int len = normalized.length();
        if (len != 2 && len != 4 && len != 6 && len != 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Le code doit faire 2, 4, 6 ou 10 chiffres après normalisation. Reçu : " + len + " chiffre(s).");
        }

        String chapCode = normalized.substring(0, 2);
        Chapitre chapitre = chapitreRepository.findByCode(chapCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Chapitre introuvable pour le code : " + chapCode));
        Section section = sectionRepository.findByCode(chapitre.getSection())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Section introuvable pour : " + chapitre.getSection()));

        DecodeResult.CodeItem sectionItem  = new DecodeResult.CodeItem(section.getCode(), section.getDescription());
        DecodeResult.CodeItem chapitreItem = new DecodeResult.CodeItem(chapitre.getCode(), chapitre.getDescription());

        // Niveau CHAPITRE (2 chiffres)
        if (len == 2) {
            List<DecodeResult.CodeItem> positions4 = position4Repository.findAllByPrefix(chapCode + "%")
                    .stream().map(p -> new DecodeResult.CodeItem(p.getCode(), p.getDescription()))
                    .collect(Collectors.toList());
            return ResponseEntity.ok(DecodeResult.builder()
                    .codeRecherche(code).niveau("CHAPITRE")
                    .section(sectionItem).chapitre(chapitreItem)
                    .positions6(positions4).build());
        }

        String pos4Code = normalized.substring(0, 4);
        Position4 position4 = position4Repository.findByCode(pos4Code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Position4 introuvable pour : " + pos4Code));
        DecodeResult.CodeItem position4Item = new DecodeResult.CodeItem(position4.getCode(), position4.getDescription());

        // Niveau POSITION4 (4 chiffres)
        if (len == 4) {
            List<DecodeResult.CodeItem> positions6 = position6DzRepository.findAllByPrefix(pos4Code + "%")
                    .stream().map(p -> new DecodeResult.CodeItem(p.getCode(), p.getDescription()))
                    .collect(Collectors.toList());
            return ResponseEntity.ok(DecodeResult.builder()
                    .codeRecherche(code).niveau("POSITION4")
                    .section(sectionItem).chapitre(chapitreItem).position4(position4Item)
                    .positions6(positions6).build());
        }

        String pos6Code = normalized.substring(0, 6);
        Position6Dz position6 = position6DzRepository.findByCode(pos6Code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Code HS introuvable : " + pos6Code));
        DecodeResult.CodeItem position6Item = new DecodeResult.CodeItem(position6.getCode(), position6.getDescription());

        // Niveau POSITION6 (6 chiffres) — liste des P10 avec titres hiérarchiques
        if (len == 6) {
            List<Position10Dz> p10List = position10DzRepository.findAllByPrefixWithId(pos6Code + "%");
            List<DecodeResult.CodeItem> positions10 = p10List.stream()
                    .map(p -> new DecodeResult.CodeItem(p.getCode(), p.getDescription()))
                    .collect(Collectors.toList());
            List<String> titres = p10List.isEmpty() ? Collections.emptyList()
                    : findTitres(p10List.get(0).getId(), countDashes(p10List.get(0).getDescription()));
            return ResponseEntity.ok(DecodeResult.builder()
                    .codeRecherche(code).niveau("POSITION6")
                    .section(sectionItem).chapitre(chapitreItem).position4(position4Item)
                    .positions6(Collections.singletonList(position6Item))
                    .positions10(positions10).titresPosition10(titres).build());
        }

        // Niveau POSITION10 (10 chiffres)
        String pos10Code = normalized.substring(0, 10);
        Position10Dz position10 = position10DzRepository.findByCode(pos10Code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Code P10 introuvable : " + pos10Code));
        List<String> titres = findTitres(position10.getId(), countDashes(position10.getDescription()));
        return ResponseEntity.ok(DecodeResult.builder()
                .codeRecherche(code).niveau("POSITION10")
                .section(sectionItem).chapitre(chapitreItem).position4(position4Item)
                .positions6(Collections.singletonList(position6Item))
                .positions10(Collections.singletonList(
                        new DecodeResult.CodeItem(position10.getCode(), position10.getDescription())))
                .titresPosition10(titres).build());
    }

    /**
     * Remonte la hiérarchie des titres (code='') précédant une entrée.
     * Algorithme : à partir de l'id et du nombre de tirets de l'entrée,
     * cherche récursivement les titres avec de moins en moins de tirets
     * jusqu'à n_tirets = 1.
     *
     * @return liste de titres du plus général (1 tiret) au plus spécifique
     */
    private List<String> findTitres(long startId, int nTirets) {
        List<String> titres = new ArrayList<>();
        long currentId = startId;

        while (nTirets > 1) {
            Object[] row = position10DzRepository
                    .findFirstTitleBeforeWithFewerDashes(currentId, nTirets)
                    .orElse(null);
            if (row != null) {
                long foundId = ((Number) row[0]).longValue();
                String desc  = (String) row[1];
                titres.add(0, desc); // prepend : du plus général au plus spécifique
                currentId = foundId;
            }
            nTirets--;
        }

        return titres;
    }

    /**
     * Compte le nombre de "- " en préfixe d'une description.
     * "- texte" → 1, "- - texte" → 2, etc.
     */
    private int countDashes(String description) {
        if (description == null) return 0;
        int count = 0;
        String s = description;
        while (s.startsWith("- ")) {
            count++;
            s = s.substring(2);
        }
        return count == 0 && description.startsWith("-") ? 1 : count;
    }
}
