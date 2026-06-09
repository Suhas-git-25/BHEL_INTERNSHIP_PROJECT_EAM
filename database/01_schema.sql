-- ============================================
-- Enterprise Asset Management – Oracle DDL
-- Run in DBeaver as SYS or a user with CREATE privileges,
-- OR run while connected as your application schema user.
--
-- DBeaver: run the FULL script once (Ctrl+A → right-click → Execute SQL Script),
-- or use Alt+X "Execute SQL Script". If you execute only one statement at a time,
-- COMMENT ON eam_assignment will fail with ORA-00942 until CREATE TABLE succeeds.
--
-- If you already created the other tables but NOT eam_assignment, run instead:
--   database/fix_missing_eam_assignment.sql
-- ============================================

-- Application users (login / admins)
CREATE TABLE eam_app_user (
    user_id          NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email            VARCHAR2(255 CHAR) NOT NULL UNIQUE,
    password_hash    VARCHAR2(255 CHAR) NOT NULL,
    full_name        VARCHAR2(255 CHAR),
    created_at       TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT eam_app_user_email_lower CHECK (email = LOWER(email))
);

-- People assets are issued to (employees / contractors)
CREATE TABLE eam_holder (
    holder_id       NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name       VARCHAR2(255 CHAR) NOT NULL,
    email           VARCHAR2(255 CHAR),
    department      VARCHAR2(120 CHAR),
    contract_ref    VARCHAR2(120 CHAR),
    CONSTRAINT eam_holder_email_unique UNIQUE (email)
);

-- Hardware inventory
CREATE TABLE eam_hardware (
    hardware_id     NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_tag       VARCHAR2(120 CHAR) NOT NULL UNIQUE,
    name            VARCHAR2(255 CHAR) NOT NULL,
    category        VARCHAR2(120 CHAR),
    model           VARCHAR2(120 CHAR),
    status          VARCHAR2(40 CHAR) DEFAULT 'AVAILABLE'
                    CONSTRAINT eam_hw_status_ck CHECK (status IN ('AVAILABLE', 'ISSUED', 'RETIRED')),
    contract_ref    VARCHAR2(120 CHAR),
    purchase_date   DATE,
    notes           VARCHAR2(4000 CHAR),
    created_at      TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);

-- Software licenses / products
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

-- Issue / return ledger (hardware XOR software row)
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

-- Enforce “one hardware row can only have one OPEN assignment” in the app layer
-- or add a trigger; standard Oracle lacks partial unique indexes in many editions.
CREATE INDEX eam_assignment_hw_ix ON eam_assignment (hardware_id, returned_at);
CREATE INDEX eam_assignment_sw_ix ON eam_assignment (software_id, returned_at);
CREATE INDEX eam_assignment_holder_ix ON eam_assignment (holder_id, issued_at);

COMMENT ON TABLE eam_app_user IS 'Login accounts for EAM administrators';
COMMENT ON TABLE eam_holder IS 'People who may be issued hardware or software';
COMMENT ON TABLE eam_hardware IS 'Hardware asset inventory';
COMMENT ON TABLE eam_software IS 'Software licenses / catalog';
COMMENT ON TABLE eam_assignment IS 'Historical and active issue/return transactions';
