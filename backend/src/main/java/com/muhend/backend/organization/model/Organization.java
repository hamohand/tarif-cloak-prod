package com.muhend.backend.organization.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Entité représentant une entreprise/organisation.
 * Phase 2 MVP : Association Utilisateur → Entreprise
 */
@Entity
@Table(name = "organization")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Organization {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "name", nullable = false, length = 255)
    private String name;
    
    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email; // Email de l'organisation (identifiant unique)
    
    @Column(name = "monthly_quota", nullable = true)
    private Integer monthlyQuota; // null = quota illimité (peut être défini par le plan tarifaire)
    
    @Column(name = "pricing_plan_id", nullable = true)
    private Long pricingPlanId; // Référence au plan tarifaire
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}

