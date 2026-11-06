"""Exact next-consumer preparation and pre-stop observation fault tests."""
import copy
import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
import types
import sys
def load(name, path):
    m=types.ModuleType(name); m.__file__=str(path); sys.modules[name]=m
    exec(compile(path.read_bytes(),str(path),'exec'),m.__dict__); return m
B=load('scope_adoption_baseline',ROOT/'tests/platform17-app8ed-capacity-v2/test_controller.py')
C,H=B.C,B.H
P=load('scope_adoption_prepare',ROOT/'scripts/platform17-app8ed-capacity-v2/prepare.py')


def prior_fixture():
    r=B.fixture()
    r['consumer']=copy.deepcopy(r['old_app'])
    for key in ('pid','start_ticks','argv','record_sha256','build'): r['consumer'].pop(key)
    r['tool']=copy.deepcopy(P.PRIOR_TOOL)
    r['run_id']='app8ed-prior-accepted-0001'
    build=B.fixture()['old_app']['build']
    served={'source':C.OLD,'tree':C.OLD_TREE,'build':copy.deepcopy(build),
        'listener':{'pid':4242,'start_ticks':'100','cwd':C.OLD_ROOT,
                    'argv':['next-server (v16.4.1)'],'uid':os.getuid()}}
    outer={'contract':'platform17.exact-built-start-continuation.v1',
           'request':r,'expected_build':copy.deepcopy(build)}
    result={'state':'ACK_EXACT_APP8ED_RETAINED','first_error':None,
            'start_dispatch':'ACK','evidence':{'served':served,'new_build':copy.deepcopy(build)}}
    admission={'contract':'core17.exact-app-consumer-admission.v1','source_base':C.ANCHOR,
        'installed_Core_base':C.CORE,'origin':'http://localhost:3008',
        'consumer':copy.deepcopy(r['consumer']),
        'transport':{'app':{k:r['transport'][k] for k in ('root','sha','tree','launcher_sha256')},
            'binding_sha256':r['transport']['binding_sha256'],
            'relay_seal_sha256':r['transport']['relay_seal_sha256']}}
    r['admission']['sha256']=C.sha(P.encoded(admission))
    return outer,result,admission


class PureTests(unittest.TestCase):
    setUp=B.Tests.setUp
    tearDown=B.Tests.tearDown
    def derive(self,outer,result,admission):
        return P.derive(outer,result,admission,B.fixture()['tool'],'app8ed-scope-successor-0001',C)
    def test_exact_projection_preserves_prior_and_only_rebinds_consumer(self):
        outer,result,admission=prior_fixture(); before=P.encoded([outer,result,admission])
        r,record,new=self.derive(outer,result,admission)
        C.validate(r)
        self.assertEqual(P.encoded([outer,result,admission]),before)
        self.assertEqual(r['consumer']['sha'],C.BASE); self.assertEqual(record['source'],C.OLD)
        self.assertEqual(r['old_app']['build'],outer['expected_build'])
        self.assertEqual(r['transport'],outer['request']['transport'])
        self.assertEqual(r['protected_files'],outer['request']['protected_files'])
        self.assertEqual(new['transport'],admission['transport'])
        self.assertEqual(r['old_app']['record_sha256'],C.sha(P.encoded(record)))
    def reject(self,change):
        outer,result,admission=prior_fixture(); change(outer,result,admission)
        with self.assertRaises((C.Rejected,KeyError,ValueError)):
            self.derive(outer,result,admission)
    def test_unaccepted_prior_tool(self): self.reject(lambda o,r,a:o['request']['tool'].update(sha='0'*40))
    def test_different_prior_source(self): self.reject(lambda o,r,a:o['request']['consumer'].update(sha='0'*40))
    def test_unknown_prior_start(self): self.reject(lambda o,r,a:r.update(state='UNKNOWN_STOPPED_NO_RETRY'))
    def test_not_ack_prior_start(self): self.reject(lambda o,r,a:r.update(start_dispatch='DISPATCHED_MAY_EXIST'))
    def test_prior_error_not_erased(self): self.reject(lambda o,r,a:r.update(first_error={'code':'failure'}))
    def test_served_build_mismatch(self): self.reject(lambda o,r,a:r['evidence']['served']['build'].update(id='different'))
    def test_accepted_build_hash_mismatch(self): self.reject(lambda o,r,a:o['expected_build']['files'].update({C.BUILD_FILES[0]:'0'*64}))
    def test_foreign_listener(self): self.reject(lambda o,r,a:r['evidence']['served']['listener'].update(cwd='/tmp/other'))
    def test_foreign_uid(self): self.reject(lambda o,r,a:r['evidence']['served']['listener'].update(uid=os.getuid()+1))
    def test_foreign_core(self): self.reject(lambda o,r,a:a.update(installed_Core_base='0'*40))
    def test_different_binding(self): self.reject(lambda o,r,a:a['transport'].update(binding_sha256='0'*64))
    def test_prebuild_probe_is_before_build_and_stop(self):
        h=B.FakeHost(); result=C.Controller(h).run(B.encode(B.fixture()))
        self.assertEqual(result.state,'ACK_EXACT_CONSUMER_RETAINED')
        self.assertLess(h.events.index('probe'),h.events.index('build'))
        self.assertLess(h.events.index('probe'),h.events.index('stop-old'))
        self.assertEqual(result.evidence['observation_probe_cleanup']['state'],'ACK')
    def test_probe_failure_has_no_build_stop_start(self):
        h=B.FakeHost(); h.probe_error='OBSERVATION_DENIED'
        result=C.Controller(h).run(B.encode(B.fixture()))
        self.assertEqual(result.first_error['message'],'OBSERVATION_DENIED')
        self.assertFalse(any(x in h.events for x in ('build','stop-old','start')))
        self.assertEqual(result.evidence['observation_probe_cleanup']['state'],'ACK')
    def test_probe_unknown_cleanup_is_not_NO_CHILD(self):
        h=B.FakeHost()
        def unknown(*args):
            h.effect('probe'); h.probe_cleanup={'state':'UNKNOWN','resource':'observation_probe'}
            raise C.Unknown('PROBE_ACK_UNKNOWN')
        h.probe_observation=unknown
        result=C.Controller(h).run(B.encode(B.fixture()))
        self.assertEqual(result.state,'UNKNOWN_STOPPED_NO_RETRY')
        self.assertEqual(result.evidence['observation_probe_cleanup']['state'],'UNKNOWN')
        self.assertNotIn('build',h.events); self.assertFalse(h.old_ended)
    def test_old198_tuple_rejected_before_claim(self):
        r=B.fixture(); r['old_app']['sha']='198e8a35dc120b554468074dd689793addb54385'
        h=B.FakeHost()
        with self.assertRaises(C.Rejected): C.Controller(h).run(B.encode(r))
        self.assertEqual(h.events,[])
    def test_grandparent_mistaken_for_active_source_rejected(self):
        r=B.fixture(); h=B.FakeHost(); snapshot=h.observe(r)
        snapshot['lineage'][0]='0'*40
        with self.assertRaises(C.Rejected): C.check_snapshot(snapshot,r)
    def test_legacy_continuation_not_an_entrypoint_for_new_profile(self):
        for mode in ('prepare-resume','resume-built-once'):
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(H.main([mode,'a'*64]),2)


