import { execFileSync } from 'node:child_process';
import { appendFileSync, openSync, writeSync, fsyncSync, closeSync, fstatSync, readFileSync } from 'node:fs';
import { sha, canonical, need, Hold, seal, admit, sourceBinding, reviewRegistry, validateDescriptor } from './contract.mjs';

const inspectCommand=execFileSync;
export const DOCKER='/usr/local/bin/docker';
// No Config.Env dump: provider signing keys must never reach the custody ledger.
export const INSPECT='{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Image}},"user":{{json .Config.User}},"labels":{{json .Config.Labels}},"running":{{json .State.Running}},"host":{{json .HostConfig}},"mounts":{{json .Mounts}},"ports":{{json .NetworkSettings.Ports}}}';
const FILTER=['PATH','DOCKER_CONFIG','XDG_RUNTIME_DIR','HTTP_PROXY','HTTPS_PROXY','NO_PROXY','http_proxy','https_proxy','no_proxy','SSL_CERT_FILE','SSL_CERT_DIR','CODEX_PROXY_CERT'];
export const cleanEnvironment=()=>Object.fromEntries(FILTER.filter(k=>typeof process.env[k]==='string').map(k=>[k,process.env[k]]));
const PG='sha256:99445113a4a19e82dd3713c65bd9f6fb5bf972065ab043df8d1e1c93e957da9a';
const AUTH='sha256:1181bff5ba4ce440013a63cef9f4cf13024c432d705c9b1fbc9e5b949e852f48';

