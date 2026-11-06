"""Pure synthetic state/fault tests; no private admission, native child, network or service is used."""
import copy
import contextlib
import io
import types
import tempfile
import shutil
import json
from pathlib import Path
import sys
import unittest
from unittest import mock
import socket
import signal
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
def module(name, path):
    m=types.ModuleType(name);m.__file__=str(path);sys.modules[name]=m;exec(compile(path.read_bytes(),str(path),'exec'),m.__dict__);return m
C = module('capacity_test_core', ROOT / 'scripts/platform17-app8ed-capacity-v2/controller.py')
H = module('capacity_test_host', ROOT / 'scripts/platform17-app8ed-capacity-v2/host.py')


def fixture():
    """SYNTHETIC ONLY. Hashes/PID/build/registry values are not real evidence."""
    return {'contract':'platform17.app198-app8ed.request.v2','run_id':'app8ed-synthetic-only-0001',
        'tool':{'sha':'1'*40,'tree':'2'*40,'seal_sha256':'3'*64},
        'consumer':{'root':C.APP_ROOT,'sha':C.BASE,'tree':C.NEW_TREE,'launcher_sha256':C.LAUNCHER},
        'old_app':{'root':C.OLD_ROOT,'sha':C.OLD,'tree':C.OLD_TREE,'launcher_sha256':C.LAUNCHER,'pid':4242,'start_ticks':'100','argv':['next-server (v16.4.1)'],'record_sha256':'4'*64,'build':{'id':'synthetic-old','files':{n:'5'*64 for n in C.BUILD_FILES},'served_manifest_sha256':'6'*64}},
        'admission':{'file':C.ADMISSION,'sha256':'7'*64},
        'transport':{'root':C.ANCHOR_ROOT,'sha':C.ANCHOR,'tree':'534ec94f21699a65686bade5539517dfd818ec1e','launcher_sha256':'5a25abd1847b7ff928fb310b14f9aadbfcda554eb1c29d1a146e66e6cb944092','abi':'platform17.relay-cors-preflight.v2','relay_seal_sha256':'c3cb3af536866aac88513c402a3a4484f48103583592a9e86e9e3926112aaf02','binding_sha256':'8'*64},
        'protected_files':{n:'9'*64 for n in C.PROTECTED_FILES},
        'budget':{'start_bytes':C.START,'reserve_bytes':C.RESERVE,'estimated_build_bytes':1073741824,'margin_bytes':536870912,'peak_bound':False},'deadline_seconds':600}

def encode(r):return json.dumps(r).encode()

