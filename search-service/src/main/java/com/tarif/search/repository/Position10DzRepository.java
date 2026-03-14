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
}
