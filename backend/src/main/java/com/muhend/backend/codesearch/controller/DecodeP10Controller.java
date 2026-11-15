package com.muhend.backend.codesearch.controller;

import com.muhend.backend.codesearch.model.DecodeResult;
import com.muhend.backend.codesearch.model.Hs6ComparisonResult;
import com.muhend.backend.codesearch.service.TariffDecodeService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Recherche inverse nationale multi-zones (P10 DZ / NC8 EU) :
 * à partir d'un code (2, 4, 6, 8 ou 10 chiffres), retourne la hiérarchie complète
 * et les données réglementaires officielles.
 * Pure requête SQL gratuite (sans IA ni consommation de crédits).
 *
 * Route Traefik : /api/decode-p10 -> backend:/decode-p10
 */
@RestController
@RequestMapping("/decode-p10")
@RequiredArgsConstructor
@Slf4j
public class DecodeP10Controller {

    private final TariffDecodeService tariffDecodeService;

    @GetMapping(produces = "application/json")
    public ResponseEntity<DecodeResult> decodeCode(
            @RequestParam String code,
            @RequestParam(required = false, defaultValue = "DZ") String zone,
            HttpServletRequest request) {
        tariffDecodeService.checkRateLimit(extractClientIp(request));
        return ResponseEntity.ok(tariffDecodeService.decode(code, zone, true));
    }

    @GetMapping(value = "/compare", produces = "application/json")
    public ResponseEntity<Hs6ComparisonResult> compareHs6(
            @RequestParam String code,
            HttpServletRequest request) {
        tariffDecodeService.checkRateLimit(extractClientIp(request));
        return ResponseEntity.ok(tariffDecodeService.compareHs6(code));
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
