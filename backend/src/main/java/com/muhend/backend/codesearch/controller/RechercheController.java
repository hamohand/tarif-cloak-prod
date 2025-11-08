package com.muhend.backend.codesearch.controller;

import com.muhend.backend.codesearch.model.*;
import com.muhend.backend.codesearch.service.ChapitreService;
import com.muhend.backend.codesearch.service.Position4Service;
import com.muhend.backend.codesearch.service.Position6DzService;
import com.muhend.backend.codesearch.service.SectionService;
import com.muhend.backend.codesearch.service.ai.AiPrompts;
import com.muhend.backend.codesearch.service.ai.AiService;
import com.muhend.backend.codesearch.service.ai.OpenAiService;
import com.muhend.backend.usage.service.UsageLogService;
import com.muhend.backend.organization.service.OrganizationService;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 *
 */
@RestController
@Data
@Slf4j
// --- IMPORTANT --- *******************************************************************
// On supprime "/api" du mapping, car Traefik le gère déjà.
// Spring ne verra que le chemin "/recherche".
// ***********************************************************************************
//@RequestMapping("/api/recherche")
@RequestMapping("/recherche") // pour Traefik

public class RechercheController {
    private final AiService aiService;
    private final AiPrompts aiPrompts;
    private final SectionService sectionService;
    private final ChapitreService chapitreService;
    private final Position4Service position4Service;
    private final Position6DzService position6DzService;
    private final UsageLogService usageLogService;
    private final OrganizationService organizationService;

    @Autowired
    public RechercheController(AiService aiService, AiPrompts aiPrompts, SectionService sectionService, ChapitreService chapitreService,
                               Position4Service position4Service, Position6DzService position6DzService,
                               UsageLogService usageLogService, OrganizationService organizationService) {
        this.aiService = aiService;
        this.aiPrompts = aiPrompts;
        this.sectionService = sectionService;
        this.chapitreService = chapitreService;
        this.position4Service = position4Service;
        this.position6DzService = position6DzService;
        this.usageLogService = usageLogService;
        this.organizationService = organizationService;
    }

    // Enumération des différents niveaux de recherche
    private enum SearchLevel {
        SECTIONS, CHAPITRES, POSITIONS4, POSITIONS6
    }

    //****************************************************************************************
    // --------------------------------- ENDPOINTS DE RECHERCHE -----------------------------
    //****************************************************************************************

    // Niveau de recherche 0 : sections
    @GetMapping(value = "/sections", produces = "application/json")
    public List<Position> reponseSections(@RequestParam String termeRecherche) {
        try {
            List<Position> result = handleSearchRequest(termeRecherche, SearchLevel.SECTIONS);
            return result;
        } finally {
            // Toujours nettoyer le ThreadLocal et logger, même en cas d'erreur
            logUsage("/recherche/sections", termeRecherche);
            OpenAiService.clearCurrentUsage(); // Nettoyage de sécurité
        }
    }

    // Niveau de recherche 1 : chapitres
    @GetMapping(path = "/chapitres", produces = "application/json")
    public List<Position> reponseChapitres(@RequestParam String termeRecherche) {
        try {
            List<Position> result = handleSearchRequest(termeRecherche, SearchLevel.CHAPITRES);
            return result;
        } finally {
            // Toujours nettoyer le ThreadLocal et logger, même en cas d'erreur
            logUsage("/recherche/chapitres", termeRecherche);
            OpenAiService.clearCurrentUsage(); // Nettoyage de sécurité
        }
    }

    // Niveau de recherche 2 : positions 4
    @GetMapping(path = "/positions4", produces = "application/json")
    public List<Position> reponsePositions4(@RequestParam String termeRecherche) {
        try {
            List<Position> result = handleSearchRequest(termeRecherche, SearchLevel.POSITIONS4);
            return result;
        } finally {
            // Toujours nettoyer le ThreadLocal et logger, même en cas d'erreur
            logUsage("/recherche/positions4", termeRecherche);
            OpenAiService.clearCurrentUsage(); // Nettoyage de sécurité
        }
    }

