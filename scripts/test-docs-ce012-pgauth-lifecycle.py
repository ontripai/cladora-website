#!/usr/bin/env python3
"""Only Documents parent handoff/lifecycle delta; no Docker, SQL, Auth or session."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

s=importlib.util.spec_from_file_location('docs_parent',Path(__file__).with_name('run-docs-ce012-pgauth.py'))
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)


def owner(root):
    lane=m.Lane.__new__(m.Lane)
    lane.out=Path(root);lane.run='cladora-lane-'+'a'*12
    lane.p=json.loads(m.PROFILE.read_bytes())
    lane.owned=[{'role':'pg','name':lane.run+'-pg','cid':'b'*64},{'role':'auth','name':lane.run+'-auth','cid':'c'*64}]
    lane.images=[('pg','pg-image',True),('auth','auth-image',False)]
    lane.r={'profile_sha256':m.digest(m.PROFILE.read_bytes()),'health_result':'PG17_AND_REAL_AUTH_HEALTH_PROVED_NO_DOMAIN_INSTALL',
            'consumer':{'status':'NOT_RUN'},'cleanup':[],'stages':{},'overall_result':'INCOMPLETE'}
    return lane


def acknowledged(lane):
    lane.r['cleanup']=[{'kind':'container','resource_id':entry['name'],'identity':entry['cid'],'state':'acknowledged-absent'} for entry in lane.owned]
    lane.r['cleanup'] += [{'kind':'image','resource_id':identity,'identity':identity,
        'state':'removal-acknowledged' if acquired else 'skipped-preexisting'} for image,identity,acquired in lane.images]


class ParentDelta(unittest.TestCase):
    def test_01_actual_platform_handoff_and_duplicate_rejection(self):
        with tempfile.TemporaryDirectory() as temp:
            lane=owner(temp);h=m.prepare_handoff(lane)
            self.assertEqual(len(h['attempt_id']),32)
            descriptor={'run_id':lane.run,'owner_uid':os.getuid(),**h,
                'pg_cid':lane.owned[0]['cid'],'pg_name':lane.owned[0]['name'],
                'auth_cid':lane.owned[1]['cid'],'auth_name':lane.owned[1]['name']}
            m.assert_lane(lane,descriptor)
            with self.assertRaises(m.NotReady):m.prepare_handoff(lane)
            for key,value in [('auth_cid','forged'),('run_id','other'),('attempt_id','0'*32)]:
                with self.subTest(key=key),self.assertRaises(m.NotReady):m.assert_lane(lane,dict(descriptor,**{key:value}))

    def test_02_authless_or_historical_owner_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            lane=owner(temp);m.prepare_handoff(lane)
            d={'run_id':lane.run,'owner_uid':os.getuid(),**lane.r['docs_ce012_handoff'],
               'pg_cid':lane.owned[0]['cid'],'pg_name':lane.owned[0]['name'],
               'auth_cid':lane.owned[1]['cid'],'auth_name':lane.owned[1]['name']}
            lane.owned.pop()
            with self.assertRaises(m.NotReady):m.assert_lane(lane,d)
            lane=owner(temp);lane.r['ended_utc']='historical'
            with self.assertRaises(m.NotReady):m.assert_lane(lane,d)

    def test_03_positive_and_incomplete_cleanup_actual_owner_slot(self):
        for gap in ('complete','unknown','missing','empty'):
            with self.subTest(gap=gap),tempfile.TemporaryDirectory() as temp:
                lane=owner(temp)
                def consumer(l,fd):l.r['consumer']={'status':'PASSED'}
                def cleanup():
                    acknowledged(lane)
                    if gap=='unknown':lane.r['cleanup'][0]['state']='unknown'
                    if gap=='missing':lane.r['cleanup'].pop(0)
                    if gap=='empty':lane.r['cleanup']=[]
                with patch.object(m,'consume_owned_lane',side_effect=consumer),patch.object(lane,'cleanup',side_effect=cleanup):
                    r=m.consume_and_cleanup(lane,3)
                actual=json.loads((Path(temp)/'receipt.json').read_bytes())
                self.assertEqual(actual['overall_result'],'PASSED' if gap=='complete' else 'UNKNOWN')
                self.assertEqual(actual['exit_code'],0 if gap=='complete' else 1)
                self.assertEqual(actual['health_result'],'PG17_AND_REAL_AUTH_HEALTH_PROVED_NO_DOMAIN_INSTALL')
                self.assertEqual(actual['consumer']['status'],'PASSED')
                self.assertEqual(r,actual)

    def test_04_first_error_survives_independent_cleanup_failure(self):
        with tempfile.TemporaryDirectory() as temp:
            lane=owner(temp)
            def consumer(l,fd):l.r['primary_error']='SESSION_FIRST';l.r['consumer']={'status':'FAILED_OR_UNKNOWN'}
            with patch.object(m,'consume_owned_lane',side_effect=consumer),patch.object(lane,'cleanup',side_effect=RuntimeError('cleanup second')):
                r=m.consume_and_cleanup(lane,3)
            self.assertEqual(r['primary_error'],'SESSION_FIRST')
            self.assertEqual(r['overall_result'],'UNKNOWN');self.assertEqual(r['exit_code'],1)
            self.assertEqual(r['cleanup_errors'],['RuntimeError'])

    def test_05_lifecycle_reuse_cannot_cleanup_or_rewrite_history(self):
        with tempfile.TemporaryDirectory() as temp:
            lane=owner(temp)
            with patch.object(m,'consume_owned_lane',side_effect=lambda l,fd:l.r.update(consumer={'status':'PASSED'})),patch.object(lane,'cleanup',side_effect=lambda:acknowledged(lane)):
                m.consume_and_cleanup(lane,3)
            before=(Path(temp)/'receipt.json').read_bytes()
            with patch.object(lane,'cleanup',side_effect=AssertionError('no cleanup replay')):
                with self.assertRaisesRegex(m.NotReady,'ENDED_LIFECYCLE_NO_REPLAY'):m.consume_and_cleanup(lane,3)
            self.assertEqual(before,(Path(temp)/'receipt.json').read_bytes())

    def test_06_missing_producer_inputs_not_ready_without_effect(self):
        with tempfile.TemporaryDirectory() as temp:
            lane=owner(temp)
            with patch.object(lane,'cmd',side_effect=AssertionError('no Docker')),patch.object(m,'node',side_effect=AssertionError('no worker')):
                result=m.consume_owned_lane(lane,3)
            self.assertNotEqual(result['status'],'PASSED');self.assertEqual(result['consumer'],'NOT_RUN')
            self.assertEqual(result['zero_write'],'NOT_RUN')

    def test_07_cli_no_run_exec_or_session_env_fallback(self):
        launcher=Path(m.__file__)
        for arg in ('--run','--exec','--sql'):
            p=subprocess.run([sys.executable,str(launcher),arg],capture_output=True)
            self.assertEqual(p.returncode,2)
        p=subprocess.run([sys.executable,str(launcher),'--inspect'],capture_output=True)
        self.assertEqual(p.returncode,0,p.stderr)
        self.assertEqual(json.loads(p.stdout)['execution'],'NOT_READY_FINAL_BINDING_AND_REVIEW_REQUIRED')

    def test_08_private_file_mode_and_consumed_attempt(self):
        with tempfile.TemporaryDirectory() as temp:
            p=Path(temp)/'input.json';p.write_text('{}');p.chmod(0o644)
            with self.assertRaises(m.NotReady):m.private_file(p)
            p.chmod(0o600);self.assertEqual(m.private_file(p),b'{}')
            lane=owner(temp);d=Path(temp)/'docs-ce012';d.mkdir();(d/'dispatch.claim').write_text('used')
            before=copy.deepcopy(lane.r)
            with self.assertRaises(m.NotReady):m.consume_owned_lane(lane,3)
            self.assertEqual(lane.r,before)


if __name__=='__main__':unittest.main(verbosity=2)
