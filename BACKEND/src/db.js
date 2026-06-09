const oracledb = require("oracledb");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
require("dotenv").config({ path: envPath });

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool;

async function initPool() {
  if (pool) {
    return pool;
  }
  pool = await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: 1,
    poolMax: 8,
    poolIncrement: 1,
  });
  return pool;
}

async function withConnection(handler) {
  const p = await initPool();
  const conn = await p.getConnection();
  try {
    return await handler(conn);
  } finally {
    await conn.close();
  }
}

async function closePool() {
  if (pool) {
    await pool.close(10);
    pool = undefined;
  }
}

module.exports = { initPool, withConnection, closePool };
