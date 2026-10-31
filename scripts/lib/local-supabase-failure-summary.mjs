// Allowlisted diagnostic fields only. Never echo a CLI line, SQL body, URL or credential.
export function summarizeFailure(log, migrationNames) {
  const known = new Set(migrationNames);
  const categories = new Set(['INACTIVE_SOURCE_GUARD','OWNER_TRANSFER_SET_ROLE','RELATION_ALREADY_EXISTS','CONNECTIVITY','CONTAINER_IMAGE','PERMISSION','DATABASE_ERROR','UNCLASSIFIED']);
  // A workflow can wrap the already-redacted helper. Revalidate the small
  // summary instead of echoing that wrapper's potentially credential-bearing log.
  for (const line of log.split('\n').reverse()) {
    if (!line.startsWith('{')) continue;
    try {
      const value = JSON.parse(line);
      if (value.status !== 'FAILED' || value.raw_output !== 'WITHHELD' || !categories.has(value.category)) continue;
      return {status:'FAILED',category:value.category,
        last_known_migration:known.has(value.last_known_migration)?value.last_known_migration:null,
        sqlstate:typeof value.sqlstate==='string'&&/^[0-9A-Z]{5}$/.test(value.sqlstate)?value.sqlstate:null,
        raw_output:'WITHHELD'};
    } catch { /* Unrecognized lines remain private. */ }
  }
  const applied = [...log.matchAll(/Applying migration ([0-9]{14}_[a-z0-9_]+\.sql)(?:\.\.\.|\s|$)/g)]
    .map(match => match[1]).filter(name => known.has(name));
  const codes = [...log.matchAll(/\bSQLSTATE[\s:=]+([0-9A-Z]{5})\b/g)].map(match => match[1]);
  const error = log.split('\n').filter(line=>/ERROR:/.test(line)).at(-1) ?? '';
  const category = /building_g2_inactive_source_only/.test(error) ? 'INACTIVE_SOURCE_GUARD'
    : /must be able to SET ROLE/.test(error) ? 'OWNER_TRANSFER_SET_ROLE'
    : /relation [^\n]* already exists/.test(error) ? 'RELATION_ALREADY_EXISTS'
    : /could not (?:resolve|connect)|connection refused|TLS handshake timeout|i\/o timeout/i.test(log) ? 'CONNECTIVITY'
    : /manifest unknown|failed to pull|pull access denied/i.test(log) ? 'CONTAINER_IMAGE'
    : /permission denied|insufficient privilege/i.test(log) ? 'PERMISSION'
    : codes.length ? 'DATABASE_ERROR' : 'UNCLASSIFIED';
  return { status: 'FAILED', category, last_known_migration: applied.at(-1) ?? null,
    sqlstate: codes.at(-1) ?? null, raw_output: 'WITHHELD' };
}
