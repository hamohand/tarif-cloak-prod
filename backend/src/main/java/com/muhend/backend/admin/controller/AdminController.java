package com.muhend.backend.admin.controller;

import com.muhend.backend.admin.service.EndpointDiscoveryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@Tag(name = "Admin", description = "Endpoints d'administration (nécessite le rôle ADMIN)")
public class AdminController {

    private final EndpointDiscoveryService endpointDiscoveryService;

    @GetMapping("/endpoints")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
        summary = "Lister tous les endpoints du backend",
        description = "Retourne la liste de tous les endpoints disponibles dans l'application. Nécessite le rôle ADMIN.",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    public ResponseEntity<Map<String, Object>> listEndpoints() {
        List<Map<String, Object>> endpoints = endpointDiscoveryService.discoverEndpoints();
        
        return ResponseEntity.ok(Map.of(
            "total", endpoints.size(),
            "endpoints", endpoints
        ));
    }
}

