package com.tarif.search.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Projection légère de tariff_position pour la cascade IA multi-zones,
 * sans chargement du champ JSONB regulatory_data.
 */
@Entity
@Table(name = "tariff_position")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TariffPosition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "zone_code", nullable = false, length = 8)
    private String zoneCode = "DZ";

    @Column(nullable = false, length = 16)
    private String code = "";

    @Column(name = "pos4_code", nullable = false, length = 4)
    private String pos4Code = "";

    @Column(name = "hs6_code", nullable = false, length = 6)
    private String hs6Code = "";

    @Column(nullable = false, length = 4096)
    private String description;

    @Column(name = "dash_level", nullable = false)
    private Integer dashLevel = 0;

    @Column(name = "is_title", nullable = false)
    private Boolean isTitle = false;

    @Column(name = "row_order", nullable = false)
    private Integer rowOrder = 0;
}
