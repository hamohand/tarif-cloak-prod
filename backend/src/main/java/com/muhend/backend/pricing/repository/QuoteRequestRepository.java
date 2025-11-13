package com.muhend.backend.pricing.repository;

import com.muhend.backend.pricing.model.QuoteRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuoteRequestRepository extends JpaRepository<QuoteRequest, Long> {
    List<QuoteRequest> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);
    List<QuoteRequest> findAllByOrderByCreatedAtDesc();
    List<QuoteRequest> findByStatusOrderByCreatedAtDesc(QuoteRequest.QuoteStatus status);
}