class PrivatePreparationTests(unittest.TestCase):
    def test_real_preparation_CLI_uses_prior_bytes_and_writes_no_registry_claim_or_child(self):
        outer,result,admission=prior_fixture(); tool=B.fixture()['tool']
        with tempfile.TemporaryDirectory(prefix='cladora-scope-prepare-') as folder:
            root=Path(folder); prior=root/'prior'; auth=root/'authority'; private=root/'consumer'
            for d in (prior,prior/'requests',prior/'runs',prior/'runs'/outer['request']['run_id']):
                d.mkdir(mode=0o700,exist_ok=True)
            def put(path,value): H.persist(path,value)
            digest=C.sha(P.encoded(outer))
            put(prior/'coordinator-accepted-executions.json',{'contract':'platform17.coordinator-execution-registry.v2',
                'entries':[{'request_sha256':digest,'tool':P.PRIOR_TOOL,'run_id':outer['request']['run_id']}]})
            put(prior/'requests'/(digest+'.json'),outer)
            put(prior/'runs'/outer['request']['run_id']/'result.private.json',result)
            old_ad=prior/'admission.json'; put(old_ad,admission)
            responses={('status','--porcelain'):'',('rev-parse','HEAD^'):H.TOOL_PARENT,
                ('rev-parse','HEAD'):tool['sha'],('rev-parse','HEAD^{tree}'):tool['tree']}
            def git(self,where,*args): return responses[args].encode()
            def observe(self,r,old_stopped=False):
                # Source/backend observation is controlled; private file IO and
                # the prepare/main composition are real in the disposable root.
                h=B.FakeHost(r)
                snapshot=h.observe(r); snapshot['old'].update(pid=r['old_app']['pid'],start_ticks=r['old_app']['start_ticks'])
                return snapshot
            native=[]
            def forbidden(*a,**k): native.append(True); raise AssertionError('NATIVE_ACTION_FORBIDDEN')
            with mock.patch.object(P,'PRIOR_ROOT',prior),mock.patch.object(P,'PRIOR_ADMISSION',old_ad), \
                 mock.patch.object(C,'PRIVATE',str(private)),mock.patch.object(C,'OLD_RECORD',str(private/'old.json')), \
                 mock.patch.object(C,'ADMISSION',str(private/'admission.json')), \
                 mock.patch.object(H,'AUTHORITY_ROOT',auth),mock.patch.object(H,'REGISTRY',auth/'registry.json'), \
                 mock.patch.object(H,'C',C),mock.patch.object(H,'load_prepare',lambda:P), \
                 mock.patch.object(H,'seal_identity',lambda:tool['seal_sha256']), \
                 mock.patch.object(H.NativeHost,'git',git),mock.patch.object(H.NativeHost,'observe',observe), \
                 mock.patch.object(H,'process_full',lambda pid:{**result['evidence']['served']['listener'],'state':'S'}), \
                 mock.patch.object(H.subprocess,'Popen',forbidden),mock.patch.object(H.os,'kill',forbidden), \
                 contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(H.main(['prepare-next','app8ed-scope-preparation-0001']),0)
            reply=json.loads(output.getvalue()); request=auth/'requests'/(reply['request_sha256']+'.json')
            self.assertEqual(C.sha(request.read_bytes()),reply['request_sha256'])
            self.assertEqual(request.stat().st_mode & 0o777,0o600)
            self.assertEqual(reply['state'],'EXACT_REQUEST_PREPARED_NOT_AUTHORIZED')
            self.assertFalse((auth/'registry.json').exists()); self.assertFalse((auth/'runs').exists())
            self.assertEqual(native,[])
            self.assertEqual((prior/'requests'/(digest+'.json')).read_bytes(),P.encoded(outer))
            self.assertEqual((prior/'runs'/outer['request']['run_id']/'result.private.json').read_bytes(),P.encoded(result))


if __name__=='__main__': unittest.main()
