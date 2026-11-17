-- Autorise les demandes de devis publiques (prospects B2B / déploiement souverain Box Locale sans compte préalable)
ALTER TABLE quote_request ALTER COLUMN organization_id DROP NOT NULL;