class FakeHost:
    def __init__(self, r=None):
        self.r = copy.deepcopy(r or fixture()); self.events=[]; self.approved=True; self.now=100.; self.wall_now=100.; self.claimed=False
        self.free=C.START; self.inodes=100; self.old_ended=False; self.old_ticks='100'; self.preflights=0
        self.after_preflight=None; self.after_wait=None; self.build_code=0; self.sample_free=None; self.polls=0
        self.build=None; self.new=None; self.start_error=None; self.cleanup_error=False; self.finish_error=False; self.pid_error=False
        self.backend='UNCHANGED'; self.relay='UNCHANGED'; self.new_build={'id':'synthetic-new','files':{n:'a'*64 for n in C.BUILD_FILES},'served_manifest_sha256':'b'*64}
    def effect(self,n):self.events.append(n)
    def authorize(self,r,d):
        if not self.approved:raise C.Rejected('NO_SYNTHETIC_TEST_AUTHORITY')
    def current(self,r):
        if self.wall_now>=1000:raise C.Rejected('AUTHORITY_EXPIRED_OR_REVOKED')
    def observe(self,r,old_stopped=False):
        return {'consumer':copy.deepcopy(self.r['consumer']),'tool':self.r['tool'],'lineage':[C.OLD,C.MIDDLE,C.BASE],
          'admission_sha256':self.r['admission']['sha256'],'protected_files':self.r['protected_files'],'relay_identity_current':True,
          'sources_clean':True,'protected_sources_match':True,'old_ended':self.old_ended,
          'old':{'source':C.OLD,'tree':C.OLD_TREE,'pid':4242,'start_ticks':self.old_ticks,'cwd':C.OLD_ROOT,'argv':['next-server (v16.4.1)'],'live':not self.old_ended,'build':self.r['old_app']['build']},
          'available_bytes':self.free,'free_inodes':self.inodes}
    def claim(self,r,d):
        if self.claimed:raise C.Rejected('RUN_ALREADY_CONSUMED')
        self.claimed=True;self.effect('claim')
    def preflight(self,r):
        self.preflights+=1
        if self.after_preflight:self.after_preflight(self)
    def record(self,n,v):self.events.append('receipt:'+n)
    def spawn_build(self,r):self.effect('build');self.build={'kind':'build','live':True};return self.build
    def sample(self):return {'available_bytes':self.sample_free if self.sample_free is not None else self.free,'free_inodes':self.inodes}
    def monotonic(self):return self.now
    def sleep(self,d):
        self.now+=d
        if self.after_wait:self.after_wait(self)
    def build_poll(self,handle):
        self.polls+=1
        if self.build_code is not None:handle['live']=False
        return self.build_code
    def build_members(self,handle):return [handle] if handle['live'] else []
    def read_build(self,r):return copy.deepcopy(self.new_build)
    def stop_old(self,r):
        self.effect('stop-old');self.old_ended=True
    def port_free(self):return True
    def spawn_start(self,r,build):
        self.effect('start');self.new={'kind':'new-app','live':True}
        if self.pid_error:raise C.Unknown('START_CREATED_PID_RECORD_UNKNOWN')
        return self.new
    def start_ack(self,new,r,build):
        if self.start_error:raise C.Unknown(self.start_error)
        return {'source':C.BASE,'tree':C.NEW_TREE,'build':build,'listener':'SYNTHETIC_ONLY'}
    def possible_build(self):return self.build
    def possible_start(self):return self.new
    def cleanup_build(self,child):
        self.effect('cleanup-build-only')
        if self.cleanup_error:raise C.Unknown('CLEANUP_UNKNOWN')
        child['live']=False;return {'resource':'build','state':'ACK'}
    def cleanup_start(self,child):
        self.effect('cleanup-start-only')
        if child is None:return {'resource':'new-app','state':'UNKNOWN','child_may_exist':True}
        child['live']=False;return {'resource':'new-app','state':'ACK'}
    def finish(self,result):
        if self.finish_error:raise OSError('RECEIPT_FSYNC_FAILED')
        self.result=result

