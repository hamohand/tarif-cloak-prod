CREATE TABLE IF NOT EXISTS onprem_license_state (
    id BIGINT PRIMARY KEY,
    license_id VARCHAR(120),
    box_id VARCHAR(120),
    token TEXT,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat_ok_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
