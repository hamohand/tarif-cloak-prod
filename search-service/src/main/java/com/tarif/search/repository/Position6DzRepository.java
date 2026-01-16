package com.tarif.search.repository;

import com.tarif.search.model.Position6Dz;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface Position6DzRepository extends JpaRepository<Position6Dz, Long> {

    List<Position6Dz> findByCodeContaining(String code);

    List<Position6Dz> findByDescriptionContaining(String description);

    Optional<Position6Dz> findByCode(String code);

    boolean existsByCode(String code);

    @Query("SELECT p FROM Position6Dz p WHERE p.code LIKE :prefix")
    List<Position6Dz> findAllByPrefix(@Param("prefix") String prefix);
}
