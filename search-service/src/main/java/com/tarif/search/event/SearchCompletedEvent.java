package com.tarif.search.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchCompletedEvent implements Serializable {

    private static final long serialVersionUID = 1L;

    @Builder.Default
    private String eventId = UUID.randomUUID().toString();

    @Builder.Default
    private Instant timestamp = Instant.now();

    private String userId;
    private Long organizationId;
    private String endpoint;
    private String searchTerm;
    private Integer tokensUsed;
    private Double cost;
    private boolean success;
}
