package com.muhend.backend.payment.repository;

import com.muhend.backend.payment.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    
    /**
     * Trouve tous les paiements d'une organisation.
     */
    List<Payment> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);
    
    /**
     * Trouve tous les paiements d'un abonnement.
     */
    List<Payment> findBySubscriptionIdOrderByCreatedAtDesc(Long subscriptionId);
    
    /**
     * Trouve tous les paiements d'une facture.
     */
    List<Payment> findByInvoiceIdOrderByCreatedAtDesc(Long invoiceId);
    
    /**
     * Trouve un paiement par son ID chez le processeur de paiement.
     */
    Optional<Payment> findByPaymentProviderPaymentId(String paymentProviderPaymentId);
    
    /**
     * Trouve un paiement par son ID d'intention de paiement (Stripe).
     */
    Optional<Payment> findByPaymentProviderPaymentIntentId(String paymentProviderPaymentIntentId);
    
    /**
     * Trouve tous les paiements avec un statut spécifique.
     */
    List<Payment> findByStatus(Payment.PaymentStatus status);
    
    /**
     * Trouve tous les paiements d'une organisation avec un statut spécifique.
     */
    List<Payment> findByOrganizationIdAndStatusOrderByCreatedAtDesc(Long organizationId, Payment.PaymentStatus status);
    
    /**
     * Supprime les liens de clés étrangères avant suppression.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Payment p SET p.invoiceId = null, p.subscriptionId = null WHERE p.organizationId = :organizationId")
    void clearInvoiceAndSubscriptionLinks(@Param("organizationId") Long organizationId);

    /**
     * Supprime tous les paiements d'une organisation.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM Payment p WHERE p.organizationId = :organizationId")
    int deleteByOrganizationId(@Param("organizationId") Long organizationId);
}

