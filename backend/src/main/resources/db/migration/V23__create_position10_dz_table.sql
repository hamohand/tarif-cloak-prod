CREATE TABLE IF NOT EXISTS position10_dz (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(255) NOT NULL UNIQUE,
    description VARCHAR(1024) NOT NULL
);
