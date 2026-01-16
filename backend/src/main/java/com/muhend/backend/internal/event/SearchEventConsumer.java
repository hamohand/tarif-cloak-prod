package com.muhend.backend.internal.event;

import com.muhend.backend.usage.service.UsageLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

/**
 * Consumer RabbitMQ pour les événements de recherche du search-service.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SearchEventConsumer {

    private final UsageLogService usageLogService;

    @RabbitListener(queues = "${messaging.queue.search-completed:search-completed-queue}")
    public void handleSearchCompleted(SearchCompletedEvent event) {
        log.debug("Événement reçu: {} - userId={}, endpoint={}, tokens={}",
                event.getEventId(), event.getUserId(), event.getEndpoint(), event.getTokensUsed());

        try {
            if (event.getUserId() == null || event.getOrganizationId() == null) {
                log.warn("Événement incomplet ignoré: userId={}, orgId={}",
                        event.getUserId(), event.getOrganizationId());
                return;
            }

            usageLogService.logUsage(
                    event.getUserId(),
                    event.getOrganizationId(),
                    event.getEndpoint(),
                    event.getSearchTerm(),
                    event.getTokensUsed(),
                    event.getCost()
            );

            log.info("Usage logged: org={}, endpoint={}, tokens={}, cost={}",
                    event.getOrganizationId(), event.getEndpoint(),
                    event.getTokensUsed(), event.getCost());

        } catch (Exception e) {
            log.error("Erreur lors du traitement de l'événement {}: {}",
                    event.getEventId(), e.getMessage());
        }
    }
}
