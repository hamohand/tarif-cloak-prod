package com.muhend.backend.codesearch.controller;

import com.muhend.backend.codesearch.model.DecodeResult;
import com.muhend.backend.codesearch.service.GuestDecodeQuotaService;
import com.muhend.backend.codesearch.service.TariffDecodeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Recherche inverse HS (2, 4 ou 6 chiffres) :
 * retourne la hiérarchie complète (Section -> Chapitre -> Position4 -> Position6).
 * Pure requête SQL gratuite (sans IA ni consommation de crédits).
 * Visiteurs non connectés limités à un aperçu découverte ; illimité sur compte connecté.
 *
 * Route Traefik : /api/decode -> backend:/decode
 */
@RestController
@RequestMapping("/decode")
@RequiredArgsConstructor
@Slf4j
public class DecodeController {

    private final TariffDecodeService tariffDecodeService;
    private final GuestDecodeQuotaService guestDecodeQuotaService;

    @GetMapping(produces = "application/json")
    public ResponseEntity<DecodeResult> decodeCode(
            @RequestParam String code,
            @RequestParam(required = false, defaultValue = "DZ") String zone,
            HttpServletRequest request,
            HttpServletResponse response) {
        tariffDecodeService.checkRateLimit(GuestDecodeQuotaService.extractClientIp(request));
        guestDecodeQuotaService.enforceGuestAccess(request, response);
        return ResponseEntity.ok(tariffDecodeService.decode(code, zone, false));
    }
}
