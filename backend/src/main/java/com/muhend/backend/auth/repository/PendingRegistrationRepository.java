package com.muhend.backend.auth.repository;

import com.muhend.backend.auth.model.PendingRegistration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PendingRegistrationRepository extends JpaRepository<PendingRegistration, Long> {
    
    Optional<PendingRegistration> findByConfirmationToken(String token);
    
    List<PendingRegistration> findByOrganizationEmail(String organizationEmail);
    
    @Query("SELECT pr FROM PendingRegistration pr WHERE pr.expiresAt < :now AND pr.confirmed = false")
    List<PendingRegistration> findExpiredUnconfirmed(@Param("now") LocalDateTime now);
    
    @Modifying
    @Query("DELETE FROM PendingRegistration pr WHERE pr.expiresAt < :now AND pr.confirmed = false")
    void deleteExpiredUnconfirmed(@Param("now") LocalDateTime now);
    
    boolean existsByUsername(String username);
    
    boolean existsByEmail(String email);
    
    boolean existsByOrganizationEmail(String organizationEmail);
}

