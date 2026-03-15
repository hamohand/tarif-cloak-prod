CREATE TABLE IF NOT EXISTS position10_dz (
    id          BIGSERIAL PRIMARY KEY,
    description VARCHAR(1024) NOT NULL,
    code        VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_position10dz_code ON position10_dz (code) WHERE code != '';
CREATE INDEX IF NOT EXISTS idx_code_position10dz ON position10_dz (code);
