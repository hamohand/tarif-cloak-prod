package com.tarif.search.service.ai;

import com.tarif.search.model.UsageInfo;

/**
 * Interface commune pour tous les providers IA.
 */
public interface AiProvider {

    /**
     * Envoie une requête à l'IA et retourne la réponse.
     *
     * @param titre             Le titre/niveau de la recherche (SECTIONS, CHAPITRES, etc.)
     * @param question          Le prompt complet avec le RAG
     * @param withJustification Si true, demande des justifications dans la réponse
     * @param niveau            Le nom du niveau (pour adapter system message et max_tokens)
     * @return La réponse JSON de l'IA
     */
    String demanderAiAide(String titre, String question, boolean withJustification, String niveau);

    /**
     * Récupère les informations d'utilisation de la dernière requête.
     */
    UsageInfo getLastUsageInfo();

    /**
     * Nettoie les informations d'utilisation.
     */
    void clearUsageInfo();
}
