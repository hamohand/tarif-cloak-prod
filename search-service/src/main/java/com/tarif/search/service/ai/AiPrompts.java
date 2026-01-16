package com.tarif.search.service.ai;

import lombok.Data;
import org.springframework.stereotype.Component;

@Component
@Data
public class AiPrompts {

    public DefTheme defTheme = DefTheme.getThemeDescrip();

    public static String getSystemMessage(boolean withJustification) {
        if (withJustification) {
            return SYSTEM_MESSAGE_TEMPLATE
                    .replace("{instruction_details}", INSTRUCTION_DETAILS_JUSTIFIED)
                    .replace("{format_example}", FORMAT_EXAMPLE_JUSTIFIED)
                    .replace("{json_keys}", JSON_KEYS_JUSTIFIED)
                    .replace("{examples}", EXAMPLES_JUSTIFIED);
        } else {
            return SYSTEM_MESSAGE_TEMPLATE
                    .replace("{instruction_details}", INSTRUCTION_DETAILS_SIMPLE)
                    .replace("{format_example}", FORMAT_EXAMPLE_SIMPLE)
                    .replace("{json_keys}", JSON_KEYS_SIMPLE)
                    .replace("{examples}", EXAMPLES_SIMPLE);
        }
    }

    private static final String SYSTEM_MESSAGE_TEMPLATE = """
            Extraction intelligente de codes douaniers
              Vous êtes un assistant multilingue spécialisé dans le domaine de la recherche des codes douaniers du commerce international.
               Tâche :
               À partir d'une liste complète ou partielle de codes douaniers (codes SH/HS/Harmonized System), identifie tous les codes et leurs descriptions qui pourraient raisonnablement s'appliquer au produit suivant :
               Produit cible : {décrire précisément le produit, ses caractéristiques, son usage, ses matériaux, sa nature, etc.}

               Instructions :
               - Analyse sémantiquement la description du produit.
               - Scanne la liste des codes douaniers fournie.
               - Sélectionne tous les codes dont les descriptions sont susceptibles de s'appliquer au produit, que ce soit de manière :
                    * directe (correspondance explicite),\s
                    * ou indirecte (correspondance potentielle selon l'usage ou le matériau).
               - Pour chaque code sélectionné, fournis :{instruction_details}

               Format de sortie attendu un tableau JSON :
               Exemples de sortie :
           {format_example}

               Remarques :
                   Si plusieurs codes sont pertinents selon des contextes ou des interprétations différentes (ex : selon matière, usage, ou destination du produit), indique-les tous.
                   Ne sélectionne aucun code hors sujet, même si une partie du libellé semble correspondre.

               Veuillez répondre uniquement au format JSON avec les clés {json_keys}.\s
               Toujours retourner un tableau JSON, même s'il ne contient qu'un seul élément ou est vide.

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
               Exemple 1 :
                    USER : Pommes.
                    ASSISTANT :\s
                    [
                       {
                                "code": "08",
                                "justification": "C'est un code précis"
                       }
                   ]

               Exemple 2 :
                    USER : T-shirt à manches courtes, en coton 100%, destiné aux hommes.
                    ASSISTANT :\s
                    [
                       {
                                "code": "6109 10",
                                "justification": "C'est le code le plus précis pour les t-shirts en coton."
                       },
                       {
                                "code": "6109 90",
                                "justification": "Alternative si mélange de fibres."
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
               """;
}
