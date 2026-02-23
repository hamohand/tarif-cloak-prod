package com.tarif.search.repository;

import com.tarif.search.model.Position8Dz;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface Position8DzRepository extends JpaRepository<Position8Dz, Long> {

    Optional<Position8Dz> findByCode(String code);

    boolean existsByCode(String code);

    @Query("SELECT p FROM Position8Dz p WHERE p.code LIKE :prefix")
    List<Position8Dz> findAllByPrefix(@Param("prefix") String prefix);
}
