package com.muhend.backend.codesearch.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;

@Entity
@Table(name = "tariff_position")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TariffPosition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "zone_code", nullable = false, length = 8)
    @Builder.Default
    private String zoneCode = "DZ";

    @Column(nullable = false, length = 16)
    @Builder.Default
    private String code = "";

    @Column(name = "formatted_code", length = 32)
    private String formattedCode;

    @Column(name = "check_digit", length = 4)
    private String checkDigit;

    @Column(name = "chapter_code", nullable = false, length = 4)
    @Builder.Default
    private String chapterCode = "";

    @Column(name = "pos4_code", nullable = false, length = 4)
    @Builder.Default
    private String pos4Code = "";

    @Column(name = "hs6_code", nullable = false, length = 6)
    @Builder.Default
    private String hs6Code = "";

    @Column(nullable = false, length = 4096)
    private String description;

    @Column(name = "dash_level", nullable = false)
    @Builder.Default
    private Integer dashLevel = 0;

    @Column(name = "is_title", nullable = false)
    @Builder.Default
    private Boolean isTitle = false;

    @Column(name = "row_order", nullable = false)
    @Builder.Default
    private Integer rowOrder = 0;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "regulatory_data", columnDefinition = "jsonb")
    private Map<String, Object> regulatoryData;

    @Column(nullable = false)
    @Builder.Default
    private Boolean enriched = false;

    @Column(name = "source_version", length = 32)
    @Builder.Default
    private String sourceVersion = "2026";
}
