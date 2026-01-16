package com.muhend.backend.internal.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.Instant;

/**
 * Événement reçu du search-service quand une recherche est terminée.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchCompletedEvent implements Serializable {

    private static final long serialVersionUID = 1L;

    private String eventId;
    private Instant timestamp;
    private String userId;
    private Long organizationId;
    private String endpoint;
    private String searchTerm;
    private Integer tokensUsed;
    private Double cost;
    private boolean success;
}
