package com.tarif.search.client;

import com.tarif.search.config.FeignConfig;
import com.tarif.search.dto.QuotaCheckResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(
        name = "backend-service",
        url = "${backend.url}",
        configuration = FeignConfig.class,
        fallback = BackendFallback.class
)
public interface BackendClient {

    @GetMapping("/internal/quota-check")
    QuotaCheckResponse checkQuota(@RequestHeader("Authorization") String authorizationHeader);
}
