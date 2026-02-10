package com.tarif.search.controller;

import com.tarif.search.service.ai.AnthropicBatchService;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Contrôleur REST pour gérer les recherches de codes HS par lots (batch).
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

    private final AnthropicBatchService batchService;

    public BatchSearchController(AnthropicBatchService batchService) {
        this.batchService = batchService;
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

        // Convertir les requêtes en format attendu par le service
        List<AnthropicBatchService.SearchRequest> searchRequests = new ArrayList<>();
        for (SearchItem item : request.getSearches()) {
            AnthropicBatchService.SearchRequest searchRequest = AnthropicBatchService.SearchRequest.builder()
                .customId(item.getCustomId())
                .searchTerm(item.getSearchTerm())
                .ragContext(item.getRagContext())
                .build();
            searchRequests.add(searchRequest);
        }

        // Créer le batch
        String batchId = batchService.createBatch(searchRequests);

        if (batchId != null) {
            log.info("Batch créé avec succès: {}", batchId);
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

        AnthropicBatchService.BatchStatus status = batchService.getBatchStatus(batchId);

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
    }

    /**
     * Récupère les résultats d'un batch terminé.
     *
     * @param batchId L'ID du batch
     * @return La liste des résultats ou une erreur si le batch n'est pas terminé
     */
    @GetMapping("/results/{batchId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<BatchResultsResponse> getBatchResults(@PathVariable String batchId) {
        log.debug("Demande de résultats pour le batch: {}", batchId);

        // Récupérer d'abord le statut pour obtenir l'URL des résultats
        AnthropicBatchService.BatchStatus status = batchService.getBatchStatus(batchId);

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
                .body(new BatchResultsResponse(batchId, null, "URL de résultats non disponible"));
        }

        // Récupérer les résultats
        List<AnthropicBatchService.BatchResult> results = batchService.getBatchResults(status.getResultsUrl());

        if (results != null) {
            BatchResultsResponse response = new BatchResultsResponse(
                batchId,
                results,
                "Résultats récupérés avec succès"
            );
            response.setTotalResults(results.size());
            response.setSuccessCount((int) results.stream().filter(AnthropicBatchService.BatchResult::isSuccess).count());
            response.setErrorCount((int) results.stream().filter(r -> !r.isSuccess()).count());

            log.info("Résultats récupérés pour le batch {}: {} résultats ({} succès, {} erreurs)",
                    batchId, results.size(), response.getSuccessCount(), response.getErrorCount());

            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new BatchResultsResponse(batchId, null, "Erreur lors de la récupération des résultats"));
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
    }

    /**
     * Construit un message de statut lisible.
     */
    private String buildStatusMessage(AnthropicBatchService.BatchStatus status) {
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

    // ========================================================================================
    // DTOs (Data Transfer Objects)
    // ========================================================================================

    /**
     * Requête pour soumettre un batch de recherches.
     */
    @Data
    public static class BatchSearchRequest {
        private List<SearchItem> searches;
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
        private List<AnthropicBatchService.BatchResult> results;
        private String message;
        private Integer totalResults;
        private Integer successCount;
        private Integer errorCount;

        public BatchResultsResponse(String batchId, List<AnthropicBatchService.BatchResult> results, String message) {
            this.batchId = batchId;
            this.results = results;
            this.message = message;
        }
    }
}
