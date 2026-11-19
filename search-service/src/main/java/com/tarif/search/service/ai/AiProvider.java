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
     * Variante permettant d'autoriser ou non l'utilisation d'un modèle rapide (fast-model)
     * pour les niveaux larges de la cascade.
     */
    default String demanderAiAide(String titre, String question, boolean withJustification, String niveau, boolean allowFastModel) {
        return demanderAiAide(titre, question, withJustification, niveau);
    }

    /**
     * Indique si le modèle rapide doit être utilisé pour le niveau donné.
     */
    static boolean shouldUseFastModel(boolean allowFastModel, boolean withJustification, String fastModel, String niveau) {
        return allowFastModel
                && !withJustification
                && fastModel != null
                && !fastModel.isBlank()
                && ("SECTIONS".equals(niveau) || "CHAPITRES".equals(niveau));
    }

    /**
     * Cumule l'utilisation de tokens et le coût sur l'ensemble des niveaux de la cascade.
     */
    static void accumulateUsage(
            ThreadLocal<UsageInfo> holder,
            int promptTokens,
            int completionTokens,
            int totalTokens,
            double baseRequestPrice,
            double tokenCostUsd) {
        UsageInfo existing = holder.get();
        if (existing == null) {
            holder.set(new UsageInfo(totalTokens, baseRequestPrice, promptTokens, completionTokens, tokenCostUsd));
        } else {
            existing.setTokens((existing.getTokens() != null ? existing.getTokens() : 0) + totalTokens);
            existing.setPromptTokens((existing.getPromptTokens() != null ? existing.getPromptTokens() : 0) + promptTokens);
            existing.setCompletionTokens((existing.getCompletionTokens() != null ? existing.getCompletionTokens() : 0) + completionTokens);
            existing.setTokenCostUsd((existing.getTokenCostUsd() != null ? existing.getTokenCostUsd() : 0.0) + tokenCostUsd);
        }
    }

    /**
     * Récupère les informations d'utilisation de la dernière requête.
     */
    UsageInfo getLastUsageInfo();

    /**
     * Nettoie les informations d'utilisation.
     */
    void clearUsageInfo();
}
