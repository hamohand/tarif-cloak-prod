-- Remplace la contrainte UNIQUE globale par un index unique partiel
-- pour permettre plusieurs lignes avec code='' (titres de catégorie)

ALTER TABLE position10_dz DROP CONSTRAINT IF EXISTS position10_dz_code_key;
ALTER TABLE position10_dz ALTER COLUMN code SET DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS uk_position10dz_code
    ON position10_dz (code) WHERE code != '';
