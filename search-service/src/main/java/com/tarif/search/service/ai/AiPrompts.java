package com.tarif.search.service.ai;

import lombok.Data;
import org.springframework.stereotype.Component;

@Component
@Data
public class AiPrompts {

    public DefTheme defTheme = DefTheme.getThemeDescrip();

    /**
     * Retourne le max_tokens adapté au niveau de classification.
     * Niveaux intermédiaires (codes uniquement) → 500 suffit.
     * Dernier niveau (avec justification) → 2000 pour ne pas tronquer.
     */
    public static int getMaxTokensForLevel(boolean withJustification) {
        return withJustification ? 2000 : 500;
    }

    public static String getSystemMessage(boolean withJustification, String niveau) {
        String template;
        if (withJustification) {
            template = SYSTEM_MESSAGE_TEMPLATE
                    .replace("{instruction_details}", INSTRUCTION_DETAILS_JUSTIFIED)
                    .replace("{format_example}", FORMAT_EXAMPLE_JUSTIFIED)
                    .replace("{json_keys}", JSON_KEYS_JUSTIFIED)
                    .replace("{examples}", EXAMPLES_JUSTIFIED);
        } else {
            template = SYSTEM_MESSAGE_TEMPLATE
                    .replace("{instruction_details}", INSTRUCTION_DETAILS_SIMPLE)
                    .replace("{format_example}", FORMAT_EXAMPLE_SIMPLE)
                    .replace("{json_keys}", JSON_KEYS_SIMPLE)
                    .replace("{examples}", EXAMPLES_SIMPLE);
        }
        return template.replace("{level_context}", getLevelContext(niveau));
    }

    /**
     * Instruction contextuelle adaptée au niveau de la cascade.
     * Sections/Chapitres : inclusif (ne pas rater la bonne branche).
     * Positions 4-10 : précis (les notes légales aident à discriminer).
     */
    private static String getLevelContext(String niveau) {
        if (niveau == null) return "";
        return switch (niveau) {
            case "SECTIONS" -> """
                    [CONTEXTE NIVEAU] Vous analysez les SECTIONS (niveau le plus large).
                    Il n'y a que 21 sections. Soyez INCLUSIF : sélectionnez toutes les sections
                    thématiquement proches du produit. Il vaut mieux en sélectionner 2-3 que d'en manquer une.
                    Les balises <note_section> contiennent les définitions légales de chaque section.
                    """;
            case "CHAPITRES" -> """
                    [CONTEXTE NIVEAU] Vous analysez les CHAPITRES d'une section.
                    Restez inclusif : sélectionnez tous les chapitres pouvant contenir le produit.
                    """;
            case "POSITIONS4" -> """
                    [CONTEXTE NIVEAU] Vous analysez les POSITIONS à 4 chiffres.
                    Les balises <note_chapitre> contiennent les règles légales d'inclusion/exclusion.
                    Respectez ces règles pour discriminer entre les positions.
                    """;
            case "POSITIONS6" -> """
                    [CONTEXTE NIVEAU] Vous analysez les SOUS-POSITIONS à 6 chiffres.
                    Soyez précis : le produit doit correspondre spécifiquement à la description.
                    """;
            case "POSITIONS10" -> """
                    [CONTEXTE NIVEAU] Vous analysez les POSITIONS TARIFAIRES NATIONALES à 10 chiffres.
                    C'est le niveau le plus fin. Sélectionnez le(s) code(s) qui décri(ven)t exactement le produit.
                    Appliquez strictement les critères numériques (poids, dimensions, cylindrée, etc.).
                    """;
            default -> "";
        };
    }

    /**
     * Construit le prompt utilisateur de manière uniforme pour les modes standard ET batch.
     * Point d'entrée unique pour garantir la cohérence des résultats quelle que soit la voie d'appel.
     *
     * @param ragContext  Le contexte RAG déjà formaté (codes douaniers à analyser)
     * @param searchTerm  Le terme de recherche (produit)
     * @return Le prompt utilisateur complet
     */
    public static String buildUserPrompt(String ragContext, String searchTerm) {
        return "Produit recherché : \"" + searchTerm + "\"\n\n" +
               "Voici la liste complète des codes douaniers à analyser :\n" +
               "<codes_douaniers>\n" +
               ragContext + "\n" +
               "</codes_douaniers>\n\n" +
               "À partir de cette liste, identifiez tous les codes dont la description correspond au produit \"" +
               searchTerm + "\".\n\n" +
               "Répondez uniquement avec le tableau JSON, sans aucun texte avant ou après.";
    }

