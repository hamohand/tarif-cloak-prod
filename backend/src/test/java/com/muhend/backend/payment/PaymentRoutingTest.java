package com.muhend.backend.payment;

import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.service.OrganizationService;
import com.muhend.backend.payment.config.ChargilyConfig;
import com.muhend.backend.payment.config.StripeConfig;
import com.muhend.backend.payment.controller.PaymentController;
import com.muhend.backend.payment.dto.CheckoutSessionResponse;
import com.muhend.backend.payment.dto.CreateCheckoutSessionRequest;
import com.muhend.backend.payment.service.ChargilyService;
import com.muhend.backend.payment.service.PaymentService;
import com.muhend.backend.payment.service.StripeService;
import com.muhend.backend.pricing.dto.PricingPlanDto;
import com.muhend.backend.pricing.service.PricingPlanService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentRoutingTest {

    @Mock private StripeService stripeService;
    @Mock private ChargilyService chargilyService;
    @Mock private PaymentService paymentService;
    @Mock private OrganizationService organizationService;
    @Mock private PricingPlanService pricingPlanService;
    @Mock private StripeConfig stripeConfig;
    @Mock private ChargilyConfig chargilyConfig;

    private PaymentController controller;

    @BeforeEach
    void setUp() {
        controller = new PaymentController(
                stripeService, chargilyService, paymentService, organizationService,
                pricingPlanService, stripeConfig, chargilyConfig);
        Jwt jwt = Jwt.withTokenValue("tok").header("alg", "none").claim("sub", "kc-user-1").build();
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(jwt, null));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void routesDzdPlanCheckoutToChargilyAndNotStripe() throws Exception {
        PricingPlanDto dzPlan = new PricingPlanDto();
        dzPlan.setId(10L);
        dzPlan.setMarketVersion("DZ");
        dzPlan.setCurrency("DZD");

        when(chargilyConfig.isConfigured()).thenReturn(true);
        when(organizationService.getOrganizationIdByUserId("kc-user-1")).thenReturn(1L);
        when(pricingPlanService.getPricingPlanById(10L)).thenReturn(dzPlan);
        when(chargilyService.createCheckoutSession(eq(1L), any()))
                .thenReturn(new CheckoutSessionResponse("chk_dz", "https://pay.chargily.net/chk_dz", null));

        CreateCheckoutSessionRequest req = new CreateCheckoutSessionRequest();
        req.setPricingPlanId(10L);

        var resp = controller.createCheckoutSession(req);

        assertEquals("chk_dz", resp.getBody().getSessionId());
        assertFalse(resp.getBody().isManualInvoiceFallback());
        verify(chargilyService).createCheckoutSession(eq(1L), eq(req));
        verifyNoInteractions(stripeService);
    }

    @Test
    void routesEurPlanCheckoutToStripeWhenConfigured() throws Exception {
        PricingPlanDto euPlan = new PricingPlanDto();
        euPlan.setId(20L);
        euPlan.setMarketVersion("DEFAULT");
        euPlan.setCurrency("EUR");

        when(stripeConfig.isConfigured()).thenReturn(true);
        when(organizationService.getOrganizationIdByUserId("kc-user-1")).thenReturn(2L);
        when(pricingPlanService.getPricingPlanById(20L)).thenReturn(euPlan);
        when(stripeService.createCheckoutSession(eq(2L), any()))
                .thenReturn(new CheckoutSessionResponse("cs_eu", "https://checkout.stripe.com/cs_eu", "pk_test"));

        CreateCheckoutSessionRequest req = new CreateCheckoutSessionRequest();
        req.setPricingPlanId(20L);

        var resp = controller.createCheckoutSession(req);

        assertEquals("cs_eu", resp.getBody().getSessionId());
        assertFalse(resp.getBody().isManualInvoiceFallback());
        verify(stripeService).createCheckoutSession(eq(2L), eq(req));
        verifyNoInteractions(chargilyService);
    }

    @Test
    void fallsBackToManualInvoiceWhenStripeNotConfiguredForEurPlan() {
        PricingPlanDto euPlan = new PricingPlanDto();
        euPlan.setId(20L);
        euPlan.setMarketVersion("DEFAULT");
        euPlan.setCurrency("EUR");

        when(stripeConfig.isConfigured()).thenReturn(false);
        when(organizationService.getOrganizationIdByUserId("kc-user-1")).thenReturn(2L);
        when(pricingPlanService.getPricingPlanById(20L)).thenReturn(euPlan);

        CreateCheckoutSessionRequest req = new CreateCheckoutSessionRequest();
        req.setPricingPlanId(20L);

        var resp = controller.createCheckoutSession(req);

        assertNotNull(resp.getBody());
        assertTrue(resp.getBody().isManualInvoiceFallback());
        assertEquals("/organization/quote-requests?mode=invoice&planId=20", resp.getBody().getUrl());
        verifyNoInteractions(stripeService, chargilyService);
    }

    @Test
    void routesInvoicePaymentByOrganizationMarketAndCountry() throws Exception {
        OrganizationDto dzOrg = new OrganizationDto();
        dzOrg.setId(1L);
        dzOrg.setMarketVersion("DZ");
        dzOrg.setCountry("DZ");

        OrganizationDto frOrg = new OrganizationDto();
        frOrg.setId(2L);
        frOrg.setMarketVersion("DEFAULT");
        frOrg.setCountry("FR");

        when(chargilyConfig.isConfigured()).thenReturn(true);
        when(stripeConfig.isConfigured()).thenReturn(true);
        when(organizationService.getOrganizationIdByUserId("kc-user-1")).thenReturn(1L, 2L);
        when(organizationService.getOrganizationById(1L)).thenReturn(dzOrg);
        when(organizationService.getOrganizationById(2L)).thenReturn(frOrg);
        when(chargilyService.createInvoiceCheckoutSession(1L, 50L, null, null))
                .thenReturn(new CheckoutSessionResponse("chk_inv", "https://pay.chargily.net/inv", null));
        when(stripeService.createInvoiceCheckoutSession(2L, 60L, null, null))
                .thenReturn(new CheckoutSessionResponse("cs_inv", "https://checkout.stripe.com/inv", "pk_test"));

        var dzResp = controller.payInvoice(50L, null);
        var euResp = controller.payInvoice(60L, null);

        assertEquals("chk_inv", dzResp.getBody().getSessionId());
        assertEquals("cs_inv", euResp.getBody().getSessionId());
        verify(chargilyService).createInvoiceCheckoutSession(1L, 50L, null, null);
        verify(stripeService).createInvoiceCheckoutSession(2L, 60L, null, null);
    }
}
