package com.tarif.search.controller;

import com.tarif.search.client.BackendClient;
import com.tarif.search.dto.QuotaCheckResponse;
import com.tarif.search.event.SearchEventPublisher;
import com.tarif.search.model.Position;
import com.tarif.search.model.UsageInfo;
import com.tarif.search.service.SearchService;
import com.tarif.search.service.SearchService.SearchLevel;
import com.tarif.search.service.ai.AiService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/recherche")
@RequiredArgsConstructor
@Slf4j
public class RechercheController {

    private final SearchService searchService;
    private final AiService aiService;
    private final BackendClient backendClient;
    private final SearchEventPublisher eventPublisher;

    @GetMapping(value = "/sections", produces = "application/json")
    public List<Position> reponseSections(@RequestParam String termeRecherche) {
        return executeSearch(termeRecherche, SearchLevel.SECTIONS, "/recherche/sections");
    }

    @GetMapping(value = "/chapitres", produces = "application/json")
    public List<Position> reponseChapitres(@RequestParam String termeRecherche) {
        return executeSearch(termeRecherche, SearchLevel.CHAPITRES, "/recherche/chapitres");
    }

    @GetMapping(value = "/positions4", produces = "application/json")
    public List<Position> reponsePositions4(@RequestParam String termeRecherche) {
        return executeSearch(termeRecherche, SearchLevel.POSITIONS4, "/recherche/positions4");
    }

    @GetMapping(value = "/positions6", produces = "application/json")
    public List<Position> reponsePositions6(@RequestParam String termeRecherche) {
        return executeSearch(termeRecherche, SearchLevel.POSITIONS6, "/recherche/positions6");
    }

    private List<Position> executeSearch(String termeRecherche, SearchLevel level, String endpoint) {
        log.info("Requête {} pour '{}'", endpoint, termeRecherche);
        boolean searchExecuted = false;
        QuotaCheckResponse quotaCheck = null;

        try {
            // Vérifier le quota via le backend
            quotaCheck = checkQuota();

            // Exécuter la recherche
            List<Position> result = searchService.search(termeRecherche, level);
            searchExecuted = true;

            return result != null ? result : new ArrayList<>();

        } catch (QuotaExceededException e) {
            log.warn("Quota dépassé: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, e.getMessage());
        } catch (Exception e) {
            log.error("Erreur lors de la recherche: {}", e.getMessage(), e);
            return new ArrayList<>();
        } finally {
            if (searchExecuted) {
                publishSearchEvent(endpoint, termeRecherche, quotaCheck);
            }
            aiService.clearCurrentUsage();
        }
    }

    private QuotaCheckResponse checkQuota() {
        String authHeader = getAuthorizationHeader();
        QuotaCheckResponse response = backendClient.checkQuota(authHeader);

        if (response == null) {
            log.warn("Réponse quota null - Mode dégradé");
            return QuotaCheckResponse.builder().canSearch(true).quotaOk(true).build();
        }

        if (!response.isCanSearch()) {
            throw new QuotaExceededException(response.getMessage() != null
                    ? response.getMessage()
                    : "Quota dépassé");
        }

        if (!response.isQuotaOk() && !response.isCanUsePayPerRequest()) {
            throw new QuotaExceededException("Quota mensuel dépassé. Aucun plan pay-per-request disponible.");
        }

        log.debug("Quota OK - Usage: {}/{}", response.getCurrentUsage(), response.getMonthlyQuota());
        return response;
    }

    private void publishSearchEvent(String endpoint, String searchTerm, QuotaCheckResponse quotaCheck) {
        try {
            String userId = getCurrentUserId();
            UsageInfo usageInfo = aiService.getCurrentUsage();

            if (userId != null && usageInfo != null) {
                Long organizationId = quotaCheck != null ? quotaCheck.getOrganizationId() : null;
                Double cost = determineCost(quotaCheck, usageInfo);

                eventPublisher.publishSearchCompleted(
                        userId,
                        organizationId,
                        endpoint,
                        searchTerm,
                        usageInfo.getTokens(),
                        cost
                );
            }
        } catch (Exception e) {
            log.warn("Erreur publication événement (non bloquant): {}", e.getMessage());
        }
    }

    private Double determineCost(QuotaCheckResponse quotaCheck, UsageInfo usageInfo) {
        if (quotaCheck == null) {
            return null;
        }

        // Si quota dépassé et pay-per-request disponible
        if (!quotaCheck.isQuotaOk() && quotaCheck.isCanUsePayPerRequest()) {
            return quotaCheck.getPayPerRequestPrice() != null
                    ? quotaCheck.getPayPerRequestPrice().doubleValue()
                    : usageInfo.getCostUsd();
        }

        // Plan mensuel standard : pas de facturation par requête
        return null;
    }

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            return jwt.getClaimAsString("sub");
        }
        return null;
    }

    private String getAuthorizationHeader() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            return "Bearer " + jwt.getTokenValue();
        }
        return "";
    }

    public static class QuotaExceededException extends RuntimeException {
        public QuotaExceededException(String message) {
            super(message);
        }
    }
}
