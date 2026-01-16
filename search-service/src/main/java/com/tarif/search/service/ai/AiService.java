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
    public List<Position> promptEtReponse(String titre, String termeRecherche, List<Position> listePositions) {
        try {
            StringBuilder leRAG = creerContexteRAG(titre, listePositions);
            String reponseIaJson = obtenirReponseJsonDeIA(titre, leRAG, termeRecherche);
            String jsonNettoye = JsonUtils.cleanJsonString(reponseIaJson);

            if (!JsonUtils.isValidJson(jsonNettoye)) {
                return Collections.emptyList();
            }

            return JsonUtils.conversionReponseIaToList(jsonNettoye);
        } catch (Exception ex) {
            log.error("Erreur lors du traitement IA: {}", ex.getMessage());
            return Collections.emptyList();
        }
    }

    private String construirePrompt(StringBuilder ragString, String termeRecherche) {
        return "En utilisant la liste suivante : \n" +
                ragString + "\n" +
                "Recherchez tous les items qui contiennent la catégorie qui correspond à : \"" +
                termeRecherche + "\"." +
                "L'aspect qui nous intéresse est la valeur du code.";
    }

    private String obtenirReponseJsonDeIA(String titre, StringBuilder ragString, String termeRecherche) {
        String prompt = construirePrompt(ragString, termeRecherche);
        try {
            return getActiveProvider().demanderAiAide(titre, prompt);
        } catch (Exception e) {
            log.error("Erreur lors de l'appel IA: {}", e.getMessage());
            return "";
        }
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
            stringRAG.append(formatterPosition(position.getCode(), position.getDescription(), null));
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
