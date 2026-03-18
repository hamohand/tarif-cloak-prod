-- Ajout de la colonne price_per_year à la table pricing_plan
ALTER TABLE pricing_plan
    ADD COLUMN IF NOT EXISTS price_per_year NUMERIC(10, 2);
