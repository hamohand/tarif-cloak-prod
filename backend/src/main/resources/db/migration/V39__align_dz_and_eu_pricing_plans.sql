-- Migration pour aligner les plans tarifaires Algérie (DZ / DZD) et Europe & International (DEFAULT / EUR).
-- Idempotente : met à jour en place sans supprimer d'enregistrements référencés.

-- 1. Lever la contrainte d'unicité globale sur le nom pour autoriser les mêmes noms en DZ et DEFAULT
ALTER TABLE pricing_plan DROP CONSTRAINT IF EXISTS pricing_plan_name_key;

UPDATE pricing_plan
SET market_version = 'DEFAULT'
WHERE market_version IS NULL OR TRIM(market_version) = '';

-- 2. Désactiver les anciens plans Pay-per-Request sans casser les historiques
UPDATE pricing_plan
SET is_active = false
WHERE name = 'Pay-per-Request';

-- 3. Renommer / mettre à jour en place les plans historiques DEFAULT (EUR)
UPDATE pricing_plan
SET name = 'Essentiel',
    description = 'PME & importateurs/exportateurs réguliers — ~100 recherches assistées/mois + décodage illimité',
    price_per_month = 29.00,
    price_per_year = 290.00,
    price_per_request = NULL,
    monthly_quota = 1500,
    trial_period_days = NULL,
    features = 'Décodage & Comparaison DZ ↔ UE illimités, 1 500 crédits / mois (~100 recherches P10/NC8), Import de listes CSV, Support par email',
    currency = 'EUR',
    is_active = true,
    display_order = 1
WHERE name = 'Starter'
  AND market_version = 'DEFAULT'
  AND is_custom = false
  AND NOT EXISTS (
      SELECT 1 FROM pricing_plan p2
      WHERE p2.name = 'Essentiel' AND p2.market_version = 'DEFAULT' AND p2.is_custom = false
  );

UPDATE pricing_plan
SET name = 'Pro / Transit',
    description = 'Transitaires, commissionnaires en douane & cabinets conseil — ~500 recherches assistées/mois',
    price_per_month = 79.00,
    price_per_year = 790.00,
    price_per_request = NULL,
    monthly_quota = 7500,
    trial_period_days = NULL,
    features = 'Décodage & Comparaison DZ ↔ UE illimités, 7 500 crédits / mois (~500 recherches P10/NC8), Listes CSV & traitement Batch, Multi-collaborateurs & statistiques',
    currency = 'EUR',
    is_active = true,
    display_order = 2
WHERE name = 'Professional'
  AND market_version = 'DEFAULT'
  AND is_custom = false
  AND NOT EXISTS (
      SELECT 1 FROM pricing_plan p2
      WHERE p2.name = 'Pro / Transit' AND p2.market_version = 'DEFAULT' AND p2.is_custom = false
  );

UPDATE pricing_plan
SET name = 'Entreprise',
    description = 'Grands comptes & groupes logistiques — ~2 000 recherches assistées/mois',
    price_per_month = 199.00,
    price_per_year = 1990.00,
    price_per_request = NULL,
    monthly_quota = 30000,
    trial_period_days = NULL,
    features = 'Décodage & Comparaison DZ ↔ UE illimités, 30 000 crédits / mois (~2 000 recherches P10/NC8), Multi-collaborateurs illimités & Batch, Facturation annuelle ou devis sur mesure',
    currency = 'EUR',
    is_active = true,
    display_order = 3
WHERE name = 'Enterprise'
  AND market_version = 'DEFAULT'
  AND is_custom = false
  AND NOT EXISTS (
      SELECT 1 FROM pricing_plan p2
      WHERE p2.name = 'Entreprise' AND p2.market_version = 'DEFAULT' AND p2.is_custom = false
  );

-- 4. Mettre à jour les plans existants DZ (DZD)
UPDATE pricing_plan
SET description = 'Découverte complète — Décodage & Comparaison illimités + 225 crédits offerts (30 jours)',
    price_per_month = 0.00,
    price_per_year = NULL,
    price_per_request = NULL,
    monthly_quota = 225,
    trial_period_days = 30,
    features = 'Décodage & Comparaison DZ ↔ UE illimités, 225 crédits de recherche assistée (~15 recherches P10/NC8), Valable 30 jours sans engagement',
    currency = 'DZD',
    is_active = true,
    display_order = 0
