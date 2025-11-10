package com.muhend.backend.email.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.List;

/**
 * Service pour l'envoi d'emails.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;

    @Value("${spring.mail.from}")
    private String fromEmail;

    @Value("${spring.mail.from-name:Enclume Numérique}")
    private String fromName;

    @Value("${FRONTEND_URL:https://hscode.enclume-numerique.com}")
    private String frontendUrl;

    /**
     * Envoie un email de notification pour une nouvelle facture.
     *
     * @param toEmail Email du destinataire
     * @param organizationName Nom de l'organisation
     * @param invoiceNumber Numéro de la facture
     * @param periodStart Date de début de période
     * @param periodEnd Date de fin de période
     * @param totalAmount Montant total de la facture
     * @param invoiceId ID de la facture (pour le lien)
     */
    public void sendInvoiceNotificationEmail(
            String toEmail,
            String organizationName,
            String invoiceNumber,
            String periodStart,
            String periodEnd,
            String totalAmount,
            Long invoiceId) {
        try {
            Context context = new Context();
            context.setVariable("organizationName", organizationName);
            context.setVariable("invoiceNumber", invoiceNumber);
            context.setVariable("periodStart", periodStart);
            context.setVariable("periodEnd", periodEnd);
            context.setVariable("totalAmount", totalAmount);
            context.setVariable("invoiceId", invoiceId);
            context.setVariable("frontendUrl", getFrontendUrl());

            String htmlContent = templateEngine.process("invoice-notification", context);
            if (htmlContent == null || htmlContent.trim().isEmpty()) {
                throw new RuntimeException("Le template d'email a généré un contenu vide");
            }

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            String from = fromEmail != null ? fromEmail : "noreply@enclume-numerique.com";
            String fromNameValue = fromName != null ? fromName : "Enclume Numérique";
            
            helper.setFrom(from, fromNameValue);
            helper.setTo(toEmail != null ? toEmail : "");
            helper.setSubject("Nouvelle facture disponible - " + (invoiceNumber != null ? invoiceNumber : ""));
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("Email de notification de facture envoyé à {} pour la facture {}", toEmail, invoiceNumber);
        } catch (MessagingException e) {
            log.error("Erreur lors de l'envoi de l'email de notification de facture à {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur lors de l'envoi de l'email", e);
        } catch (Exception e) {
            log.error("Erreur inattendue lors de l'envoi de l'email à {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur lors de l'envoi de l'email", e);
        }
    }

    /**
     * Envoie un email de notification pour une nouvelle facture à plusieurs destinataires.
     */
    public void sendInvoiceNotificationEmailToMultiple(
            List<String> toEmails,
            String organizationName,
            String invoiceNumber,
            String periodStart,
            String periodEnd,
            String totalAmount,
            Long invoiceId) {
        for (String email : toEmails) {
            if (email != null && !email.trim().isEmpty()) {
                try {
                    sendInvoiceNotificationEmail(email, organizationName, invoiceNumber, periodStart, periodEnd, totalAmount, invoiceId);
                } catch (Exception e) {
                    log.error("Erreur lors de l'envoi de l'email à {}: {}", email, e.getMessage());
                    // Continuer avec les autres emails même si un échoue
                }
            }
        }
    }

    /**
     * Envoie un email de rappel pour une facture en retard.
     *
     * @param toEmail Email du destinataire
     * @param organizationName Nom de l'organisation
     * @param invoiceNumber Numéro de la facture
     * @param periodStart Date de début de période
     * @param periodEnd Date de fin de période
     * @param dueDate Date d'échéance
     * @param totalAmount Montant total de la facture
     * @param daysOverdue Nombre de jours de retard
     * @param invoiceId ID de la facture (pour le lien)
     */
    public void sendOverdueInvoiceReminderEmail(
            String toEmail,
            String organizationName,
            String invoiceNumber,
            String periodStart,
            String periodEnd,
            String dueDate,
            String totalAmount,
            long daysOverdue,
            Long invoiceId) {
        try {
            Context context = new Context();
            context.setVariable("organizationName", organizationName);
            context.setVariable("invoiceNumber", invoiceNumber);
            context.setVariable("periodStart", periodStart);
            context.setVariable("periodEnd", periodEnd);
            context.setVariable("dueDate", dueDate);
            context.setVariable("totalAmount", totalAmount);
            context.setVariable("daysOverdue", daysOverdue);
            context.setVariable("invoiceId", invoiceId);
            context.setVariable("frontendUrl", getFrontendUrl());

            String htmlContent = templateEngine.process("invoice-overdue-reminder", context);
            if (htmlContent == null || htmlContent.trim().isEmpty()) {
                throw new RuntimeException("Le template d'email a généré un contenu vide");
            }

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            String from = fromEmail != null ? fromEmail : "noreply@enclume-numerique.com";
            String fromNameValue = fromName != null ? fromName : "Enclume Numérique";
            
            helper.setFrom(from, fromNameValue);
            helper.setTo(toEmail != null ? toEmail : "");
            helper.setSubject("⚠️ Facture en retard - " + (invoiceNumber != null ? invoiceNumber : "") + " (" + daysOverdue + " jour(s) de retard)");
            helper.setText(htmlContent, true);

            mailSender.send(message);
            log.info("Email de rappel de facture en retard envoyé à {} pour la facture {} ({} jours de retard)", 
                    toEmail, invoiceNumber, daysOverdue);
        } catch (MessagingException e) {
            log.error("Erreur lors de l'envoi de l'email de rappel de facture en retard à {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur lors de l'envoi de l'email", e);
        } catch (Exception e) {
            log.error("Erreur inattendue lors de l'envoi de l'email de rappel à {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Erreur lors de l'envoi de l'email", e);
        }
    }

    /**
     * Envoie un email de rappel pour une facture en retard à plusieurs destinataires.
     */
    public void sendOverdueInvoiceReminderEmailToMultiple(
            List<String> toEmails,
            String organizationName,
            String invoiceNumber,
            String periodStart,
            String periodEnd,
            String dueDate,
            String totalAmount,
            long daysOverdue,
            Long invoiceId) {
        for (String email : toEmails) {
            if (email != null && !email.trim().isEmpty()) {
                try {
                    sendOverdueInvoiceReminderEmail(email, organizationName, invoiceNumber, periodStart, 
                            periodEnd, dueDate, totalAmount, daysOverdue, invoiceId);
                } catch (Exception e) {
                    log.error("Erreur lors de l'envoi de l'email de rappel à {}: {}", email, e.getMessage());
                    // Continuer avec les autres emails même si un échoue
                }
            }
        }
    }

    /**
     * Récupère l'URL du frontend depuis les variables d'environnement ou utilise une valeur par défaut.
     */
    private String getFrontendUrl() {
        return frontendUrl != null ? frontendUrl : "https://hscode.enclume-numerique.com";
    }
}

