package com.muhend.backend.invoice.service;

import com.muhend.backend.invoice.dto.InvoiceDto;
import com.muhend.backend.invoice.dto.InvoiceItemDto;
import com.muhend.backend.invoice.model.Invoice;
import com.muhend.backend.invoice.model.InvoiceItem;
import com.muhend.backend.invoice.repository.InvoiceItemRepository;
import com.muhend.backend.invoice.repository.InvoiceRepository;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.service.OrganizationService;
import com.muhend.backend.usage.model.UsageLog;
import com.muhend.backend.usage.repository.UsageLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service pour gérer les factures.
 * Phase 5 MVP : Facturation
 */
@Service
@Slf4j
public class InvoiceService {
    
    private final InvoiceRepository invoiceRepository;
    private final InvoiceItemRepository invoiceItemRepository;
    private final UsageLogRepository usageLogRepository;
    private final OrganizationService organizationService;
    
    private static final DateTimeFormatter INVOICE_NUMBER_FORMAT = DateTimeFormatter.ofPattern("yyyyMM");
    
    public InvoiceService(
            InvoiceRepository invoiceRepository,
            InvoiceItemRepository invoiceItemRepository,
            UsageLogRepository usageLogRepository,
            OrganizationService organizationService) {
        this.invoiceRepository = invoiceRepository;
        this.invoiceItemRepository = invoiceItemRepository;
        this.usageLogRepository = usageLogRepository;
        this.organizationService = organizationService;
    }
    
    /**
     * Génère une facture mensuelle pour une organisation.
     * 
     * @param organizationId ID de l'organisation
     * @param year Année
     * @param month Mois (1-12)
     * @return La facture générée
     */
    @Transactional
    public InvoiceDto generateMonthlyInvoice(Long organizationId, int year, int month) {
        // Vérifier que l'organisation existe
        OrganizationDto organization = organizationService.getOrganizationById(organizationId);
        if (organization == null) {
            throw new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId);
        }
        
        // Calculer les dates de la période
        YearMonth yearMonth = YearMonth.of(year, month);
        LocalDate periodStart = yearMonth.atDay(1);
        LocalDate periodEnd = yearMonth.atEndOfMonth();
        
        // Vérifier si une facture existe déjà pour cette période
        if (invoiceRepository.existsByOrganizationIdAndPeriodStartAndPeriodEnd(
                organizationId, periodStart, periodEnd)) {
            throw new IllegalArgumentException(
                    String.format("Une facture existe déjà pour l'organisation %d pour la période %s",
                            organizationId, yearMonth.format(DateTimeFormatter.ofPattern("yyyy-MM"))));
        }
        
        // Récupérer les logs d'utilisation pour la période
        LocalDateTime startDateTime = periodStart.atStartOfDay();
        LocalDateTime endDateTime = periodEnd.atTime(LocalTime.MAX);
        
        List<UsageLog> usageLogs = usageLogRepository.findByOrganizationIdAndTimestampBetween(
                organizationId, startDateTime, endDateTime);
        
        if (usageLogs.isEmpty()) {
            throw new IllegalArgumentException(
                    "Aucune utilisation trouvée pour cette période. Impossible de générer une facture.");
        }
        
        // Calculer le total
        BigDecimal totalAmount = usageLogs.stream()
                .filter(log -> log.getCostUsd() != null)
                .map(UsageLog::getCostUsd)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        
        // Générer le numéro de facture
        String invoiceNumber = generateInvoiceNumber(organizationId, year, month);
        
        // Créer la facture
        Invoice invoice = new Invoice();
        invoice.setOrganizationId(organizationId);
        invoice.setOrganizationName(organization.getName());
        invoice.setOrganizationEmail(organization.getEmail());
        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setPeriodStart(periodStart);
        invoice.setPeriodEnd(periodEnd);
        invoice.setTotalAmount(totalAmount);
        invoice.setStatus(Invoice.InvoiceStatus.PENDING);
        invoice.setDueDate(periodEnd.plusDays(30)); // 30 jours après la fin de la période
        
        invoice = invoiceRepository.save(invoice);
        
        // Créer les lignes de facture
        List<InvoiceItem> items = createInvoiceItems(invoice, usageLogs);
        if (!items.isEmpty()) {
            invoiceItemRepository.saveAll(items);
        }
        
        log.info("Facture générée: {} pour l'organisation {} (période: {})",
                invoiceNumber, organization.getName(), yearMonth.format(DateTimeFormatter.ofPattern("yyyy-MM")));
        
