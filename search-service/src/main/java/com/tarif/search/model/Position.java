package com.tarif.search.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
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
@JsonIgnoreProperties(ignoreUnknown = true)
public class Position {

    private String code;
    private String description;
    private String justification;

    public Position(String code, String description) {
        this.code = code;
        this.description = description;
    }
}
