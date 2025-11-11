package com.muhend.backend.organization.repository;

import com.muhend.backend.organization.model.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OrganizationRepository extends JpaRepository<Organization, Long> {
    
    /**
     * Trouve une organisation par son nom (exact match).
     */
    Optional<Organization> findByName(String name);
    
    /**
     * Vérifie si une organisation existe avec ce nom.
     */
    boolean existsByName(String name);
    
    /**
     * Trouve une organisation par son email (exact match).
     */
    Optional<Organization> findByEmail(String email);
    
    /**
     * Vérifie si une organisation existe avec cet email.
     */
    boolean existsByEmail(String email);
    
    /**
     * Trouve une organisation par son ID de client Stripe.
     */
    java.util.Optional<Organization> findByStripeCustomerId(String stripeCustomerId);

    /**
     * Trouve une organisation par l'identifiant Keycloak de son compte principal.
     */
    Optional<Organization> findByKeycloakUserId(String keycloakUserId);
}

