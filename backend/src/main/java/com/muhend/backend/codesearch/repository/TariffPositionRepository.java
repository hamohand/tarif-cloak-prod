package com.muhend.backend.codesearch.repository;

import com.muhend.backend.codesearch.model.TariffPosition;
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

    List<TariffPosition> findByZoneCodeAndHs6CodeOrderByRowOrderAsc(String zoneCode, String hs6Code);

    @Query("""
            SELECT t FROM TariffPosition t
            WHERE t.zoneCode = :zone
              AND t.hs6Code = :hs6
              AND t.isTitle = false
            ORDER BY t.rowOrder ASC
            """)
    List<TariffPosition> findLeafPositionsByZoneAndHs6(
            @Param("zone") String zone,
            @Param("hs6") String hs6);
}