class Tests(unittest.TestCase):
    def setUp(self):
        self.native_attempts=[]
        def denied(*a,**k):
            self.native_attempts.append('FORBIDDEN_NATIVE_EFFECT');raise AssertionError('OFFLINE_TEST_NATIVE_EFFECT_FORBIDDEN')
        self.patches=[mock.patch.object(subprocess,'Popen',denied),mock.patch.object(H.os,'killpg',denied),mock.patch.object(H.os,'kill',denied),mock.patch.object(H.os,'pidfd_open',denied),mock.patch.object(signal,'pidfd_send_signal',denied),mock.patch.object(urllib.request,'urlopen',denied),mock.patch.object(socket.socket,'connect',denied),mock.patch.object(H,'private_read',denied)]
        for p in self.patches:p.start()
    def tearDown(self):
        for p in reversed(self.patches):p.stop()
        self.assertEqual(self.native_attempts,[],'offline tests attempted a native effect')
    def reject(self, mutate):
        r=fixture();mutate(r);h=FakeHost()
        with self.assertRaises((C.Rejected,ValueError,TypeError)):C.Controller(h).run(encode(r))
        self.assertEqual(h.events,[]);self.assertFalse(h.old_ended);self.assertIsNone(h.build);self.assertIsNone(h.new)
    def test_valid_budget_and_full_synthetic_transition(self):
        h=FakeHost();x=C.Controller(h).run(encode(fixture()));self.assertEqual(x.state,'ACK_EXACT_APP8ED_RETAINED')
        self.assertEqual([n for n in h.events if n in ('build','stop-old','start')],['build','stop-old','start'])
        self.assertLess(h.events.index('receipt:build-pass'),h.events.index('stop-old'));self.assertEqual(h.backend,'UNCHANGED');self.assertEqual(h.relay,'UNCHANGED')
    def test_indirect_parent_chain(self):
        r=fixture();h=FakeHost();s=h.observe(r);C.check_snapshot(s,r)
        self.assertEqual(s['lineage'],[C.OLD,C.MIDDLE,C.BASE]);self.assertNotEqual(s['lineage'][-2],C.OLD)
    def test_lower_start(self):self.reject(lambda r:r['budget'].update(start_bytes=C.START-1))
    def test_lower_reserve(self):self.reject(lambda r:r['budget'].update(reserve_bytes=C.RESERVE-1))
    def test_higher_unapproved_budget(self):self.reject(lambda r:r['budget'].update(start_bytes=C.START+1))
    def test_boolean_budget(self):self.reject(lambda r:r['budget'].update(start_bytes=True))
    def test_unknown_input(self):self.reject(lambda r:r.update(approved=True))
    def test_arbitrary_exec(self):self.reject(lambda r:r.update(exec=['arbitrary']))
    def test_old_app97(self):self.reject(lambda r:r['old_app'].update(sha='97e35e533ec06a7ae984ca9c696bd3edadb1a45c'))
    def test_wrong_consumer_tree(self):self.reject(lambda r:r['consumer'].update(tree='0'*40))
    def test_wrong_launcher(self):self.reject(lambda r:r['consumer'].update(launcher_sha256='0'*64))
    def test_wrong_admission_path(self):self.reject(lambda r:r['admission'].update(file='/tmp/arbitrary'))
    def test_wrong_hash(self):self.reject(lambda r:r['admission'].update(sha256='invalid'))
    def test_tool_is_not_app(self):self.reject(lambda r:r['tool'].update(sha=C.BASE))
    def test_null_binding_not_execution_ready(self):self.reject(lambda r:r['transport'].update(binding_sha256=None))
    def test_duplicate_json_rejected_before_effect(self):
        h=FakeHost();raw=encode(fixture()).replace(b'"run_id":',b'"run_id":"duplicate","run_id":')
        with self.assertRaises(C.Rejected):C.Controller(h).run(raw)
        self.assertEqual(h.events,[])
    def test_budget_is_not_authority(self):
        h=FakeHost();h.approved=False
        with self.assertRaises(C.Rejected):C.Controller(h).run(encode(fixture()))
        self.assertEqual(h.events,[])
    def test_low_capacity_before_claim(self):
        h=FakeHost();h.free=C.START-1
        with self.assertRaises(C.Rejected):C.Controller(h).run(encode(fixture()))
        self.assertEqual(h.events,[])
    def test_missing_inode(self):
        h=FakeHost();h.inodes=0
        with self.assertRaises(C.Rejected):C.Controller(h).run(encode(fixture()))
        self.assertEqual(h.events,[])
    def test_valid_format_wrong_observed_hash(self):
        h=FakeHost();h.r['admission']['sha256']='0'*64
        with self.assertRaises(C.Rejected):C.Controller(h).run(encode(fixture()))
        self.assertEqual(h.events,[])
    def test_recycled_old_pid(self):
        h=FakeHost();h.old_ticks='101'
        with self.assertRaises(C.Rejected):C.Controller(h).run(encode(fixture()))
        self.assertEqual(h.events,[])
    def test_identity_changes_during_preflight_wait(self):
        h=FakeHost();h.after_preflight=lambda h:setattr(h,'old_ticks','101');x=C.Controller(h).run(encode(fixture()))
        self.assertIn('OLD_PID',x.first_error['message']);self.assertNotIn('build',h.events);self.assertNotIn('stop-old',h.events)
    def test_identity_changes_after_build_before_stop(self):
        h=FakeHost();h.after_preflight=lambda h:setattr(h,'old_ticks','101') if h.preflights==2 else None
        x=C.Controller(h).run(encode(fixture()));self.assertNotIn('stop-old',h.events);self.assertNotIn('start',h.events);self.assertIsNotNone(x.first_error)
    def test_capacity_stop_only_build_group(self):
        h=FakeHost();original=h.spawn_build
        def then_capacity_falls(r):
            child=original(r);h.sample_free=C.EARLY_STOP;return child
        h.spawn_build=then_capacity_falls;x=C.Controller(h).run(encode(fixture()))
        self.assertEqual(x.first_error['message'],'STOPPED_CAPACITY_GUARD');self.assertIn('cleanup-build-only',h.events);self.assertNotIn('stop-old',h.events);self.assertFalse(h.old_ended);self.assertEqual(h.backend,'UNCHANGED');self.assertEqual(h.relay,'UNCHANGED')
    def test_build_failure_keeps_old_app(self):
        h=FakeHost();h.build_code=1;x=C.Controller(h).run(encode(fixture()));self.assertIn('FAILED_OFFICIAL_BUILD',x.first_error['message']);self.assertNotIn('stop-old',h.events);self.assertNotIn('start',h.events)
    def test_expiry_during_build_no_stop_old(self):
        h=FakeHost();h.build_code=None;h.after_wait=lambda h:setattr(h,'wall_now',1000)
        x=C.Controller(h).run(encode(fixture()));self.assertEqual(x.first_error['message'],'AUTHORITY_EXPIRED_OR_REVOKED');self.assertNotIn('stop-old',h.events)
    def test_unknown_start_no_second_start(self):
        h=FakeHost();h.start_error='START_ACK_UNKNOWN';x=C.Controller(h).run(encode(fixture()))
        self.assertEqual(x.state,'UNKNOWN_STOPPED_NO_RETRY');self.assertEqual(h.events.count('start'),1);self.assertEqual(x.start_dispatch,'DISPATCHED_MAY_EXIST');self.assertEqual(x.old_stop,'ACK')
    def test_pid_persistence_error_keeps_child_custody(self):
        h=FakeHost();h.pid_error=True;x=C.Controller(h).run(encode(fixture()));self.assertEqual(h.events.count('start'),1);self.assertIn('cleanup-start-only',h.events);self.assertIn('PID_RECORD',x.first_error['message']);self.assertIsNotNone(h.new)
    def test_cleanup_error_cannot_replace_first_error(self):
        h=FakeHost();h.build_code=1;h.cleanup_error=True;x=C.Controller(h).run(encode(fixture()))
        self.assertEqual(x.first_error['message'],'FAILED_OFFICIAL_BUILD');self.assertEqual(x.cleanup[0]['state'],'UNKNOWN');self.assertEqual(x.state,'UNKNOWN_STOPPED_NO_RETRY')
    def test_finish_failure_preserves_first_error(self):
        h=FakeHost();h.build_code=1;h.finish_error=True;x=C.Controller(h).run(encode(fixture()));self.assertEqual(x.first_error['message'],'FAILED_OFFICIAL_BUILD');self.assertEqual(x.state,'UNKNOWN_RECEIPT_PERSISTENCE_NO_RETRY')
    def test_run_is_single_use(self):
        h=FakeHost();h.claimed=True;x=C.Controller(h).run(encode(fixture()));self.assertIsNotNone(x.first_error);self.assertNotIn('build',h.events)
    def test_real_host_group_guard_protects_app_and_backend(self):
        born={'pid':200,'pgrp':200,'session':200,'start_ticks':'10'};member={**born,'uid':1000}
        self.assertEqual(H.safe_group(born,[member],born,{10,20},1000),[member])
        for changes in ({'pid':10},{'session':10},{'uid':0},{'start_ticks':'9'}):
            with self.assertRaises(ValueError):H.safe_group(born,[{**member,**changes}],born,{10,20},1000)
        with self.assertRaises(ValueError):H.safe_group(born,[member],{**born,'start_ticks':'11'},{10,20},1000)
    def test_registry_currentness_and_exact_binding(self):
        r=fixture();entry={'request_sha256':'a'*64,'tool':r['tool'],'run_id':r['run_id'],'issued_at_epoch':100,'expires_at_epoch':200,'single_use':True,'owner_decision_sha256':'b'*64}
        H.validate_registry_entry(entry,r,'a'*64,199)
        with self.assertRaises(ValueError):H.validate_registry_entry(entry,r,'a'*64,200)
        with self.assertRaises(ValueError):H.validate_registry_entry(entry,r,'c'*64,199)
        with self.assertRaises(ValueError):H.validate_registry_entry({**entry,'approved':True},r,'a'*64,199)
    def test_pid_metadata_wait_counts_toward_deadline(self):
        h=FakeHost();original=h.spawn_build
        def slow(r):
            child=original(r);h.now+=601;return child
        h.spawn_build=slow;x=C.Controller(h).run(encode(fixture()));self.assertEqual(x.first_error['message'],'STOPPED_BUILD_DEADLINE');self.assertNotIn('stop-old',h.events)
    def test_capacity_changed_during_intent_persistence(self):
        h=FakeHost();original=h.record
        def changed(name,value):
            original(name,value)
            if name=='build-intent':h.free=C.START-1
        h.record=changed;x=C.Controller(h).run(encode(fixture()));self.assertEqual(x.first_error['message'],'INSUFFICIENT_CAPACITY_NO_BUILD');self.assertNotIn('build',h.events)
    def test_unknown_cli_mode_and_extra_args_precede_private_read(self):
        for argv in (['--exec','anything'],['execute-once','a'*64,'approved:true'],['execute-once','/arbitrary/path']):
            with contextlib.redirect_stdout(io.StringIO()):self.assertEqual(H.main(argv),2)
        self.assertEqual(self.native_attempts,[])
    def test_delivered_null_template_is_not_admission(self):
        raw=(ROOT/'scripts/platform17-app8ed-capacity-v2/request.template.json').read_bytes();h=FakeHost()
        with self.assertRaises(C.Rejected):C.Controller(h).run(raw)
        self.assertEqual(h.events,[])
        self.assertEqual(json.loads((ROOT/'scripts/platform17-app8ed-capacity-v2/registry.template.json').read_bytes())['entries'],[])
    def test_real_seal_file_hash_rejects_changed_source(self):
        with tempfile.TemporaryDirectory(prefix='platform17-v2-synthetic-') as folder:
            root=Path(folder);seal_path=ROOT/'scripts/platform17-app8ed-capacity-v2/source-seal.json';seal=json.loads(seal_path.read_bytes())
            for item in seal['files']:
                destination=root/item['path'];destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/item['path'],destination)
            target=root/'scripts/platform17-app8ed-capacity-v2/source-seal.json';shutil.copyfile(seal_path,target)
            self.assertEqual(H.seal_identity(root),H.hash_bytes(seal_path.read_bytes()))
            changed=root/'scripts/platform17-app8ed-capacity-v2/controller.py';changed.write_bytes(changed.read_bytes()+b'\n# synthetic drift\n')
            with self.assertRaises(ValueError):H.seal_identity(root)
    def test_real_seal_rejects_extra_or_missing_path(self):
        with tempfile.TemporaryDirectory(prefix='platform17-v2-synthetic-') as folder:
            root=Path(folder);target=root/'scripts/platform17-app8ed-capacity-v2/source-seal.json';target.parent.mkdir(parents=True)
            original=json.loads((ROOT/'scripts/platform17-app8ed-capacity-v2/source-seal.json').read_bytes())
            for value in (original['files'][:-1],original['files']+[{'path':'arbitrary.py','bytes':0,'sha256':'0'*64}]):
                target.write_text(json.dumps({**original,'files':value}))
                with self.assertRaises(ValueError):H.seal_identity(root)
    def test_tool_seal_mismatch_no_effect(self):
        h=FakeHost();h.r['tool']['seal_sha256']='f'*64
        with self.assertRaises(C.Rejected):C.Controller(h).run(encode(fixture()))
        self.assertEqual(h.events,[])
    def test_wrong_intermediate_not_arbitrary_descendant(self):
        h=FakeHost();original=h.observe
        def wrong(*a,**k):
            s=original(*a,**k);s['lineage']=[C.OLD,C.BASE];return s
        h.observe=wrong
        with self.assertRaises(C.Rejected):C.Controller(h).run(encode(fixture()))
        self.assertEqual(h.events,[])
    def test_space_changes_after_preflight_no_build(self):
        h=FakeHost();h.after_preflight=lambda h:setattr(h,'free',C.START-1);x=C.Controller(h).run(encode(fixture()))
        self.assertEqual(x.first_error['message'],'INSUFFICIENT_CAPACITY_NO_BUILD');self.assertNotIn('build',h.events);self.assertNotIn('stop-old',h.events)
    def test_expiry_after_old_stop_prevents_start(self):
        h=FakeHost();original=h.stop_old
        def stopped(r):original(r);h.wall_now=1000
        h.stop_old=stopped;x=C.Controller(h).run(encode(fixture()));self.assertEqual(x.old_stop,'ACK');self.assertNotIn('start',h.events)
    def test_successful_start_receipt_failure_is_unknown_retained(self):
        h=FakeHost();h.finish_error=True;x=C.Controller(h).run(encode(fixture()))
        self.assertEqual(x.state,'UNKNOWN_RECEIPT_PERSISTENCE_NO_RETRY');self.assertEqual(x.start_dispatch,'ACK');self.assertTrue(h.new['live']);self.assertEqual(x.evidence['custody_followup']['owner'],'Platform')
    def test_foreign_target_rejected_before_effect(self):self.reject(lambda r:r['transport'].update(root='/tmp/foreign'))
    def test_old_identity_state_is_not_a_source_change(self):
        a={'pid':1,'start_ticks':'10','cwd':'/fixed','argv':['fixed'],'state':'S'}
        self.assertTrue(H.stable_process_same(a,{**a,'state':'R'}))
        self.assertFalse(H.stable_process_same(a,{**a,'start_ticks':'11'}))
        self.assertFalse(H.stable_process_same(a,{**a,'state':'Z'}))
    def test_unknown_start_without_handle_is_not_no_child(self):
        h=FakeHost()
        def unknown(r,build):h.effect('start');raise C.Unknown('SPAWN_ACK_UNKNOWN')
        h.spawn_start=unknown;x=C.Controller(h).run(encode(fixture()));self.assertEqual(h.events.count('start'),1);self.assertEqual(x.cleanup[0]['state'],'UNKNOWN');self.assertEqual(x.start_dispatch,'DISPATCHING_MAY_EXIST')
    def test_start_port_collision_does_not_dispatch(self):
        h=FakeHost();h.port_free=lambda:False;x=C.Controller(h).run(encode(fixture()));self.assertEqual(x.first_error['message'],'PORT3008_NOT_FREE_NO_START');self.assertNotIn('start',h.events)
    def test_sources_are_only_fixed_commands(self):
        self.assertEqual(C.BUILD_ARGV,('node','scripts/run-core-service-app-assembly-17.mjs','build'));self.assertEqual(C.START_ARGV[-1],'start')

if __name__=='__main__':unittest.main()
