package com.muhend.backend.admin.service;

import com.muhend.backend.BaseIntegrationTest;
import com.muhend.backend.invoice.model.Invoice;
import com.muhend.backend.invoice.repository.InvoiceRepository;
import com.muhend.backend.organization.model.Organization;
import com.muhend.backend.organization.repository.OrganizationRepository;
import com.muhend.backend.payment.model.Payment;
import com.muhend.backend.payment.repository.PaymentRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

/**
 * Test d'intégration automatisé pour vérifier que le "Feature" de suppression 
 * d'une organisation ne cause jamais d'erreur 500 liée à des dépendances circulaires 
 * de la base de données.
 */
public class OrganizationDeletionIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private OrganizationDeletionService organizationDeletionService;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Test
    public void testDeleteOrganization_WithCircularDependency_ShouldSucceed() {
        // 1. Préparation des données (Given)
        Organization org = new Organization();
        org.setName("Org Test Délétrice");
        org.setEmail("delete-me@test.com");
        org.setAddress("123 rue delete");
        org.setCountry("FR");
        org.setPhone("0102030405");
        // Save de l'Organisation pour obtenir l'ID généré
        org = organizationRepository.saveAndFlush(org);

        // 2. Création d'une facture liée à l'organisation
        Invoice invoice = new Invoice();
        invoice.setOrganizationId(org.getId());
        invoice.setOrganizationName(org.getName());
        invoice.setOrganizationEmail(org.getEmail());
        invoice.setInvoiceNumber("INV-TEST-001");
        invoice.setPeriodStart(LocalDate.now().minusDays(30));
        invoice.setPeriodEnd(LocalDate.now());
        invoice.setTotalAmount(new BigDecimal("100.00"));
        invoice.setDueDate(LocalDate.now().plusDays(15));
        invoice.setStatus(Invoice.InvoiceStatus.PENDING);
        invoice = invoiceRepository.saveAndFlush(invoice);

        // 3. Création d'un paiement lié à l'organisation ET à la facture
        Payment payment = new Payment();
        payment.setOrganizationId(org.getId());
        payment.setInvoiceId(invoice.getId());
        payment.setAmount(new BigDecimal("100.00"));
        payment.setPaymentProvider("stripe");
        payment.setStatus(Payment.PaymentStatus.SUCCEEDED);
        payment = paymentRepository.saveAndFlush(payment);

        // 4. Mettre à jour la facture pour qu'elle pointe "en retour" sur le paiement
        // Ceci recrée la cause de l'erreur 500 (dépendance circulaire) : Facture -> Paiement ET Paiement -> Facture
        invoice.setPaymentId(payment.getId());
        invoiceRepository.saveAndFlush(invoice);

        // 5. Exécution & Vérification (When / Then)
        // La suppression ne doit PAS lever d'Exception (plus d'erreur 500)
        final Long orgId = org.getId();
        
        assertDoesNotThrow(() -> {
            OrganizationDeletionService.DeletionResult result = organizationDeletionService.deleteOrganization(orgId);
            assertThat(result.isSuccess()).isTrue();
            assertThat(result.getDeletedInvoices()).isGreaterThan(0);
            assertThat(result.getDeletedPayments()).isGreaterThan(0);
        }, "Le service de suppression a causé une erreur (probablement une contrainte PostgreSQL) !");

        // 6. Vérification finale que tout est nettoyé en BDD
        assertThat(organizationRepository.findById(orgId)).isEmpty();
        assertThat(invoiceRepository.findAll()).isEmpty();
        assertThat(paymentRepository.findAll()).isEmpty();
    }
}
