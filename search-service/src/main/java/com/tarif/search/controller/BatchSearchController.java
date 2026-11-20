package com.tarif.search.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarif.search.model.Position;
import com.tarif.search.model.Position10Dz;
import com.tarif.search.service.Position10DzService;
import com.tarif.search.service.Position6DzService;
import com.tarif.search.service.TariffPositionService;
import com.tarif.search.service.ai.JsonUtils;
import com.tarif.search.service.ai.batch.BatchOwnershipService;
import com.tarif.search.service.ai.batch.BatchService;
import com.tarif.search.service.ai.batch.models.BatchResult;
import com.tarif.search.service.ai.batch.models.BatchStatus;
import com.tarif.search.service.ai.batch.models.SearchRequest;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.text.Normalizer;
import java.util.*;

/**
 * Contrôleur REST pour gérer les recherches de codes HS par lots (batch).
 * Supporte plusieurs providers AI (Anthropic, OpenAI) via le BatchService orchestrateur.
 *
 * Endpoints disponibles :
 * - POST /batch-search/submit : Soumettre un batch de recherches
 * - GET /batch-search/status/{batchId} : Vérifier le statut d'un batch
 * - GET /batch-search/results/{batchId} : Récupérer les résultats d'un batch terminé
 * - POST /batch-search/cancel/{batchId} : Annuler un batch en cours
 */
@RestController
@RequestMapping("/batch-search")
@Slf4j
public class BatchSearchController {

    private final BatchService batchService;
    private final Position6DzService position6DzService;
    private final Position10DzService position10DzService;
    private final TariffPositionService tariffPositionService;
    private final BatchOwnershipService batchOwnershipService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public BatchSearchController(
            BatchService batchService,
            Position6DzService position6DzService,
            Position10DzService position10DzService,
            TariffPositionService tariffPositionService,
            BatchOwnershipService batchOwnershipService) {
        this.batchService = batchService;
        this.position6DzService = position6DzService;
        this.position10DzService = position10DzService;
        this.tariffPositionService = tariffPositionService;
        this.batchOwnershipService = batchOwnershipService;
    }

    public BatchSearchController(
            BatchService batchService,
            Position6DzService position6DzService,
            Position10DzService position10DzService,
            TariffPositionService tariffPositionService) {
        this(batchService, position6DzService, position10DzService, tariffPositionService, null);
    }

    public BatchSearchController(BatchService batchService) {
        this(batchService, null, null, null, null);
    }

