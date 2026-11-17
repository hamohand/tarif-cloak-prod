package com.muhend.backend.license.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Payload signé embarqué dans un jeton de licence On-Premise (format TCI1).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class LicensePayload {
    private String licenseId;
    private String boxId;
    private String organizationName;
    private String planName;
    private Integer maxUsers;
    private Integer monthlyQuota;
    private LocalDate issuedAt;
    private LocalDate expiresAt;
    private Integer graceDays;
}
