package com.muhend.backend.codesearch.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "tariff_glossary")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TariffGlossary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "zone_code", nullable = false, length = 8)
    private String zoneCode;

    @Column(nullable = false, length = 16)
    private String category;

    @Column(nullable = false, length = 32)
    private String code;

    @Column(nullable = false, length = 255)
    private String label;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 128)
    private String authority;
}
