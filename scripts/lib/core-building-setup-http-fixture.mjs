import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { createServer, connect } from 'node:net';
import { promisify } from 'node:util';
import { generateTotp } from './ap10-auth-e2e-fixture.mjs';

export const TASK = 'CORE-BUILDING-SETUP-CONNECTED-HTTP-01';
export const PARENT = '87ddb06877fb31f562ba66477d14f7bc453a17ee';
export const BRANCH = 'codex/core-building-setup-connected-http';
export const ROOT = new URL('../../', import.meta.url);
export const ROUTE = '/api/customer/v1/onboarding/building-setup';
const exec = promisify(execFile);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const sha = /^[a-f0-9]{40}$/;
export function check(value, code) {
  if (!value) throw Error('BH_' + code);
}
export const hash = value => createHash('sha256').update(value).digest('hex');
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function browserKey(key) {
  check(typeof key==='string' && key.length>16 && !key.startsWith('sb_secret_'),'PUBLIC_KEY');
  if(key.startsWith('sb_publishable_')) return key;
  try {
    check(key.split('.').length===3 && JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon','PUBLIC_KEY');
  } catch {throw Error('BH_PUBLIC_KEY');}
  return key;
}

function localOrigin(value) {
  let u;
  try { u = new URL(value); } catch { throw Error('BH_ORIGIN'); }
  check(u.protocol === 'http:' && u.hostname === '127.0.0.1' && u.origin === value
    && !u.username && !u.password && Number(u.port) >= 1024 && Number(u.port) <= 65535, 'ORIGIN');
  return u;
}

// Lease is supplied by the Coordinator/provisioner, never minted by this runner.
// DB marker + exact live container IDs independently bind its target. No endpoints
// or credentials are accepted from command-line flags or endpoint env overrides.
export function validateLease({ lease, env, head, projectRef, now = Date.now() }) {
  check(env.BUILDING_SETUP_HTTP_EPHEMERAL === '1', 'EPHEMERAL_OPT_IN');
  check(!env.VERCEL && !env.VERCEL_ENV && !env.NEXT_PUBLIC_VERCEL_ENV
    && env.NODE_ENV !== 'production', 'PRODUCTION');
  check(!env.DOCKER_HOST && !env.DOCKER_CONTEXT && !env.DOCKER_TLS_VERIFY && !env.DOCKER_CERT_PATH, 'DOCKER_OVERRIDE');
  for (const key of Object.keys(env)) {
    if (key.startsWith('BUILDING_SETUP_HTTP_')) check(
      ['BUILDING_SETUP_HTTP_EPHEMERAL', 'BUILDING_SETUP_HTTP_LEASE_FILE', 'BUILDING_SETUP_HTTP_INJECT_FAILURE'].includes(key),
      'ENDPOINT_OVERRIDE');
  }
  check(!env.NODE_OPTIONS && !env.NODE_TLS_REJECT_UNAUTHORIZED, 'RUNTIME_OVERRIDE');
  const fields = ['version','task','worker','sha','run_id','lease_id','expires_at','project_ref',
    'app_origin','api_origin','db_port','db_container_id','auth_container_id','fixture_prefix'];
  check(lease && Object.keys(lease).length === fields.length && fields.every(k => Object.hasOwn(lease,k)), 'LEASE_SHAPE');
  check(fields.filter(k=>!['version','db_port'].includes(k)).every(k=>typeof lease[k]==='string'),'LEASE_TYPES');
  check(lease.version === 1 && lease.task === TASK && lease.worker === 'CLADORA-CORE-WORKER-01', 'LEASE_TASK');
  check(sha.test(head) && lease.sha === head && uuid.test(lease.run_id), 'LEASE_SHA');
  check(lease.lease_id === 'building-http-' + lease.run_id + '-' + head, 'LEASE_ID');
  const end = Date.parse(lease.expires_at);
  check(Number.isFinite(end) && end > now && end - now <= 4 * 3600_000, 'LEASE_EXPIRY');
  check(lease.project_ref === projectRef && projectRef === 'cladora-local', 'PROJECT');
  localOrigin(lease.app_origin); localOrigin(lease.api_origin);
  check(lease.api_origin === 'http://127.0.0.1:54321' && lease.db_port === 54322
    && lease.app_origin !== lease.api_origin && new URL(lease.app_origin).port !== String(lease.db_port), 'PORTS');
  check(/^[a-f0-9]{64}$/.test(lease.db_container_id) && /^[a-f0-9]{64}$/.test(lease.auth_container_id)
    && lease.db_container_id !== lease.auth_container_id, 'CONTAINER_ID');
  check(/^[a-f0-9]{8}$/.test(lease.fixture_prefix) && lease.fixture_prefix !== 'c2200000', 'FIXTURE_NAMESPACE');
  check(!env.BUILDING_SETUP_HTTP_INJECT_FAILURE
    || ['after-auth','after-fixture','after-next','after-recovery'].includes(env.BUILDING_SETUP_HTTP_INJECT_FAILURE), 'INJECTION');
  return Object.freeze({ ...lease });
}

export async function readExecutionLease(env = process.env) {
  check(env.BUILDING_SETUP_HTTP_EPHEMERAL === '1', 'EPHEMERAL_OPT_IN');
  const path = env.BUILDING_SETUP_HTTP_LEASE_FILE;
  check(typeof path === 'string' && path.startsWith('/'), 'LEASE_FILE');
  const stat = await lstat(path);
  check(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 8192
    && (stat.mode & 0o077) === 0 && stat.uid === process.getuid(), 'LEASE_FILE_PERMISSIONS');
  const names = await readdir(ROOT);
  check(!names.some(n => n === '.env' || n.startsWith('.env.') && n !== '.env.example'), 'DOTENV');
  const git = async args => (await exec('git',args,{cwd:ROOT,timeout:10_000,maxBuffer:64*1024})).stdout.trim();
  check(await git(['remote','get-url','origin']) === 'https://github.com/ontripai/cladora-website.git', 'ORIGIN_REPOSITORY');
  check(await git(['branch','--show-current']) === BRANCH, 'BRANCH');
  const head = await git(['rev-parse','HEAD']);
  await git(['merge-base','--is-ancestor',PARENT,head]);
  check(await git(['diff','--name-only']) === '' && await git(['diff','--cached','--name-only']) === '', 'DIRTY_TRACKED');
  const untracked = await git(['ls-files','--others','--exclude-standard']);
  check(!untracked || untracked === 'supabase/.temp/cli-latest', 'DIRTY_UNTRACKED');
  const config = await readFile(new URL('supabase/config.toml',ROOT),'utf8');
  const projectRef = /^project_id\s*=\s*"([^"]+)"$/m.exec(config)?.[1];
  let lease;
  try { lease = JSON.parse(await readFile(path,'utf8')); } catch { throw Error('BH_LEASE_JSON'); }
  return validateLease({lease,env,head,projectRef});
}

