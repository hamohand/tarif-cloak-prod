-- ===============================================================
-- V0_3 : Création des tables manquantes (créées avant par Hibernate update)
-- ===============================================================

-- ---------------------------------------------------------------
-- TABLE : usage_log
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_log (
    id BIGSERIAL PRIMARY KEY,
    keycloak_user_id VARCHAR(255) NOT NULL,
    organization_id BIGINT,
    endpoint VARCHAR(255) NOT NULL,
    search_term VARCHAR(500),
    tokens_used INTEGER,
    cost_usd NUMERIC(10, 6),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------
-- TABLE : quota_alert
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quota_alert (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    organization_name VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    current_usage BIGINT NOT NULL,
    monthly_quota INTEGER,
    percentage_used DOUBLE PRECISION NOT NULL,
    message VARCHAR(500) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------
-- TABLE : organization_user
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_user (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    keycloak_user_id VARCHAR(255) NOT NULL,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_organization_user UNIQUE (organization_id, keycloak_user_id),
    CONSTRAINT fk_org_user_org_id FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------
-- TABLE : invoice_item
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_item (
    id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL,
    description VARCHAR(500) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10, 6) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    item_type VARCHAR(50),
    CONSTRAINT fk_invoice_item_invoice_id FOREIGN KEY (invoice_id) REFERENCES invoice(id) ON DELETE CASCADE
);