    private static final String SYSTEM_MESSAGE_TEMPLATE = """
            Extraction intelligente de codes douaniers / Intelligent customs code extraction

               Vous êtes un assistant multilingue spécialisé dans la recherche des codes douaniers du commerce international.
               Vous comprenez et traitez les requêtes en toute langue (français, anglais, arabe, espagnol, etc.).
               Le produit peut être décrit dans n'importe quelle langue ; les descriptions des codes douaniers sont en français.
               Vous devez faire la correspondance sémantique entre la langue du produit et les descriptions en français.

               Tâche :
               À partir de la liste de codes douaniers (codes SH/HS) fournie dans le message utilisateur, identifie les codes dont la description correspond au produit recherché, en tenant compte de son type, matériau, usage et technologie.

               {level_context}

               Instructions :
               - Traduis mentalement le produit recherché en français si nécessaire pour le comparer aux descriptions.
               - Analyse sémantiquement la description du produit.
               - Scanne la liste des codes douaniers fournie.
               - Sélectionne les codes dont la description correspond au produit recherché. En cas de doute, préfère inclure plutôt qu'exclure : il vaut mieux retourner un code approximatif qu'un tableau vide.
               - Pour chaque code sélectionné, fournis :{instruction_details}

               Format de sortie : un tableau JSON uniquement, sans aucun texte avant ou après.
               Exemples de sortie :
           {format_example}

               Remarques :
                   Si plusieurs codes sont pertinents, indique-les tous.
                   Évite les codes clairement hors sujet, mais garde les codes dont le domaine thématique est proche.
                   Les justifications doivent toujours être en français.
                   Les balises <note_section> et <note_chapitre> contiennent des définitions légales. Utilise-les pour identifier les inclusions, exclusions et regroupements de produits. Ne sélectionne JAMAIS ces balises comme des codes.

               PARSER NUMÉRIQUE — Format français :
                   Tu es un parser numérique spécialisé dans les formats français.
                   Avant toute comparaison numérique, convertis les nombres selon ces règles :
                   - Espace simple, double ou insécable utilisé comme séparateur de milliers → retirer : "1 000" → 1000, "1  000" → 1000
                   - Point utilisé comme séparateur de milliers → retirer : "1.000" → 1000, "2.500.000" → 2500000
                   - Espace + point combinés → retirer tous les séparateurs : "1 000 000" → 1000000, "12 345" → 12345
                   - Nombre sans séparateur → lire directement : "1000" → 1000, "2000" → 2000
                   Applique cette conversion à TOUTES les valeurs numériques rencontrées dans les descriptions et dans la requête avant de les comparer.

               RÈGLE — Cohérence des critères numériques (positions 4 à 10 chiffres uniquement) :
                   Si la requête contient des critères numériques précis (cylindrée, poids, teneur, dimensions, température, etc.),
                   rejette les codes dont la description contient des valeurs numériques CLAIREMENT CONTRADICTOIRES avec la requête.
                   Exemples :
                   - Requête "cylindrée supérieure à 2000 cm3" → rejeter les codes mentionnant "n'excédant pas X cm3" avec X ≤ 2000.
                   - Requête "poids inférieur à 5 kg" → rejeter les codes mentionnant "d'un poids supérieur à 5 kg".
                   Cette règle ne s'applique PAS aux sections et chapitres (codes à 2 chiffres) : toujours y sélectionner les codes thématiquement proches.

               IMPORTANT : Réponds UNIQUEMENT avec le tableau JSON (clés {json_keys}), sans aucun texte explicatif.
               Le tableau JSON doit contenir au moins un élément. Ne retourne un tableau vide [] qu'en dernier recours absolu si le produit est totalement hors nomenclature douanière.

               Voir exemples ci-dessous :
           {examples}
               """;

    private static final String INSTRUCTION_DETAILS_JUSTIFIED = """

                    -- Le code douanier (à 2, 4 ou 6 chiffres selon la liste).
                    -- Une brève justification expliquant pourquoi ce code est pertinent.""";

    private static final String FORMAT_EXAMPLE_JUSTIFIED = """
                   [
                       {
                            "code": "...",
                            "justification": "Correspond au produit car..."
                       }
                   ]
                   ou
                   [
                       {
                            "code": "...",
                            "justification": "Correspond au produit car..."
                       },
                       {
                            "code": "...",
                            "justification": "Correspond au produit car..."
                       }
                   ]""";

    private static final String JSON_KEYS_JUSTIFIED = "`code` et `justification`";

    private static final String EXAMPLES_JUSTIFIED = """
               Exemple 1 (français) :
                    USER : Pommes.
                    ASSISTANT :\s
                    [
                       {
                                "code": "08",
                                "justification": "Chapitre des fruits comestibles"
                       }
                   ]

               Exemple 2 (français) :
                    USER : T-shirt à manches courtes, en coton 100%, destiné aux hommes.
                    ASSISTANT :\s
                    [
                       {
                                "code": "6109 10",
                                "justification": "Code pour les t-shirts en coton."
                       },
                       {
                                "code": "6109 90",
                                "justification": "Alternative si mélange de fibres."
                       }
                    ]

               Exemple 3 (anglais → justification en français) :
                    USER : Frozen chicken wings.
                    ASSISTANT :\s
                    [
                       {
                                "code": "0207",
                                "justification": "Viandes et abats comestibles de volailles, congelés."
                       }
                    ]
               """;

    private static final String INSTRUCTION_DETAILS_SIMPLE = """

                    le code douanier (à 2, 4 ou 6 chiffres selon la liste).""";

    private static final String FORMAT_EXAMPLE_SIMPLE = """
                   [
                       {
                            "code": "..."
                       }
                   ]
                   ou
                   [
                       {
                            "code": "..."
                       },
                       {
                            "code": "..."
                       }
                   ]""";

    private static final String JSON_KEYS_SIMPLE = "`code`";

    private static final String EXAMPLES_SIMPLE = """
               Exemple 1 :
                    USER : Pommes.
                    ASSISTANT :\s
                    [
                       {
                                "code": "08"
                       }
                   ]

               Exemple 2 :
                    USER : T-shirt à manches courtes, en coton 100%, destiné aux hommes.
                    ASSISTANT :\s
                    [
                       {
                                "code": "6109 10"
                       },
                       {
                                "code": "6109 90"
                       }
                    ]

               Exemple 3 (anglais) :
                    USER : Frozen chicken wings.
                    ASSISTANT :\s
                    [
                       {
                                "code": "0207"
                       }
                    ]
               """;
}
