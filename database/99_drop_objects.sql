-- Tear down schema (reverse dependency order)

DROP TABLE IF EXISTS eam_assignment CASCADE;
DROP TABLE IF EXISTS eam_hardware CASCADE;
DROP TABLE IF EXISTS eam_software CASCADE;
DROP TABLE IF EXISTS eam_holder CASCADE;
DROP TABLE IF EXISTS eam_app_user CASCADE;