WHERE name = 'Essai gratuit'
  AND market_version = 'DZ'
  AND is_custom = false;

UPDATE pricing_plan
SET name = 'Pro / Transit',
    description = 'Transitaires, commissionnaires en douane & cabinets conseil — ~500 recherches assistées/mois',
    price_per_month = 9900.00,
    price_per_year = 99000.00,
    price_per_request = NULL,
    monthly_quota = 7500,
    trial_period_days = NULL,
    features = 'Décodage & Comparaison DZ ↔ UE illimités, 7 500 crédits / mois (~500 recherches P10/NC8), Listes CSV & traitement Batch, Multi-collaborateurs & statistiques, Paiement CIB / Edahabia ou virement annuel',
    currency = 'DZD',
    is_active = true,
    display_order = 2
WHERE name = 'Forfait'
  AND market_version = 'DZ'
  AND is_custom = false
  AND NOT EXISTS (
      SELECT 1 FROM pricing_plan p2
      WHERE p2.name = 'Pro / Transit' AND p2.market_version = 'DZ' AND p2.is_custom = false
  );

-- 5. Créer l'index d'unicité par couple (nom, marché) pour les plans standards actifs
CREATE UNIQUE INDEX IF NOT EXISTS uq_pricing_plan_name_market
    ON pricing_plan (name, market_version)
    WHERE is_custom = false AND is_active = true;

-- 6. Insérer les paliers manquants pour DEFAULT (EUR)
INSERT INTO pricing_plan (name, description, price_per_month, price_per_year, price_per_request, monthly_quota, trial_period_days, features, is_active, display_order, market_version, currency, is_custom, created_at)
SELECT 'Essai gratuit', 'Découverte complète — Décodage & Comparaison illimités + 225 crédits offerts (30 jours)', 0.00, NULL, NULL, 225, 30,
       'Décodage & Comparaison DZ ↔ UE illimités, 225 crédits de recherche assistée (~15 recherches P10/NC8), Valable 30 jours sans engagement',
       true, 0, 'DEFAULT', 'EUR', false, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pricing_plan WHERE name = 'Essai gratuit' AND market_version = 'DEFAULT' AND is_custom = false);

INSERT INTO pricing_plan (name, description, price_per_month, price_per_year, price_per_request, monthly_quota, trial_period_days, features, is_active, display_order, market_version, currency, is_custom, created_at)
SELECT 'Essentiel', 'PME & importateurs/exportateurs réguliers — ~100 recherches assistées/mois + décodage illimité', 29.00, 290.00, NULL, 1500, NULL,
       'Décodage & Comparaison DZ ↔ UE illimités, 1 500 crédits / mois (~100 recherches P10/NC8), Import de listes CSV, Support par email',
       true, 1, 'DEFAULT', 'EUR', false, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pricing_plan WHERE name = 'Essentiel' AND market_version = 'DEFAULT' AND is_custom = false);

INSERT INTO pricing_plan (name, description, price_per_month, price_per_year, price_per_request, monthly_quota, trial_period_days, features, is_active, display_order, market_version, currency, is_custom, created_at)
SELECT 'Pro / Transit', 'Transitaires, commissionnaires en douane & cabinets conseil — ~500 recherches assistées/mois', 79.00, 790.00, NULL, 7500, NULL,
       'Décodage & Comparaison DZ ↔ UE illimités, 7 500 crédits / mois (~500 recherches P10/NC8), Listes CSV & traitement Batch, Multi-collaborateurs & statistiques',
       true, 2, 'DEFAULT', 'EUR', false, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pricing_plan WHERE name = 'Pro / Transit' AND market_version = 'DEFAULT' AND is_custom = false);