    // Niveau de recherche 3 : positions 6
    @GetMapping(path = "/positions6", produces = "application/json")
    public List<Position> reponsePositions6(@RequestParam String termeRecherche) {
        System.out.println("=== Requête reçue sur /positions6 ==="); // Log de base
        System.out.println("Terme de recherche: " + termeRecherche);

        try {
            List<Position> result = handleSearchRequest(termeRecherche, SearchLevel.POSITIONS6);
            System.out.println("[CONTROLLER] handleSearchRequest a retourné: " + (result == null ? "null" : result.size() + " éléments"));

            if (result == null) {
                System.out.println("[CONTROLLER] ATTENTION: Résultat null, conversion en liste vide.");
                result = new ArrayList<>();
            }
            return result;
        } catch (Exception e) {
            System.err.println("[CONTROLLER] ERREUR INATTENDUE: " + e.getMessage());
            e.printStackTrace();
            log.error("Erreur lors de la recherche positions6", e);
            // En cas d'erreur, renvoyer une liste vide pour éviter de casser le frontend
            return new ArrayList<>();
        } finally {
            // Toujours nettoyer le ThreadLocal et logger, même en cas d'erreur
            logUsage("/recherche/positions6", termeRecherche);
            OpenAiService.clearCurrentUsage(); // Nettoyage de sécurité
        }
    }
    
    /**
     * Log l'utilisation d'une recherche.
     * Récupère les informations de coût depuis OpenAiService et enregistre le log.
     * Cette méthode est complètement non-bloquante et ne doit jamais faire échouer la requête principale.
     */
    private void logUsage(String endpoint, String searchTerm) {
        try {
            // Récupérer l'utilisateur depuis le contexte de sécurité
            String userId = getCurrentUserId();
            if (userId == null) {
                log.debug("Impossible de récupérer l'utilisateur pour le logging. Utilisation non enregistrée.");
                return;
            }
            
            // Récupérer l'organisation de l'utilisateur (peut être null)
            Long organizationId = null;
            try {
                organizationId = organizationService.getOrganizationIdByUserId(userId);
            } catch (Exception e) {
                // Si on ne peut pas récupérer l'organisation, on continue sans (non bloquant)
                log.debug("Impossible de récupérer l'organisation pour l'utilisateur {}: {}", userId, e.getMessage());
            }
            
            // Récupérer les informations d'utilisation depuis OpenAiService
            UsageInfo usageInfo = OpenAiService.getCurrentUsage();
            if (usageInfo != null && usageInfo.getTokens() != null && usageInfo.getTokens() > 0) {
                // Le service logUsage est déjà non-bloquant, on peut l'appeler sans try-catch
                usageLogService.logUsage(
                    userId,
                    organizationId,
                    endpoint,
                    searchTerm,
                    usageInfo.getTokens(),
                    usageInfo.getCostUsd()
                );
                log.debug("Tentative d'enregistrement du log: userId={}, organizationId={}, endpoint={}, tokens={}, cost={}", 
                         userId, organizationId, endpoint, usageInfo.getTokens(), usageInfo.getCostUsd());
            } else {
                log.debug("Aucune information d'utilisation disponible pour l'endpoint: {} (usageInfo={})", 
                         endpoint, usageInfo != null ? "présent mais tokens=0 ou null" : "null");
            }
        } catch (Exception e) {
            // Double sécurité : ne jamais faire échouer la requête si le logging échoue
            log.warn("Erreur lors du logging de l'utilisation (non bloquant): {}", e.getMessage());
        }
    }
    
