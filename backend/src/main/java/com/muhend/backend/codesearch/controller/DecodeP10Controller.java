package com.muhend.backend.codesearch.controller;

import com.muhend.backend.codesearch.model.DecodeResult;
import com.muhend.backend.codesearch.model.Hs6ComparisonResult;
import com.muhend.backend.codesearch.service.GuestDecodeQuotaService;
import com.muhend.backend.codesearch.service.TariffDecodeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Recherche inverse nationale multi-zones (P10 DZ / NC8 EU) :
 * à partir d'un code (2, 4, 6, 8 ou 10 chiffres), retourne la hiérarchie complète
 * et les données réglementaires officielles.
 * Pure requête SQL gratuite (sans IA ni consommation de crédits).
 * Visiteurs non connectés limités à un aperçu découverte ; illimité sur compte connecté.
 *
 * Route Traefik : /api/decode-p10 -> backend:/decode-p10
 */
@RestController
@RequestMapping("/decode-p10")
@RequiredArgsConstructor
@Slf4j
public class DecodeP10Controller {

    private final TariffDecodeService tariffDecodeService;
    private final GuestDecodeQuotaService guestDecodeQuotaService;

    @GetMapping(value = "/guest-quota", produces = "application/json")
    public ResponseEntity<GuestDecodeQuotaService.DecodeQuotaStatus> getGuestQuota(HttpServletRequest request) {
        if (GuestDecodeQuotaService.isAuthenticatedUser()) {
            return ResponseEntity.ok(new GuestDecodeQuotaService.DecodeQuotaStatus(true, -1, -1, null));
        }
        return ResponseEntity.ok(guestDecodeQuotaService.peekStatus(GuestDecodeQuotaService.extractClientIp(request)));
    }

    @GetMapping(produces = "application/json")
    public ResponseEntity<DecodeResult> decodeCode(
            @RequestParam String code,
            @RequestParam(required = false, defaultValue = "DZ") String zone,
            HttpServletRequest request,
            HttpServletResponse response) {
        tariffDecodeService.checkRateLimit(GuestDecodeQuotaService.extractClientIp(request));
        guestDecodeQuotaService.enforceGuestAccess(request, response);
        return ResponseEntity.ok(tariffDecodeService.decode(code, zone, true));
    }

    @GetMapping(value = "/compare", produces = "application/json")
    public ResponseEntity<Hs6ComparisonResult> compareHs6(
            @RequestParam String code,
            HttpServletRequest request,
            HttpServletResponse response) {
        tariffDecodeService.checkRateLimit(GuestDecodeQuotaService.extractClientIp(request));
        guestDecodeQuotaService.enforceGuestAccess(request, response);
        return ResponseEntity.ok(tariffDecodeService.compareHs6(code));
    }
}
