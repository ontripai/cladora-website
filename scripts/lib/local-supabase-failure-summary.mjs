// Allowlisted diagnostic fields only. Never echo a CLI line, SQL body, URL or credential.
export function summarizeFailure(log, migrationNames) {
  const known = new Set(migrationNames);
  const applied = [...log.matchAll(/Applying migration ([0-9]{14}_[a-z0-9_]+\.sql)(?:\.\.\.|\s|$)/g)]
    .map(match => match[1]).filter(name => known.has(name));
  const codes = [...log.matchAll(/\bSQLSTATE[\s:=]+([0-9A-Z]{5})\b/g)].map(match => match[1]);
  const category = /must be able to SET ROLE/.test(log) ? 'OWNER_TRANSFER_SET_ROLE'
    : /relation [^\n]* already exists/.test(log) ? 'RELATION_ALREADY_EXISTS'
    : /could not (?:resolve|connect)|connection refused|TLS handshake timeout|i\/o timeout/i.test(log) ? 'CONNECTIVITY'
    : /manifest unknown|failed to pull|pull access denied/i.test(log) ? 'CONTAINER_IMAGE'
    : /permission denied|insufficient privilege/i.test(log) ? 'PERMISSION'
    : codes.length ? 'DATABASE_ERROR' : 'UNCLASSIFIED';
  return { status: 'FAILED', category, last_known_migration: applied.at(-1) ?? null,
    sqlstate: codes.at(-1) ?? null, raw_output: 'WITHHELD' };
}
