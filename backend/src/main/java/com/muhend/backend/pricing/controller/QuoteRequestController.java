package com.muhend.backend.pricing.controller;

import com.muhend.backend.pricing.dto.CreateQuoteRequestDto;
import com.muhend.backend.pricing.dto.QuoteRequestDto;
import com.muhend.backend.pricing.model.QuoteRequest;
import com.muhend.backend.pricing.service.QuoteRequestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller pour gérer les demandes de devis.
 */
@RestController
@RequestMapping("/quote-requests")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Quote Requests", description = "Endpoints pour gérer les demandes de devis personnalisés")
public class QuoteRequestController {
    
    private final QuoteRequestService quoteRequestService;
    
    @PostMapping
    @Operation(
        summary = "Créer une demande de devis",
        description = "Permet à une organisation de demander un devis pour un plan tarifaire personnalisé."
    )
    public ResponseEntity<QuoteRequestDto> createQuoteRequest(@Valid @RequestBody CreateQuoteRequestDto dto) {
        QuoteRequestDto created = quoteRequestService.createQuoteRequest(dto);
        return ResponseEntity.ok(created);
    }
    
    @GetMapping("/organization/{organizationId}")
    @Operation(
        summary = "Récupérer les demandes de devis d'une organisation",
        description = "Retourne toutes les demandes de devis d'une organisation spécifique."
    )
    public ResponseEntity<List<QuoteRequestDto>> getQuoteRequestsByOrganization(@PathVariable Long organizationId) {
        List<QuoteRequestDto> requests = quoteRequestService.getQuoteRequestsByOrganization(organizationId);
        return ResponseEntity.ok(requests);
    }
    
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Récupérer toutes les demandes de devis",
        description = "Retourne toutes les demandes de devis. Réservé aux administrateurs."
    )
    public ResponseEntity<List<QuoteRequestDto>> getAllQuoteRequests() {
        List<QuoteRequestDto> requests = quoteRequestService.getAllQuoteRequests();
        return ResponseEntity.ok(requests);
    }
    
    @GetMapping("/status/{status}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Récupérer les demandes de devis par statut",
        description = "Retourne les demandes de devis filtrées par statut. Réservé aux administrateurs."
    )
    public ResponseEntity<List<QuoteRequestDto>> getQuoteRequestsByStatus(@PathVariable String status) {
        try {
            QuoteRequest.QuoteStatus quoteStatus = QuoteRequest.QuoteStatus.valueOf(status.toUpperCase());
            List<QuoteRequestDto> requests = quoteRequestService.getQuoteRequestsByStatus(quoteStatus);
            return ResponseEntity.ok(requests);
        } catch (IllegalArgumentException e) {
            log.error("Statut invalide: {}", status);
            return ResponseEntity.badRequest().build();
        }
    }
}