export function assertContainer(proof, id, project, kind) {
  check(proof.id === id && proof.running === true && proof.labels?.['com.supabase.cli.project'] === project, 'CONTAINER_IDENTITY');
  check(kind === 'db'
    ? /^(?:public\.ecr\.aws\/supabase\/|supabase\/)postgres:17\.6\.1\.095$/.test(proof.image)
    : /^(?:public\.ecr\.aws\/supabase\/|supabase\/)gotrue:v[0-9.]+$/.test(proof.image), 'OFFICIAL_IMAGE');
  if (kind === 'db') check(proof.ports?.['5432/tcp']?.some(p =>
    ['127.0.0.1','0.0.0.0'].includes(p.HostIp) && p.HostPort === '54322'), 'DB_PORT_IDENTITY');
}

export async function inspectTarget(lease) {
  // Read-only official CLI status, not startup, image pull or configuration.
  const version=await exec('supabase',['--version'],{cwd:ROOT,timeout:10_000,maxBuffer:65536});
  check(version.stdout.trim()==='2.84.2','CLI_VERSION');
  await exec('supabase',['status','--help'],{cwd:ROOT,timeout:10_000,maxBuffer:65536});
  const { stdout } = await exec('supabase',['status','--output','json'],{cwd:ROOT,timeout:15_000,maxBuffer:1024*1024});
  const status = JSON.parse(stdout);
  check(status.API_URL === lease.api_origin && status.DB_URL, 'CLI_TARGET');
  const db = new URL(status.DB_URL);
  check(['postgres:','postgresql:'].includes(db.protocol) && db.hostname === '127.0.0.1'
    && db.port === String(lease.db_port) && db.pathname === '/postgres' && db.username === 'postgres'
    && !db.search && !db.hash, 'CLI_DATABASE');
  check(typeof status.ANON_KEY === 'string' && typeof status.SERVICE_ROLE_KEY === 'string'
    && status.ANON_KEY !== status.SERVICE_ROLE_KEY, 'CLI_KEYS');
  browserKey(status.ANON_KEY);
  for (const [kind,id] of [['db',lease.db_container_id],['auth',lease.auth_container_id]]) {
    const format = '{{json .Id}}|{{json .Config.Labels}}|{{json .Config.Image}}|{{json .State.Running}}|{{json .HostConfig.PortBindings}}';
    const {stdout: raw} = await exec('docker',['--host=unix:///var/run/docker.sock','inspect','--format',format,id],
      {timeout:10_000,maxBuffer:65536});
    const parts = raw.trim().split('|').map(p => JSON.parse(p));
    assertContainer({id:parts[0],labels:parts[1],image:parts[2],running:parts[3],ports:parts[4]},id,lease.project_ref,kind);
  }
  return status; // In-memory only: never serialize status or raw subprocess errors.
}

