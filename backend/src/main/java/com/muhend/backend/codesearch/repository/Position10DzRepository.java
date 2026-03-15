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

    @Query(value = "SELECT description FROM position10_dz WHERE code = '' AND id < (SELECT id FROM position10_dz WHERE code = :code) ORDER BY id DESC LIMIT 1", nativeQuery = true)
    Optional<String> findTitleBeforeCode(@Param("code") String code);
}
