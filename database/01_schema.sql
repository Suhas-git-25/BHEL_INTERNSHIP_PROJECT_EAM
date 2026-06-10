-- ============================================
-- Enterprise Asset Management – PostgreSQL DDL
-- Run in DBeaver connected to your EAM database
-- (e.g. database "eam" as user "eam" or postgres).
--
-- DBeaver: run the FULL script once (Ctrl+A → Execute SQL Script).
-- ============================================

-- Application users (login / admins)
CREATE TABLE eam_app_user (
    user_id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email            VARCHAR(255) NOT NULL UNIQUE,
    password_hash    VARCHAR(255) NOT NULL,
    full_name        VARCHAR(255),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT eam_app_user_email_lower CHECK (email = LOWER(email))
);

-- People assets are issued to (employees / contractors)
CREATE TABLE eam_holder (
    holder_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255),
    department      VARCHAR(120),
    contract_ref    VARCHAR(120),
    CONSTRAINT eam_holder_email_unique UNIQUE (email)
);

-- Hardware inventory
CREATE TABLE eam_hardware (
    hardware_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_tag       VARCHAR(120) NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    category        VARCHAR(120),
    model           VARCHAR(120),
    status          VARCHAR(40) DEFAULT 'AVAILABLE'
                    CONSTRAINT eam_hw_status_ck CHECK (status IN ('AVAILABLE', 'ISSUED', 'RETIRED')),
    contract_ref    VARCHAR(120),
    purchase_date   DATE,
    notes           VARCHAR(4000),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Software licenses / products
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

-- Issue / return ledger (hardware XOR software row)
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

-- Enforce "one hardware row can only have one OPEN assignment" in the app layer
-- or add a partial unique index (supported in PostgreSQL):
-- CREATE UNIQUE INDEX eam_assignment_open_hw_uq ON eam_assignment (hardware_id) WHERE returned_at IS NULL;
CREATE INDEX eam_assignment_hw_ix ON eam_assignment (hardware_id, returned_at);
CREATE INDEX eam_assignment_sw_ix ON eam_assignment (software_id, returned_at);
CREATE INDEX eam_assignment_holder_ix ON eam_assignment (holder_id, issued_at);

COMMENT ON TABLE eam_app_user IS 'Login accounts for EAM administrators';
COMMENT ON TABLE eam_holder IS 'People who may be issued hardware or software';
COMMENT ON TABLE eam_hardware IS 'Hardware asset inventory';
COMMENT ON TABLE eam_software IS 'Software licenses / catalog';
COMMENT ON TABLE eam_assignment IS 'Historical and active issue/return transactions';
