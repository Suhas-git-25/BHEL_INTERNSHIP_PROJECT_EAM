-- ============================================================
-- Enterprise Asset Management – create database objects (PostgreSQL)
--
-- CONNECT TO YOUR DATABASE FIRST (example: localhost:5432 / eam)
-- Prefer a dedicated schema user (e.g. eam) — not postgres for daily use.
--
-- Run each STEP in order inside DBeaver, OR select ALL and
-- Execute SQL Script (Alt+X).
-- ============================================================

-- ------------------------------------------------------------
-- STEP 0 — (Optional) Sanity check – should return one row each
-- ------------------------------------------------------------
SELECT current_user AS pg_user;
SELECT 1 AS ok;


-- ------------------------------------------------------------
-- STEP A — (Optional) Dedicated application user + database
--
-- Run as superuser (postgres). Skip if you already have database "eam".
-- ------------------------------------------------------------

/*
CREATE USER eam WITH PASSWORD 'YOUR_STRONG_PASSWORD_HERE';
CREATE DATABASE eam OWNER eam;
GRANT ALL PRIVILEGES ON DATABASE eam TO eam;

-- Next: reconnect DBeaver to database EAM as user eam, then continue at STEP B.
*/


-- ------------------------------------------------------------
-- STEP Z — (Optional) Tear down OLD EAM tables before rebuild
--
-- Uncomment once. Order matters (children first).
-- ------------------------------------------------------------

/*
DROP TABLE IF EXISTS eam_assignment CASCADE;
DROP TABLE IF EXISTS eam_hardware CASCADE;
DROP TABLE IF EXISTS eam_software CASCADE;
DROP TABLE IF EXISTS eam_holder CASCADE;
DROP TABLE IF EXISTS eam_app_user CASCADE;
*/


-- ------------------------------------------------------------
-- STEP B — Core tables (run as the schema owner — e.g. eam)
-- ------------------------------------------------------------

CREATE TABLE eam_app_user (
    user_id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email            VARCHAR(255) NOT NULL UNIQUE,
    password_hash    VARCHAR(255) NOT NULL,
    full_name        VARCHAR(255),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT eam_app_user_email_lower CHECK (email = LOWER(email))
);

CREATE TABLE eam_holder (
    holder_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255),
    department      VARCHAR(120),
    contract_ref    VARCHAR(120),
    CONSTRAINT eam_holder_email_unique UNIQUE (email)
);

CREATE TABLE eam_hardware (
    hardware_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_tag       VARCHAR(120) NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    category        VARCHAR(120),
    model           VARCHAR(120),
    status          VARCHAR(40) DEFAULT 'AVAILABLE'
                    CONSTRAINT eam_hw_status_ck CHECK (
                        status IN ('AVAILABLE', 'ISSUED', 'RETIRED')),
    contract_ref    VARCHAR(120),
    purchase_date   DATE,
    notes           VARCHAR(4000),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE eam_software (
    software_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    version_label    VARCHAR(80),
    license_type     VARCHAR(120),
    total_licenses   INTEGER DEFAULT 0,
    seats_in_use     INTEGER DEFAULT 0,
    contract_ref     VARCHAR(120),
    notes            VARCHAR(4000),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT eam_sw_lic_ck CHECK (total_licenses >= 0 AND seats_in_use >= 0)
);

CREATE TABLE eam_assignment (
    assignment_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    holder_id       INTEGER NOT NULL,
    hardware_id     INTEGER,
    software_id     INTEGER,
    issued_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    returned_at     TIMESTAMP,
    notes           VARCHAR(1000),
    issued_by       INTEGER REFERENCES eam_app_user (user_id),
    CONSTRAINT eam_assign_holder_fk FOREIGN KEY (holder_id) REFERENCES eam_holder (holder_id),
    CONSTRAINT eam_assign_hw_fk FOREIGN KEY (hardware_id) REFERENCES eam_hardware (hardware_id),
    CONSTRAINT eam_assign_sw_fk FOREIGN KEY (software_id) REFERENCES eam_software (software_id),
    CONSTRAINT eam_assign_one_asset_ck CHECK (
        (hardware_id IS NOT NULL AND software_id IS NULL)
        OR (hardware_id IS NULL AND software_id IS NOT NULL)
    )
);


-- ------------------------------------------------------------
-- STEP C — Indexes
-- ------------------------------------------------------------

CREATE INDEX eam_assignment_hw_ix     ON eam_assignment (hardware_id, returned_at);
CREATE INDEX eam_assignment_sw_ix     ON eam_assignment (software_id, returned_at);
CREATE INDEX eam_assignment_holder_ix ON eam_assignment (holder_id, issued_at);


-- ------------------------------------------------------------
-- STEP D — Table comments (optional)
-- ------------------------------------------------------------

COMMENT ON TABLE eam_app_user   IS 'Login accounts for EAM administrators';
COMMENT ON TABLE eam_holder      IS 'People who may be issued hardware or software';
COMMENT ON TABLE eam_hardware    IS 'Hardware asset inventory';
COMMENT ON TABLE eam_software    IS 'Software licenses / catalog';
COMMENT ON TABLE eam_assignment  IS 'Historical and active issue/return transactions';


-- ------------------------------------------------------------
-- STEP E — Verify (same schema owner)
-- ------------------------------------------------------------

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'eam%'
ORDER BY table_name;


-- ------------------------------------------------------------
-- STEP F — (Optional) Seed sample rows
--
-- Uncomment to load demo data — see 02_seed_sample.sql
-- ------------------------------------------------------------
