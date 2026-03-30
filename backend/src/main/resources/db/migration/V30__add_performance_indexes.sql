-- V30 : Index de performance sur les tables à fort volume de requêtes

-- usage_log
CREATE INDEX IF NOT EXISTS idx_usage_log_organization_id   ON usage_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_timestamp         ON usage_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_log_org_timestamp     ON usage_log(organization_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_log_user_id           ON usage_log(keycloak_user_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_user_timestamp    ON usage_log(keycloak_user_id, timestamp);

-- quota_alert
CREATE INDEX IF NOT EXISTS idx_quota_alert_organization_id ON quota_alert(organization_id);
CREATE INDEX IF NOT EXISTS idx_quota_alert_is_read         ON quota_alert(is_read);
CREATE INDEX IF NOT EXISTS idx_quota_alert_created_at      ON quota_alert(created_at);
CREATE INDEX IF NOT EXISTS idx_quota_alert_org_read        ON quota_alert(organization_id, is_read);

-- organization_user
CREATE INDEX IF NOT EXISTS idx_organization_user_org_id    ON organization_user(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_user_keycloak  ON organization_user(keycloak_user_id);

-- organization
CREATE INDEX IF NOT EXISTS idx_organization_email          ON organization(email) WHERE email IS NOT NULL;
