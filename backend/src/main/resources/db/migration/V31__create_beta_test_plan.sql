-- Migration pour créer le plan "Bêta Testeur" pour le marché DZ
-- Ce plan offre un accès gratuit avec un quota de 1000 crédits pour la phase de test

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
    'Bêta Testeur',
    'Plan gratuit réservé à nos testeurs - 1000 requêtes pendant 30 jours',
    0.00,
    NULL,
    1000,
    30,
    '1000 requêtes gratuites, Essai de 30 jours, Accès complet, Support prioritaire par WhatsApp',
    true,
    1,  -- display_order = 1 (juste après l'essai classique si existant)
    'DZ',
    'DZD',
    false, -- Marqué comme normal pour pouvoir être sélectionné côté frontend
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM pricing_plan 
    WHERE name = 'Bêta Testeur' 
    AND market_version = 'DZ'
);
