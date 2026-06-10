-- ============================================================
-- Repair: CREATE eam_assignment if missing (API / COMMENT errors)
--
-- Prerequisites: these must already exist (from 01_schema.sql):
--   eam_app_user, eam_holder, eam_hardware, eam_software
--
-- If the table ALREADY exists partially, DROP it first then re-run:
--   DROP TABLE eam_assignment;
-- ============================================================

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

CREATE INDEX eam_assignment_hw_ix ON eam_assignment (hardware_id, returned_at);
CREATE INDEX eam_assignment_sw_ix ON eam_assignment (software_id, returned_at);
CREATE INDEX eam_assignment_holder_ix ON eam_assignment (holder_id, issued_at);

COMMENT ON TABLE eam_assignment IS 'Historical and active issue/return transactions';
