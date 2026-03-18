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

    @Query("SELECT a FROM Position10Dz a WHERE a.code LIKE :prefix AND a.code != ''")
    List<Position10Dz> findAllByPrefix(@Param("prefix") String prefix);

    @Query("SELECT a FROM Position10Dz a WHERE a.code LIKE :prefix AND a.code != '' ORDER BY a.id ASC")
    List<Position10Dz> findAllByPrefixWithId(@Param("prefix") String prefix);

    /**
     * Trouve le premier titre (code='') avant une position donnée
     * dont le nombre de tirets est strictement inférieur à nTirets.
     * Formule PostgreSQL : (char_length - char_length(ltrim)) / 2 = nb de "- " en préfixe.
     */
    @Query(value = """
        SELECT id, description FROM position10_dz
        WHERE code = ''
          AND id < :beforeId
          AND (char_length(description) - char_length(ltrim(description, '- '))) / 2 < :nTirets
        ORDER BY id DESC LIMIT 1
        """, nativeQuery = true)
    Optional<Object[]> findFirstTitleBeforeWithFewerDashes(
            @Param("beforeId") long beforeId,
            @Param("nTirets") int nTirets);
}
