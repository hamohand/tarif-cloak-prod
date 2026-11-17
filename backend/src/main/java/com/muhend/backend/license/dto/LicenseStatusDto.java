package com.muhend.backend.license.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * État courant de la licence exposé aux clients et à l'interface Angular.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LicenseStatusDto {
    private boolean valid;
    private String state;
    private String licenseId;
    private String boxId;
    private String organizationName;
    private String planName;
    private LocalDate issuedAt;
    private LocalDate expiresAt;
    private Long daysRemaining;
    private Long offlineGraceDaysRemaining;
    private Integer maxUsers;
    private Integer monthlyQuota;
    private LocalDateTime lastHeartbeatAt;
    private String message;
}
