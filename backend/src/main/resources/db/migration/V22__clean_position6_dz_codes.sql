-- V22 : Supprimer les espaces des codes dans position6_dz
-- Le SQL d'import ciblait la table "position6dz" (sans underscore),
-- alors que l'application lit "position6_dz" (nom Hibernate en snake_case).
-- Ce script nettoie la table réelle et installe le trigger préventif.

-- 1. Nettoyer les codes existants (espaces début, fin, et internes)
UPDATE position6_dz
SET code = REPLACE(TRIM(code), ' ', '')
WHERE code <> REPLACE(TRIM(code), ' ', '');

-- 2. Fonction trigger pour les futures insertions/mises à jour
CREATE OR REPLACE FUNCTION clean_position6_dz_code()
    RETURNS TRIGGER AS $$
BEGIN
    NEW.code = REPLACE(TRIM(NEW.code), ' ', '');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS clean_code_trigger ON position6_dz;
CREATE TRIGGER clean_code_trigger
    BEFORE INSERT OR UPDATE ON position6_dz
    FOR EACH ROW EXECUTE FUNCTION clean_position6_dz_code();

-- 4. Contrainte CHECK pour garantir l'absence d'espaces
ALTER TABLE position6_dz
    DROP CONSTRAINT IF EXISTS chk_code_no_spaces;
ALTER TABLE position6_dz
    ADD CONSTRAINT chk_code_no_spaces CHECK (code = REPLACE(TRIM(code), ' ', ''));
