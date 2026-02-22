package com.muhend.backend.codesearch.controller;

import com.muhend.backend.codesearch.model.*;
import com.muhend.backend.codesearch.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Recherche inverse : à partir d'un code HS (2, 4 ou 6 chiffres),
 * retourne la hiérarchie complète (Section → Chapitre → Position4 → Position6).
 * Pure requête SQL, sans IA, sans décompte de quota.
 *
 * Route Traefik : /api/decode → backend:/decode
 */
@RestController
@RequestMapping("/decode")
@RequiredArgsConstructor
@Slf4j
public class DecodeController {

    private final ChapitreRepository chapitreRepository;
    private final SectionRepository sectionRepository;
    private final Position4Repository position4Repository;
    private final Position6DzRepository position6DzRepository;

    /**
     * Décode un code HS et retourne la hiérarchie complète.
     *
     * @param code Code HS saisi (2, 4 ou 6 chiffres, accepte points et espaces)
     * @return Hiérarchie : section, chapitre, position4, positions6
     */
    @GetMapping(produces = "application/json")
    public ResponseEntity<DecodeResult> decodeCode(@RequestParam String code) {
        // Normalisation : supprime tout ce qui n'est pas un chiffre
        String normalized = code.replaceAll("[^0-9]", "");
        log.debug("Décodage du code HS: '{}' → normalisé: '{}'", code, normalized);

        int len = normalized.length();
        if (len != 2 && len != 4 && len != 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Le code HS doit faire 2, 4 ou 6 chiffres après normalisation. Reçu : " + normalized.length() + " chiffre(s).");
        }

        // Extraction des préfixes
        String chapCode = normalized.substring(0, 2);

        // --- Chapitre ---
        Chapitre chapitre = chapitreRepository.findByCode(chapCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Chapitre introuvable pour le code : " + chapCode));

        // --- Section ---
        String sectionCode = chapitre.getSection();
        Section section = sectionRepository.findByCode(sectionCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Section introuvable pour le code : " + sectionCode));

        DecodeResult.CodeItem sectionItem = new DecodeResult.CodeItem(section.getCode(), section.getDescription());
        DecodeResult.CodeItem chapitreItem = new DecodeResult.CodeItem(chapitre.getCode(), chapitre.getDescription());

        // --- Niveau CHAPITRE (2 chiffres) ---
        if (len == 2) {
            List<DecodeResult.CodeItem> positions4 = position4Repository.findAllByPrefix(chapCode + "%")
                    .stream()
                    .map(p4 -> new DecodeResult.CodeItem(p4.getCode(), p4.getDescription()))
                    .collect(Collectors.toList());

            return ResponseEntity.ok(DecodeResult.builder()
                    .codeRecherche(code)
                    .niveau("CHAPITRE")
                    .section(sectionItem)
                    .chapitre(chapitreItem)
                    .position4(null)
                    .positions6(positions4) // on réutilise positions6 pour afficher les position4 enfants
                    .build());
        }

        // --- Position4 (4 ou 6 chiffres) ---
        String pos4Code = normalized.substring(0, 4);
        Position4 position4 = position4Repository.findByCode(pos4Code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Position4 introuvable pour le code : " + pos4Code));

        DecodeResult.CodeItem position4Item = new DecodeResult.CodeItem(position4.getCode(), position4.getDescription());

        // --- Niveau POSITION4 (4 chiffres) ---
        if (len == 4) {
            List<DecodeResult.CodeItem> positions6 = position6DzRepository.findAllByPrefix(pos4Code + "%")
                    .stream()
                    .map(p6 -> new DecodeResult.CodeItem(p6.getCode(), p6.getDescription()))
                    .collect(Collectors.toList());

            return ResponseEntity.ok(DecodeResult.builder()
                    .codeRecherche(code)
                    .niveau("POSITION4")
                    .section(sectionItem)
                    .chapitre(chapitreItem)
                    .position4(position4Item)
                    .positions6(positions6)
                    .build());
        }

        // --- Niveau POSITION6 (6 chiffres) ---
        // Les codes position6 sont stockés au format "XXXX XX" (espace après les 4 premiers chiffres)
        String pos6DbCode = normalized.substring(0, 4) + " " + normalized.substring(4, 6);
        Position6Dz position6 = position6DzRepository.findByCode(pos6DbCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Code HS introuvable : " + pos6DbCode));

        return ResponseEntity.ok(DecodeResult.builder()
                .codeRecherche(code)
                .niveau("POSITION6")
                .section(sectionItem)
                .chapitre(chapitreItem)
                .position4(position4Item)
                .positions6(Collections.singletonList(new DecodeResult.CodeItem(position6.getCode(), position6.getDescription())))
                .build());
    }
}
