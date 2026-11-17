package com.muhend.backend;

import com.muhend.backend.pricing.repository.PricingPlanRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class BackendApplicationTests extends BaseIntegrationTest {

    @Autowired
    private PricingPlanRepository pricingPlanRepository;

    @Test
    void contextLoads() {
        assertThat(pricingPlanRepository).isNotNull();
    }

}
