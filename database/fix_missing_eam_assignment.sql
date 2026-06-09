-- ============================================================
-- Repair: CREATE eam_assignment if ORA-00942 on COMMENT / API
--
-- Prerequisites: these must already exist (from 01_schema.sql):
--   eam_app_user, eam_holder, eam_hardware, eam_software
--
-- If the table ALREADY exists partially, DROP it first then re-run:
--   DROP TABLE eam_assignment;
-- ============================================================

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

CREATE INDEX eam_assignment_hw_ix ON eam_assignment (hardware_id, returned_at);
CREATE INDEX eam_assignment_sw_ix ON eam_assignment (software_id, returned_at);
CREATE INDEX eam_assignment_holder_ix ON eam_assignment (holder_id, issued_at);

COMMENT ON TABLE eam_assignment IS 'Historical and active issue/return transactions';

COMMIT;