    /**
     * Récupère l'ID de l'utilisateur Keycloak depuis le contexte de sécurité.
     * @return L'ID de l'utilisateur (sub du JWT) ou null si non disponible
     */
    private String getCurrentUserId() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.getPrincipal() instanceof Jwt) {
                Jwt jwt = (Jwt) authentication.getPrincipal();
                return jwt.getClaimAsString("sub");
            }
        } catch (Exception e) {
            log.error("Erreur lors de la récupération de l'ID utilisateur", e);
        }
        return null;
    }


    //****************************************************************************************
    // --------------------------------- LOGIQUE DE RECHERCHE EN CASCADE --------------------
    //****************************************************************************************

    private List<Position> handleSearchRequest(String termeRecherche, SearchLevel maxLevel) {
        System.out.println("[HANDLER] --- Début de la recherche en cascade pour '" + termeRecherche + "' (maxLevel: " + maxLevel + ") ---");
        List<Position> reponseList = new ArrayList<>();
        List<Position> positions = new ArrayList<>();
        List<Position> reponseListLevel = new ArrayList<>();
        List<Position> ragNiveau;
        int tentativesMax = 2;

        // --------------------------- Level 0 : Sections ---------------------------------------
        ragNiveau = ragSections();
        System.out.println("[HANDLER] Level 0 (Sections) - Taille du RAG: " + ragNiveau.size());

        int nbTentatives = 0;
        do {
            nbTentatives++;
            System.out.println("[HANDLER] Level 0 -> Tentative " + nbTentatives + "/" + tentativesMax);
            positions = aiService.promptEtReponse(SearchLevel.SECTIONS.toString(), termeRecherche, ragNiveau);
        } while (nbTentatives < tentativesMax && positions.isEmpty());

        System.out.println("[HANDLER] Level 0 -> Résultat de l'IA: " + (positions != null ? positions.size() : "null") + " élément(s)");
        if (positions == null || positions.isEmpty()) {
            System.out.println("[HANDLER] Level 0 -> Aucun résultat. Arrêt de la cascade et retour liste vide.");
            return new ArrayList<>();
        }

        // Description
        if (aiPrompts.defTheme.isWithDescription()) { // affichage avec les descriptions
            for (Position position : positions) {
                String code = position.getCode();
                String description = sectionService.getDescription(code.trim());
                position.setDescription(description);
            }
        }
        // Résultat du niveau
        reponseListLevel.addAll(positions);
        // Cascade
        if (aiPrompts.defTheme.isWithCascade()) { // ajout du niveau au résultat général
            reponseList.addAll(reponseListLevel);
        }
        // si niveau demandé
        if (maxLevel == SearchLevel.SECTIONS) {
            if (!aiPrompts.defTheme.isWithCascade()) { // reponseList contiendra le résultat du niveau courant uniquement
                return reponseListLevel;
            } else {
                return reponseList;
            }
        }

        // ----------------------------- Level 1: Chapitres ----------------------------------------
        reponseListLevel.clear();
        ragNiveau = ragChapitres(positions);
        System.out.println("[HANDLER] Level 1 (Chapitres) - Taille du RAG: " + ragNiveau.size());

        nbTentatives = 0;
        do {
            nbTentatives++;
            System.out.println("[HANDLER] Level 1 -> Tentative " + nbTentatives + "/" + tentativesMax);

            positions = aiService.promptEtReponse(SearchLevel.CHAPITRES.toString(), termeRecherche, ragNiveau);

        } while (nbTentatives < tentativesMax && positions.isEmpty());

        System.out.println("[HANDLER] Level 1 -> Résultat de l'IA: " + (positions != null ? positions.size() : "null") + " élément(s)");
        if (positions == null || positions.isEmpty()) {
            System.out.println("[HANDLER] Level 1 -> Aucun résultat. Arrêt de la cascade et retour liste vide.");
            return new ArrayList<>();
        }

        // Description
        if (aiPrompts.defTheme.isWithDescription()) { // affichage avec les descriptions
            for (Position position : positions) {
                String code = position.getCode();
                String description = chapitreService.getDescription(code);
                position.setDescription(description);
            }
        }
        // Résultat du niveau
        reponseListLevel.addAll(positions);
        // Cascade
        if (aiPrompts.defTheme.isWithCascade()) { // ajout du niveau au résultat général
            reponseList.addAll(reponseListLevel);
        }
        // Si niveau demandé
        if (maxLevel == SearchLevel.CHAPITRES) {
            if (!aiPrompts.defTheme.isWithCascade()) { // reponseList contiendra le résultat du niveau courant uniquement
                return reponseListLevel;
            } else {
                return reponseList;
            }
        }

        // ------------------------------- Level 2 : Positions 4 -------------------------------------------------
        reponseListLevel.clear();
        ragNiveau = ragPositions4(positions);
        System.out.println("[HANDLER] Level 2 (Positions4) - Taille du RAG: " + ragNiveau.size());

        nbTentatives = 0;
        do {
            nbTentatives++;
            System.out.println("[HANDLER] Level 2 -> Tentative " + nbTentatives + "/" + tentativesMax);

                positions = aiService.promptEtReponse(SearchLevel.POSITIONS4.toString(), termeRecherche, ragNiveau);

        } while (nbTentatives < tentativesMax && positions.isEmpty());

        List<Position> positionsPositions4 = positions;
        System.out.println("[HANDLER] Level 2 -> Résultat de l'IA: " + (positions != null ? positions.size() : "null") + " élément(s)");

        if (positions == null || positions.isEmpty()) {
            System.out.println("[HANDLER] Level 2 -> Aucun résultat. Arrêt de la cascade et retour liste vide.");
            return new ArrayList<>();
        }

        // Description
        if (aiPrompts.defTheme.isWithDescription()) { // ajout des descriptions
            for (Position position : positions) {
                String code = position.getCode();
                String description = position4Service.getDescription(code);
                position.setDescription(description);
            }
        }
        // Résultat du niveau
        reponseListLevel.addAll(positions);
        // Cascade
        if (aiPrompts.defTheme.isWithCascade()) { // ajout du niveau au résultat général
            reponseList.addAll(reponseListLevel);
        }
        // si niveau demandé
        if (maxLevel == SearchLevel.POSITIONS4) {
            if (!aiPrompts.defTheme.isWithCascade()) { // reponseList contiendra affichage du niveau courant uniquement
                return reponseListLevel;
            }
            return reponseList;
        }

        // ------------------------------- Level 3 : Positions 6 - le plus haut pour le moment-------------------------------------------------
        reponseListLevel.clear();
        ragNiveau = ragPositions6(positions);
        System.out.println("[HANDLER] Level 3 (Positions6) - Taille du RAG: " + ragNiveau.size());

        nbTentatives = 0;
        do {
            nbTentatives++;
            System.out.println("[HANDLER] Level 3 -> Tentative " + nbTentatives + "/" + tentativesMax);

                positions = aiService.promptEtReponse(SearchLevel.POSITIONS6.toString(), termeRecherche, ragNiveau);

        } while (nbTentatives < tentativesMax && positions.isEmpty());

        //List<Position> positionsPositions6Dz = positions;
        System.out.println("[HANDLER] Level 3 -> Résultat de l'IA: " + (positions != null ? positions.size() : "null") + " élément(s)");

        if (positions == null || positions.isEmpty()) {
            System.out.println("[HANDLER] Level 3 -> Aucun résultat au niveau 6.");
            if (!positionsPositions4.isEmpty()) {
                System.out.println("[HANDLER] Level 3 -> Utilisation des résultats de Level 2 (Positions4): " + positionsPositions4.size() + " élément(s)");
                positions = positionsPositions4;
            } else {
                System.out.println("[HANDLER] Level 3 -> Aucun résultat aux niveaux 2 et 3. Retour null.");
                return new ArrayList<>();
            }
        }
        // Description
        if (aiPrompts.defTheme.isWithDescription()) { // ajout des descriptions
            for (Position position : positions) {
                String code = position.getCode();
                String description = position6DzService.getDescription(code);
                position.setDescription(description);
            }
        }
        // Résultat du niveau
        reponseListLevel.addAll(positions);
        // Cascade
        if (aiPrompts.defTheme.isWithCascade()) { // ajout du niveau au résultat général
            reponseList.addAll(reponseListLevel);
        }
        // si niveau demandé
        if (maxLevel == SearchLevel.POSITIONS6) {
            if (!aiPrompts.defTheme.isWithCascade()) {
                System.out.println("[HANDLER] --- Fin recherche (sans cascade). Retour: " + reponseListLevel.size() + " élément(s) ---");
                return reponseListLevel;
            }
            System.out.println("[HANDLER] --- Fin recherche (avec cascade). Retour: " + reponseList.size() + " élément(s) ---");
            return reponseList;
        }

        // Réponse genérale
        System.out.println("[HANDLER] --- Fin recherche générale. Retour: " + reponseList.size() + " élément(s) ---");
        return reponseList;
    }


    //****************************************************************************************
    // --------------------------------- GÉNÉRATION DU CONTEXTE (RAG) -----------------------
    //****************************************************************************************

    /**
     * Crée le contexte (RAG) pour la recherche de CHAPITRES en listant toutes les sections disponibles.
     *
     * @return Une liste de Positions contenant les sections.
     */
    private List<Position> ragSections() {
        List<Section> results = sectionService.getAllSections();
        return results.stream()
                .map(section -> new Position(section.getCode(), section.getDescription()))
                .collect(Collectors.toList());
    }

    private List<Position> ragChapitres(List<Position> listePositions) {
        if (listePositions != null && !listePositions.isEmpty()) {
            return listePositions.stream()
                    .flatMap(position -> chapitreService.getChapitresBySection(position.getCode()).stream())
                    .map(chapitre -> new Position(chapitre.getCode(), chapitre.getDescription()))
                    .collect(Collectors.toList());
        } else { // si la liste des sections condidates est vide, RAG = liste de tous les chapitres
            List<Chapitre> results = chapitreService.getAllChapitres();
            return results.stream()
                    .map(chapitre -> new Position(chapitre.getCode(), chapitre.getDescription()))
                    .collect(Collectors.toList());
        }
    }

    private List<Position> ragPositions4(List<Position> listePositions) {
        return listePositions.stream()
                .flatMap(position -> {
                    String chapterCodePrefix = position.getCode() + "%";
                    return position4Service.getPosition4sByPrefix(chapterCodePrefix).stream();
                })
                .map(pos4 -> new Position(pos4.getCode(), pos4.getDescription()))
                .collect(Collectors.toList());
    }

    private List<Position> ragPositions6(List<Position> listePositions) {
        return listePositions.stream()
                .flatMap(position -> {
                    String position4CodePrefix = position.getCode() + "%";
                    return position6DzService.getPosition6DzsByPrefix(position4CodePrefix).stream();
                })
                .map(pos6 -> new Position(pos6.getCode(), pos6.getDescription()))
                .collect(Collectors.toList());
    }
}
