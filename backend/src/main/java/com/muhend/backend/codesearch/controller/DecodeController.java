package com.muhend.backend.codesearch.controller;

import com.muhend.backend.codesearch.model.DecodeResult;
import com.muhend.backend.codesearch.service.TariffDecodeService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Recherche inverse HS (2, 4 ou 6 chiffres) :
 * retourne la hiérarchie complète (Section -> Chapitre -> Position4 -> Position6).
 * Pure requête SQL gratuite (sans IA ni consommation de crédits).
 *
 * Route Traefik : /api/decode -> backend:/decode
 */
@RestController
@RequestMapping("/decode")
@RequiredArgsConstructor
@Slf4j
public class DecodeController {

    private final TariffDecodeService tariffDecodeService;

    @GetMapping(produces = "application/json")
    public ResponseEntity<DecodeResult> decodeCode(
            @RequestParam String code,
            @RequestParam(required = false, defaultValue = "DZ") String zone,
            HttpServletRequest request) {
        tariffDecodeService.checkRateLimit(extractClientIp(request));
        return ResponseEntity.ok(tariffDecodeService.decode(code, zone, false));
    }

    private String extractClientIp(HttpServletRequest request) {
        if (request == null) return "unknown";
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
