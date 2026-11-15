package com.muhend.backend.codesearch.repository;

import com.muhend.backend.codesearch.model.TariffGlossary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TariffGlossaryRepository extends JpaRepository<TariffGlossary, Long> {

    List<TariffGlossary> findByZoneCode(String zoneCode);
}