export function inspect(cid) {
  const out=inspectCommand(DOCKER,['--host=unix:///var/run/docker.sock','inspect','--format',INSPECT,cid],
    {env:cleanEnvironment(),timeout:2000,maxBuffer:262144,stdio:['ignore','pipe','ignore']});
  return JSON.parse(out);
}
const empty=v=>v==null || (typeof v==='object' && Object.keys(v).length===0);
export function checkView(v, role, d) {
  const cid=d[`${role}_cid`],h=v.host;
  need(v.id===cid && v.name===`/${d[`${role}_name`]}` && v.running===true
    && v.labels?.['cladora.runtime.run']===d.run_id && v.image===(role==='pg'?PG:AUTH),'LOST_CUSTODY');
  need(v.user==='999:999' && h.ReadonlyRootfs===true && h.NetworkMode===(role==='pg'?'none':`container:${d.pg_cid}`)
    && !h.Privileged && empty(h.PortBindings) && empty(h.Binds) && empty(h.VolumesFrom) && empty(h.CapAdd)
    && canonical(h.CapDrop)===canonical(['ALL']) && canonical(h.SecurityOpt)===canonical(['no-new-privileges:true'])
    && h.PidMode==='' && !h.Devices?.length && !h.DeviceRequests?.length
    && !h.ExtraHosts?.length && !h.Links?.length && h.Memory===536870912 && h.NanoCpus===500000000
    && h.PidsLimit===128 && Object.values(v.ports??{}).every(x=>x===null), 'ISOLATION_DRIFT');
  const dirs=role==='pg'?['/tmp','/var/lib/postgresql/data','/var/run/postgresql']:['/tmp'];
  need(canonical(Object.keys(h.Tmpfs??{}).sort())===canonical(dirs.sort()),'TMPFS_DRIFT');
  const seen=new Set();for(const m of v.mounts??[]){need(m.Type==='tmpfs' && dirs.includes(m.Destination) && !seen.has(m.Destination),'MOUNT_DRIFT');seen.add(m.Destination);}
  need(sha(Buffer.from(canonical(v)))===d[`${role}_config_sha256`],'LIVE_CONFIG_SEAL_DRIFT');
}
export function descriptorFromPlatform(observation) {
  // Only the Platform launcher calls this with actual Lane custody + native identity.
  const {descriptor,pg,auth}=observation;
  validateDescriptor(descriptor);checkView(pg,'pg',descriptor);checkView(auth,'auth',descriptor);
  return Object.freeze(structuredClone(descriptor));
}
export class Ledger {
  constructor(file) {
    this.fd=openSync(file,'wx',0o600);this.sequence=0;this.previous='0'.repeat(64);this.bytes=0;
    this.maximum=8*1024*1024;
  }
  append(event) {
    const item={sequence:this.sequence+1,previous:this.previous,...event};
    const raw=Buffer.from(canonical(item)+'\n');
    need(raw.length<=16384 && this.bytes+raw.length<=this.maximum,'UNKNOWN_LEDGER_CAPACITY');
    const written=writeSync(this.fd,raw);need(written===raw.length,'UNKNOWN_LEDGER_SHORT_WRITE');
    fsyncSync(this.fd);this.bytes+=written;this.sequence++;this.previous=sha(raw.subarray(0,-1));
  }
  close(){fsyncSync(this.fd);closeSync(this.fd);}
}
export class Custody {
  constructor(admitted,{clock=Date.now,inspector=inspect,reseal=seal,recheck=admit,materialCheck=()=>{},ledger}={}) {
    this.admitted=admitted;this.clock=clock;this.inspector=inspector;this.reseal=reseal;
    this.recheck=recheck;this.materialCheck=materialCheck;this.ledger=ledger;this.primary=null;this.quarantined=false;
    this.connections=0;this.relays=new Set();this.ceiling=admitted.ceiling;this.deadline=Math.min(admitted.ceiling,clock()+180000);
  }
  bindProducerCeiling(expiry) {
    this.current();const value=Date.parse(expiry);
    need(Number.isFinite(value)&&value>this.clock(),'PRODUCER_REVIEW_EXPIRED');
    this.ceiling=Math.min(this.ceiling,value); // never extend a prior authorization ceiling
    this.current();
  }
  current() {
    need(!this.quarantined,'HOST_QUARANTINED');
    need(this.clock()<this.ceiling && this.clock()<this.deadline,'AUTHORIZATION_EXPIRED');
    need(this.reseal().sha256===this.admitted.seal.sha256,'SOURCE_SEAL_DRIFT');
    this.materialCheck();
    const again=this.recheck(this.admitted.input);
    need(again.identity===this.admitted.identity && again.ceiling===this.admitted.ceiling,'REVIEW_CHANGED');
  }
  effect(phase,operation) {
    try {
      this.current();
      const d=this.admitted.input.descriptor;
      for(const role of ['pg','auth']){checkView(this.inspector(d[`${role}_cid`]),role,d);this.current();}
      this.ledger?.append({phase,run:d.run_id,attempt:d.attempt_id,status:'EFFECT_ADMITTED'});
      this.current(); // fsync/inspection are not a lease across the effect boundary
      const result=operation();
      return result;
    } catch(error){this.fail(error);throw error;}
  }
  async verified(phase,operation) {
    this.effect(`${phase}:before`,()=>{});
    try {const value=await operation();this.effect(`${phase}:after`,()=>{});return value;}
    catch(error){this.fail(error);throw error;}
  }
  fail(error) {
    this.primary??=(typeof error?.code==='string' && /^[A-Z0-9_]{3,100}$/.test(error.code))?error.code:'UNKNOWN_TRANSPORT_OR_PERSISTENCE';
    this.quarantined=true;
    // No normal lane remains usable; exact local relays only, never cancel a guessed PID.
    for(const relay of this.relays) relay.destroy();
  }
  terminal(event) {
    // Recording already-received terminal/error evidence is bounded settlement,
    // not permission for a new query/unit. Expiry does not decide transaction outcome.
    try{this.ledger?.append(event);}catch(error){this.fail(error);throw error;}
  }
  connection() {this.effect('physical-connect-allocation',()=>{need(this.connections<5,'CONNECTION_LIMIT');this.connections++;});}
  async closeRelays(){
    const owned=[...this.relays];for(const relay of owned)relay.destroy();
    const end=Date.now()+3000;
    while(owned.some(r=>!r.closedAck) && Date.now()<end)await new Promise(r=>setTimeout(r,10));
    need(owned.every(r=>r.closedAck),'UNKNOWN_RELAY_CLOSE');
  }
}
export function readPrivate(fd,maximum=262144) {
  const s=fstatSync(fd);need(s.isFile() && s.uid===process.getuid() && (s.mode&0o077)===0 && s.size<=maximum,'PRIVATE_PLATFORM_INPUT_REQUIRED');
  return readFileSync(fd);
}
