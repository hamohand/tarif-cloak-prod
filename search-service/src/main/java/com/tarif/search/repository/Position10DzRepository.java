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
     * Récupère tous les codes du préfixe ET les titres (code='') intercalés,
     * dans l'ordre d'id, pour fournir le contexte hiérarchique à l'IA.
     */
    @Query(value = """
        SELECT * FROM position10_dz
        WHERE id >= (SELECT MIN(id) FROM position10_dz WHERE code LIKE :prefix AND code != '')
          AND id <= (SELECT MAX(id) FROM position10_dz WHERE code LIKE :prefix AND code != '')
        ORDER BY id ASC
        """, nativeQuery = true)
    List<Position10Dz> findAllWithContextByPrefix(@Param("prefix") String prefix);
}
