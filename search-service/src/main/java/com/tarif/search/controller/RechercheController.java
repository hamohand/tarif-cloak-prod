package com.tarif.search.controller;

import com.tarif.search.client.BackendClient;
import com.tarif.search.dto.QuotaCheckResponse;
import com.tarif.search.event.SearchEventPublisher;
import com.tarif.search.model.Position;
import com.tarif.search.model.UsageInfo;
import com.tarif.search.service.GuestTrialService;
import com.tarif.search.service.SearchService;
import com.tarif.search.service.SearchService.SearchLevel;
import com.tarif.search.service.ai.AiService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

    private static final String BACKEND_UNAVAILABLE_PREFIX = "BACKEND_UNAVAILABLE:";

    private final SearchService searchService;
    private final AiService aiService;
    private final BackendClient backendClient;
    private final SearchEventPublisher eventPublisher;
    private final GuestTrialService guestTrialService;

    @GetMapping(value = "/sections", produces = "application/json")
    public List<Position> reponseSections(
            @RequestParam String termeRecherche,
            @RequestParam(required = false, defaultValue = "DZ") String zone,
            HttpServletRequest request,
            HttpServletResponse response) {
        return executeSearch(termeRecherche, SearchLevel.SECTIONS, zone, "/recherche/sections", request, response);
    }

    @GetMapping(value = "/chapitres", produces = "application/json")
    public List<Position> reponseChapitres(
            @RequestParam String termeRecherche,
            @RequestParam(required = false, defaultValue = "DZ") String zone,
            HttpServletRequest request,
            HttpServletResponse response) {
        return executeSearch(termeRecherche, SearchLevel.CHAPITRES, zone, "/recherche/chapitres", request, response);
    }

    @GetMapping(value = "/positions4", produces = "application/json")
    public List<Position> reponsePositions4(
            @RequestParam String termeRecherche,
            @RequestParam(required = false, defaultValue = "DZ") String zone,
            HttpServletRequest request,
            HttpServletResponse response) {
        return executeSearch(termeRecherche, SearchLevel.POSITIONS4, zone, "/recherche/positions4", request, response);
    }

    @GetMapping(value = "/positions6", produces = "application/json")
    public List<Position> reponsePositions6(
            @RequestParam String termeRecherche,
            @RequestParam(required = false, defaultValue = "DZ") String zone,
            HttpServletRequest request,
            HttpServletResponse response) {
        return executeSearch(termeRecherche, SearchLevel.POSITIONS6, zone, "/recherche/positions6", request, response);
    }

    @GetMapping(value = {"/positions10", "/positions-nationales"}, produces = "application/json")
    public List<Position> reponsePositions10(
            @RequestParam String termeRecherche,
            @RequestParam(required = false, defaultValue = "DZ") String zone,
            HttpServletRequest request,
            HttpServletResponse response) {
        return executeSearch(termeRecherche, SearchLevel.POSITIONS10, zone, "/recherche/positions10", request, response);
    }

    @GetMapping(value = "/guest-quota", produces = "application/json")
    public ResponseEntity<GuestTrialService.TrialStatus> getGuestQuota(HttpServletRequest request) {
        return ResponseEntity.ok(guestTrialService.peekStatus(extractClientIp(request)));
    }

    private List<Position> executeSearch(
            String termeRecherche,
            SearchLevel level,
            String zone,
            String endpoint,
            HttpServletRequest request,
            HttpServletResponse response) {
        log.info("Requête {} pour '{}' (zone: {})", endpoint, termeRecherche, zone);
        boolean searchExecuted = false;
        QuotaCheckResponse quotaCheck = null;
        String currentUserId = getCurrentUserId();
        boolean isAuthenticated = currentUserId != null;
        String clientIp = extractClientIp(request);

        try {
            if (isAuthenticated) {
                quotaCheck = checkQuota();
            } else {
                if (level != SearchLevel.POSITIONS6 && level != SearchLevel.POSITIONS10) {
                    throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentification requise.");
                }
                GuestTrialService.TrialStatus trial = guestTrialService.tryConsumeTrial(clientIp);
                if (!trial.allowed()) {
                    throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, trial.reason());
                }
                if (response != null) {
                    response.setHeader("X-Guest-Trials-Remaining", String.valueOf(trial.remaining()));
                    response.setHeader("X-Guest-Search-Pass", guestTrialService.issueEnrichmentPass(clientIp));
                }
            }

            List<Position> result = searchService.search(termeRecherche, level, zone);
            searchExecuted = true;

            return result != null ? result : new ArrayList<>();

        } catch (QuotaExceededException e) {
            log.warn("Quota dépassé: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, e.getMessage());
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Erreur lors de la recherche: {}", e.getMessage(), e);
            return new ArrayList<>();
        } finally {
            if (searchExecuted) {
                publishSearchEvent(endpoint, termeRecherche, quotaCheck, currentUserId, clientIp);
            }
            aiService.clearCurrentUsage();
        }
    }

    private QuotaCheckResponse checkQuota() {
        String authHeader = getAuthorizationHeader();
        QuotaCheckResponse response = backendClient.checkQuota(authHeader);

        if (response == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Service de vérification des quotas temporairement indisponible.");
        }

        if (!response.isCanSearch()) {
            String message = response.getMessage();
            if (message != null && message.startsWith(BACKEND_UNAVAILABLE_PREFIX)) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        message.substring(BACKEND_UNAVAILABLE_PREFIX.length()).trim());
            }
            throw new QuotaExceededException(message != null ? message : "Quota dépassé");
        }

        log.debug("Quota OK - Usage: {}/{}", response.getCurrentUsage(), response.getMonthlyQuota());
        return response;
    }

    private void publishSearchEvent(String endpoint, String searchTerm, QuotaCheckResponse quotaCheck,
                                    String userId, String clientIp) {
        try {
            UsageInfo usageInfo = aiService.getCurrentUsage();
            int tokens = usageInfo != null ? usageInfo.getTokens() : 0;
            String effectiveUserId = userId != null ? userId : "guest:" + clientIp;
            Long organizationId = (userId != null && quotaCheck != null) ? quotaCheck.getOrganizationId() : null;
            Double cost = userId != null
                    ? determineCost(quotaCheck, usageInfo)
                    : (usageInfo != null ? usageInfo.getCostUsd() : 0.0);

            eventPublisher.publishSearchCompleted(
                    effectiveUserId,
                    organizationId,
                    endpoint,
                    searchTerm,
                    tokens,
                    cost
            );
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
                    : (usageInfo != null ? usageInfo.getCostUsd() : 0.0);
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
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }

    public static class QuotaExceededException extends RuntimeException {
        public QuotaExceededException(String message) {
            super(message);
        }
    }
}