INSERT INTO pricing_plan (name, description, price_per_month, price_per_year, price_per_request, monthly_quota, trial_period_days, features, is_active, display_order, market_version, currency, is_custom, created_at)
SELECT 'Entreprise', 'Grands comptes & groupes logistiques — ~2 000 recherches assistées/mois', 199.00, 1990.00, NULL, 30000, NULL,
       'Décodage & Comparaison DZ ↔ UE illimités, 30 000 crédits / mois (~2 000 recherches P10/NC8), Multi-collaborateurs illimités & Batch, Facturation annuelle ou devis sur mesure',
       true, 3, 'DEFAULT', 'EUR', false, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pricing_plan WHERE name = 'Entreprise' AND market_version = 'DEFAULT' AND is_custom = false);

INSERT INTO pricing_plan (name, description, price_per_month, price_per_year, price_per_request, monthly_quota, trial_period_days, features, is_active, display_order, market_version, currency, is_custom, created_at)
SELECT 'Invité', 'Accès beta-testeur — 500 crédits offerts pendant 30 jours', 0.00, NULL, NULL, 500, 30,
       '500 crédits gratuits, Accès complet pendant 30 jours, Réservé aux beta-testeurs',
       true, -1, 'DEFAULT', 'EUR', false, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pricing_plan WHERE name = 'Invité' AND market_version = 'DEFAULT' AND is_custom = false);

-- 7. Insérer les paliers manquants pour DZ (DZD)
INSERT INTO pricing_plan (name, description, price_per_month, price_per_year, price_per_request, monthly_quota, trial_period_days, features, is_active, display_order, market_version, currency, is_custom, created_at)
SELECT 'Essai gratuit', 'Découverte complète — Décodage & Comparaison illimités + 225 crédits offerts (30 jours)', 0.00, NULL, NULL, 225, 30,
       'Décodage & Comparaison DZ ↔ UE illimités, 225 crédits de recherche assistée (~15 recherches P10/NC8), Valable 30 jours sans engagement',
       true, 0, 'DZ', 'DZD', false, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pricing_plan WHERE name = 'Essai gratuit' AND market_version = 'DZ' AND is_custom = false);

INSERT INTO pricing_plan (name, description, price_per_month, price_per_year, price_per_request, monthly_quota, trial_period_days, features, is_active, display_order, market_version, currency, is_custom, created_at)
SELECT 'Essentiel', 'PME & importateurs/exportateurs réguliers — ~100 recherches assistées/mois + décodage illimité', 3900.00, 39000.00, NULL, 1500, NULL,
       'Décodage & Comparaison DZ ↔ UE illimités, 1 500 crédits / mois (~100 recherches P10/NC8), Import de listes CSV, Paiement CIB / Edahabia ou virement',
       true, 1, 'DZ', 'DZD', false, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pricing_plan WHERE name = 'Essentiel' AND market_version = 'DZ' AND is_custom = false);

INSERT INTO pricing_plan (name, description, price_per_month, price_per_year, price_per_request, monthly_quota, trial_period_days, features, is_active, display_order, market_version, currency, is_custom, created_at)
SELECT 'Pro / Transit', 'Transitaires, commissionnaires en douane & cabinets conseil — ~500 recherches assistées/mois', 9900.00, 99000.00, NULL, 7500, NULL,
       'Décodage & Comparaison DZ ↔ UE illimités, 7 500 crédits / mois (~500 recherches P10/NC8), Listes CSV & traitement Batch, Multi-collaborateurs & statistiques, Paiement CIB / Edahabia ou virement annuel',
       true, 2, 'DZ', 'DZD', false, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pricing_plan WHERE name = 'Pro / Transit' AND market_version = 'DZ' AND is_custom = false);

INSERT INTO pricing_plan (name, description, price_per_month, price_per_year, price_per_request, monthly_quota, trial_period_days, features, is_active, display_order, market_version, currency, is_custom, created_at)
SELECT 'Entreprise', 'Grands comptes & groupes logistiques — ~2 000 recherches assistées/mois', 24000.00, 240000.00, NULL, 30000, NULL,
       'Décodage & Comparaison DZ ↔ UE illimités, 30 000 crédits / mois (~2 000 recherches P10/NC8), Multi-collaborateurs illimités & Batch, Facturation annuelle par virement / bon de commande',
       true, 3, 'DZ', 'DZD', false, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM pricing_plan WHERE name = 'Entreprise' AND market_version = 'DZ' AND is_custom = false);
