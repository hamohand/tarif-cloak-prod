package com.tarif.search.event;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class SearchEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    @Value("${messaging.exchange.search:search-exchange}")
    private String exchange;

    @Value("${messaging.routing-key.search-completed:search.completed}")
    private String routingKey;

    @Async
    public void publishSearchCompleted(
            String userId,
            Long organizationId,
            String endpoint,
            String searchTerm,
            Integer tokensUsed,
            Double cost) {

        SearchCompletedEvent event = SearchCompletedEvent.builder()
                .userId(userId)
                .organizationId(organizationId)
                .endpoint(endpoint)
                .searchTerm(searchTerm)
                .tokensUsed(tokensUsed)
                .cost(cost)
                .success(true)
                .build();

        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, event);
            log.debug("Event publié: {} - userId={}, tokens={}", routingKey, userId, tokensUsed);
        } catch (Exception e) {
            log.error("Erreur publication event RabbitMQ: {}", e.getMessage());
        }
    }
}
