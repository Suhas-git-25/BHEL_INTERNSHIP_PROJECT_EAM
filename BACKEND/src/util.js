function rowsToClients(result) {
  if (!result || !result.rows) {
    return [];
  }
  return result.rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        typeof k === "string" ? k.toLowerCase() : k,
        v instanceof Date ? v.toISOString() : v,
      ])
    )
  );
}

module.exports = { rowsToClients };
