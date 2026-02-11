package com.tarif.search.service.ai.batch;

import com.tarif.search.service.ai.batch.models.BatchResult;
import com.tarif.search.service.ai.batch.models.BatchStatus;
import com.tarif.search.service.ai.batch.models.SearchRequest;

import java.util.List;

/**
 * Interface pour les providers de traitement par lots (Batch API).
 * Permet d'abstraire les différences entre les APIs Anthropic, OpenAI, etc.
 */
public interface BatchProvider {

    /**
     * Crée un nouveau batch de recherches.
     * @param requests Liste des requêtes de recherche
     * @return L'ID du batch créé, ou null en cas d'erreur
     */
    String createBatch(List<SearchRequest> requests);

    /**
     * Récupère le statut d'un batch.
     * @param batchId ID du batch
     * @return Le statut du batch, ou null si non trouvé
     */
    BatchStatus getBatchStatus(String batchId);

    /**
     * Récupère les résultats d'un batch terminé.
     * @param batchId ID du batch
     * @return Liste des résultats, vide si batch pas terminé
     */
    List<BatchResult> getBatchResults(String batchId);

    /**
     * Annule un batch en cours.
     * @param batchId ID du batch
     * @return true si annulé avec succès
     */
    boolean cancelBatch(String batchId);

    /**
     * Indique si ce provider supporte les opérations batch.
     * @return true si batch supporté
     */
    default boolean supportsBatching() {
        return true;
    }
}
