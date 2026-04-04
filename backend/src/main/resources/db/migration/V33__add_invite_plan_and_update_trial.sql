-- Crée le plan "Invité" réservé aux beta-testeurs (prod) : 500 crédits / 30 jours
INSERT INTO pricing_plan (
    name,
    description,
    price_per_month,
    price_per_request,
    monthly_quota,
    trial_period_days,
    features,
    is_active,
    display_order,
    market_version,
    currency,
    is_custom,
    created_at
)
SELECT
    'Invité',
    'Accès beta-testeur — 500 crédits offerts pendant 30 jours',
    0.00,
    NULL,
    500,
    30,
    '500 crédits gratuits, Accès complet pendant 30 jours, Réservé aux beta-testeurs',
    true,
    -1,
    'DZ',
    'DZD',
    false,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM pricing_plan WHERE name = 'Invité'
);

-- Met à jour le plan "Essai gratuit" : 200 crédits / 30 jours (au lieu de 20 crédits / 7 jours)
UPDATE pricing_plan
SET monthly_quota    = 200,
    trial_period_days = 30,
    description      = '200 crédits gratuits valables pendant 30 jours'
WHERE name = 'Essai gratuit';
