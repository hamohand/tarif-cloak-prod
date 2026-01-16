package com.tarif.search.service.ai;

import lombok.Builder;
import lombok.Value;

/**
 * Définit les options d'affichage pour les résultats de recherche de codes douaniers.
 */
@Value
@Builder(toBuilder = true)
public class DefTheme {

    @Builder.Default
    boolean withCode = true;

    @Builder.Default
    boolean withJustification = false;

    @Builder.Default
    boolean withCascade = false;

    @Builder.Default
    boolean onlyCodes = false;

    @Builder.Default
    boolean withDescription = false;

    public static DefTheme getThemeAll() {
        return DefTheme.builder()
                .withDescription(true)
                .withJustification(true)
                .withCascade(true)
                .build();
    }

    public static DefTheme getCode() {
        return DefTheme.builder()
                .build();
    }

    public static DefTheme getThemeDescripJustif() {
        return DefTheme.builder()
                .withDescription(true)
                .withJustification(true)
                .build();
    }

    public static DefTheme getThemeJustifCascade() {
        return DefTheme.builder()
                .withJustification(true)
                .withCascade(true)
                .build();
    }

    public static DefTheme getThemeJustif() {
        return DefTheme.builder()
                .withJustification(true)
                .build();
    }

    public static DefTheme getThemeDescripCascade() {
        return DefTheme.builder()
                .withDescription(true)
                .withCascade(true)
                .build();
    }

    public static DefTheme getThemeDescrip() {
        return DefTheme.builder()
                .withDescription(true)
                .build();
    }
}
