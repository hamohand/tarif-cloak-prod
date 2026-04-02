package com.muhend.backend;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Classe parente abstraite pour tous les tests d'intégration nécessitant une vraie base de données.
 * Utilise Testcontainers pour démarrer un PostgreSQL isolé.
 */
@SpringBootTest
@Testcontainers
@ActiveProfiles("test") // On suppose qu'un environnement 'test' existe ou on override
public abstract class BaseIntegrationTest {

    // On utilise l'image postgres:15-alpine pour rester léger
    @Container
    @ServiceConnection
    protected static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine")
            .withDatabaseName("tarifcloak_test")
            .withUsername("testuser")
            .withPassword("testpass");

}
