package com.tarif.search.repository;

import com.tarif.search.model.Chapitre;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChapitreRepository extends JpaRepository<Chapitre, Long> {

    List<Chapitre> findByCodeContaining(String code);

    List<Chapitre> findByDescriptionContaining(String description);

    List<Chapitre> findBySectionContaining(String section);

    Optional<Chapitre> findByCode(String code);

    Optional<Chapitre> findByCodeStartingWith(String code);

    boolean existsByCode(String code);

    List<Chapitre> findBySection(String section);

    @Query("""
        SELECT c
        FROM Chapitre c
        WHERE TRIM(c.code) = TRIM(:code)
    """)
    Optional<Chapitre> findByCodeTrimmed(@Param("code") String code);
}