        return toDto(invoice);
    }
    
    /**
     * Génère une facture pour une période personnalisée.
     * 
     * @param organizationId ID de l'organisation
     * @param periodStart Date de début de la période
     * @param periodEnd Date de fin de la période
     * @return La facture générée
     */
    @Transactional
    public InvoiceDto generateInvoice(Long organizationId, LocalDate periodStart, LocalDate periodEnd) {
        // Vérifier que l'organisation existe
        OrganizationDto organization = organizationService.getOrganizationById(organizationId);
        if (organization == null) {
            throw new IllegalArgumentException("Organisation non trouvée avec l'ID: " + organizationId);
        }
        
        // Vérifier si une facture existe déjà pour cette période
        if (invoiceRepository.existsByOrganizationIdAndPeriodStartAndPeriodEnd(
                organizationId, periodStart, periodEnd)) {
            throw new IllegalArgumentException(
                    String.format("Une facture existe déjà pour l'organisation %d pour la période %s - %s",
                            organizationId, periodStart, periodEnd));
        }
        
        // Récupérer les logs d'utilisation pour la période
        LocalDateTime startDateTime = periodStart.atStartOfDay();
        LocalDateTime endDateTime = periodEnd.atTime(LocalTime.MAX);
        
        List<UsageLog> usageLogs = usageLogRepository.findByOrganizationIdAndTimestampBetween(
                organizationId, startDateTime, endDateTime);
        
        if (usageLogs.isEmpty()) {
            throw new IllegalArgumentException(
                    "Aucune utilisation trouvée pour cette période. Impossible de générer une facture.");
        }
        
        // Calculer le total
        BigDecimal totalAmount = usageLogs.stream()
                .filter(log -> log.getCostUsd() != null)
                .map(UsageLog::getCostUsd)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        
        // Générer le numéro de facture (basé sur la date de début)
        YearMonth yearMonth = YearMonth.from(periodStart);
        String invoiceNumber = generateInvoiceNumber(organizationId, yearMonth.getYear(), yearMonth.getMonthValue());
        
        // Créer la facture
        Invoice invoice = new Invoice();
        invoice.setOrganizationId(organizationId);
        invoice.setOrganizationName(organization.getName());
        invoice.setOrganizationEmail(organization.getEmail());
        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setPeriodStart(periodStart);
        invoice.setPeriodEnd(periodEnd);
        invoice.setTotalAmount(totalAmount);
        invoice.setStatus(Invoice.InvoiceStatus.PENDING);
        invoice.setDueDate(periodEnd.plusDays(30)); // 30 jours après la fin de la période
        
        invoice = invoiceRepository.save(invoice);
        
        // Créer les lignes de facture
        List<InvoiceItem> items = createInvoiceItems(invoice, usageLogs);
        if (!items.isEmpty()) {
            invoiceItemRepository.saveAll(items);
        }
        
        log.info("Facture générée: {} pour l'organisation {} (période: {} - {})",
                invoiceNumber, organization.getName(), periodStart, periodEnd);
        
        return toDto(invoice);
    }
    
    /**
     * Crée les lignes de facture à partir des logs d'utilisation.
     */
    private List<InvoiceItem> createInvoiceItems(Invoice invoice, List<UsageLog> usageLogs) {
        List<InvoiceItem> items = new ArrayList<>();
        
        // Agréger par endpoint
        var usageByEndpoint = usageLogs.stream()
                .collect(Collectors.groupingBy(
                        UsageLog::getEndpoint,
                        Collectors.toList()
                ));
        
        for (var entry : usageByEndpoint.entrySet()) {
            String endpoint = entry.getKey();
            List<UsageLog> logs = entry.getValue();
            
            // Calculer le total pour cet endpoint
            long requestCount = logs.size();
            BigDecimal totalCost = logs.stream()
                    .filter(log -> log.getCostUsd() != null)
                    .map(UsageLog::getCostUsd)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .setScale(2, RoundingMode.HALF_UP);
            
            // Calculer le prix unitaire moyen
            BigDecimal unitPrice = requestCount > 0
                    ? totalCost.divide(BigDecimal.valueOf(requestCount), 6, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            
            InvoiceItem item = new InvoiceItem();
            item.setInvoice(invoice);
            item.setDescription(getEndpointDescription(endpoint));
            item.setQuantity((int) requestCount);
            item.setUnitPrice(unitPrice);
            item.setTotalPrice(totalCost);
            item.setItemType("API_REQUEST");
            
            items.add(item);
        }
        
        // Ajouter une ligne récapitulative pour les tokens si nécessaire
        long totalTokens = usageLogs.stream()
                .filter(log -> log.getTokensUsed() != null)
                .mapToLong(UsageLog::getTokensUsed)
                .sum();
        
        if (totalTokens > 0) {
            // Calculer le coût total des tokens
            BigDecimal totalTokenCost = usageLogs.stream()
                    .filter(log -> log.getCostUsd() != null)
                    .map(UsageLog::getCostUsd)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .setScale(2, RoundingMode.HALF_UP);
            
            BigDecimal tokenUnitPrice = totalTokens > 0
                    ? totalTokenCost.divide(BigDecimal.valueOf(totalTokens), 6, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            
            InvoiceItem tokenItem = new InvoiceItem();
            tokenItem.setInvoice(invoice);
            tokenItem.setDescription("Utilisation de tokens (agrégé)");
            tokenItem.setQuantity((int) totalTokens);
            tokenItem.setUnitPrice(tokenUnitPrice);
            tokenItem.setTotalPrice(totalTokenCost);
            tokenItem.setItemType("TOKEN_USAGE");
            
            items.add(tokenItem);
        }
        
        return items;
    }
    
    /**
     * Génère un numéro de facture unique.
     * Format: INV-{YYYYMM}-{ORG_ID}-{SEQUENCE}
     */
    private String generateInvoiceNumber(Long organizationId, int year, int month) {
        String baseNumber = String.format("INV-%s-%03d", 
                YearMonth.of(year, month).format(INVOICE_NUMBER_FORMAT),
                organizationId);
        
        // Vérifier l'unicité et ajouter un suffixe si nécessaire
        String invoiceNumber = baseNumber;
        int suffix = 1;
        while (invoiceRepository.findByInvoiceNumber(invoiceNumber).isPresent()) {
            invoiceNumber = baseNumber + "-" + suffix;
            suffix++;
        }
        
        return invoiceNumber;
    }
    
    /**
     * Retourne une description lisible pour un endpoint.
     */
    private String getEndpointDescription(String endpoint) {
        return switch (endpoint) {
            case "/recherche/sections" -> "Recherche par sections";
            case "/recherche/chapitres" -> "Recherche par chapitres";
            case "/recherche/positions4" -> "Recherche par positions (4 chiffres)";
            case "/recherche/positions6" -> "Recherche par positions (6 chiffres)";
            default -> "Requête API: " + endpoint;
        };
    }
    
    /**
     * Récupère une facture par son ID.
     */
    public InvoiceDto getInvoiceById(Long invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new IllegalArgumentException("Facture non trouvée avec l'ID: " + invoiceId));
        return toDto(invoice);
    }
    
    /**
     * Récupère toutes les factures d'une organisation.
     */
    public List<InvoiceDto> getInvoicesByOrganization(Long organizationId) {
        return invoiceRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Récupère toutes les factures (admin uniquement).
     */
    public List<InvoiceDto> getAllInvoices() {
        return invoiceRepository.findAll()
                .stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /**
     * Met à jour le statut d'une facture.
     */
    @Transactional
    public InvoiceDto updateInvoiceStatus(Long invoiceId, Invoice.InvoiceStatus status, String notes) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new IllegalArgumentException("Facture non trouvée avec l'ID: " + invoiceId));
        
        invoice.setStatus(status);
        if (notes != null && !notes.trim().isEmpty()) {
            invoice.setNotes(notes);
        }
        
        if (status == Invoice.InvoiceStatus.PAID && invoice.getPaidAt() == null) {
            invoice.setPaidAt(LocalDateTime.now());
        }
        
        invoice = invoiceRepository.save(invoice);
        
        log.info("Statut de la facture {} mis à jour: {}", invoice.getInvoiceNumber(), status);
        
        return toDto(invoice);
    }
    
    /**
     * Compte les nouvelles factures non consultées d'une organisation.
     */
    public long countNewInvoices(Long organizationId) {
        return invoiceRepository.countByOrganizationIdAndViewedAtIsNull(organizationId);
    }
    
    /**
     * Marque une facture comme consultée.
     */
    @Transactional
    public InvoiceDto markInvoiceAsViewed(Long invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new IllegalArgumentException("Facture non trouvée avec l'ID: " + invoiceId));
        
        // Marquer comme consultée seulement si ce n'est pas déjà fait
        if (invoice.getViewedAt() == null) {
            invoice.setViewedAt(LocalDateTime.now());
            invoice = invoiceRepository.save(invoice);
            log.info("Facture {} marquée comme consultée", invoice.getInvoiceNumber());
        }
        
        return toDto(invoice);
    }
    
    /**
     * Convertit une Invoice en DTO.
     */
    private InvoiceDto toDto(Invoice invoice) {
        InvoiceDto dto = new InvoiceDto();
        dto.setId(invoice.getId());
        dto.setOrganizationId(invoice.getOrganizationId());
        dto.setOrganizationName(invoice.getOrganizationName());
        dto.setOrganizationEmail(invoice.getOrganizationEmail());
        dto.setInvoiceNumber(invoice.getInvoiceNumber());
        dto.setPeriodStart(invoice.getPeriodStart());
        dto.setPeriodEnd(invoice.getPeriodEnd());
        dto.setTotalAmount(invoice.getTotalAmount());
        dto.setStatus(invoice.getStatus());
        dto.setCreatedAt(invoice.getCreatedAt());
        dto.setDueDate(invoice.getDueDate());
        dto.setPaidAt(invoice.getPaidAt());
        dto.setNotes(invoice.getNotes());
        dto.setViewedAt(invoice.getViewedAt());
        
        // Récupérer les lignes de facture
        List<InvoiceItem> items = invoiceItemRepository.findByInvoiceIdOrderById(invoice.getId());
        if (items != null) {
            dto.setItems(items.stream()
                    .map(this::toItemDto)
                    .collect(Collectors.toList()));
        } else {
            dto.setItems(new ArrayList<>());
        }
        
        // Calculer les statistiques d'utilisation pour la période
        LocalDateTime startDateTime = invoice.getPeriodStart().atStartOfDay();
        LocalDateTime endDateTime = invoice.getPeriodEnd().atTime(LocalTime.MAX);
        
        Long orgId = invoice.getOrganizationId();
        List<UsageLog> usageLogs = orgId != null 
                ? usageLogRepository.findByOrganizationIdAndTimestampBetween(orgId, startDateTime, endDateTime)
                : new ArrayList<>();
        
        dto.setTotalRequests((long) usageLogs.size());
        dto.setTotalTokens(usageLogs.stream()
                .filter(log -> log.getTokensUsed() != null)
                .mapToLong(UsageLog::getTokensUsed)
                .sum());
        dto.setTotalCostUsd(usageLogs.stream()
                .filter(log -> log.getCostUsd() != null)
                .map(UsageLog::getCostUsd)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP));
        
        return dto;
    }
    
    /**
     * Convertit une InvoiceItem en DTO.
     */
    private InvoiceItemDto toItemDto(InvoiceItem item) {
        InvoiceItemDto dto = new InvoiceItemDto();
        dto.setId(item.getId());
        dto.setDescription(item.getDescription());
        dto.setQuantity(item.getQuantity());
        dto.setUnitPrice(item.getUnitPrice());
        dto.setTotalPrice(item.getTotalPrice());
        dto.setItemType(item.getItemType());
        return dto;
    }
    
    /**
     * Génère les factures mensuelles pour toutes les organisations ayant une utilisation.
     * 
     * @param year Année
     * @param month Mois (1-12)
     * @return Liste des factures générées
     */
    @Transactional
    public List<InvoiceDto> generateMonthlyInvoicesForAllOrganizations(int year, int month) {
        List<InvoiceDto> invoices = new ArrayList<>();
        
        // Récupérer toutes les organisations
        List<OrganizationDto> organizations = organizationService.getAllOrganizations();
        
        YearMonth yearMonth = YearMonth.of(year, month);
        LocalDate periodStart = yearMonth.atDay(1);
        LocalDate periodEnd = yearMonth.atEndOfMonth();
        
        LocalDateTime startDateTime = periodStart.atStartOfDay();
        LocalDateTime endDateTime = periodEnd.atTime(LocalTime.MAX);
        
        for (OrganizationDto organization : organizations) {
            try {
                // Vérifier si une facture existe déjà
                if (invoiceRepository.existsByOrganizationIdAndPeriodStartAndPeriodEnd(
                        organization.getId(), periodStart, periodEnd)) {
                    log.debug("Facture déjà existante pour l'organisation {} pour la période {}",
                            organization.getName(), yearMonth.format(DateTimeFormatter.ofPattern("yyyy-MM")));
                    continue;
                }
                
                // Vérifier s'il y a de l'utilisation pour cette période
                List<UsageLog> usageLogs = usageLogRepository.findByOrganizationIdAndTimestampBetween(
                        organization.getId(), startDateTime, endDateTime);
                
                if (usageLogs.isEmpty()) {
                    log.debug("Aucune utilisation pour l'organisation {} pour la période {}",
                            organization.getName(), yearMonth.format(DateTimeFormatter.ofPattern("yyyy-MM")));
                    continue;
                }
                
                // Générer la facture
                InvoiceDto invoice = generateMonthlyInvoice(organization.getId(), year, month);
                invoices.add(invoice);
                
                log.info("Facture générée pour l'organisation {}: {}",
                        organization.getName(), invoice.getInvoiceNumber());
                
            } catch (Exception e) {
                log.error("Erreur lors de la génération de la facture pour l'organisation {}: {}",
                        organization.getName(), e.getMessage(), e);
            }
        }
        
        log.info("Génération de factures terminée. {} facture(s) générée(s) pour la période {}",
                invoices.size(), yearMonth.format(DateTimeFormatter.ofPattern("yyyy-MM")));
        
        return invoices;
    }
}

