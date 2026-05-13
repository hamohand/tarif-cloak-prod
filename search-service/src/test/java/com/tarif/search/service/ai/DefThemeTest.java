package com.tarif.search.service.ai;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

/**
 * Tests unitaires pour DefTheme.
 * Valide que chaque factory method active exactement les bons flags.
 * Aucune dépendance — exécution instantanée.
 */
@DisplayName("DefTheme — modes de configuration")
class DefThemeTest {

    // ── Valeurs par défaut ────────────────────────────────────────────────────

    @Test
    @DisplayName("getCode() → seul withCode est activé (mode minimal)")
    void getCode_doitActiver_uniquementWithCode() {
        DefTheme theme = DefTheme.getCode();

        assertThat(theme.isWithCode()).isTrue();
        assertThat(theme.isWithJustification()).isFalse();
        assertThat(theme.isWithCascade()).isFalse();
        assertThat(theme.isOnlyCodes()).isFalse();
        assertThat(theme.isWithDescription()).isFalse();
    }

    // ── getThemeDescrip (défaut de l'application) ─────────────────────────────

    @Test
    @DisplayName("getThemeDescrip() → withDescription activé, rien d'autre")
    void getThemeDescrip_doitActiver_uniquementWithDescription() {
        DefTheme theme = DefTheme.getThemeDescrip();

        assertThat(theme.isWithDescription()).isTrue();
        assertThat(theme.isWithJustification()).isFalse();
        assertThat(theme.isWithCascade()).isFalse();
    }

    // ── getThemeAll ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("getThemeAll() → description, justification ET cascade tous activés")
    void getThemeAll_doitActiver_toutLesModes() {
        DefTheme theme = DefTheme.getThemeAll();

        assertThat(theme.isWithDescription()).isTrue();
        assertThat(theme.isWithJustification()).isTrue();
        assertThat(theme.isWithCascade()).isTrue();
    }

    // ── Modes intermédiaires ──────────────────────────────────────────────────

    @Test
    @DisplayName("getThemeJustif() → seul withJustification est activé")
    void getThemeJustif_doitActiver_uniquementWithJustification() {
        DefTheme theme = DefTheme.getThemeJustif();

        assertThat(theme.isWithJustification()).isTrue();
        assertThat(theme.isWithDescription()).isFalse();
        assertThat(theme.isWithCascade()).isFalse();
    }

    @Test
    @DisplayName("getThemeDescripJustif() → description ET justification, sans cascade")
    void getThemeDescripJustif_doitActiver_descriptionEtJustification() {
        DefTheme theme = DefTheme.getThemeDescripJustif();

        assertThat(theme.isWithDescription()).isTrue();
        assertThat(theme.isWithJustification()).isTrue();
        assertThat(theme.isWithCascade()).isFalse();
    }

    @Test
    @DisplayName("getThemeJustifCascade() → justification ET cascade, sans description")
    void getThemeJustifCascade_doitActiver_justificationEtCascade() {
        DefTheme theme = DefTheme.getThemeJustifCascade();

        assertThat(theme.isWithJustification()).isTrue();
        assertThat(theme.isWithCascade()).isTrue();
        assertThat(theme.isWithDescription()).isFalse();
    }

    @Test
    @DisplayName("getThemeDescripCascade() → description ET cascade, sans justification")
    void getThemeDescripCascade_doitActiver_descriptionEtCascade() {
        DefTheme theme = DefTheme.getThemeDescripCascade();

        assertThat(theme.isWithDescription()).isTrue();
        assertThat(theme.isWithCascade()).isTrue();
        assertThat(theme.isWithJustification()).isFalse();
    }

    // ── Immutabilité (@Value Lombok) ──────────────────────────────────────────

    @Test
    @DisplayName("DefTheme est immutable — deux instances identiques sont égales")
    void defTheme_doitEtreImmutable_deuxInstancesIdentiquesEgales() {
        DefTheme a = DefTheme.builder().withDescription(true).withCascade(true).build();
        DefTheme b = DefTheme.builder().withDescription(true).withCascade(true).build();

        assertThat(a).isEqualTo(b);
        assertThat(a.hashCode()).isEqualTo(b.hashCode());
    }

    @Test
    @DisplayName("toBuilder() permet de dériver un nouveau theme sans modifier l'original")
    void toBuilder_doitCreer_nouvelleInstanceSansModifierLOriginal() {
        DefTheme original = DefTheme.getThemeDescrip();

        // Dériver avec cascade activée
        DefTheme derive = original.toBuilder().withCascade(true).build();

        // L'original est inchangé
        assertThat(original.isWithCascade()).isFalse();
        // Le dérivé a la cascade
        assertThat(derive.isWithCascade()).isTrue();
        assertThat(derive.isWithDescription()).isTrue(); // hérité
    }
}
