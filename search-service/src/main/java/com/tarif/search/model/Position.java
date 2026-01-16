package com.tarif.search.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO représentant une position retournée par l'IA avec justification.
 * Non persisté en base.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Position {

    private String code;
    private String description;
    private String justification;

    public Position(String code, String description) {
        this.code = code;
        this.description = description;
    }
}
