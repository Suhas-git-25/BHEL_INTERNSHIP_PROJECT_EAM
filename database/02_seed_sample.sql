-- Optional sample rows for local testing (run after 01_schema.sql)

INSERT INTO eam_holder (full_name, email, department, contract_ref)
VALUES ('Ada Lovelace', 'ada@example.com', 'Engineering', 'CNT-2024-001');

INSERT INTO eam_holder (full_name, email, department, contract_ref)
VALUES ('Alan Turing', 'alan@example.com', 'Research', 'CNT-2024-002');

INSERT INTO eam_hardware (asset_tag, name, category, model, status, contract_ref, purchase_date)
VALUES ('LT-001', 'Dell Latitude 7430', 'Laptop', '7430', 'AVAILABLE', 'CNT-2024-001', DATE '2023-06-01');

INSERT INTO eam_hardware (asset_tag, name, category, model, status, contract_ref, purchase_date)
VALUES ('LT-002', 'Lenovo ThinkPad X1', 'Laptop', 'Gen10', 'AVAILABLE', 'CNT-2024-001', DATE '2023-09-15');

INSERT INTO eam_hardware (asset_tag, name, category, model, status, contract_ref)
VALUES ('MON-090', 'Dell Ultrasharp 27', 'Monitor', 'U2723QE', 'AVAILABLE', 'CNT-2024-002');

INSERT INTO eam_software (name, version_label, license_type, total_licenses, seats_in_use, contract_ref)
VALUES ('Adobe Creative Cloud', '2024', 'Named', 10, 0, 'CNT-2024-001');

INSERT INTO eam_software (name, version_label, license_type, total_licenses, seats_in_use, contract_ref)
VALUES ('Microsoft 365 E3', '-', 'Subscription', 200, 0, 'CNT-2024-002');

COMMIT;

-- Application login users should be created through POST /api/auth/register
-- or insert a bcrypt hash you generate in Node.js (never store plaintext passwords).
