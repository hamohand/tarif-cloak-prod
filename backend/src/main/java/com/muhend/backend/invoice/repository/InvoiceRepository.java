package com.muhend.backend.invoice.repository;

import com.muhend.backend.invoice.model.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
    
    /**
     * Récupère toutes les factures d'une organisation.
     */
    List<Invoice> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);
    
    /**
     * Récupère une facture par son numéro.
     */
    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);
    
    /**
     * Récupère les factures d'une organisation pour une période donnée.
     */
    List<Invoice> findByOrganizationIdAndPeriodStartGreaterThanEqualAndPeriodEndLessThanEqual(
            Long organizationId, LocalDate startDate, LocalDate endDate);
    
    /**
     * Récupère les factures par statut.
     */
    List<Invoice> findByStatusOrderByCreatedAtDesc(Invoice.InvoiceStatus status);
    
    /**
     * Vérifie si une facture existe pour une organisation et une période donnée.
     */
    boolean existsByOrganizationIdAndPeriodStartAndPeriodEnd(
            Long organizationId, LocalDate periodStart, LocalDate periodEnd);
    
    /**
     * Récupère la dernière facture d'une organisation.
     */
    Optional<Invoice> findFirstByOrganizationIdOrderByCreatedAtDesc(Long organizationId);
    
    /**
     * Compte les factures non consultées d'une organisation (viewedAt est null).
     */
    long countByOrganizationIdAndViewedAtIsNull(Long organizationId);
    
    /**
     * Récupère les factures non consultées d'une organisation.
     */
    List<Invoice> findByOrganizationIdAndViewedAtIsNullOrderByCreatedAtDesc(Long organizationId);
}

