// Validates a deployment target; it neither opens a connection nor grants
// execution authority. Callers must supply an independently approved policy,
// not derive the expected project from the connection string being checked.
const REF = /^[a-z]{20}$/;
const fail = code => { throw new Error(code); };
export function validateStagingConnection(policy, configured) {
  if (policy?.purpose !== 'staging' || !REF.test(policy.expectedProjectRef ?? '') ||
      !Array.isArray(policy.forbiddenProjectRefs) || policy.forbiddenProjectRefs.length === 0 ||
      policy.forbiddenProjectRefs.some(ref => !REF.test(ref))) fail('STAGING_POLICY_REQUIRED');
  const expected = policy.expectedProjectRef;
  if (policy.forbiddenProjectRefs.includes(expected)) fail('PRODUCTION_TARGET_FORBIDDEN');
  if (configured?.projectRef !== expected) fail('STAGING_PROJECT_MISMATCH');
  let api, db;
  try { api = new URL(configured.supabaseUrl); } catch { fail('STAGING_API_URL_INVALID'); }
  if (api.protocol !== 'https:' || api.hostname !== expected + '.supabase.co' ||
      api.port || api.username || api.password || api.pathname !== '/' || api.search || api.hash)
    fail('STAGING_API_PROJECT_MISMATCH');
  try { db = new URL(configured.databaseUrl); } catch { fail('STAGING_DATABASE_URL_INVALID'); }
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || db.hash) fail('STAGING_DATABASE_URL_INVALID');
  let user, password;
  try { user = decodeURIComponent(db.username); password = decodeURIComponent(db.password); }
  catch { fail('STAGING_CREDENTIAL_ENCODING_INVALID'); }
  if (!password || /[\u0000\r\n]/.test(password)) fail('STAGING_PASSWORD_REQUIRED');
  if (db.pathname !== '/postgres') fail('STAGING_DATABASE_NAME_INVALID');
  if (db.port && db.port !== '5432') fail('SESSION_CONNECTION_REQUIRED');
  let mode;
  if (db.hostname === 'db.' + expected + '.supabase.co') {
    if (user !== 'postgres') fail('STAGING_DATABASE_USER_MISMATCH');
    mode = 'direct';
  } else if (/^aws-\d+-[a-z]{2}-[a-z]+-\d+\.pooler\.supabase\.com$/.test(db.hostname)) {
    if (user !== 'postgres.' + expected) fail('STAGING_POOLER_PROJECT_MISMATCH');
    mode = 'session_pooler';
  } else fail('STAGING_DATABASE_HOST_MISMATCH');
  for (const [key,value] of db.searchParams) {
    if (key === 'sslmode') {
      if (!['require','verify-full'].includes(value) || db.searchParams.getAll(key).length !== 1)
        fail('VERIFIED_TLS_REQUIRED');
    } else if (key === 'application_name') {
      if (!/^[A-Za-z0-9_.-]{1,64}$/.test(value) || db.searchParams.getAll(key).length !== 1)
        fail('STAGING_APPLICATION_NAME_INVALID');
    } else fail('STAGING_CONNECTION_OPTION_FORBIDDEN');
  }
  // Credential-free descriptor only. Do not return or log the URL/password.
  // The actual client must use explicit ssl.rejectUnauthorized=true; checking
  // sslmode here alone is not proof that a particular driver verifies TLS.
  return {projectRef:expected,host:db.hostname,port:5432,user,database:'postgres',mode,tls:'verify-full-required'};
}
