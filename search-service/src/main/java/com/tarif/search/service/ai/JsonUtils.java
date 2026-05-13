package com.tarif.search.service.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarif.search.model.Position;

import java.util.List;

/**
 * Utilitaires pour le traitement JSON des réponses IA.
 */
public class JsonUtils {

    private static final String JSON_PREFIX = "json";
    private static final char BACKTICK = '`';
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private JsonUtils() {
    }

    public static List<Position> conversionReponseIaToList(String cleanedJson) throws JsonProcessingException {
        String jsonPourListe = cleanedJson.trim();

        // Cas 1 : tableau direct [...]
        if (jsonPourListe.startsWith("[")) {
            return objectMapper.readValue(jsonPourListe, new TypeReference<List<Position>>() {});
        }

        // Cas 2 : objet contenant un tableau (ex: {"codes": [...]} ou {"results": [...]})
        // → fréquent quand response_format=json_object est activé
        if (jsonPourListe.startsWith("{")) {
            var tree = objectMapper.readTree(jsonPourListe);
            // Chercher la première valeur qui est un tableau
            var fields = tree.fields();
            while (fields.hasNext()) {
                var field = fields.next();
                if (field.getValue().isArray()) {
                    return objectMapper.readValue(
                            field.getValue().toString(),
                            new TypeReference<List<Position>>() {}
                    );
                }
            }
            // Aucun tableau trouvé → traiter l'objet racine comme un seul élément
            Position single = objectMapper.readValue(jsonPourListe, Position.class);
            return List.of(single);
        }

        throw new RuntimeException("Format JSON inattendu : " + jsonPourListe.substring(0, Math.min(100, jsonPourListe.length())));
    }

    public static String cleanJsonString(String jsonResponse) {
        if (jsonResponse == null || jsonResponse.isBlank()) {
            throw new RuntimeException("Réponse JSON vide ou nulle !");
        }

        String cleanedJson = jsonResponse.trim();
        cleanedJson = removeEnclosingBackticks(cleanedJson);

        if (cleanedJson.startsWith(JSON_PREFIX)) {
            cleanedJson = cleanedJson.substring(JSON_PREFIX.length()).trim();
        }

        if (!isValidJson(cleanedJson)) {
            throw new RuntimeException("Veuillez donner plus de précisions. La réponse n'est pas un JSON valide : " + cleanedJson);
        }

        return cleanedJson;
    }

    public static String removeEnclosingBackticks(String json) {
        while (json.startsWith(String.valueOf(BACKTICK))) {
            json = json.substring(1).trim();
        }
        while (json.endsWith(String.valueOf(BACKTICK))) {
            json = json.substring(0, json.length() - 1).trim();
        }
        return json;
    }

    public static boolean isValidJson(String json) {
        try {
            objectMapper.readTree(json);
            return true;
        } catch (JsonProcessingException e) {
            return false;
        }
    }
}
