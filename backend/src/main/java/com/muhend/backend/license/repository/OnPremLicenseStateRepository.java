package com.muhend.backend.license.repository;

import com.muhend.backend.license.model.OnPremLicenseState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OnPremLicenseStateRepository extends JpaRepository<OnPremLicenseState, Long> {
}
