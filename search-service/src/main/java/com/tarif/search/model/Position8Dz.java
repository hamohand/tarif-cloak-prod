package com.tarif.search.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "position8_dz")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Position8Dz {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code; // 8 chiffres bruts, ex: "87031010"

    @Column(nullable = false, length = 1024)
    private String description;
}
