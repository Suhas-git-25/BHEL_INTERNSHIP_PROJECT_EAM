-- ============================================================
-- Reference queries you can paste into DBeaver (adjust binds)
-- ============================================================

-- All laptops (hardware category filter — “reports list of laptops”)
SELECT asset_tag,
       name,
       model,
       status,
       contract_ref,
       purchase_date
FROM eam_hardware
WHERE LOWER(category) LIKE '%laptop%'
ORDER BY asset_tag;

-- Current activity — open assignments (issued, not returned)
SELECT a.assignment_id,
       h.full_name   AS holder_name,
       h.department,
       hw.asset_tag,
       hw.name       AS hardware_name,
       sw.name       AS software_name,
       a.issued_at
FROM eam_assignment a
JOIN eam_holder h ON h.holder_id = a.holder_id
LEFT JOIN eam_hardware hw ON hw.hardware_id = a.hardware_id
LEFT JOIN eam_software sw ON sw.software_id = a.software_id
WHERE a.returned_at IS NULL
ORDER BY a.issued_at DESC;

-- Recent returns (historical movement for dashboard)
SELECT a.assignment_id,
       h.full_name,
       hw.asset_tag,
       sw.name AS software_name,
       a.issued_at,
       a.returned_at
FROM eam_assignment a
JOIN eam_holder h ON h.holder_id = a.holder_id
LEFT JOIN eam_hardware hw ON hw.hardware_id = a.hardware_id
LEFT JOIN eam_software sw ON sw.software_id = a.software_id
WHERE a.returned_at IS NOT NULL
ORDER BY a.returned_at DESC
FETCH FIRST 50 ROWS ONLY;

-- Global search pattern (hardware + software union)
SELECT 'HARDWARE' AS kind, CAST(hardware_id AS VARCHAR2(20)) AS id, name, asset_tag AS extra
FROM eam_hardware
WHERE LOWER(name) LIKE '%' || :q || '%' OR LOWER(asset_tag) LIKE '%' || :q || '%'
UNION ALL
SELECT 'SOFTWARE', CAST(software_id AS VARCHAR2(20)), name, version_label
FROM eam_software
WHERE LOWER(name) LIKE '%' || :q || '%';

-- Stats: assignments grouped by holder contract_ref (contract‑basis view)
SELECT h.contract_ref,
       COUNT(*) AS open_assignments
FROM eam_assignment a
JOIN eam_holder h ON h.holder_id = a.holder_id
WHERE a.returned_at IS NULL
GROUP BY h.contract_ref
ORDER BY open_assignments DESC;

-- Stats: asset rows grouped by asset contract_ref
SELECT NVL(contract_ref, '(none)') AS contract_ref,
       COUNT(*) AS qty
FROM eam_hardware
GROUP BY contract_ref;

-- ISSUE hardware (transaction pattern — backend uses similar + status update)
-- 1. Ensure hardware is AVAILABLE
-- 2. INSERT assignment
/*
INSERT INTO eam_assignment (holder_id, hardware_id, issued_by)
VALUES (:holder_id, :hardware_id, :app_user_id);
UPDATE eam_hardware SET status = 'ISSUED' WHERE hardware_id = :hardware_id;
COMMIT;
*/

-- TAKE BACK hardware
/*
UPDATE eam_assignment
SET returned_at = SYSTIMESTAMP
WHERE assignment_id = :assignment_id AND returned_at IS NULL;
UPDATE eam_hardware SET status = 'AVAILABLE' WHERE hardware_id = :hardware_id;
COMMIT;
*/
