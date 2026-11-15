package com.tarif.search.client;

import com.tarif.search.dto.QuotaCheckResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class BackendFallback implements BackendClient {

    @Override
    public QuotaCheckResponse checkQuota(String authorizationHeader) {
        log.error("Backend indisponible - Mode fail-closed activé (recherche refusée)");

        return QuotaCheckResponse.builder()
                .canSearch(false)
                .quotaOk(false)
                .message("BACKEND_UNAVAILABLE: Service de vérification des quotas temporairement indisponible")
                .build();
    }
}