    /**
     * Soumet un batch de recherches de codes HS.
     *
     * Exemple de requête :
     * POST /batch-search/submit
     * {
     *   "searches": [
     *     {
     *       "customId": "search-1",
     *       "searchTerm": "Pommes fraîches",
     *       "ragContext": "RAG pour la recherche des : POSITIONS6\n\n - Code = 0808 10 -..."
     *     }
     *   ]
     * }
     *
     * @param request La requête contenant les recherches à traiter
     * @return La réponse avec l'ID du batch créé
     */
    @PostMapping("/submit")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BatchSubmitResponse> submitBatchSearch(@RequestBody BatchSearchRequest request) {
        log.info("Réception d'une demande de batch avec {} recherches",
                request.getSearches() != null ? request.getSearches().size() : 0);

        if (request.getSearches() == null || request.getSearches().isEmpty()) {
            return ResponseEntity.badRequest()
                .body(new BatchSubmitResponse(null, "Erreur: Liste de recherches vide", HttpStatus.BAD_REQUEST.value()));
        }

        // Limiter le nombre de recherches par batch
        if (request.getSearches().size() > 1000) {
            return ResponseEntity.badRequest()
                .body(new BatchSubmitResponse(null, "Erreur: Maximum 1000 recherches par batch", HttpStatus.BAD_REQUEST.value()));
        }

        String normZone = "EU".equalsIgnoreCase(request.getZone()) ? "EU" : "DZ";
        String normEndpoint = "positions10".equalsIgnoreCase(request.getEndpoint()) ? "positions10" : "positions6";
        String targetLevel = "positions10".equals(normEndpoint)
                ? "POSITIONS10"
                : "POSITIONS6";

        // Convertir les requêtes en format attendu par le service
        List<SearchRequest> searchRequests = new ArrayList<>();
        Map<String, String> searchTermsMap = new LinkedHashMap<>();
        for (SearchItem item : request.getSearches()) {
            SearchRequest searchRequest = SearchRequest.builder()
                .customId(item.getCustomId())
                .searchTerm(item.getSearchTerm())
                .ragContext(item.getRagContext())
                .targetLevel(targetLevel)
                .zone(normZone)
                .build();
            searchRequests.add(searchRequest);
            if (item.getCustomId() != null && item.getSearchTerm() != null) {
                searchTermsMap.put(item.getCustomId(), item.getSearchTerm());
            }
        }

        // Créer le batch via le provider actif
        try {
            String batchId = batchService.createBatch(searchRequests);

            if (batchId != null) {
                String currentUserId = getCurrentUserId();
                if (batchOwnershipService != null && currentUserId != null) {
                    batchOwnershipService.registerBatch(batchId, currentUserId, normEndpoint, normZone, searchTermsMap);
                }
                log.info("Batch créé avec succès: {} (user: {}, provider: {}, targetLevel: {}, zone: {})",
                        batchId, currentUserId, batchService.getActiveProviderName(), targetLevel, normZone);
                return ResponseEntity.ok(new BatchSubmitResponse(
                    batchId,
                    "Batch créé avec succès. Utilisez l'ID pour suivre le statut.",
                    HttpStatus.OK.value()
                ));
            } else {
                log.error("Échec de la création du batch");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new BatchSubmitResponse(null, "Erreur lors de la création du batch", HttpStatus.INTERNAL_SERVER_ERROR.value()));
            }

        } catch (UnsupportedOperationException e) {
            log.error("Opération batch non supportée: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                .body(new BatchSubmitResponse(null,
                    "Le provider actuel ne supporte pas les opérations batch",
                    HttpStatus.NOT_IMPLEMENTED.value()));
        }
    }

    /**
     * Retourne uniquement la liste des batches soumis par l'utilisateur connecté.
     */
    @GetMapping("/my-batches")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<UserBatchSummary>> getMyBatches() {
        String currentUserId = getCurrentUserId();
        if (currentUserId == null || batchOwnershipService == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        List<UserBatchSummary> summaries = batchOwnershipService.listUserBatches(currentUserId)
                .stream()
                .map(r -> new UserBatchSummary(
                        r.batchId(),
                        r.submittedAt(),
                        r.endpoint(),
                        r.zone(),
                        r.searchTerms()
                ))
                .toList();
        return ResponseEntity.ok(summaries);
    }

    /**
     * Récupère le statut d'un batch.
     *
     * @param batchId L'ID du batch
     * @return Le statut du batch avec les compteurs de requêtes
     */
    @GetMapping("/status/{batchId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BatchStatusResponse> getBatchStatus(@PathVariable String batchId) {
        log.debug("Demande de statut pour le batch: {}", batchId);

        if (!isAuthorizedForBatch(batchId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        try {
            BatchStatus status = batchService.getBatchStatus(batchId);

            if (status != null) {
                BatchStatusResponse response = new BatchStatusResponse();
                response.setBatchId(status.getId());
                response.setStatus(status.getProcessingStatus());
                response.setRequestCounts(status.getRequestCounts());
                response.setCreatedAt(status.getCreatedAt());
                response.setEndedAt(status.getEndedAt());
                response.setResultsAvailable(status.isEnded() && status.getResultsUrl() != null);
                response.setMessage(buildStatusMessage(status));

                return ResponseEntity.ok(response);
            } else {
                log.error("Impossible de récupérer le statut du batch: {}", batchId);
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(null);
            }

        } catch (UnsupportedOperationException e) {
            log.error("Opération batch non supportée: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        }
    }

    /**
     * Récupère les résultats d'un batch terminé.
     *
     * @param batchId L'ID du batch
     * @return La liste des résultats ou une erreur si le batch n'est pas terminé
     */
    @GetMapping("/results/{batchId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BatchResultsResponse> getBatchResults(
            @PathVariable String batchId,
            @RequestParam(required = false) String endpoint,
            @RequestParam(required = false) String zone) {
        log.debug("Demande de résultats pour le batch: {} (endpoint={}, zone={})", batchId, endpoint, zone);

        if (!isAuthorizedForBatch(batchId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new BatchResultsResponse(batchId, null, "Accès refusé à ce batch"));
        }

        BatchOwnershipService.BatchOwnerRecord ownerRecord =
                batchOwnershipService != null ? batchOwnershipService.findBatch(batchId) : null;
        String effectiveEndpoint = (endpoint != null && !endpoint.isBlank())
                ? endpoint
                : (ownerRecord != null && ownerRecord.endpoint() != null ? ownerRecord.endpoint() : "positions6");
        String effectiveZone = (zone != null && !zone.isBlank())
                ? zone
                : (ownerRecord != null && ownerRecord.zone() != null ? ownerRecord.zone() : "DZ");

        try {
            // Récupérer d'abord le statut pour vérifier que le batch est terminé
            BatchStatus status = batchService.getBatchStatus(batchId);

            if (status == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new BatchResultsResponse(batchId, null, "Batch introuvable"));
            }

            if (!status.isEnded()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new BatchResultsResponse(
                        batchId,
                        null,
                        "Le batch n'est pas encore terminé. Statut: " + status.getProcessingStatus()
                    ));
            }

            if (status.getResultsUrl() == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new BatchResultsResponse(batchId, null, "Résultats non disponibles"));
            }

            // Récupérer les résultats via le provider actif (prend batchId, pas resultsUrl)
            List<BatchResult> results = batchService.getBatchResults(batchId);

            if (results != null) {
                enrichAndNormalizeResults(results, effectiveEndpoint, effectiveZone);

                BatchResultsResponse response = new BatchResultsResponse(
                    batchId,
                    results,
                    "Résultats récupérés avec succès"
                );
                response.setTotalResults(results.size());
                response.setSuccessCount((int) results.stream().filter(BatchResult::isSuccess).count());
                response.setErrorCount((int) results.stream().filter(r -> !r.isSuccess()).count());

                log.info("Résultats récupérés pour le batch {}: {} résultats ({} succès, {} erreurs)",
                        batchId, results.size(), response.getSuccessCount(), response.getErrorCount());

                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new BatchResultsResponse(batchId, null, "Erreur lors de la récupération des résultats"));
            }

        } catch (UnsupportedOperationException e) {
            log.error("Opération batch non supportée: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        }
    }

    /**
     * Annule un batch en cours de traitement.
     *
     * @param batchId L'ID du batch à annuler
     * @return Le résultat de l'annulation
     */
    @PostMapping("/cancel/{batchId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> cancelBatch(@PathVariable String batchId) {
        log.info("Demande d'annulation du batch: {}", batchId);

        if (!isAuthorizedForBatch(batchId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                            "batchId", batchId,
                            "canceled", false,
                            "message", "Accès refusé à ce batch"
                    ));
        }

        try {
            boolean success = batchService.cancelBatch(batchId);

            Map<String, Object> response = new HashMap<>();
            response.put("batchId", batchId);
            response.put("canceled", success);
            response.put("message", success ? "Batch annulé avec succès" : "Échec de l'annulation du batch");

            if (success) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
            }

        } catch (UnsupportedOperationException e) {
            log.error("Opération batch non supportée: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        }
    }

    /**
     * Construit un message de statut lisible.
     */
    private String buildStatusMessage(BatchStatus status) {
        if (status.isEnded()) {
            Map<String, Integer> counts = status.getRequestCounts();
            int total = counts.values().stream().mapToInt(Integer::intValue).sum();
            int succeeded = counts.getOrDefault("succeeded", 0);
            int errored = counts.getOrDefault("errored", 0);

            return String.format("Batch terminé: %d/%d succès, %d erreurs", succeeded, total, errored);
        } else if (status.isInProgress()) {
            Map<String, Integer> counts = status.getRequestCounts();
            int processing = counts.getOrDefault("processing", 0);
            int succeeded = counts.getOrDefault("succeeded", 0);

            return String.format("Batch en cours: %d en traitement, %d terminées", processing, succeeded);
        } else {
            return "Statut: " + status.getProcessingStatus();
        }
    }

    private void enrichAndNormalizeResults(List<BatchResult> results, String endpoint, String zone) {
        if (results == null || results.isEmpty()) {
            return;
        }
        boolean isPos10 = "positions10".equalsIgnoreCase(endpoint);
        String normZone = "EU".equalsIgnoreCase(zone) ? "EU" : "DZ";

        for (BatchResult res : results) {
            if (res == null || !res.isSuccess() || res.getContent() == null || res.getContent().isBlank()) {
                continue;
            }
            try {
                String cleaned = JsonUtils.cleanJsonString(res.getContent());
                List<Position> parsed = JsonUtils.conversionReponseIaToList(cleaned);
                if (parsed == null || parsed.isEmpty()) {
                    continue;
                }
                List<Position> normalized = new ArrayList<>();
                Set<String> seen = new LinkedHashSet<>();

                for (Position p : parsed) {
                    if (p == null || p.getCode() == null) {
                        continue;
                    }
                    Position resolved = resolveBatchPosition(p, isPos10, normZone);
                    if (resolved != null && resolved.getCode() != null && !resolved.getCode().isBlank()
                            && seen.add(resolved.getCode())) {
                        normalized.add(resolved);
                    }
                }

                if (!normalized.isEmpty()) {
                    res.setContent(objectMapper.writeValueAsString(Map.of("items", normalized)));
                }
            } catch (Exception e) {
                log.debug("Enrichissement batch ignoré pour customId={}: {}", res.getCustomId(), e.getMessage());
            }
        }
    }

    private Position resolveBatchPosition(Position raw, boolean isPos10, String zone) {
        String digits = raw.getCode() != null ? raw.getCode().replaceAll("[^0-9]", "") : "";
        if (digits.isEmpty()) {
            return null;
        }
        String justif = raw.getJustification();

        if (!isPos10) {
            String hs6 = digits.length() > 6 ? digits.substring(0, 6) : digits;
            String desc = lookupHs6Description(zone, hs6);
            return new Position(hs6, desc, justif);
        }

        // Mode POSITIONS10 : NC8 (8 chiffres en EU) ou P10 (10 chiffres en DZ)
        boolean isEu = "EU".equals(zone);
        int targetLen = isEu ? 8 : 10;

        if (digits.length() == targetLen) {
            String exactDesc = lookupLeafDescription(zone, digits);
            if (exactDesc != null && !exactDesc.isBlank()) {
                return new Position(digits, exactDesc, justif);
            }
        }

        if (!isEu && digits.length() == 8) {
            String padded10 = digits + "00";
            String paddedDesc = lookupLeafDescription("DZ", padded10);
            if (paddedDesc != null && !paddedDesc.isBlank()) {
                return new Position(padded10, paddedDesc, justif);
            }
        }

        if (digits.length() >= 6) {
            String hs6 = digits.substring(0, 6);
            List<Position> leaves = getSelectableLeavesForHs6(zone, hs6, targetLen);
            if (leaves.size() == 1) {
                Position only = leaves.get(0);
                return new Position(only.getCode(), only.getDescription(), justif);
            }
            if (leaves.size() > 1) {
                Position matched = matchBestLeaf(leaves, justif);
                if (matched != null) {
                    return new Position(matched.getCode(), matched.getDescription(), justif);
                }
            }
            String hs6Desc = lookupHs6Description(zone, hs6);
            if (hs6Desc != null && !hs6Desc.isBlank()) {
                return new Position(hs6, hs6Desc, justif);
            }
        }

        String fallbackDesc = raw.getDescription();
        return new Position(digits, fallbackDesc, justif);
    }

    private String lookupHs6Description(String zone, String hs6) {
        if (hs6 == null || hs6.length() < 6) {
            return null;
        }
        String desc = position6DzService != null ? position6DzService.getDescription(hs6) : null;
        if ((desc == null || desc.isBlank()) && tariffPositionService != null) {
            desc = tariffPositionService.getHs6Description(zone, hs6);
        }
        return desc;
    }

    private String lookupLeafDescription(String zone, String code) {
        String desc = tariffPositionService != null ? tariffPositionService.getDescription(zone, code) : null;
        if ((desc == null || desc.isBlank()) && "DZ".equals(zone) && position10DzService != null) {
            desc = position10DzService.getDescription(code);
        }
        return desc;
    }

    private List<Position> getSelectableLeavesForHs6(String zone, String hs6, int targetLen) {
        List<Position> rawRows = new ArrayList<>();
        if (tariffPositionService != null) {
            rawRows = tariffPositionService.getContextPositionsForHs6(zone, hs6);
        }
        if (rawRows.isEmpty() && "DZ".equals(zone) && position10DzService != null) {
            for (Position10Dz p10 : position10DzService.getPosition10DzsWithContextByPrefix(hs6 + "%")) {
                rawRows.add(new Position(p10.getCode(), p10.getDescription()));
            }
        }
        List<Position> leaves = new ArrayList<>();
        for (Position row : rawRows) {
            if (row == null || row.getCode() == null) continue;
            String clean = row.getCode().replaceAll("[^0-9]", "");
            if (clean.length() == targetLen) {
                leaves.add(new Position(clean, row.getDescription()));
            }
        }
        return leaves;
    }

    private Position matchBestLeaf(List<Position> leaves, String contextText) {
        Set<String> queryTokens = tokenizeForMatch(contextText);
        Position best = null;
        int bestScore = 0;
        int secondBest = 0;

        for (Position leaf : leaves) {
            Set<String> leafTokens = tokenizeForMatch(leaf.getDescription());
            int score = 0;
            for (String token : queryTokens) {
                if (leafTokens.contains(token)) {
                    score++;
                }
            }
            if (score > bestScore) {
                secondBest = bestScore;
                bestScore = score;
                best = leaf;
            } else if (score > secondBest) {
                secondBest = score;
            }
        }

        if (bestScore >= 1 && bestScore > secondBest) {
            return best;
        }

        // Si exactement 2 subdivisions dont une résiduelle "Autres" et aucun mot-clé spécifique ne matche l'autre
        if (leaves.size() == 2 && bestScore == 0) {
            Position autresLeaf = null;
            int autresCount = 0;
            for (Position leaf : leaves) {
                String cleanedDesc = normalizeText(leaf.getDescription());
                if ("autres".equals(cleanedDesc)) {
                    autresLeaf = leaf;
                    autresCount++;
                }
            }
            if (autresCount == 1) {
                return autresLeaf;
            }
        }

        return null;
    }

    private Set<String> tokenizeForMatch(String text) {
        String norm = normalizeText(text);
        if (norm.isEmpty()) {
            return Collections.emptySet();
        }
        Set<String> stopWords = Set.of("les", "des", "aux", "dans", "pour", "par", "sur", "avec", "sans", "autres", "autre", "que", "qui", "une", "son", "ses", "code", "chapitre", "position", "sous");
        Set<String> tokens = new HashSet<>();
        for (String part : norm.split("\\s+")) {
            if (part.length() >= 4 && !stopWords.contains(part)) {
                tokens.add(part);
            }
        }
        return tokens;
    }

    private String normalizeText(String text) {
        if (text == null) {
            return "";
        }
        return Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    private boolean isAuthorizedForBatch(String batchId) {
        if (batchOwnershipService == null) {
            return true;
        }
        String currentUserId = getCurrentUserId();
        if (currentUserId == null || !batchOwnershipService.isOwnedBy(batchId, currentUserId)) {
            log.warn("Accès refusé au batch {} pour l'utilisateur {}", batchId, currentUserId);
            return false;
        }
        return true;
    }

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }
        if (auth.getPrincipal() instanceof Jwt jwt) {
            String sub = jwt.getClaimAsString("sub");
            if (sub != null && !sub.isBlank()) {
                return sub.trim();
            }
        }
        String name = auth.getName();
        if (name != null && !name.isBlank() && !"anonymousUser".equalsIgnoreCase(name)) {
            return name.trim();
        }
        return null;
    }

    // ========================================================================================
    // DTOs (Data Transfer Objects)
    // ========================================================================================

    /**
     * Résumé d'un batch appartenant à l'utilisateur connecté.
     */
    @Data
    public static class UserBatchSummary {
        private String batchId;
        private String submittedAt;
        private String endpoint;
        private String zone;
        private Map<String, String> searchTerms;

        public UserBatchSummary(
                String batchId,
                String submittedAt,
                String endpoint,
                String zone,
                Map<String, String> searchTerms) {
            this.batchId = batchId;
            this.submittedAt = submittedAt;
            this.endpoint = endpoint;
            this.zone = zone;
            this.searchTerms = searchTerms;
        }
    }

    /**
     * Requête pour soumettre un batch de recherches.
     */
    @Data
    public static class BatchSearchRequest {
        private List<SearchItem> searches;
        private String endpoint; // "positions6" ou "positions10"
        private String zone;     // "DZ" ou "EU"
    }

    /**
     * Item de recherche individuel.
     */
    @Data
    public static class SearchItem {
        private String customId;
        private String searchTerm;
        private String ragContext;
    }

    /**
     * Réponse lors de la soumission d'un batch.
     */
    @Data
    public static class BatchSubmitResponse {
        private String batchId;
        private String message;
        private Integer statusCode;

        public BatchSubmitResponse(String batchId, String message, Integer statusCode) {
            this.batchId = batchId;
            this.message = message;
            this.statusCode = statusCode;
        }
    }

    /**
     * Réponse pour le statut d'un batch.
     */
    @Data
    public static class BatchStatusResponse {
        private String batchId;
        private String status;
        private Map<String, Integer> requestCounts;
        private String createdAt;
        private String endedAt;
        private Boolean resultsAvailable;
        private String message;
    }

    /**
     * Réponse contenant les résultats d'un batch.
     */
    @Data
    public static class BatchResultsResponse {
        private String batchId;
        private List<BatchResult> results;
        private String message;
        private Integer totalResults;
        private Integer successCount;
        private Integer errorCount;

        public BatchResultsResponse(String batchId, List<BatchResult> results, String message) {
            this.batchId = batchId;
            this.results = results;
            this.message = message;
        }
    }
}
