package com.muhend.backend.pricing;

import com.muhend.backend.email.service.EmailService;
import com.muhend.backend.organization.dto.OrganizationDto;
import com.muhend.backend.organization.service.OrganizationService;
import com.muhend.backend.pricing.controller.QuoteRequestController;
import com.muhend.backend.pricing.dto.CreateQuoteRequestDto;
import com.muhend.backend.pricing.dto.QuoteRequestDto;
import com.muhend.backend.pricing.model.QuoteRequest;
import com.muhend.backend.pricing.service.QuoteRequestService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuoteRequestControllerTest {

    @Mock
    private QuoteRequestService quoteRequestService;

    @Mock
    private OrganizationService organizationService;

    @Mock
    private EmailService emailService;

    private QuoteRequestController controller;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        controller = new QuoteRequestController(
                quoteRequestService,
                organizationService,
                emailService,
                "sales@enclume-numerique.com",
                10
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void anonymousProspect_shouldCreatePublicQuoteRequestAndNotifyAdmin() {
        CreateQuoteRequestDto req = new CreateQuoteRequestDto(999L, "Karim Benali", "k.benali@transit-alger.dz", "Devis Box Locale 10 postes");
        HttpServletRequest httpReq = mock(HttpServletRequest.class);
        when(httpReq.getHeader("X-Forwarded-For")).thenReturn("41.100.10.20");

        when(quoteRequestService.createQuoteRequest(any(CreateQuoteRequestDto.class))).thenAnswer(inv -> {
            CreateQuoteRequestDto arg = inv.getArgument(0);
            QuoteRequestDto dto = new QuoteRequestDto();
            dto.setId(42L);
            dto.setOrganizationId(arg.getOrganizationId());
            dto.setContactName(arg.getContactName());
            dto.setContactEmail(arg.getContactEmail());
            dto.setMessage(arg.getMessage());
            dto.setStatus(QuoteRequest.QuoteStatus.PENDING);
            return dto;
        });

        ResponseEntity<?> response = controller.createQuoteRequest(req, httpReq);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        ArgumentCaptor<CreateQuoteRequestDto> captor = ArgumentCaptor.forClass(CreateQuoteRequestDto.class);
        verify(quoteRequestService).createQuoteRequest(captor.capture());
        assertNull(captor.getValue().getOrganizationId());
        verify(emailService).sendNewQuoteRequestNotificationEmail(
                eq("sales@enclume-numerique.com"),
                eq("Karim Benali"),
                eq("k.benali@transit-alger.dz"),
                eq(null),
                eq("Devis Box Locale 10 postes")
        );
    }

    @Test
    void authenticatedOrgUser_shouldAttachResolvedOrganizationId() {
        Jwt jwt = Jwt.withTokenValue("tok")
                .header("alg", "none")
                .claim("sub", "kc-user-7")
                .build();
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(jwt, null));

        OrganizationDto org = new OrganizationDto();
        org.setId(15L);
        when(organizationService.getOrganizationIdByUserId("kc-user-7")).thenReturn(15L);
        when(organizationService.getOrganizationById(15L)).thenReturn(org);
        when(quoteRequestService.createQuoteRequest(any(CreateQuoteRequestDto.class))).thenAnswer(inv -> {
            CreateQuoteRequestDto arg = inv.getArgument(0);
            QuoteRequestDto dto = new QuoteRequestDto();
            dto.setId(43L);
            dto.setOrganizationId(arg.getOrganizationId());
            dto.setContactName(arg.getContactName());
            dto.setContactEmail(arg.getContactEmail());
            dto.setMessage(arg.getMessage());
            return dto;
        });

        CreateQuoteRequestDto req = new CreateQuoteRequestDto(null, "Claire Martin", "claire@logistique.fr", "Devis Entreprise EU");
        ResponseEntity<?> response = controller.createQuoteRequest(req, mock(HttpServletRequest.class));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        QuoteRequestDto body = (QuoteRequestDto) response.getBody();
        assertNotNull(body);
        assertEquals(15L, body.getOrganizationId());
    }

    @Test
    void anonymousRateLimit_shouldReturn429On11thRequestFromSameIp() {
        HttpServletRequest httpReq = mock(HttpServletRequest.class);
        when(httpReq.getHeader("X-Forwarded-For")).thenReturn("197.10.20.30");
        when(quoteRequestService.createQuoteRequest(any(CreateQuoteRequestDto.class))).thenReturn(new QuoteRequestDto());

        CreateQuoteRequestDto req = new CreateQuoteRequestDto(null, "Test", "test@exemple.dz", "Demande");
        for (int i = 0; i < 10; i++) {
            assertEquals(HttpStatus.OK, controller.createQuoteRequest(req, httpReq).getStatusCode());
        }

        ResponseEntity<?> eleventh = controller.createQuoteRequest(req, httpReq);
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, eleventh.getStatusCode());
    }
}
