package com.tarif.search.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * DTO représentant une position retournée par l'IA avec justification.
 * Non persisté en base.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class Position implements Serializable {

    private static final long serialVersionUID = 1L;

    private String code;
    private String description;
    private String justification;

    public Position(String code, String description) {
        this.code = code;
        this.description = description;
    }
}
