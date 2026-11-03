"""Core12 admission models ONLY. No Docker, SQL parsing, query or PG process."""
import argparse
import contextlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch

S = importlib.util.spec_from_file_location('core12_preflight',Path(__file__).with_name('core12_pg_preflight.py'))
m = importlib.util.module_from_spec(S); S.loader.exec_module(m)


def identity(pid=41):
    # Synthetic unit metadata, never a fixture descriptor or actual provenance.
    return {'kind':'owned-disposable-pg17-only','database':'core_sqlstate_boundary_proof','database_oid':'123',
            'system_identifier':'456','version':170011,'pid':pid,'current_user':'unit_executor','session_user':'unit_executor',
            'rolsuper':False,'rolbypassrls':False,'rolcreaterole':False,'rolcreatedb':False,'rolreplication':False,
            'database_connect':True,'database_temp':True,'own_pg_temp_function_rights':True,'plpgsql_usage':True,
            'function_default_acl_rows':0,'namespaces_present':[]}


def model():
    r={'health_result':'PG17_ONLY_HEALTH_PROVED_NO_DOMAIN_INSTALL','request_sha256':m.sha(m.request_bytes()),
       'run_id':'cladora-lane-'+'1'*12,'attempt':'2'*32,'cid':'3'*64,'installer_connection_id':'core12-witness-'+'4'*16,
       'installer_identity':identity(),'observer_identity':identity(42),'cleanup_errors':[],
       'observer':{'state':'completed','pid':42,'witness_functions_remaining':0,'matrix_remaining':0,
                   'protected_before':'5'*64,'protected_after':'5'*64,'snapshot_complete':True},
       'cleanup':[{'kind':'container','resource_id':'unit-container','identity':'3'*64,'state':'acknowledged-absent'},
                  {'kind':'image','resource_id':'unit-image','identity':'unit-image','state':'skipped-preexisting'}]}
    r['terminal']={k:r[k] for k in ['request_sha256','run_id','attempt','cid']}
    r['terminal'].update(pid=41,connection_id=r['installer_connection_id'],payload_sha256=m.PAYLOAD['sha256'],
                         tags=['BEGIN','DO','ROLLBACK'],errors=[],ready='I',fsync_ack=True,chain='6'*64)
    return r,[{'role':'pg','name':'unit-container','cid':'3'*64}],[('unit-image-ref','unit-image',False)]


