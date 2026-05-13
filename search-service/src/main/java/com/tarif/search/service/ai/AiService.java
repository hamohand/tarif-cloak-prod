package com.tarif.search.service.ai;

import com.tarif.search.model.Position;
import com.tarif.search.model.UsageInfo;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

/**
 * Service principal d'IA qui orchestre les différents providers.
 */
@Service
@Slf4j
public class AiService {

    private final OpenAiService openAiService;
    private final AnthropicService anthropicService;
    private final OllamaService ollamaService;
    private final String activeProvider;

    public AiService(
            OpenAiService openAiService,
            AnthropicService anthropicService,
            OllamaService ollamaService,
            @Value("${ai.provider:openai}") String activeProvider) {
        this.openAiService = openAiService;
        this.anthropicService = anthropicService;
        this.ollamaService = ollamaService;
        this.activeProvider = activeProvider;
        log.info("AiService initialisé avec le provider: {}", activeProvider);
    }

    /**
     * Recherche les positions pertinentes en utilisant l'IA.
     */
    public List<Position> promptEtReponse(String titre, String termeRecherche, List<Position> listePositions, boolean withJustification) {
        StringBuilder leRAG = creerContexteRAG(titre, listePositions);
        // AiProviderException remonte librement pour permettre le retry dans executeWithRetry
        String reponseIaJson = obtenirReponseJsonDeIA(titre, leRAG, termeRecherche, withJustification);
        String jsonNettoye = JsonUtils.cleanJsonString(reponseIaJson);

        if (!JsonUtils.isValidJson(jsonNettoye)) {
            log.warn("{} - Réponse IA non JSON : {}", titre, reponseIaJson);
            return Collections.emptyList();
        }

        try {
            return JsonUtils.conversionReponseIaToList(jsonNettoye);
        } catch (Exception ex) {
            log.warn("{} - Échec parsing JSON : {}", titre, ex.getMessage());
            return Collections.emptyList();
        }
    }

    private String obtenirReponseJsonDeIA(String titre, StringBuilder ragString, String termeRecherche, boolean withJustification) {
        String prompt = AiPrompts.buildUserPrompt(ragString.toString(), termeRecherche);
        return getActiveProvider().demanderAiAide(titre, prompt, withJustification, titre);
    }

    private AiProvider getActiveProvider() {
        return switch (activeProvider.toLowerCase()) {
            case "anthropic" -> anthropicService;
            case "ollama" -> ollamaService;
            default -> openAiService;
        };
    }

    private StringBuilder formatterPosition(String code, String description, String justification) {
        StringBuilder affichePosition = new StringBuilder();
        affichePosition.append(" - Code = ").append(code).append(" -\n\n");
        if (description != null && !description.isEmpty()) {
            affichePosition.append("   _Description : ").append(description).append("\n\n");
        }
        if (justification != null && !justification.isEmpty()) {
            affichePosition.append("   _Justification: ").append(justification).append("\n\n");
        }
        return affichePosition;
    }

    private StringBuilder creerContexteRAG(String titre, List<Position> positions) {
        StringBuilder stringRAG = new StringBuilder("RAG pour la recherche des : " + titre + "\n\n");
        for (Position position : positions) {
            if (position.getCode() == null || position.getCode().isBlank()) {
                // Note explicative (section ou chapitre) — balisage XML structuré
                String desc = position.getDescription();
                if (desc.startsWith("[Note de la Section")) {
                    String code = desc.substring(desc.indexOf("Section") + 8, desc.indexOf("]"));
                    String note = desc.substring(desc.indexOf("]") + 2);
                    stringRAG.append("<note_section code=\"").append(code.trim()).append("\">\n")
                             .append(note).append("\n</note_section>\n");
                } else if (desc.startsWith("[Note du chapitre")) {
                    String code = desc.substring(desc.indexOf("chapitre") + 9, desc.indexOf("]"));
                    String note = desc.substring(desc.indexOf("]") + 2);
                    stringRAG.append("<note_chapitre code=\"").append(code.trim()).append("\">\n")
                             .append(note).append("\n</note_chapitre>\n");
                } else {
                    // Autres lignes de contexte génériques
                    String label = desc.replaceAll("^[- ]+", "").trim();
                    stringRAG.append("[Catégorie : ").append(label).append("]\n");
                }
            } else {
                stringRAG.append(formatterPosition(position.getCode(), position.getDescription(), null));
            }
        }
        return stringRAG;
    }

    public StringBuilder formatterListeReponsesPourAffichage(String titre, List<Position> positions) {
        StringBuilder resultatAffiche = new StringBuilder("** " + titre + " **" + "\n\n");
        if (!positions.isEmpty()) {
            for (Position position : positions) {
                resultatAffiche.append("\n\n").append(
                        formatterPosition(position.getCode(), position.getDescription(), position.getJustification())
                );
            }
        } else {
            resultatAffiche.append("Terme insuffisant, aucune réponse trouvée. Donnez plus de précisions.");
        }
        return resultatAffiche;
    }

    /**
     * Récupère les informations d'utilisation du provider actif.
     */
    public UsageInfo getCurrentUsage() {
        return getActiveProvider().getLastUsageInfo();
    }

    /**
     * Nettoie les informations d'utilisation.
     */
    public void clearCurrentUsage() {
        getActiveProvider().clearUsageInfo();
    }
}
