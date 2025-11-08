package com.muhend.backend.organization.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO pour les associations utilisateur-organisation.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationUserDto {
    
    private Long id;
    private Long organizationId;
    private String organizationName;
    private String keycloakUserId;
    private LocalDateTime joinedAt;
}

