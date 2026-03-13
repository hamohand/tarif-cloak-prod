package com.tarif.search.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "position6_dz")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Position6Dz {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    public String getCode() {
        return code != null ? code.replaceAll("[^0-9]", "") : null;
    }

    @Column(nullable = false, length = 1024)
    private String description;
}
