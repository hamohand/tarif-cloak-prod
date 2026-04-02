package com.muhend.backend;

import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Classe parente abstraite pour tous les tests d'intégration nécessitant une vraie base de données.
 * Utilise Testcontainers pour démarrer un PostgreSQL isolé et @DataJpaTest pour ne charger
 * que la couche de données (évite les erreurs Keycloak, RabbitMQ, Stripe au démarrage).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
@ActiveProfiles("test")
@TestPropertySource(properties = {
    "POSTGRES_USER=test",
    "POSTGRES_PASSWORD=test",
    "POSTGRES_DB=test",
    "KEYCLOAK_EXTERNAL_URL=http://localhost:8080",
    "KEYCLOAK_INTERNAL_URL=http://localhost:8080",
    "KEYCLOAK_REALM=test"
})
public abstract class BaseIntegrationTest {

    // On utilise l'image postgres:15-alpine pour rester léger
    @Container
    @ServiceConnection
    protected static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine")
            .withDatabaseName("tarifcloak_test")
            .withUsername("testuser")
            .withPassword("testpass");

}
