package com.muhend.backend.codesearch.repository;

import com.muhend.backend.codesearch.model.Position10Dz;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface Position10DzRepository extends JpaRepository<Position10Dz, Long> {

    Optional<Position10Dz> findByCode(String code);

    @Query("SELECT a FROM Position10Dz a WHERE a.code LIKE :prefix AND LENGTH(a.code) = 10")
    List<Position10Dz> findAllByPrefix(@Param("prefix") String prefix);

    @Query("SELECT a FROM Position10Dz a WHERE a.code LIKE :prefix AND LENGTH(a.code) = 10 ORDER BY a.id ASC")
    List<Position10Dz> findAllByPrefixWithId(@Param("prefix") String prefix);

    /**
     * Trouve le premier titre hiérarchique (code='', commençant par '-') avant une position donnée
     * au sein de la même Position4, dont le nombre de tirets est strictement inférieur à nTirets.
     * Formule PostgreSQL : (char_length - char_length(ltrim)) / 2 = nb de "- " en préfixe.
     */
    @Query(value = """
        SELECT id, description FROM position10_dz
        WHERE code = ''
          AND description LIKE '-%'
          AND id < :beforeId
          AND id > COALESCE((SELECT MAX(id) FROM position10_dz WHERE char_length(code) = 4 AND id < :beforeId), 0)
          AND (char_length(description) - char_length(ltrim(description, '- '))) / 2 < :nTirets
        ORDER BY id DESC LIMIT 1
        """, nativeQuery = true)
    List<Object[]> findFirstTitleBeforeWithFewerDashes(
            @Param("beforeId") long beforeId,
            @Param("nTirets") int nTirets);

    /**
     * Retourne tous les codes P10 (10 chiffres) ET les titres hiérarchiques (code='' et '-' en préfixe)
     * dans l'ordre id, pour la plage couvrant le préfixe donné.
     */
    @Query(value = """
        SELECT * FROM position10_dz
        WHERE id >= (SELECT MIN(id) FROM position10_dz WHERE code LIKE :prefix AND char_length(code) = 10)
          AND id <= (SELECT MAX(id) FROM position10_dz WHERE code LIKE :prefix AND char_length(code) = 10)
          AND (char_length(code) = 10 OR (code = '' AND description LIKE '-%'))
        ORDER BY id ASC
        """, nativeQuery = true)
    List<Position10Dz> findAllWithContextByPrefix(@Param("prefix") String prefix);
}
