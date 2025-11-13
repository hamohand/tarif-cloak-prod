package com.muhend.backend.pricing.service;

import com.muhend.backend.pricing.dto.CreateQuoteRequestDto;
import com.muhend.backend.pricing.dto.QuoteRequestDto;
import com.muhend.backend.pricing.model.QuoteRequest;
import com.muhend.backend.pricing.repository.QuoteRequestRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Service pour gérer les demandes de devis.
 */
@Service
@Slf4j
public class QuoteRequestService {
    
    private final QuoteRequestRepository quoteRequestRepository;
    
    public QuoteRequestService(QuoteRequestRepository quoteRequestRepository) {
        this.quoteRequestRepository = quoteRequestRepository;
    }
    
    /**
     * Crée une nouvelle demande de devis.
     */
    @Transactional
    public QuoteRequestDto createQuoteRequest(CreateQuoteRequestDto dto) {
        QuoteRequest quoteRequest = new QuoteRequest();
        quoteRequest.setOrganizationId(dto.getOrganizationId());
        quoteRequest.setContactName(dto.getContactName());
        quoteRequest.setContactEmail(dto.getContactEmail());
        quoteRequest.setMessage(dto.getMessage());
        quoteRequest.setStatus(QuoteRequest.QuoteStatus.PENDING);
        
        QuoteRequest saved = quoteRequestRepository.save(quoteRequest);
        log.info("Nouvelle demande de devis créée: id={}, organizationId={}", saved.getId(), saved.getOrganizationId());
        
        return toDto(saved);
    }
    
    /**
     * Récupère toutes les demandes de devis d'une organisation.
     */
    @Transactional(readOnly = true)
    public List<QuoteRequestDto> getQuoteRequestsByOrganization(Long organizationId) {
        List<QuoteRequest> requests = quoteRequestRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId);
        return requests.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Récupère toutes les demandes de devis (pour les admins).
     */
    @Transactional(readOnly = true)
    public List<QuoteRequestDto> getAllQuoteRequests() {
        List<QuoteRequest> requests = quoteRequestRepository.findAllByOrderByCreatedAtDesc();
        return requests.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Récupère les demandes de devis par statut.
     */
    @Transactional(readOnly = true)
    public List<QuoteRequestDto> getQuoteRequestsByStatus(QuoteRequest.QuoteStatus status) {
        List<QuoteRequest> requests = quoteRequestRepository.findByStatusOrderByCreatedAtDesc(status);
        return requests.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Convertit un QuoteRequest en DTO.
     */
    private QuoteRequestDto toDto(QuoteRequest quoteRequest) {
        QuoteRequestDto dto = new QuoteRequestDto();
        dto.setId(quoteRequest.getId());
        dto.setOrganizationId(quoteRequest.getOrganizationId());
        dto.setContactName(quoteRequest.getContactName());
        dto.setContactEmail(quoteRequest.getContactEmail());
        dto.setMessage(quoteRequest.getMessage());
        dto.setStatus(quoteRequest.getStatus());
        dto.setAdminNotes(quoteRequest.getAdminNotes());
        dto.setCreatedAt(quoteRequest.getCreatedAt());
        dto.setUpdatedAt(quoteRequest.getUpdatedAt());
        dto.setRespondedAt(quoteRequest.getRespondedAt());
        return dto;
    }
}

