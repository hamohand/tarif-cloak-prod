package com.muhend.backend.license.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * État persistant de la licence On-Premise (enregistrement singleton id = 1).
 * Permet de stocker la licence activée, l'horodatage anti-rollback et le dernier heartbeat réussi.
 */
@Entity
@Table(name = "onprem_license_state")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OnPremLicenseState {

    @Id
    private Long id;

    @Column(name = "license_id", length = 120)
    private String licenseId;

    @Column(name = "box_id", length = 120)
    private String boxId;

    @Column(name = "token", columnDefinition = "TEXT")
    private String token;

    @Column(name = "revoked", nullable = false)
    private Boolean revoked = false;

    @Column(name = "last_seen_at", nullable = false)
    private LocalDateTime lastSeenAt;

    @Column(name = "last_heartbeat_ok_at")
    private LocalDateTime lastHeartbeatOkAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
