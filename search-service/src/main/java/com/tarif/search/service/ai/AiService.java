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
        return "Produit recherché : \"" + termeRecherche + "\"\n\n" +
                "Voici la liste complète des codes douaniers à analyser :\n" +
                "<codes_douaniers>\n" +
                ragString + "\n" +
                "</codes_douaniers>\n\n" +
                "À partir de cette liste, identifiez tous les codes dont la description correspond au produit \"" +
                termeRecherche + "\".\n\n" +
                "IMPORTANT : Si le produit contient des critères numériques (cylindrée, poids, teneur, dimensions, etc.), " +
                "vous devez EXCLURE tout code dont la description contient des valeurs numériques qui CONTREDISENT ces critères. " +
                "Note : les descriptions utilisent la notation française avec espace pour les milliers (ex: \"1 000\" = 1000, \"2 000\" = 2000, \"1 500\" = 1500). " +
                "Tenez compte de cette notation lors de la comparaison des valeurs numériques. " +
                "Par exemple, si le produit précise \"cylindrée supérieure à 2000 cm3\", " +
                "excluez tous les codes mentionnant \"n'excédant pas 1 000 cm3\", \"n'excédant pas 1 500 cm3\", \"n'excédant pas 2 000 cm3\" etc.\n\n" +
                "Répondez uniquement avec le tableau JSON, sans aucun texte avant ou après.";
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
