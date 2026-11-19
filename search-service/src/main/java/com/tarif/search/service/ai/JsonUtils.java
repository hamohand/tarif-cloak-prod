package com.tarif.search.service.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tarif.search.model.Position;

import java.util.ArrayList;
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
            return new ArrayList<>(objectMapper.readValue(jsonPourListe, new TypeReference<List<Position>>() {}));
        }

        // Cas 2 : objet contenant un tableau (ex: {"codes": [...]} ou {"results": [...]})
        // → format standard avec response_format=json_object
        if (jsonPourListe.startsWith("{")) {
            var tree = objectMapper.readTree(jsonPourListe);
            for (var entry : tree.properties()) {
                if (entry.getValue().isArray()) {
                    List<Position> list = objectMapper.convertValue(
                            entry.getValue(),
                            new TypeReference<List<Position>>() {}
                    );
                    return list != null ? new ArrayList<>(list) : new ArrayList<>();
                }
            }
            // Aucun tableau trouvé → traiter l'objet racine comme un seul élément
            Position single = objectMapper.treeToValue(tree, Position.class);
            List<Position> result = new ArrayList<>(1);
            result.add(single);
            return result;
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