class Core12PreflightTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        p=os.environ.get('CORE12_UNIT_SOURCE')
        if not p: raise AssertionError('explicit private exact Core source required; no SQL executed')
        cls.payload=Path(p).read_bytes();cls.raw=m.REQUEST.read_bytes()

    def test_01_exact_draft_and_null_bindings(self):
        out=m.inspect_request(self.raw,self.payload)
        self.assertEqual(out['status'],'DRAFT_BYTES_VALID_NOT_EXECUTABLE')
        self.assertEqual(out['planned_calls'],176);self.assertIsNone(out['executed_calls'])
        for key in ['target','executor','authority']: self.assertIsNone(out[key])
        self.assertFalse(m.profile()['execution_enabled']); self.assertEqual(m.profile()['auth'],None)

    def test_02_wrong_hash_source_and_arbitrary_payload(self):
        for raw in [self.payload[:-1],self.payload+b' ',b'SELECT 1;',bytes(len(self.payload))]:
            with self.assertRaisesRegex(m.Hold,'EXACT_PAYLOAD'):m.validate_payload(raw)
        for key,val in [('source_commit','a'*40),('payloads',[]),('planned_calls',177)]:
            r=json.loads(self.raw);r[key]=val
            with self.assertRaisesRegex(m.Hold,'EXACT_DRAFT_BINDING'):m.inspect_request(json.dumps(r).encode(),self.payload)

    def test_03_wrong_target_executor_or_inline_authority_rejected(self):
        for key,val in [('target','ryygcqiunqqtfkpkflzf'),('target',{'database':'postgres'}),('executor','postgres'),
                        ('authority',{'approved':True}),('execution_binding',{'cid':'1'*64}),('approved',True),('sql','arbitrary')]:
            r=json.loads(self.raw);r[key]=val
            with self.assertRaisesRegex(m.Hold,'EXACT_DRAFT_BINDING'):m.inspect_request(json.dumps(r).encode(),self.payload)

    def test_04_duplicate_reformatted_and_changed_profile_reject(self):
        with self.assertRaisesRegex(m.Hold,'DUPLICATE_REQUEST_KEY'):m.inspect_request(b'{"x":1,"x":2}',self.payload)
        with self.assertRaisesRegex(m.Hold,'EXACT_REQUEST_BYTES'):m.inspect_request(json.dumps(json.loads(self.raw)).encode(),self.payload)
        with patch.object(m.PROFILE.__class__,'read_bytes',return_value=b'{}'):
            with self.assertRaisesRegex(m.Hold,'PROFILE_DRIFT'):m.profile()

    def test_05_empty_registry_and_guc_flag_are_not_authority(self):
        self.assertEqual(json.loads(m.REGISTRY.read_bytes())['reviews'],{})
        with patch.dict(os.environ,{'CORE12_APPROVED':'true','core12.reviewed_pg_only_capsule':'core12-boundary-v1'}):
            with self.assertRaisesRegex(m.Hold,'HOLD_REVIEW_TARGET_EXECUTOR_AND_ADAPTER_UNBOUND'):m.admit(self.raw,self.payload)
        self.assertFalse(m.profile()['guard_latch']['authority_source'])

    def test_06_ordinary_identity_constraints_not_observations(self):
        self.assertEqual(m.validate_identity_model(identity()),'MODEL_SHAPE_ONLY_NOT_RUNTIME_PROOF')
        for key,val in [('database','postgres'),('kind','supabase-staging'),('version',160001),('current_user','postgres'),
                        ('session_user','other'),('rolsuper',True),('rolbypassrls',True),('rolcreaterole',True),
                        ('database_temp',None),('function_default_acl_rows',1),('namespaces_present',['auth'])]:
            r=identity();r[key]=val
            with self.assertRaises(m.Hold):m.validate_identity_model(r)

    def test_07_existing_finalizer_positive_is_only_model(self):
        with patch('subprocess.Popen',side_effect=AssertionError('no process allowed')),patch('subprocess.run',side_effect=AssertionError('no command allowed')):
            r=m.closeout_model(*model())
        self.assertEqual(r['assessment'],'OFFLINE_MODEL_NOT_RUNTIME_PROOF');self.assertTrue(r['model_criteria_satisfied'])
        self.assertEqual(r['required_exit_code'],0);self.assertEqual(r['live'],'HOLD')

    def test_08_partial_unknown_or_skipped_container_cleanup_nonzero(self):
        for change in [lambda r:r['cleanup'].clear(),lambda r:r['cleanup'].pop(),lambda r:r['cleanup'][0].update(state='unknown'),
                       lambda r:r['cleanup'][0].update(state='skipped-preexisting'),lambda r:r['cleanup'].append(copy.deepcopy(r['cleanup'][0]))]:
            r,o,i=model();change(r);out=m.closeout_model(r,o,i)
            self.assertFalse(out['model_criteria_satisfied']);self.assertNotEqual(out['required_exit_code'],0)
            self.assertEqual(out['health_result_preserved'],r['health_result']);self.assertEqual(out['cleanup_completeness'],'UNKNOWN')

    def test_09_terminal_stream_and_same_backend_ack_required(self):
        for key,val in [('ready','E'),('tags',['ROLLBACK']),('pid',999),('fsync_ack',False),('chain',None),
                        ('connection_id','other'),('request_sha256','0'*64),('payload_sha256','0'*64),('cid','0'*64)]:
            r,o,i=model();r['terminal'][key]=val;out=m.closeout_model(r,o,i)
            self.assertFalse(out['model_criteria_satisfied']);self.assertNotEqual(out['required_exit_code'],0)

    def test_10_independent_observer_complete_zero_residue(self):
        for change in [lambda r:r['observer_identity'].update(pid=41),lambda r:r['observer_identity'].update(database_oid='999'),
                       lambda r:r['observer'].update(witness_functions_remaining=1),lambda r:r['observer'].update(matrix_remaining=None),
                       lambda r:r['observer'].update(snapshot_complete=False),lambda r:r['observer'].update(protected_after='0'*64)]:
            r,o,i=model();change(r);out=m.closeout_model(r,o,i);self.assertFalse(out['model_criteria_satisfied'])

    def test_11_first_error_and_cleanup_failure_preserved(self):
        r,o,i=model();r['primary_error']='UNIT_ORIGINAL_ERROR';r['cleanup'][0]['state']='unknown'
        out=m.closeout_model(r,o,i);self.assertEqual(out['primary_error'],'UNIT_ORIGINAL_ERROR');self.assertNotEqual(out['required_exit_code'],0)

    def test_12_no_exec_cli(self):
        for args in [['--exec','id'],['--run'],['--inspect-source','/not-read','--approved','true']]:
            with contextlib.redirect_stderr(io.StringIO()),self.assertRaises(SystemExit):m.main(args)


if __name__=='__main__':unittest.main()
