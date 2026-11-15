package com.tarif.search.repository;

import com.tarif.search.model.TariffPosition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TariffPositionRepository extends JpaRepository<TariffPosition, Long> {

    Optional<TariffPosition> findByZoneCodeAndCode(String zoneCode, String code);

    List<TariffPosition> findByZoneCodeAndPos4CodeOrderByRowOrderAsc(String zoneCode, String pos4Code);

    @Query("""
            SELECT t FROM TariffPosition t
            WHERE t.zoneCode = :zone
              AND t.chapterCode = :chapterCode
              AND LENGTH(t.code) = 4
            ORDER BY t.rowOrder ASC
            """)
    List<TariffPosition> findPos4HeadingsByZoneAndChapter(
            @Param("zone") String zone,
            @Param("chapterCode") String chapterCode);
}
