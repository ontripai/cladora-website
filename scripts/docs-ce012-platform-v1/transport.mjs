/** Real loopback transports through the owned PG namespace. No host TCP ports. */
import { Duplex } from 'node:stream';
import { spawn as spawnOriginal } from 'node:child_process';
import { request as requestOriginal } from 'node:http';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import dns from 'node:dns';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { DOCKER, cleanEnvironment } from './custody.mjs';
import { need, Hold, sha, keys } from './contract.mjs';
const spawn=spawnOriginal,nativeRequest=requestOriginal;
const RELAY=port=>`exec 3<>/dev/tcp/127.0.0.1/${port}; cat <&3 & reader=$!; trap "kill $reader 2>/dev/null || :" EXIT; cat >&3; wait "$reader"`;
export class NamespaceStream extends Duplex {
  constructor(custody,kind,{spawner=spawn}={}) {
    super();need(['pg','auth'].includes(kind),'FIXED_TRANSPORT_ONLY');
    this.custody=custody;this.kind=kind;this.spawner=spawner;this.child=null;this.closedAck=false;
    this.connecting=true;this.received=0;this.sent=0;this.timer=null;this.closeTimer=null;custody.relays.add(this);
    this.on('error',error=>custody.fail(error));
  }
  setNoDelay(){return this;}
  setKeepAlive(){return this;}
  ref(){return this;}
  unref(){return this;}
  setTimeout(ms,callback){clearTimeout(this.timer);if(ms>0)this.timer=setTimeout(()=>{this.emit('timeout');callback?.();},ms);return this;}
  connect(port,host) {
    try {
      need(this.child===null && host==='127.0.0.1' && Number(port)===(this.kind==='pg'?5432:9999),'FIXED_LOOPBACK_ONLY');
      if(this.kind==='pg')this.custody.connection();
      this.child=this.custody.effect(`${this.kind}-relay-create`,()=>this.spawner(DOCKER,
        ['--host=unix:///var/run/docker.sock','exec','-i','--user','999:999',this.custody.admitted.input.descriptor.pg_cid,
          'bash','-ec',RELAY(this.kind==='pg'?5432:9999)],
        {env:cleanEnvironment(),stdio:['pipe','pipe','ignore']}));
      this.child.stdout.on('data',data=>{
        this.received+=data.length;
        if(this.received>8*1024*1024){this.destroy(new Hold('UNKNOWN_RESPONSE_BOUND'));return;}
        if(!this.push(data))this.child.stdout.pause();
      });
      this.child.stdout.on('end',()=>{if(this.kind==='pg'&&!this.ending&&!this.destroyed)this.destroy(new Hold('UNKNOWN_PG_STREAM_ENDED'));else this.push(null);});
      this.child.on('error',error=>this.destroy(error));
      this.child.on('exit',(code,signal)=>{this.closedAck=true;this.custody.relays.delete(this);clearTimeout(this.closeTimer);
        if(!this.destroyed && (code!==0 || signal))this.destroy(new Hold('UNKNOWN_RELAY_EXIT'));
        else if(!this.destroyed)this.push(null);});
      queueMicrotask(()=>{try{this.custody.current();this.connecting=false;this.emit('connect');}catch(e){this.destroy(e);}});
    }catch(error){this.destroy(error);}
    return this;
  }
  _read(){this.child?.stdout.resume();}
  _write(data,encoding,callback) {
    try{
      this.custody.effect(`${this.kind}-send`,()=>{
        need(this.child && !this.child.killed,'UNKNOWN_RELAY_NOT_AVAILABLE');
        need(this.sent+data.length<=8*1024*1024,'UNKNOWN_SEND_BOUND');
        this.sent+=data.length;
        this.child.stdin.write(data,encoding,callback);
      });
    }catch(error){callback(error);}
  }
  _final(callback){this.ending=true;if(this.child)this.child.stdin.end(callback);else callback();}
  _destroy(error,callback) {
    clearTimeout(this.timer);
    if(this.child && !this.closedAck){
      this.child.stdin.destroy();this.child.stdout.destroy();
      // Exact relay process only. Destruction of the owned container belongs to Lane.
      this.child.kill('SIGTERM');this.closeTimer=setTimeout(()=>{if(!this.closedAck)this.child.kill('SIGKILL');},1000);
      this.closeTimer.unref();
    }
    if(!this.child){this.closedAck=true;this.custody.relays.delete(this);}
    callback(error);
  }
}
export function fenceExternalNetwork() {
  const blocked=()=>{throw new Hold('NON_FIXTURE_EGRESS_OR_EXEC_FORBIDDEN');};
  net.connect=net.createConnection=net.Socket.prototype.connect=blocked;
  tls.connect=blocked;http.request=http.get=https.request=https.get=blocked;
  dns.lookup=dns.resolve=blocked;if(dns.promises){dns.promises.lookup=dns.promises.resolve=blocked;}
  dgram.createSocket=blocked;
  for(const k of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])childProcess[k]=blocked;
  globalThis.WebSocket=class{constructor(){blocked();}};
  syncBuiltinESMExports();
}
export function authFetch(custody,{requester=nativeRequest,streamFactory=(c,k)=>new NamespaceStream(c,k)}={}) {
  return async (url,options={})=>{
    const d=custody.admitted.input.descriptor;
    need(String(url)===d.auth_origin+d.auth_user_path && (!options.method||options.method==='GET')
      && options.redirect==='error' && Object.keys(options.headers??{}).length===1
      && typeof options.headers.authorization==='string' && /^Bearer [^\s]+$/.test(options.headers.authorization), 'FIXED_AUTH_USER_READ_ONLY');
    return custody.verified('auth-current-user',()=>new Promise((resolve,reject)=>{
      const stream=streamFactory(custody,'auth');
      const req=custody.effect('auth-http-request',()=>requester({host:'127.0.0.1',port:9999,path:d.auth_user_path,
        method:'GET',headers:{authorization:options.headers.authorization,connection:'close'},
        createConnection:()=>{stream.connect(9999,'127.0.0.1');return stream;}},res=>{
        const chunks=[];let size=0;
        res.on('data',b=>{size+=b.length;if(size>65536){req.destroy(new Hold('UNKNOWN_AUTH_RESPONSE_BOUND'));return;}chunks.push(b);});
        res.on('error',reject);res.on('end',()=>{
          if(res.statusCode>=300 && res.statusCode<400){reject(new Hold('AUTH_REDIRECT_FORBIDDEN'));return;}
          resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:{'content-type':'application/json'}}));
        });
      }));
      req.on('error',reject);req.setTimeout(3000,()=>req.destroy(new Hold('UNKNOWN_AUTH_TIMEOUT')));
      const signal=options.signal;
      if(signal){if(signal.aborted)req.destroy(new Hold('UNKNOWN_AUTH_ABORTED'));else signal.addEventListener('abort',()=>req.destroy(new Hold('UNKNOWN_AUTH_ABORTED')),{once:true});}
      custody.effect('auth-http-dispatch',()=>req.end());
    }));
  };
}
export function bindPg(pg,custody,{streamFactory=c=>new NamespaceStream(c,'pg')}={}) {
  const OriginalPool=pg.Pool,OriginalClient=pg.Client,d=custody.admitted.input.descriptor;
  const allowed=new Map([['cladora_ce_guide_runtime',2],[d.observer_role,1],[d.conflict_role,1]]);
  const pools=[];
  class BoundClient extends OriginalClient {
    constructor(config){
      const target=new URL(config.connectionString);
      need(target.protocol==='postgresql:' && target.hostname==='127.0.0.1' && target.port==='5432'
        && target.pathname===`/${d.database}` && !target.password && !target.search && !target.hash
        && allowed.has(target.username),'DIRECT_CLIENT_IDENTITY');
      super({...config,password:''}); // never consult host .pgpass or credential fallbacks
      this.connection.on('backendKeyData',m=>custody.terminal({phase:'pg-backend',pid:m.processID}));
      this.connection.on('commandComplete',m=>custody.terminal({phase:'pg-command-complete',pid:this.processID,tag:m.text}));
      this.connection.on('readyForQuery',m=>custody.terminal({phase:'pg-ready',pid:this.processID,status:m.status}));
      this.connection.on('errorMessage',m=>custody.terminal({phase:'pg-error-response',pid:this.processID,code:m.code}));
      this.on('error',error=>custody.fail(error));
    }
    query(...args){return custody.effect('pg-query-dispatch',()=>super.query(...args));}
  }
  class BoundPool extends OriginalPool {
    constructor(config){
      const u=new URL(config.connectionString);
      need(u.protocol==='postgresql:' && u.hostname==='127.0.0.1' && u.port==='5432'
        && u.pathname===`/${d.database}` && !u.password && !u.search && !u.hash
        && allowed.has(u.username) && config.max===allowed.get(u.username), 'POOL_TARGET_ROLE_OR_CAP');
      need(Object.keys(config).every(k=>['connectionString','max','connectionTimeoutMillis','query_timeout','options'].includes(k))
        && config.connectionTimeoutMillis===3000 && Number(config.query_timeout)>0 && config.query_timeout<=12000, 'POOL_OPTION_EXPANSION');
      if(u.username===d.observer_role)need(config.options==='-c default_transaction_read_only=on -c statement_timeout=10000','READONLY_OBSERVER_REQUIRED');
      else need(!config.options,'RUNTIME_OPTIONS_FORBIDDEN');
      custody.effect('pg-pool-create',()=>{});
      super({...config,Client:BoundClient,stream:()=>streamFactory(custody)});pools.push(this);
    }
    connect(...args){return custody.effect('pg-pool-checkout',()=>super.connect(...args));}
    end(){this._platformEnd??=super.end();return this._platformEnd;}
  }
  pg.Pool=BoundPool;pg.Client=BoundClient;
  Object.defineProperty(pg,'native',{configurable:true,get(){throw new Hold('NATIVE_PG_FALLBACK_FORBIDDEN');}});
  return {Pool:BoundPool,async end(){
    const results=await Promise.allSettled(pools.map(p=>Promise.race([p.end(),new Promise((_,r)=>{const t=setTimeout(()=>r(new Hold('UNKNOWN_POOL_CLOSE_TIMEOUT')),3000);t.unref();})])));
    need(results.every(r=>r.status==='fulfilled'),'UNKNOWN_POOL_CLOSE');
  }};
}
export async function verifyIssuedSession(descriptor,packet,verifySession,observer,custody) {
  keys(packet,['format','run_id','attempt_id','synthetic_subject','token']);
  need(packet.format==='platform-issued-fixture-session.v1' && packet.run_id===descriptor.run_id
    && packet.attempt_id===descriptor.attempt_id && packet.synthetic_subject===descriptor.synthetic_subject
    && typeof packet.token==='string' && packet.token.length>20 && packet.token.length<=16384,'BOUND_PLATFORM_SESSION_REQUIRED');
  // Consumer's real /user + current auth.sessions verification is reused, not replaced.
  const session=await custody.verified('verified-fixture-session',()=>verifySession({
    auth_origin:descriptor.auth_origin,auth_issuer:descriptor.auth_issuer,auth_user_path:descriptor.auth_user_path},packet.token,observer));
  need(session.actor_id===descriptor.synthetic_subject && session.assurance_level==='aal2'
    && session.source==='supabase_verified_session' && session.expires_at*1000>Date.now(),'CURRENT_SYNTHETIC_AAL2_REQUIRED');
  return session;
}
