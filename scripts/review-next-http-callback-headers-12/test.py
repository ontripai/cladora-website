"""Real production Next HTTP negative callbacks only; HTTP11 kernel guard required.
Usage: python3 test.py OUTPUT_DIR HTTP11_DENY_EGRESS_BINARY
Build the exact source with Next16.4.1 under the same guard before invoking.
"""
import os,sys,json,time,socket,subprocess,signal,http.client,re
from pathlib import Path
from urllib.parse import urlsplit,urlencode,parse_qs
S=Path(__file__).resolve().parents[2];O=Path(sys.argv[1]);O.mkdir(parents=True,exist_ok=False);G=str(Path(sys.argv[2]).resolve());PORT=31212
assert json.loads((S/'node_modules/next/package.json').read_text())['version']=='16.4.1'
assert (S/'.next/BUILD_ID').exists() and not list(S.glob('.env.local'))
# Header fields are a multimap: dict(raw_headers) silently loses Vary lines.
def vary_set(raw):
 return {v.strip().lower() for k,value in raw if k.lower()=='vary' for v in value.split(',') if v.strip()}
example=[('Vary','Cookie'),('vary','rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch')]
assert 'cookie' in vary_set(example)
assert 'cookie' not in {k.lower():v for k,v in example}['vary'].lower()
assert 'cookie' not in vary_set(example[1:])
assert 'rsc' not in vary_set(example[:1])
rows=[]
for mode in ['unconfigured','configured']:
 env={k:os.environ[k] for k in ['PATH','HOME','LANG','TZ','TMPDIR'] if k in os.environ};env.update(NODE_ENV='production',NEXT_TELEMETRY_DISABLED='1')
 if mode=='configured':env.update(NEXT_PUBLIC_SUPABASE_URL='https://ryygcqiunqqtfkpkflzf.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_SYNTHETIC_HTTP11_INVALID_NOT_A_REAL_KEY')
 log=open(O/(mode+'.log'),'w');trace=O/(mode+'.network')
 proc=subprocess.Popen(['strace','-f','-e','trace=network','-o',str(trace),G,'node','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',str(PORT)],cwd=S,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 try:
  for _ in range(160):
   if proc.poll() is not None:raise RuntimeError('startup failed')
   try:
    sock=socket.create_connection(('127.0.0.1',PORT),timeout=.2);sock.close();break
   except OSError:time.sleep(.1)
  else:raise RuntimeError('startup timeout')
  for lang in ['fa','en','ro','xx']:
   for fmt in ['document','rsc']:
    for case,q,status in [('missing',{},'missing'),('duplicate',{'code':['SYNTHETIC_INVALID_CODE_000000000','SYNTHETIC_INVALID_CODE_000000000']},'unsafe')]:
     if lang=='xx':status='invalid_locale'
     path='/'+lang+'/auth/callback?'+urlencode(q,doseq=True);h={'Connection':'close','Accept':'text/x-component' if fmt=='rsc' else 'text/html','Cookie':'cladora_recovery_session=SYNTHETIC_INVALID_RECOVERY_NO_CREDENTIAL'}
     if fmt=='rsc':h['RSC']='1'
     hops=[]
     for hop in range(3):
      conn=http.client.HTTPConnection('127.0.0.1',PORT,timeout=15);conn.request('GET',path,headers=h);res=conn.getresponse();body=res.read();raw=res.getheaders();code=res.status;conn.close()
      headers={}
      for k,v in raw:headers.setdefault(k.lower(),[]).append(v)
      loc=headers.get('location',[''])[0];u=urlsplit(loc);hops.append({'path':path,'status':code,'raw_headers':raw,'body_bytes':len(body)})
      assert not u.netloc or u.netloc in [f'localhost:{PORT}',f'127.0.0.1:{PORT}']
      if u.path=='/'+lang+'/auth/callback' and loc:
       # Native RSC canonicalization adds _rsc, which the unchanged callback
       # query allowlist safely rejects; this hop is not Auth success.
       path=u.path+'?'+u.query
       if lang!='xx':status='unsafe'
       continue
      break
     folded=lambda k:', '.join(headers.get(k,[]))
     vary=vary_set(raw)
     checks={'internal_rejection':u.path=='/'+('ro' if lang=='xx' else lang)+'/auth-result' and parse_qs(u.query)=={'status':[status]},'status':code==307,'clear_recovery_cookie':any(v.startswith('cladora_recovery_session=;') and 'Max-Age=0' in v and 'HttpOnly' in v and 'SameSite=lax' in v for v in headers.get('set-cookie',[])),'no_success_auth_cookie':not any('-auth-token=' in v for v in headers.get('set-cookie',[])),'private_no_store':all(v in folded('cache-control') for v in ['private','no-store']),'cdn_no_store':'no-store' in folded('cdn-cache-control'),'surrogate_no_store':'no-store' in folded('surrogate-control'),'no_referrer':folded('referrer-policy')=='no-referrer','vary_cookie':'cookie' in vary,'vary_rsc':{'rsc','next-router-state-tree','next-router-prefetch','next-router-segment-prefetch'}<=vary}
     rows.append({'mode':mode,'lang':lang,'format':fmt,'case':case,'checks':checks,'vary_set':sorted(vary),'hops':hops})
 finally:
  if proc.poll() is None:os.killpg(proc.pid,signal.SIGTERM)
  try:proc.wait(timeout=10)
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);proc.wait()
  log.close()
 text=trace.read_text();assert not any(re.search(r'\b(connect|sendto|sendmmsg)\(.*= [0-9]+(?:\s|$)',l) for l in text.splitlines())
 assert 'HTTP11_SECCOMP_INSTALLED' in (O/(mode+'.log')).read_text()
 failures=[{'lang':r['lang'],'format':r['format'],'case':r['case'],'mode':r['mode'],'failed':[k for k,v in r['checks'].items() if not v]} for r in rows if not all(r['checks'].values())]
(O/'results.json').write_text(json.dumps({'cases':rows,'failures':failures,'build_id':(S/'.next/BUILD_ID').read_text().strip(),'next':'16.4.1','external_successful_network':0,'successful_Auth':0},indent=2)+'\n')
print(json.dumps({'cases':len(rows),'failures':failures}));sys.exit(bool(failures))
