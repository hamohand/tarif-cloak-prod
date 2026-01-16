package com.tarif.search.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuotaCheckResponse {

    private boolean canSearch;
    private boolean quotaOk;
    private boolean canUsePayPerRequest;
    private Long organizationId;
    private Integer currentUsage;
    private Integer monthlyQuota;
    private BigDecimal payPerRequestPrice;
    private String currency;
    private String message;
}
