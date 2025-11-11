package com.muhend.backend.payment.repository;

import com.muhend.backend.payment.model.Subscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {
    
    /**
     * Trouve tous les abonnements d'une organisation.
     */
    List<Subscription> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);
    
    /**
     * Trouve l'abonnement actif d'une organisation.
     */
    Optional<Subscription> findByOrganizationIdAndStatus(Long organizationId, Subscription.SubscriptionStatus status);
    
    /**
     * Trouve un abonnement par son ID chez le processeur de paiement.
     */
    Optional<Subscription> findByPaymentProviderSubscriptionId(String paymentProviderSubscriptionId);
    
    /**
     * Trouve tous les abonnements actifs.
     */
    List<Subscription> findByStatus(Subscription.SubscriptionStatus status);
    
    /**
     * Vérifie si une organisation a un abonnement actif.
     */
    boolean existsByOrganizationIdAndStatus(Long organizationId, Subscription.SubscriptionStatus status);
}

