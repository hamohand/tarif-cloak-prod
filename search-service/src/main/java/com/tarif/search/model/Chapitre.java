package com.tarif.search.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Entity
@Table(name = "chapitre")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Chapitre implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false, length = 1024)
    private String description;

    @Column(name = "section")
    private String section;

    /** Note explicative du chapitre (extrait du tarif douanier DGD). Nullable. */
    @Column(name = "note", columnDefinition = "TEXT")
    private String note;
}
