"""Offline bounded object/reference mapper. Never connects, runs SQL or emits DDL.
python3 map.py proposal.json PRIVATE_CATALOG.json PRIVATE_REVIEWED_REFERENCE.json
Input equality is conformance only, not provenance authentication or runtime proof.
"""
import json,sys,hashlib,re
from pathlib import Path

def canonical(x):return json.dumps(x,sort_keys=True,separators=(',',':'))
def digest(x):return hashlib.sha256(canonical(x).encode()).hexdigest()
def family(x):return x.split('(')[0]
def assess(p,s,r):
 problems=[];mapping=[]
 def fail(code,obj=None,fields=None):problems.append({'code':code,'object':obj,'fields':fields})
 def result():return {'status':'BLOCKED' if problems else 'MAPPED_SYNTHETIC_ONLY' if r.get('synthetic') is True else 'SOURCE_CONFORMANCE_ONLY_RUNTIME_HOLD','execute':False,'activation':False,'authorization':None,'problems':problems,'mapping':mapping}
 if not isinstance(p,dict) or not isinstance(s,dict) or not isinstance(r,dict):return {'status':'BLOCKED','execute':False,'problems':[{'code':'INPUT_SHAPE'}]}
 if p.get('format')!='OPS_POPULATED_TRANSITION_01A' or s.get('format')!='OPS_TARGET_CATALOG_01A' or r.get('format')!='OPS_REVIEWED_REFERENCE_01A':fail('VERSION_MISMATCH');return result()
 if p.get('new_role_or_ledger') is not False:fail('UNAUTHORIZED_ROLE_OR_LEDGER')
 if any(e.get('kind')=='routine' and (set(e.get('intended_effective_acl',{}))!={'anon','authenticated','service_role','PUBLIC'} or any(v is not False for v in e.get('intended_effective_acl',{}).values())) for e in p.get('effects',[])):fail('ACTIVE_OR_UNKNOWN_NEW_ACL')
 if p.get('execution_authorized') is not False or p.get('activation') is not False or p.get('default_acl_mutation') is not False:fail('UNAUTHORIZED_EFFECT')
 if s.get('project_ref')!=p.get('target') or r.get('project_ref')!=p.get('target'):fail('WRONG_TARGET')
 if r.get('proposal_sha256')!=digest(p):fail('WRONG_PROPOSAL_REFERENCE')
 if s.get('truncated') is not False or type(s.get('server_version_num')) is not int or not 170000<=s['server_version_num']<180000:fail('INCOMPLETE_OR_NON_PG17')
 if set(s.get('complete_sections',{}))!=set(p['catalog_sections']) or any(v is not True for v in s.get('complete_sections',{}).values()):fail('CATALOG_COVERAGE_UNKNOWN')
 if r.get('source_native_sha256')!=p['source']['native_sha256']:fail('SOURCE_IMAGE_OR_LINEAGE_MISMATCH')
 if r.get('transitive_closure_reviewed') is not True:fail('TRANSITIVE_CLOSURE_UNKNOWN')
 if r.get('reference_kind')!='reviewed_pg17_catalog_projection':fail('REFERENCE_NOT_COMPILED_OR_REVIEWED')
 if s.get('lineage_sha256')!=r.get('lineage_sha256') or not r.get('lineage_sha256'):fail('LINEAGE_UNKNOWN_OR_DRIFT')
 # Lists are compared as canonical multisets for ACL/membership order neutrality.
 def normalized(obj):
  x=dict(obj)
  for k in ['acl','effective_acl','dependencies']:
   if isinstance(x.get(k),list):x[k]=sorted(x[k],key=canonical)
  return x
 records=s.get('objects');expected=r.get('dependencies');effects=p.get('effects')
 if not isinstance(records,list) or not isinstance(expected,list) or not isinstance(effects,list):fail('OBJECT_SET_MISSING');return result()
 if len(records)>5000 or len(expected)>5000:fail('CATALOG_BOUND_EXCEEDED');return result()
 by={}
 for x in records:
  if not isinstance(x,dict) or not isinstance(x.get('id'),str) or not x.get('kind'):fail('MALFORMED_OBJECT');continue
  if x['id'] in by:fail('DUPLICATE_OBJECT',x['id'])
  by[x['id']]=x
 ref={}
 for x in expected:
  if not isinstance(x,dict) or not x.get('id') or x['id'] in ref:fail('AMBIGUOUS_REFERENCE');continue
  ref[x['id']]=x
 effects_by={x['id']:x for x in effects}
 if len(effects_by)!=len(effects) or len(effects)!=7:fail('MISSING_EXTRA_EFFECT')
 required=r.get('direct_family_to_signature',{})
 if set(required)!=set(p['dependency_routine_families']):fail('MISSING_EXTRA_ROUTINE_MAPPING')
 for f,signature in required.items():
  if family(signature)!=f or signature not in ref:fail('UNMAPPED_ROUTINE_FAMILY',f)
  if sum(x.get('kind')=='routine' and family(x['id'])==f for x in records)>1:fail('OVERLOAD_RESOLUTION_UNPROVEN',f)
 for rel in p['dependency_relations']:
  if rel not in ref or ref[rel].get('kind')!='relation':fail('UNMAPPED_RELATION',rel)
 boundary=set(r.get('affected_boundary',[]))
 if len(boundary)!=len(r.get('affected_boundary',[])) or not boundary or boundary!=set(ref)|set(effects_by):fail('BOUNDARY_MISMATCH')
 for x in records:
  # An affected-root overload or relation-scoped trigger is a collision even
  # when its signature differs. Unrelated objects stay outside this slice.
  for effect in effects:
   if effect['kind']=='routine' and x['kind']=='routine' and family(x['id'])==family(effect['id']):fail('COMMAND_NAME_COLLISION',x['id'])
   if effect['kind']=='trigger' and x['id']==effect['id']:fail('TRIGGER_PAIR_COLLISION',x['id'])
  if x.get('in_affected_boundary') is True and x['id'] not in boundary:fail('EXTRA_UNMAPPED_OBJECT',x['id'])
 for name,want in ref.items():
  got=by.get(name)
  if got is None:fail('DEPENDENCY_MISSING',name);mapping.append({'id':name,'state':'MISSING'});continue
  if any(want.get(k) is None for k in ['owner','acl','effective_acl','definition_sha256','dependencies']):fail('REFERENCE_FIELD_UNKNOWN',name)
  if any(got.get(k) is None for k in ['owner','acl','effective_acl','definition_sha256','dependencies']):fail('CATALOG_FIELD_UNKNOWN',name)
  if not all(isinstance(x.get('definition_sha256'),str) and re.fullmatch('[0-9a-f]{64}',x['definition_sha256']) for x in (want,got)):fail('INVALID_DEFINITION_IDENTITY',name)
  required_fields={'routine':['security','search_path','arguments','result','language','volatility','parallel'], 'relation':['columns','constraints','indexes','policies','rls','generated_objects'], 'trigger':['relation','callee','enabled'], 'type':['type_definition','generated_objects']}.get(want.get('kind'))
  if required_fields is None or any(k not in x or x[k] is None for x in (want,got) for k in required_fields):fail('STRUCTURAL_PROJECTION_INCOMPLETE',name)
  for x in (want,got):
   if not isinstance(x.get('dependencies'),list) or any(edge not in ref and edge not in effects_by for edge in x.get('dependencies',[])):fail('UNMAPPED_DEPENDENCY_EDGE',name)
  a=normalized(want);b=normalized({k:v for k,v in got.items() if k!='in_affected_boundary'})
  fields=sorted(k for k in set(a)|set(b) if a.get(k)!=b.get(k))
  if fields:fail('DEFINITION_OWNER_ACL_OR_EDGE_DRIFT',name,fields)
  mapping.append({'id':name,'state':'MATCH' if not fields else 'CONFLICT'})
 for effect in effects:
  if effect['id'] not in by:mapping.append({'id':effect['id'],'state':'ABSENT_ADD_CANDIDATE_NOT_AUTHORIZATION'})
 if s.get('default_acl_sha256')!=r.get('default_acl_sha256') or not r.get('default_acl_sha256'):fail('DEFAULT_ACL_DRIFT_OR_UNKNOWN')
 if s.get('protected_sha256')!=r.get('protected_sha256') or not r.get('protected_sha256'):fail('PROTECTED_STATE_DRIFT_OR_UNKNOWN')
 principal=s.get('principal',{})
 if not isinstance(principal,dict):fail('PRINCIPAL_SHAPE');principal={}
 for edge in s.get('role_edges',[]) if isinstance(s.get('role_edges'),list) else []:
  if not isinstance(edge,dict) or any(not isinstance(edge.get(k),str) or not edge[k] for k in ['role','member','grantor']) or any(type(edge.get(k)) is not bool for k in ['admin','inherit','set']):fail('ROLE_EDGE_FIELDS_UNKNOWN')
 if principal!=r.get('approved_incremental_principal') or not principal:fail('INCREMENTAL_PRINCIPAL_PROFILE_UNPROVEN')
 if not isinstance(s.get('role_edges'),list) or not isinstance(r.get('preserved_role_edges'),list) or sorted(s['role_edges'],key=canonical)!=sorted(r['preserved_role_edges'],key=canonical):fail('ROLE_GRAPH_DRIFT_OR_UNKNOWN')
 if r.get('nested_invoker_execution_path_reviewed') is not True:fail('INVOKER_FACADE_PRIVATE_ACL_UNRESOLVED','customer_api.operations_command_v1(text,uuid,uuid,text,text)')
 # Independently report fresh guard300 incompatibility, without forcing that
 # ownership-transfer lane into an additive package that never transfers owner.
 guard300={'applicable_to_this_additive_slice':False,'provider_role_changes_proposed':False,'incompatible_principal_bypassrls':principal.get('bypassrls') is not False,'incompatible_rpc_owner_graph':s.get('fresh300_single_admin_no_set_edge') is not True}
 out=result();out['fresh_guard300']=guard300;return out

if __name__=='__main__':
 try:
  p,s,r=[json.loads(Path(x).read_text()) for x in sys.argv[1:]];answer=assess(p,s,r)
 except (ValueError,KeyError,TypeError,OSError):answer={'status':'BLOCKED','execute':False,'activation':False,'problems':[{'code':'INVALID_OR_MISSING_PRIVATE_INPUT'}]}
 print(json.dumps(answer,indent=2));sys.exit(answer['status']=='BLOCKED')
