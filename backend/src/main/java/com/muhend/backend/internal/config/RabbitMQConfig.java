package com.muhend.backend.internal.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration RabbitMQ pour la communication avec les micro-services.
 */
@Configuration
public class RabbitMQConfig {

    @Value("${messaging.exchange.search:search-exchange}")
    private String exchangeName;

    @Value("${messaging.queue.search-completed:search-completed-queue}")
    private String queueName;

    @Value("${messaging.routing-key.search-completed:search.completed}")
    private String routingKey;

    @Bean
    public TopicExchange searchExchange() {
        return new TopicExchange(exchangeName);
    }

    @Bean
    public Queue searchCompletedQueue() {
        return QueueBuilder.durable(queueName).build();
    }

    @Bean
    public Binding searchCompletedBinding(Queue searchCompletedQueue, TopicExchange searchExchange) {
        return BindingBuilder.bind(searchCompletedQueue)
                .to(searchExchange)
                .with(routingKey);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(jsonMessageConverter());
        return rabbitTemplate;
    }
}