export function leaseLive(lease) {
  check(Date.parse(lease.expires_at) > Date.now(), 'LEASE_EXPIRED');
}
export function guardedFetch(origin) {
  localOrigin(origin);
  return async (input, init = {}) => {
    const u = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    check(u.origin === origin && !u.username && !u.password && !u.hash, 'FETCH_TARGET');
    const response = await fetch(input,{...init,redirect:'manual',
      signal: AbortSignal.any([init.signal,AbortSignal.timeout(20_000)].filter(Boolean))});
    check(response.status < 300 || response.status >= 400, 'REDIRECT');
    return response;
  };
}
export async function nextRequest(lease, cookie, {path = ROUTE, method = 'GET', body, discard = false, badOrigin = false}) {
  leaseLive(lease);
  const u = new URL(path,lease.app_origin);
  check(u.origin === lease.app_origin && !u.hash
    && new RegExp('^'+ROUTE+'(?:/[a-f0-9-]{36}(?:/(?:rehearse|submit|approve|provision))?)?$').test(u.pathname),
  'ROUTE_TARGET');
  for (const name of u.searchParams.keys()) check(['context_id','workspace_id','idempotency_key'].includes(name), 'QUERY_OVERRIDE');
  const response = await guardedFetch(lease.app_origin)(u,{
    method,headers:{...(cookie ? {cookie}:{}),...(body ? {'content-type':'application/json'}:{}),
      origin: badOrigin ? 'http://untrusted.invalid' : lease.app_origin},
    ...(body ? {body:JSON.stringify(body)}:{})
  });
  if (discard) {
    // Deliberately lose the committed response before consuming its JSON.
    // This is controlled application-level response loss, not a claimed wire fault.
    await response.body?.cancel();
    return Object.freeze({outcome:'AMBIGUOUS'});
  }
  let data;
  try { data = await response.json(); } catch { throw Error('BH_HTTP_JSON'); }
  return {status:response.status,data};
}

export async function createAndRecover(lease,cookie,input) {
  const original=structuredClone(input); // Keep the identical original intent/key across awaits.
  try {
    await nextRequest(lease,cookie,{method:'POST',body:original,discard:true});
  } catch(error) {
    // A transport failure after dispatch is unknown, never an instruction to
    // mint a fresh key. Safety/origin/redirect failures are not transport loss.
    if(!['TypeError','TimeoutError','AbortError'].includes(error.name))throw error;
  }
  const path=ROUTE+'?'+new URLSearchParams({context_id:original.context_id,
    workspace_id:original.workspace_id,idempotency_key:original.idempotency_key});
  let found=await nextRequest(lease,cookie,{path});
  check(found.status===200,'RECOVERY_READ');
  if(found.data.attempt===null) {
    // One bounded SAME-key retry only AFTER an authorized absence read. The
    // canonical transaction/key lock resolves a still-in-flight original safely.
    const retry=await nextRequest(lease,cookie,{method:'POST',body:original});
    check(retry.status===201,'RECOVERY_SAME_KEY_RETRY');
    found=await nextRequest(lease,cookie,{path});
    check(found.status===200 && found.data.attempt?.run_id===retry.data.run_id,'RECOVERY_RETRY_BINDING');
  }
  check(found.data.attempt?.workspace_id===original.workspace_id && found.data.attempt.run_id,'RECOVERY_TARGET');
  return found.data.attempt;
}

