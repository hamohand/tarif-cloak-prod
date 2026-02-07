-- ===============================================================
-- V0 : Création des tables de base gérées historiquement par Hibernate
-- Ces tables sont nécessaires AVANT les migrations V1+ qui les référencent
-- ===============================================================

-- ---------------------------------------------------------------
-- TABLE : organization
-- Colonnes de base uniquement (les migrations V3_1, V4, V13, V15,
-- V17, V18, V19, V21 ajouteront les colonnes supplémentaires)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    address VARCHAR(512) NOT NULL,
    country VARCHAR(2) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    keycloak_user_id VARCHAR(255) UNIQUE,
    monthly_quota INTEGER,
    pricing_plan_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------
-- TABLE : invoice
-- Colonnes de base uniquement (V3 ajoutera les colonnes de paiement)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    organization_name VARCHAR(255) NOT NULL,
    organization_email VARCHAR(255),
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_date DATE NOT NULL,
    paid_at TIMESTAMP,
    notes VARCHAR(1000),
    viewed_at TIMESTAMP
);

-- ---------------------------------------------------------------
-- TABLE : pending_registration
-- Colonnes de base uniquement (V13 ajoutera market_version,
-- V16 ajoutera organization_activity_domain)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pending_registration (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    organization_password VARCHAR(255),
    organization_name VARCHAR(255) NOT NULL,
    organization_email VARCHAR(255) NOT NULL,
    organization_address VARCHAR(512) NOT NULL,
    organization_country VARCHAR(2) NOT NULL,
    organization_phone VARCHAR(32) NOT NULL,
    pricing_plan_id BIGINT,
    confirmation_token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    confirmed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_token ON pending_registration(confirmation_token);
CREATE INDEX IF NOT EXISTS idx_email ON pending_registration(organization_email);
CREATE INDEX IF NOT EXISTS idx_expires_at ON pending_registration(expires_at);
