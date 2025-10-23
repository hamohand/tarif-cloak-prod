package com.muhend.backend.auth.service;

import com.muhend.backend.auth.dto.UserRegistrationRequest;
import jakarta.ws.rs.core.Response;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.admin.client.resource.UsersResource;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.keycloak.representations.idm.UserRepresentation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
public class KeycloakAdminService {

    private static final Logger logger = LoggerFactory.getLogger(KeycloakAdminService.class);
    private static final int MAX_RETRIES = 3;
    private static final long RETRY_DELAY_MS = 2000;

    private final Keycloak keycloak;

    @Value("${keycloak.registration.realm}")
    private String realm;

    public KeycloakAdminService(Keycloak keycloak) {
        this.keycloak = keycloak;
    }

    public Response createUser(UserRegistrationRequest registrationRequest) {
        logger.info("Creating user in Keycloak realm: {}", realm);
        logger.info("Username: {}, Email: {}", registrationRequest.getUsername(), registrationRequest.getEmail());

        int attempt = 0;
        Exception lastException = null;

        while (attempt < MAX_RETRIES) {
            try {
                UserRepresentation user = new UserRepresentation();
                user.setEnabled(true);
                user.setUsername(registrationRequest.getUsername());
                user.setFirstName(registrationRequest.getFirstName());
                user.setLastName(registrationRequest.getLastName());
                user.setEmail(registrationRequest.getEmail());
                user.setEmailVerified(false);

                CredentialRepresentation passwordCred = new CredentialRepresentation();
                passwordCred.setTemporary(false);
                passwordCred.setType(CredentialRepresentation.PASSWORD);
                passwordCred.setValue(registrationRequest.getPassword());
                user.setCredentials(Collections.singletonList(passwordCred));

                RealmResource realmResource = keycloak.realm(realm);
                UsersResource usersResource = realmResource.users();

                logger.info("Sending create user request to Keycloak (attempt {}/{})", attempt + 1, MAX_RETRIES);
                Response response = usersResource.create(user);

                int status = response.getStatus();
                logger.info("Keycloak response status: {}", status);

                if (status >= 200 && status < 300) {
                    logger.info("✓ User created successfully");
                    return response;
                } else if (status == 409) {
                    logger.warn("User already exists");
                    return response;
                } else {
                    String errorBody = response.hasEntity() ? response.readEntity(String.class) : "No error body";
                    logger.error("Failed to create user. Status: {}, Body: {}", status, errorBody);
                    return response;
                }

            } catch (Exception e) {
                lastException = e;
                attempt++;
                logger.warn("Attempt {}/{} failed to connect to Keycloak: {}",
                    attempt, MAX_RETRIES, e.getMessage());

                if (attempt < MAX_RETRIES) {
                    try {
                        logger.info("Retrying in {} ms...", RETRY_DELAY_MS);
                        Thread.sleep(RETRY_DELAY_MS);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Interrupted while retrying Keycloak connection", ie);
                    }
                }
            }
        }

        logger.error("Failed to create user after {} attempts", MAX_RETRIES);
        throw new RuntimeException("Failed to connect to Keycloak after " + MAX_RETRIES + " attempts", lastException);
    }
}