export class Cleanup {
  #entries = [];
  add(label, fn) { this.#entries.push([label,fn]); }
  async close() {
    const errors = [];
    while (this.#entries.length) {
      const [label, fn] = this.#entries.pop();
      try { await fn(); } catch { errors.push(Error('BH_CLEANUP_'+label)); }
    }
    if (errors.length) throw new AggregateError(errors,'BH_CLEANUP_FAILED');
  }
}
export async function settledRequests(requests) {
  const results=await Promise.allSettled(requests);
  const failed=results.filter(r=>r.status==='rejected');
  if(failed.length)throw new AggregateError(failed.map(r=>r.reason),'BH_PARALLEL_HTTP');
  return results.map(r=>r.value);
}
export async function portLive(port) {
  return new Promise(resolve => {
    const socket = connect({host:'127.0.0.1',port});
    const end = value => {socket.destroy();resolve(value);};
    socket.once('connect',()=>end(true));socket.once('error',()=>end(false));socket.setTimeout(300,()=>end(false));
  });
}
export async function assertFreePort(port) {
  await new Promise((resolve,reject) => {
    const server = createServer();
    server.once('error',()=>reject(Error('BH_PORT_COLLISION')));
    server.listen(port,'127.0.0.1',()=>server.close(error=>error?reject(Error('BH_PORT_CLOSE')):resolve()));
  });
}

export async function closeOwnedProcess(child,port) {
  // A spawned ChildProcess handle, never an arbitrary PID/port from environment.
  check(child.spawnfile===process.execPath && Number.isInteger(child.pid),'OWNED_PROCESS');
  try {process.kill(-child.pid,'SIGTERM');} catch(error) {if(error.code!=='ESRCH')throw error;}
  const end=Date.now()+10_000;
  while(Date.now()<end) {
    if((child.exitCode!==null || child.signalCode!==null) && !await portLive(port))return;
    await sleep(50);
  }
  // No escalation to SIGKILL, no killing whichever process now holds a port.
  throw Error('BH_PROCESS_CLEANUP_TIMEOUT');
}

export function nextEnvironment(ambient, lease, anonKey) {
  browserKey(anonKey);
  const env = {};
  // Preserve networking/CA, never pass ambient app/remote DB/Auth/cloud credentials.
  for (const key of ['PATH','HOME','TMPDIR','TMP','TEMP','LANG','LC_ALL','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY',
    'http_proxy','https_proxy','all_proxy','no_proxy','NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR',
    'REQUESTS_CA_BUNDLE','CURL_CA_BUNDLE','CODEX_PROXY_CERT','CODEX_NETWORK_POLICY','CODEX_NETWORK_POLICY_PATH']) {
    if (ambient[key] !== undefined) env[key] = ambient[key];
  }
  return {...env,NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',
    NEXT_PUBLIC_CLADORA_EPHEMERAL_LOCAL_SUPABASE:'1',NEXT_PUBLIC_SUPABASE_URL:lease.api_origin,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:anonKey};
}
export async function startNext(lease, anonKey, cleanup, signal) {
  const port = Number(new URL(lease.app_origin).port);
  await assertFreePort(port); leaseLive(lease);
  const child = spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',String(port)],
    {cwd:ROOT,env:nextEnvironment(process.env,lease,anonKey),detached:true,stdio:['ignore','pipe','pipe']});
  child.stdout.resume();child.stderr.resume();
  let failed = false;child.on('error',()=>{failed=true;});
  cleanup.add('NEXT',async()=>{
    if(child.pid)await closeOwnedProcess(child,port);
    check(!failed,'PROCESS_START');
  });
  const end = Date.now()+90_000;
  while(Date.now()<end) {
    check(!signal?.aborted && !failed && child.exitCode===null && child.signalCode===null,'NEXT_START');
    try {
      const r = await guardedFetch(lease.app_origin)(lease.app_origin+ROUTE);
      if(r.status===400) return;
    } catch(error) { if(error.message==='BH_REDIRECT') throw error; }
    await sleep(200);
  }
  throw Error('BH_NEXT_READY_TIMEOUT');
}

