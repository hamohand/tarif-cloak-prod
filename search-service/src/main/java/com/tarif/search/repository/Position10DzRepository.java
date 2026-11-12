package com.tarif.search.repository;

import com.tarif.search.model.Position10Dz;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface Position10DzRepository extends JpaRepository<Position10Dz, Long> {

    Optional<Position10Dz> findByCode(String code);

    boolean existsByCode(String code);

    @Query("SELECT p FROM Position10Dz p WHERE p.code LIKE :prefix")
    List<Position10Dz> findAllByPrefix(@Param("prefix") String prefix);

    /**
     * Récupère tous les codes du préfixe ET les titres hiérarchiques (code='', commençant par '-')
     * y compris ceux situés juste avant le premier code du préfixe, dans l'ordre d'id.
     */
    @Query(value = """
        WITH bounds AS (
            SELECT MIN(id) AS min_id, MAX(id) AS max_id
            FROM position10_dz
            WHERE code LIKE :prefix AND code != ''
        ),
        prev_code AS (
            SELECT COALESCE(MAX(p.id), 0) AS prev_id
            FROM position10_dz p, bounds b
            WHERE b.min_id IS NOT NULL
              AND p.code != ''
              AND p.id < b.min_id
        )
        SELECT p.* FROM position10_dz p, bounds b, prev_code pc
        WHERE b.min_id IS NOT NULL
          AND p.id > pc.prev_id
          AND p.id <= b.max_id
          AND (p.code != '' OR p.description LIKE '-%')
        ORDER BY p.id ASC
        """, nativeQuery = true)
    List<Position10Dz> findAllWithContextByPrefix(@Param("prefix") String prefix);
}
