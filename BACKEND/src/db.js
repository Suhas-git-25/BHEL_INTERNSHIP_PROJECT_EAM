const { Pool } = require("pg");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
require("dotenv").config({ path: envPath });

let pool;

function namedToPositional(sql, binds = {}) {
  const params = [];
  const seen = new Map();
  const converted = sql.replace(/(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name) => {
    if (!seen.has(name)) {
      seen.set(name, params.length + 1);
      params.push(binds[name]);
    }
    return `$${seen.get(name)}`;
  });
  return { sql: converted, params };
}

function preprocessSql(sql, binds) {
  let outBindName = null;
  let outBindCol = null;
  const cleanBinds = { ...binds };

  const returningInto = sql.match(/RETURNING\s+(\w+)\s+INTO\s+:(\w+)/i);
  if (returningInto) {
    outBindCol = returningInto[1];
    outBindName = returningInto[2];
    sql = sql.replace(/RETURNING\s+\w+\s+INTO\s+:\w+/i, `RETURNING ${outBindCol}`);
    const bindValue = cleanBinds[outBindName];
    if (bindValue && typeof bindValue === "object" && bindValue.dir) {
      delete cleanBinds[outBindName];
    }
  }

  sql = sql.replace(/\bSYSTIMESTAMP\b/gi, "CURRENT_TIMESTAMP");
  sql = sql.replace(/\bNVL\s*\(/gi, "COALESCE(");
  sql = sql.replace(/\bTO_CHAR\s*\(\s*(\w+)\s*\)/gi, "$1::text");

  return { sql, cleanBinds, outBindCol, outBindName };
}

async function initPool() {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL || process.env.DB_CONNECT_STRING;

  const config = connectionString
    ? { connectionString }
    : {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || "eam",
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      };

  pool = new Pool({ ...config, max: 8 });
  return pool;
}

async function withConnection(handler) {
  const p = await initPool();
  const client = await p.connect();
  let committed = false;

  try {
    await client.query("BEGIN");

    const conn = {
      async execute(sql, binds = {}) {
        const { sql: pgSql, cleanBinds, outBindCol, outBindName } = preprocessSql(sql, binds);
        const { sql: query, params } = namedToPositional(pgSql, cleanBinds);
        const result = await client.query(query, params);

        const response = {
          rows: result.rows,
          rowsAffected: result.rowCount,
        };

        if (outBindCol && outBindName && result.rows[0]) {
          response.outBinds = {
            [outBindName]: [result.rows[0][outBindCol]],
          };
        }

        return response;
      },
      async commit() {
        await client.query("COMMIT");
        committed = true;
      },
    };

    const result = await handler(conn);
    if (!committed) {
      await client.query("ROLLBACK");
      committed = true;
    }
    return result;
  } catch (err) {
    if (!committed) {
      await client.query("ROLLBACK");
      committed = true;
    }
    throw err;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = { initPool, withConnection, closePool };