export async function makeActor({lease,status,createClient,createServerClient,cleanup,label,onCreated=()=>{}}) {
  const opts={auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false},
    global:{fetch:guardedFetch(lease.api_origin)}};
  const admin=createClient(lease.api_origin,status.SERVICE_ROLE_KEY,opts);
  const actor=createClient(lease.api_origin,status.ANON_KEY,opts);
  const email='bh-'+lease.run_id+'-'+label+'@fixture.invalid';
  const password='Bh!'+randomUUID()+randomUUID();
  const must = (r,name) => {check(r && !r.error,'AUTH_'+name);return r.data;};
  const cookieFor=async session=>{
    const jar=new Map();
    const ssr=createServerClient(lease.api_origin,status.ANON_KEY,{...opts,auth:{...opts.auth,persistSession:true},
      cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),
        setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
    must(await ssr.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token}),'SSR');
    check(jar.size>0,'AUTH_COOKIE');
    return [...jar].map(([k,v])=>k+'='+v).join('; ');
  };
  const made=must(await admin.auth.admin.createUser({email,password,email_confirm:true,
    app_metadata:{fixture:TASK,run_id:lease.run_id}}),'CREATE'); // Identification only, NEVER authority.
  const userId=made.user?.id;check(uuid.test(userId),'AUTH_USER_ID');
  let token;let factor;
  cleanup.add('AUTH',async()=>{
    const errors=[];
    if(factor) {try {must(await actor.auth.mfa.unenroll({factorId:factor}),'UNENROLL');}catch {errors.push(1);}}
    if(token) {try {must(await admin.auth.admin.signOut(token,'global'),'SIGNOUT');}catch {errors.push(1);}}
    try {must(await actor.auth.signOut({scope:'local'}),'LOCAL_SIGNOUT');}catch {errors.push(1);}
    try {must(await admin.auth.admin.deleteUser(userId,true),'SOFT_DELETE');}catch {errors.push(1);}
    check(errors.length===0,'AUTH_CLEANUP');
  });
  onCreated({userId});
  leaseLive(lease);
  const signed=must(await actor.auth.signInWithPassword({email,password}),'PASSWORD');
  token=signed.session?.access_token;check(token,'AUTH_SESSION');
  const aal1Cookie=await cookieFor(signed.session);
  const enrolled=must(await actor.auth.mfa.enroll({factorType:'totp',friendlyName:'Building HTTP fixture'}),'ENROLL');
  factor=enrolled.id;
  const verified=must(await actor.auth.mfa.challengeAndVerify({factorId:factor,code:generateTotp(enrolled.totp.secret)}),'VERIFY');
  token=verified.access_token;
  const user=must(await actor.auth.getUser(token),'SERVER_USER');
  check(user.user.id===userId,'AUTH_SUBJECT');
  check(must(await actor.auth.mfa.getAuthenticatorAssuranceLevel(token),'AAL').currentLevel==='aal2','AUTH_AAL2');
  const cookie=await cookieFor(verified);
  return {userId,email,cookie,aal1Cookie,
    rpc:async(name,args)=>{
      leaseLive(lease);
      // This client holds a real GoTrue-issued session, not a forged JWT or SQL claim fixture.
      const r=await actor.schema('customer_api').rpc(name,args);
      const state=/^[A-Z0-9]{5,12}$/.test(r.error?.code??'')?r.error.code:'UNKNOWN';
      check(!r.error,'RPC_'+name.toUpperCase()+'_'+state);
      return r.data;
    }};
}

