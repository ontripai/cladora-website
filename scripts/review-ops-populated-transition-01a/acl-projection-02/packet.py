"""Offline packet integrity/anchor checks and private-export coverage inspection.
No DB driver, SQL parser, network access, shell hook, or execution admission.
Platform must independently pin/review request bytes and its own adapter/profile.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).parent
BASE = '91a8c05a13ef890f386997f29230a352e235e79c'
PREFIX = 'scripts/review-ops-populated-transition-01a/acl-projection-02/'
CASES = ['D00','D01','D02','D03','P01','P02','D04','D05','D06','D07','D08']
ROLES = ['ops_acl02_owner','ops_acl02_caller']
SCHEMAS = ['ops_acl02_api','ops_acl02_private']
FUNCTIONS = ['ops_acl02_private.command_v1(text)', 'ops_acl02_private.other_v1()', 'ops_acl02_api.facade_v1(text)']

def identity(data):
    return dict(bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),
                git_blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest())

def sql_text(data):
    # Bounded canonical fixtures only. Not a general SQL lexer/compiler.
    return '\n'.join(x.split('--',1)[0] for x in data.decode('utf-8').splitlines()).strip()

def validate(request, files):
    errors=[]
    def need(ok, code):
        if not ok: errors.append(code)
    need(request.get('format')=='OPS_ACL_CONSUMER_REQUEST_02' and request.get('base')==BASE,'REQUEST_VERSION_OR_BASE')
    need(request.get('stage')=='synthetic_pg17_acl_witness','UNSUPPORTED_STAGE')
    need(request.get('execution_authorized') is False and request.get('approval_is_external') is True,'SELF_AUTHORIZATION')
    need(set(request.get('bindings',{}))=={'coordinator_review','platform_profile_sha256','platform_adapter_identity','run_attempt'}
         and all(v is None for v in request.get('bindings',{}).values()),'SOURCE_REQUEST_BINDINGS_NOT_NULL')
    target=request.get('target',{})
    need(target==dict(kind='disposable_pg17_only',database='postgres',host=None,port=None,
                     container_identity=None,pg_system_identifier=None,project_ref=None,production_or_staging=False),'WRONG_TARGET')
    need(not any(k in request for k in ['approved','exec','command','shell','authorization']),'UNSUPPORTED_ADMISSION_FIELD')
    effects=request.get('allowed_effects',{})
    need(effects==dict(roles=ROLES,schemas=SCHEMAS,routines=FUNCTIONS,tables=[],transaction_local=True,
                      commits=0,application_objects=False,provider_role_changes=False,network_expansion=False,
                      auth_session_email=False),'EFFECT_BOUNDARY')
    order=request.get('order',[])
    need([x.get('id') for x in order]==['witness','residue'],'STAGE_ORDER')
    for entry,name in zip(order,['witness.sql','verify-clean.sql']):
        pin=entry.get('payload',{});data=files.get(name,b'')
        need(pin.get('path')==PREFIX+name and all(pin.get(k)==v for k,v in identity(data).items()),'PAYLOAD_IDENTITY_'+name)
    need(request.get('success_contract',{}).get('case_ids')==CASES,'CASE_CONTRACT')
    success=request.get('success_contract',{})
    need(success.get('rollback_ack_same_backend') is True and success.get('ready_for_query')=='I'
         and success.get('clean_observer_completion') is True and success.get('residue')=={'roles_remaining':0,'schemas_remaining':0}
         and success.get('native_or_staging_acceptance') is False,'CLEANUP_OR_NATIVE_CLAIM')
    w=sql_text(files.get('witness.sql',b''));v=sql_text(files.get('verify-clean.sql',b''))
    need(w.startswith('BEGIN;') and w.endswith('ROLLBACK;') and len(re.findall(r'(?m)^ROLLBACK;',w))==1,'WITNESS_TRANSACTION')
    need(v.startswith('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;') and v.endswith('ROLLBACK;'),'RESIDUE_READ_ONLY')
    for name,text in [('witness',w),('residue',v)]:
        need(not re.search(r'\b(COMMIT|COPY|CALL|ALTER\s+SYSTEM|ALTER\s+DEFAULT\s+PRIVILEGES|DROP|dblink)\b',text,re.I),'UNBOUNDED_SQL_'+name)
        first_read=text.find('DO $preflight$') if name=='witness' else text.find('SELECT jsonb_build_object')
        for setting in ["SET LOCAL lock_timeout = '3s';", "SET LOCAL statement_timeout = '20s';" if name=='witness' else "SET LOCAL statement_timeout = '10s';"]:
            need(setting in text and 0<=text.index(setting)<first_read,'DEADLINE_'+name)
    need(re.findall(r'CREATE ROLE (\w+)',w)==ROLES,'ROLE_SET')
    role_options='NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;'
    need(all('CREATE ROLE '+name+' '+role_options in w for name in ROLES),'ROLE_ATTRIBUTES')
    need(re.findall(r'CREATE SCHEMA (\w+) AUTHORIZATION ops_acl02_owner;',w)==SCHEMAS,'SCHEMA_SET')
    need(re.findall(r'CREATE FUNCTION ([a-z0-9_.]+)\(',w)==[x.split('(')[0] for x in FUNCTIONS],'FUNCTION_SET')
    need('LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $facade$' in w
         and 'SELECT ops_acl02_private.command_v1(p_value)' in w,'FACADE_INVOKER_PATH')
    need('LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $private$' in w
         and "p_value IS DISTINCT FROM 'allow'" in w,'PRIVATE_TOY_GUARD')
    need('OR NOT (SELECT prosecdef FROM pg_proc' in w and 'p.proowner' in w and 'pg_auth_members' in w
         and 'NOT rolbypassrls' in w,'OWNERSHIP_MEMBERSHIP_ASSERTIONS')
    need(not re.search(r'GRANT[^;]+TO\s+PUBLIC',w,re.I|re.S),'PUBLIC_POSITIVE_GRANT')
    need('WHEN OTHERS' not in w.upper(),'CATCH_ALL')
    for label in CASES:
        marker='DO $case_'+label+'$'
        need('SET LOCAL ROLE ops_acl02_caller;\n'+marker in w,'WRONG_ASSERTION_PRINCIPAL_'+label)
        need(w.count(marker)==1 and w.count('$case_'+label+'$;')==1,'CASE_BODY_'+label)
    need(w.count("EXCEPTION WHEN SQLSTATE '42501' THEN NULL;")==9,'DENIAL_ORACLE')
    need(w.count('IS DISTINCT FROM TRUE THEN')==9,'NULL_UNSAFE_PRECONDITION')
    need(w.count("'model','synthetic_only','executor','ops_acl02_owner','value','allow'")==2,'POSITIVE_EXACT_RESULT')
    need("v := ops_acl02_private.command_v1('allow');" in w,'DIRECT_PRIVATE_POSITIVE')
    anchors=['DO $case_D01$', 'GRANT EXECUTE ON FUNCTION ops_acl02_private.command_v1(text) TO ops_acl02_caller;',
             'DO $case_D02$', 'GRANT USAGE ON SCHEMA ops_acl02_private TO ops_acl02_caller;', 'DO $case_D03$',
             'DO $case_P01$', 'DO $case_P02$', 'DO $case_D04$', 'DO $case_D05$', 'DO $case_D06$',
             'DO $case_D07$', 'DO $case_D08$']
    positions=[w.find(a) for a in anchors]
    need(all(x>=0 for x in positions) and positions==sorted(positions),'PRIVILEGE_PHASE_ORDER')
    need("'roles_remaining'" in v and "'schemas_remaining'" in v and all(x in v for x in ROLES+SCHEMAS),'RESIDUE_BOUNDARY')
    return dict(status='SOURCE_PACKET_CONSISTENT_EXECUTION_HOLD' if not errors else 'BLOCKED',
                errors=errors,execute=False,authorization=None,sql_compile='NOT_RUN',pg_witness='NOT_RUN')

def inspect_catalog(raw, contract):
    """Coverage diagnostics only. Never emits mapper-ready or copies private rows."""
    errors=[]
    if raw.get('format')!=contract['raw_format']:errors.append('RAW_FORMAT')
    version=raw.get('server_version_num')
    if type(version) is not int or not 170000<=version<180000:errors.append('PG17_UNKNOWN')
    if raw.get('read_only')!='on' or raw.get('isolation')!='repeatable read':errors.append('SNAPSHOT_MODE')
    sections=raw.get('sections',{})
    for name in contract['required_sections']:
        section=sections.get(name,{})
        rows=section.get('rows');total=section.get('total');returned=section.get('returned')
        if (not isinstance(rows,list) or type(total) is not int or type(returned) is not int
            or section.get('truncated') is not False or total<0 or total>5000
            or returned!=total or len(rows)!=total):errors.append('INCOMPLETE_SECTION_'+name)
    return dict(status='BLOCKED',catalog_coverage='INCOMPLETE' if errors else 'CAPTURE_SHAPE_ONLY',
                errors=errors,remaining_external_reviews=contract['required_external_reviews'],
                mapper_ready=False,execute=False,authorization=None)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode',choices=['check','inspect-private-catalog'])
    parser.add_argument('private_catalog',nargs='?')
    args=parser.parse_args()
    try:
        if args.mode=='check':
            request=json.loads((ROOT/'request.json').read_text())
            result=validate(request,{n:(ROOT/n).read_bytes() for n in ['witness.sql','verify-clean.sql']})
        else:
            contract=json.loads((ROOT/'catalog-contract.json').read_text())
            result=inspect_catalog(json.loads(Path(args.private_catalog).read_text()),contract)
    except (OSError,ValueError,KeyError,TypeError,AttributeError):
        result=dict(status='BLOCKED',errors=['INVALID_OR_MISSING_INPUT'],execute=False,authorization=None)
    print(json.dumps(result,indent=2))
    return int(result['status']=='BLOCKED')

if __name__=='__main__':sys.exit(main())
