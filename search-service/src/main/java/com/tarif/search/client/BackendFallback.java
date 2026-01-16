package com.tarif.search.client;

import com.tarif.search.dto.QuotaCheckResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class BackendFallback implements BackendClient {

    @Override
    public QuotaCheckResponse checkQuota(String authorizationHeader) {
        log.warn("Backend indisponible - Mode dégradé activé (recherche autorisée sans vérification quota)");

        return QuotaCheckResponse.builder()
                .canSearch(true)
                .quotaOk(true)
                .canUsePayPerRequest(false)
                .message("Mode dégradé - Backend indisponible")
                .build();
    }
}