export function fixtureSql(source, lease, actors) {
  check(actors.length===4 && actors.every(a=>uuid.test(a.userId) && /^bh-[a-f0-9-]+-[a-z]+@fixture\.invalid$/.test(a.email)), 'FIXTURE_ACTORS');
  const boundary=source.indexOf("insert into bs_state select 'module'");
  check(boundary>0 && source.indexOf('create function pg_temp.bs_publish')>boundary,'FIXTURE_BOUNDARY');
  let sql=source.slice(0,boundary);
  const users=/insert into auth\.users\(id,email,email_confirmed_at\) values[\s\S]*?;\n/;
  check(users.test(sql),'FIXTURE_AUTH_BOUNDARY');
  sql=sql.replace(users,'');
  const idFn=/create function pg_temp\.bs_id\(n integer\) returns uuid language sql immutable[\s\S]*?\$\$;/;
  check(idFn.test(sql),'FIXTURE_ID_BOUNDARY');
  sql=sql.replace(idFn,()=>"create function pg_temp.bs_id(n integer) returns uuid language sql immutable as $$select case n "+
    actors.map((a,i)=>"when "+(i+1)+" then '"+a.userId+"'::uuid ").join('')+
    "else ('"+lease.fixture_prefix+"-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid end$$;");
  for(const [i,old] of ['bs-manager-a','bs-manager-b','bs-reviewer','bs-outsider'].entries())
    sql=sql.replaceAll(old+'@fixture.invalid',actors[i].email);
  // Canonical fixture preconditions/collision guard and triggers remain intact.
  check(!/set_config\('request.jwt.claims|insert into auth.users|workspace_member_role_authority_sources|insert into platform.workspace_member_roles/.test(sql),'FIXTURE_AUTHORITY_SHORTCUT');
  return sql;
}

export async function createDatabaseFixture(pool, lease, actors) {
  const source=await readFile(new URL('supabase/tests/fixtures/building_setup_authority_v2.inc',ROOT),'utf8');
  const client=await pool.connect();
  try {
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[TASK+lease.fixture_prefix]);
    await client.query(fixtureSql(source,lease,actors));
    const result=await client.query("select n,pg_temp.bs_id(n) id from unnest(array[10,20,30,50,51,60,90,91,100,101,110,111,200,210]) n");
    const ids=Object.fromEntries(result.rows.map(r=>[r.n,r.id]));
    const perms=(await client.query("select id,code from identity.permissions where code like 'onboarding.import.%'")).rows;
    const moduleId=(await client.query("select id from platform.module_definitions where code='building_setup' and version=1")).rows[0]?.id;
    check(moduleId,'CATALOG');
    await client.query('commit');
    return {ids,perms,moduleId,actors};
  } catch(error) {await client.query('rollback');throw error;} finally {client.release();}
}

export async function canonicalAssignments(lease,fixture) {
  const {ids,moduleId,perms,actors:[a,b,r]}=fixture;
  async function publish(code,permissions) {
    const result=await a.rpc('create_workspace_role_draft_v1',{p_context_id:ids[110],p_code:code,p_name:code,
      p_description:'Synthetic Building HTTP role',p_scope_ceiling:'workspace',p_base_role_id:null,
      p_reason:'Synthetic independent fixture publication',p_idempotency_key:code+'-create'});
    const role=result.id;check(uuid.test(role),'ROLE_ID');let revision=1;
    await a.rpc('attach_workspace_role_module_v1',{p_context_id:ids[110],p_workspace_role_id:role,
      p_module_definition_id:moduleId,p_expected_lock_version:revision++,p_reason:'Synthetic module attachment',p_idempotency_key:code+'-module'});
    for(const codePermission of permissions) {
      const permission=perms.find(p=>p.code===codePermission)?.id;check(permission,'PERMISSION');
      await a.rpc('attach_workspace_role_permission_v1',{p_context_id:ids[110],p_workspace_role_id:role,
        p_permission_id:permission,p_effect:'allow',p_expected_lock_version:revision++,
        p_reason:'Synthetic bounded permission',p_idempotency_key:code+'-perm-'+revision});
    }
    await a.rpc('publish_workspace_role_v1',{p_context_id:ids[110],p_workspace_role_id:role,p_expected_lock_version:revision,
      p_reason:'Synthetic independent publication',p_idempotency_key:code+'-publish'});
    return role;
  }
  const code='bh_'+lease.fixture_prefix;
  const operator=await publish(code+'_operator',['onboarding.import.read','onboarding.import.manage']);
  const reviewer=await publish(code+'_reviewer',['onboarding.import.read','onboarding.import.approve']);
  const assign=(by,context,authority,target,role,scope,key)=>by.rpc('assign_workspace_role_v2',{
    p_context_id:context,p_authority_context_id:authority,p_target_membership_id:target,p_workspace_role_id:role,
    p_scope_type:scope,p_property_id:scope==='property'?ids[30]:null,p_building_id:null,p_unit_id:null,
    p_valid_until:new Date(Date.now()+3600_000).toISOString(),p_reason:'Synthetic independently sourced native assignment',
    p_idempotency_key:code+'-'+key});
  await assign(a,ids[110],null,ids[91],operator,'property','b-property');
  await assign(b,ids[111],null,ids[90],operator,'property','a-property');
  await assign(b,ids[111],ids[101],ids[90],operator,'workspace','a-workspace');
  // Approval-capable operator is an explicit negative control for self-approval:
  // absence of approve permission must not be mistaken for dual-control proof.
  await assign(b,ids[111],ids[101],ids[90],reviewer,'workspace','a-approve-control');
  const claim=await r.rpc('claim_pilot_setup_reviewer_v1',{p_workspace_id:ids[50],p_display_name:'Synthetic independent reviewer',p_locale:'en'});
  check(uuid.test(claim.context_id),'REVIEWER_CONTEXT');
  return {reviewerRole:reviewer,reviewerContext:claim.context_id,assignReviewer:membership=>
    assign(a,ids[110],ids[100],membership,reviewer,'workspace','reviewer')};
}

const SNAPSHOT_TABLES=['platform.building_setup_runs','portfolio.properties','portfolio.buildings','portfolio.units',
  'finance.accounting_periods','finance.journals','finance.journal_entries','audit.events','platform.outbox_events',
  'identity.memberships','identity.context_grants','platform.workspace_member_roles',
  'platform.workspace_member_role_authority_sources','platform.workspace_role_handover_lineage',
  'platform.workspace_role_idempotency'];
export async function snapshot(pool) {
  const client=await pool.connect();
  try {
    await client.query('begin isolation level repeatable read read only');
    const result={};
    for(const table of SNAPSHOT_TABLES) {
      // Fixed source whitelist; no identifier/SQL from lease/environment/user input.
      result[table]=(await client.query("select count(*)::integer n,md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' order by to_jsonb(t)::text),'')) digest from "+table+" t")).rows[0];
    }
    await client.query('rollback');return result;
  } catch(error) {await client.query('rollback');throw error;} finally {client.release();}
}
export async function deniedUnchanged(pool,call,status) {
  const before=await snapshot(pool);
  const result=await call();
  assert.equal(result.status,status);
  assert.deepEqual(await snapshot(pool),before);
  return result;
}
export async function revokeOwned(pool,lease,users) {
  if(!users.length) return;
  const ids=users.map(u=>u.userId);
  check(ids.every(x=>uuid.test(x)),'CLEANUP_USER_ID');
  // Own immutable fixture history is retained for disposable-stack teardown.
  // Never DELETE domain/audit records, disable triggers or terminate sessions.
  await pool.query("update identity.memberships set status='revoked' where user_id=any($1::uuid[]) and status='active'",[ids]);
  const effective=await pool.query("select count(*)::integer n from identity.memberships where user_id=any($1::uuid[]) and status='active'",[ids]);
  check(effective.rows[0].n===0,'CLEANUP_AUTHORITY');
}
export async function assertSessionsGone(pool,users) {
  if(!users.length)return;
  check((await pool.query("select count(*)::integer n from auth.sessions where user_id=any($1::uuid[])",[users.map(u=>u.userId)])).rows[0].n===0,'CLEANUP_SESSIONS');
}
