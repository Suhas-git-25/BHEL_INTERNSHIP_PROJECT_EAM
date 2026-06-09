-- ============================================================
-- Enterprise Asset Management – create database objects (Oracle)
--
-- CONNECT TO YOUR PDB FIRST (example: localhost:1521 / XEPDB1)
-- Prefer a dedicated schema user (e.g. EAM) — not SYSTEM.
--
-- Run each STEP in order inside DBeaver, OR select ALL and
-- Execute SQL Script (Alt+X).
-- ============================================================

-- ------------------------------------------------------------
-- STEP 0 — (Optional) Sanity check – should return one row each
-- ------------------------------------------------------------
SELECT SYS_CONTEXT('USERENV', 'CURRENT_USER') AS ora_user FROM dual;
SELECT COUNT(*) FROM dual;


-- ------------------------------------------------------------
-- STEP A — (Optional) Dedicated application user/schema
--
-- Requires privilege to CREATE USER (often PDBADMIN on XEPDB1).
-- If you skip this, connect AS your chosen user instead and continue at STEP B.
-- ------------------------------------------------------------

/*
CREATE USER eam IDENTIFIED BY "YOUR_STRONG_PASSWORD_HERE";
GRANT CONNECT, RESOURCE TO eam;
ALTER USER eam QUOTA UNLIMITED ON USERS;
COMMIT;

-- Next: reconnect DBeaver as user EAM, then continue from STEP B.
*/


-- ------------------------------------------------------------
-- STEP Z — (Optional) Tear down OLD EAM tables before rebuild
--
-- Uncomment once. Order matters (children first).
-- ------------------------------------------------------------

/*
DROP TABLE eam_assignment           CASCADE CONSTRAINTS PURGE;
DROP TABLE eam_hardware           CASCADE CONSTRAINTS PURGE;
DROP TABLE eam_software           CASCADE CONSTRAINTS PURGE;
DROP TABLE eam_holder             CASCADE CONSTRAINTS PURGE;
DROP TABLE eam_app_user           CASCADE CONSTRAINTS PURGE;
COMMIT;
*/


-- ------------------------------------------------------------
-- STEP B — Core tables (run as the schema owner — e.g. EAM)
-- ------------------------------------------------------------

CREATE TABLE eam_app_user (
    user_id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email            VARCHAR2(255 CHAR) NOT NULL UNIQUE,
    password_hash    VARCHAR2(255 CHAR) NOT NULL,
    full_name        VARCHAR2(255 CHAR),
    created_at       TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT eam_app_user_email_lower CHECK (email = LOWER(email))
);

CREATE TABLE eam_holder (
    holder_id       NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name       VARCHAR2(255 CHAR) NOT NULL,
    email           VARCHAR2(255 CHAR),
    department      VARCHAR2(120 CHAR),
    contract_ref    VARCHAR2(120 CHAR),
    CONSTRAINT eam_holder_email_unique UNIQUE (email)
);

CREATE TABLE eam_hardware (
    hardware_id     NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_tag       VARCHAR2(120 CHAR) NOT NULL UNIQUE,
    name            VARCHAR2(255 CHAR) NOT NULL,
    category        VARCHAR2(120 CHAR),
    model           VARCHAR2(120 CHAR),
    status          VARCHAR2(40 CHAR) DEFAULT 'AVAILABLE'
                    CONSTRAINT eam_hw_status_ck CHECK (
                        status IN ('AVAILABLE', 'ISSUED', 'RETIRED')),
    contract_ref    VARCHAR2(120 CHAR),
    purchase_date   DATE,
    notes           VARCHAR2(4000 CHAR),
    created_at      TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE TABLE eam_software (
    software_id      NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name             VARCHAR2(255 CHAR) NOT NULL,
    version_label    VARCHAR2(80 CHAR),
    license_type     VARCHAR2(120 CHAR),
    total_licenses   NUMBER DEFAULT 0,
    seats_in_use     NUMBER DEFAULT 0,
    contract_ref     VARCHAR2(120 CHAR),
    notes            VARCHAR2(4000 CHAR),
    created_at       TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT eam_sw_lic_ck CHECK (total_licenses >= 0 AND seats_in_use >= 0)
);

CREATE TABLE eam_assignment (
    assignment_id   NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    holder_id       NUMBER NOT NULL,
    hardware_id     NUMBER,
    software_id     NUMBER,
    issued_at       TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    returned_at     TIMESTAMP,
    notes           VARCHAR2(1000 CHAR),
    issued_by       NUMBER REFERENCES eam_app_user (user_id),
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


COMMIT;


-- ------------------------------------------------------------
-- STEP E — Verify (same schema owner)
-- ------------------------------------------------------------

SELECT table_name FROM user_tables WHERE table_name LIKE 'EAM%' ORDER BY table_name;


-- ------------------------------------------------------------
-- STEP F — (Optional) Seed sample rows
--
-- Uncomment to load demo data — from same file folder see 02_seed_sample.sql
-- ------------------------------------------------------------
