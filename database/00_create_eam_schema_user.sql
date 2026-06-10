-- ============================================================
-- Optional: create a dedicated PostgreSQL user and database for EAM
--
-- Run while connected as a superuser (usually "postgres").
--
-- In DBeaver: connect as postgres → execute this script → then create
-- a NEW connection to database "eam" as user "eam" and run 01_schema.sql.
--
-- Match BACKEND/.env :
--   DB_HOST=localhost
--   DB_PORT=5432
--   DB_NAME=eam
--   DB_USER=eam
--   DB_PASSWORD → same as below
-- ============================================================

CREATE USER eam WITH PASSWORD 'ChangeMe_StrongPwd1';

CREATE DATABASE eam OWNER eam;

GRANT ALL PRIVILEGES ON DATABASE eam TO eam;

-- After success: disconnect and create a NEW DBeaver connection:
--   Host: localhost   Port: 5432
--   Database: eam
--   User / Password: eam / ChangeMe_StrongPwd1
--
-- Under that connection expand: Schemas → public → Tables (after running 01_schema.sql)
