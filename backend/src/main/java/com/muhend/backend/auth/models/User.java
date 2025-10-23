package com.muhend.backend.auth.models;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "app_users") // "user" est un mot-clé réservé dans certaines bases de données
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    private String id; // Correspond à l'ID utilisateur de Keycloak

    private String username;
    private String email;
    private String firstName;
    private String lastName;
}
