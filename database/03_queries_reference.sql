-- ============================================================
-- Reference queries you can paste into DBeaver (adjust binds)
-- ============================================================

-- All laptops (hardware category filter — "reports list of laptops")
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
LIMIT 50;

-- Global search pattern (hardware + software union)
-- Replace :q with your search term, e.g. 'dell'
SELECT 'HARDWARE' AS kind, hardware_id::text AS id, name, asset_tag AS extra
FROM eam_hardware
WHERE LOWER(name) LIKE '%' || 'dell' || '%' OR LOWER(asset_tag) LIKE '%' || 'dell' || '%'
UNION ALL
SELECT 'SOFTWARE', software_id::text, name, version_label
FROM eam_software
WHERE LOWER(name) LIKE '%' || 'dell' || '%';

-- Stats: assignments grouped by holder contract_ref (contract-basis view)
SELECT h.contract_ref,
       COUNT(*) AS open_assignments
FROM eam_assignment a
JOIN eam_holder h ON h.holder_id = a.holder_id
WHERE a.returned_at IS NULL
GROUP BY h.contract_ref
ORDER BY open_assignments DESC;

-- Stats: asset rows grouped by asset contract_ref
SELECT COALESCE(contract_ref, '(none)') AS contract_ref,
       COUNT(*) AS qty
FROM eam_hardware
GROUP BY contract_ref;

-- ISSUE hardware (transaction pattern — backend uses similar + status update)
-- 1. Ensure hardware is AVAILABLE
-- 2. INSERT assignment
/*
BEGIN;
INSERT INTO eam_assignment (holder_id, hardware_id, issued_by)
VALUES (1, 1, 1);
UPDATE eam_hardware SET status = 'ISSUED' WHERE hardware_id = 1;
COMMIT;
*/

-- TAKE BACK hardware
/*
BEGIN;
UPDATE eam_assignment
SET returned_at = CURRENT_TIMESTAMP
WHERE assignment_id = 1 AND returned_at IS NULL;
UPDATE eam_hardware SET status = 'AVAILABLE' WHERE hardware_id = 1;
COMMIT;
*/
