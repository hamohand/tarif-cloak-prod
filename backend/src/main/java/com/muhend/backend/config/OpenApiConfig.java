package com.muhend.backend.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Configuration OpenAPI pour forcer HTTPS dans les URLs générées.
 * Nécessaire quand l'application est derrière un reverse proxy (Traefik).
 */
@Configuration
public class OpenApiConfig {

    @Value("${FRONTEND_URL:https://hscode.enclume-numerique.com}")
    private String frontendUrl;

    @Bean
    public OpenAPI customOpenAPI() {
        // Construire l'URL de base pour l'API (ajouter /api si nécessaire)
        String apiBaseUrl = frontendUrl;
        if (!apiBaseUrl.endsWith("/api")) {
            // Si FRONTEND_URL ne contient pas /api, l'ajouter
            apiBaseUrl = apiBaseUrl + "/api";
        }
        
        // S'assurer que l'URL utilise HTTPS
        if (apiBaseUrl.startsWith("http://")) {
            apiBaseUrl = apiBaseUrl.replace("http://", "https://");
        }
        
        Server server = new Server();
        server.setUrl(apiBaseUrl);
        server.setDescription("Production server (HTTPS)");

        return new OpenAPI()
                .servers(List.of(server));
    }
}

