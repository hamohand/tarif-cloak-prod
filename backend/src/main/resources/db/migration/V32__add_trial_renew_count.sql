-- Ajoute le compteur de renouvellement pour les plans invité/essai
-- Permet de limiter le renouvellement admin à une seule fois par organisation
ALTER TABLE organization
    ADD COLUMN IF NOT EXISTS trial_renew_count INTEGER NOT NULL DEFAULT 0;
