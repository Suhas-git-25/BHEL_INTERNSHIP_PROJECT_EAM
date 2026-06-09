-- ============================================================
-- Optional: create a dedicated Oracle user/schema for EAM tables
--
-- Run while connected as a privileged user THAT CAN CREATE USERS inside
-- the same PDB where your app connects (often PDBADMIN when using XEPDB1).
--
-- In DBeaver: connect → XEPDB1 → execute this script → then reconnect AS the
-- new user and run 01_schema.sql there.
--
-- Match BACKEND/.env :
--   DB_USER / DB_PASSWORD → same as below
--   DB_CONNECT_STRING → e.g. localhost:1521/XEPDB1
-- ============================================================

-- Pick a username and password:

CREATE USER eam IDENTIFIED BY "ChangeMe_StrongPwd1";

GRANT CONNECT, RESOURCE TO eam;
ALTER USER eam QUOTA UNLIMITED ON USERS;

-- Optional: RESOURCE is enough for tables in many PDBs.
-- Uncomment if RESOURCE is not sufficient in your edition:
-- GRANT CREATE TABLE, CREATE SEQUENCE, CREATE VIEW TO eam;

COMMIT;

-- After success: disconnect and create a NEW DBeaver connection:
--   User / Password: eam / ChangeMe_StrongPwd1
--   Service name / URL host: localhost:1521  Service: XEPDB1
--
-- Under that connection expand: Schemas → EAM → Tables
