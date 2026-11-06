"""Resume contract and real disposable Node/kernel observation tests; no product backend."""
import contextlib
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import types
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
def module(name, path):
    import sys
    m = types.ModuleType(name); m.__file__ = str(path); sys.modules[name] = m
    exec(compile(path.read_bytes(), str(path), 'exec'), m.__dict__); return m
B = module('resume_baseline_tests', ROOT / 'tests/platform17-app8ed-capacity-v2/test_controller.py')
C, H = B.C, B.H
R = module('resume_support_tests', ROOT / 'scripts/platform17-app8ed-capacity-v2/resume.py')

class ResumeTests(unittest.TestCase):
    setUp = B.Tests.setUp
    tearDown = B.Tests.tearDown

    @contextlib.contextmanager
    def fixture(self):
        old = B.fixture(); old['tool'] = copy.deepcopy(R.PRIOR_TOOL)
        old['run_id'] = 'app8ed-prior-synthetic-0001'
        raw_old = B.encode(old); old_digest = C.sha(raw_old)
        request = copy.deepcopy(old); request['run_id'] = 'app8ed-resume-synthetic-0001'
        request['tool'] = {'sha': 'd'*40, 'tree': 'e'*40, 'seal_sha256': 'f'*64}
        fake = B.FakeHost(request); fake.old_ended = True; fake.new_build['id'] = 'synthetic-accepted-build'
        fake.probe_cleanup = None
        def probe(*args):
            fake.effect('probe'); fake.probe_cleanup = {'resource': 'observation_probe', 'state': 'ACK'}
        fake.probe_observation = probe
        result = {'state': 'UNKNOWN_STOPPED_NO_RETRY',
            'first_error': {'type': 'Unknown', 'message': 'START_LISTENER_PID_OBSERVATION_DENIED'},
            'cleanup': [{'resource': 'new_app', 'state': 'ACK', 'exit': -15},
                        {'resource': 'new_build', 'state': 'ACK', 'exit': 0}],
            'old_stop': 'ACK', 'start_dispatch': 'DISPATCHED_MAY_EXIST',
            'evidence': {'new_build': copy.deepcopy(fake.new_build)}}
        with tempfile.TemporaryDirectory(prefix='cladora-resume-unit-') as folder:
            root = Path(folder); prior_dir = root/'runs'/old['run_id']; prior_dir.mkdir(parents=True)
            result_path = prior_dir/'result.private.json'; result_path.write_bytes(B.encode(result))
            files = {root/'requests'/(old_digest+'.json'): raw_old}
            for kind, argv, pid in (('build', C.BUILD_ARGV, 42440), ('start', C.START_ARGV, 42441)):
                path = prior_dir/('000001-'+kind+'-process.private.json')
                data = B.encode({'tool': R.PRIOR_TOOL, 'source': C.BASE, 'argv': list(argv),
                    'identity': {'pid': pid, 'pgrp': pid, 'session': pid,
                                 'uid': os.getuid(), 'start_ticks': '100', 'state': 'S'}})
                path.write_bytes(data)
            outer = {'contract': 'platform17.exact-built-start-continuation.v1', 'request': request,
                'prior': {'request_sha256': old_digest, 'result_sha256': C.sha(result_path.read_bytes())},
                'expected_build': copy.deepcopy(fake.new_build)}
            def private(path):
                path = Path(path)
                if path in files: return files[path]
                self.assertTrue(path.is_relative_to(root), 'private fixture escaped temporary root')
                return path.read_bytes()
            with mock.patch.object(H, 'C', C), mock.patch.object(H, 'AUTHORITY_ROOT', root), \
                 mock.patch.object(H, 'REGISTRY', root/'registry.json'), \
                 mock.patch.object(H, 'private_read', private), \
                 mock.patch.object(H, 'group_members', lambda pid: []), \
                 mock.patch.object(H, 'proc_identity', mock.Mock(side_effect=FileNotFoundError)):
                yield outer, fake, files, result, result_path

    def execute(self, outer, fake): return R.run(fake, B.encode(outer), H, C)
    def test_prepare_helper_preserves_prior_bytes_and_has_no_authority_effect(self):
        with self.fixture() as (outer,fake,files,result,path):
            old_raw=files[H.AUTHORITY_ROOT/'requests'/(outer['prior']['request_sha256']+'.json')]
            before=bytes(old_raw)
            prepared=R.prepare_request(old_raw,path.read_bytes(),outer['request']['tool'],outer['request']['run_id'],C)
            self.assertEqual(prepared,outer);self.assertEqual(old_raw,before)
            self.assertEqual(fake.events,[])
    def test_prepare_cannot_reuse_consumed_prior_run(self):
        with self.fixture() as (outer,fake,files,result,path):
            old_raw=files[H.AUTHORITY_ROOT/'requests'/(outer['prior']['request_sha256']+'.json')]
            with self.assertRaisesRegex(C.Rejected,'PREPARE_EXACT_PRIOR_R2'):
                R.prepare_request(old_raw,path.read_bytes(),outer['request']['tool'],'app8ed-prior-synthetic-0001',C)
            self.assertEqual(fake.events,[])
    def test_real_prepare_CLI_writes_exact_private_request_without_registry_or_claim(self):
        with self.fixture() as (outer,fake,files,result,path):
            directory=H.AUTHORITY_ROOT/'requests';directory.mkdir(mode=0o700)
            tool=outer['request']['tool']
            responses={('status','--porcelain'):'',('rev-parse','HEAD^'):H.TOOL_PARENT,
                       ('rev-parse','HEAD'):tool['sha'],('rev-parse','HEAD^{tree}'):tool['tree']}
            def git(argv,**kwargs):
                self.assertEqual(argv[:3],['git','-C',str(H.TOOL)])
                return responses[tuple(argv[3:])].encode()
            with mock.patch.object(R.subprocess,'check_output',git), \
                 mock.patch.object(H,'seal_identity',lambda:tool['seal_sha256']), \
                 contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(H.main(['prepare-resume',outer['prior']['request_sha256'],outer['request']['run_id']]),0)
            reply=json.loads(output.getvalue());self.assertEqual(reply['state'],'REQUEST_PREPARED_NOT_AUTHORIZED')
            destination=directory/(reply['request_sha256']+'.json')
            self.assertEqual(C.sha(destination.read_bytes()),reply['request_sha256'])
            self.assertEqual(json.loads(destination.read_bytes()),outer)
            self.assertEqual(destination.stat().st_mode & 0o777,0o600)
            self.assertFalse(H.REGISTRY.exists());self.assertFalse((H.AUTHORITY_ROOT/'runs'/outer['request']['run_id']).exists())
            self.assertEqual(fake.events,[])
    def test_malformed_prepare_CLI_rejected_before_private_IO(self):
        for argv in (['prepare-resume','not-a-digest','app8ed-synthetic-0001'],
                     ['prepare-resume','a'*64,'../wrong-run']):
            with contextlib.redirect_stdout(io.StringIO()):self.assertEqual(H.main(argv),2)
        self.assertEqual(self.native_attempts,[])
    def test_exact_prior_success_resumes_start_without_build_or_old_stop(self):
        with self.fixture() as (outer, fake, *_):
            result = self.execute(outer, fake)
            self.assertEqual(result.state, 'ACK_EXACT_APP8ED_RETAINED')
            self.assertEqual(fake.events.count('start'), 1)
            self.assertEqual(fake.events.count('probe'), 1)
            self.assertNotIn('build', fake.events); self.assertNotIn('stop-old', fake.events)
            self.assertEqual(result.old_stop, 'PREVIOUS_ACK_NOT_REPLAYED')
            self.assertEqual(fake.backend, 'UNCHANGED'); self.assertEqual(fake.relay, 'UNCHANGED')
    def test_wrong_built_id_rejected(self):
        with self.fixture() as (outer, fake, *_):
            outer['expected_build']['id'] = 'different'
            with self.assertRaisesRegex(C.Rejected, 'PRIOR_SUCCESSFUL_BUILD_DRIFT'): self.execute(outer, fake)
            self.assertEqual(fake.events, [])
            outer['expected_build']['id'] = '../escaped'
            with self.assertRaisesRegex(C.Rejected, 'RESUME_BUILD_ID'): self.execute(outer, fake)
            self.assertEqual(fake.events, [])
    def test_prior_result_digest_drift_rejected(self):
        with self.fixture() as (outer, fake, files, result, path):
            path.write_bytes(path.read_bytes()+b' ')
            with self.assertRaisesRegex(C.Rejected, 'PRIOR_RESULT_DIGEST'): self.execute(outer, fake)
            self.assertEqual(fake.events, [])
    def prior_mutation(self, change, error):
        with self.fixture() as (outer, fake, files, result, path):
            change(result); path.write_bytes(B.encode(result)); outer['prior']['result_sha256'] = C.sha(path.read_bytes())
            with self.assertRaisesRegex(C.Rejected, error): self.execute(outer, fake)
            self.assertEqual(fake.events, [])
    def test_prior_cleanup_unknown_not_accepted(self):
        self.prior_mutation(lambda r:r['cleanup'][0].update(state='UNKNOWN'), 'PRIOR_CLEANUP_NOT_ACK')
    def test_prior_unrelated_failure_not_accepted(self):
        self.prior_mutation(lambda r:r['first_error'].update(message='different'), 'PRIOR_EXACT_END_STATE')
    def test_prior_old_stop_not_ACK_rejected(self):
        self.prior_mutation(lambda r:r.update(old_stop='NOT_RUN'), 'PRIOR_EXACT_END_STATE')
    def test_prior_failed_build_not_accepted(self):
        self.prior_mutation(lambda r:r['cleanup'][1].update(exit=1), 'PRIOR_BUILD_EXIT_NOT_ZERO')
    def test_build_bytes_changed_before_resume_rejected(self):
        with self.fixture() as (outer, fake, *_):
            fake.new_build['files'][C.BUILD_FILES[0]] = '0'*64
            with self.assertRaisesRegex(C.Rejected, 'PRIOR_SUCCESSFUL_BUILD_DRIFT'): self.execute(outer, fake)
            self.assertEqual(fake.events, [])
    def test_prior_live_group_no_start(self):
        with self.fixture() as (outer, fake, *_), mock.patch.object(H, 'group_members', lambda pid:[{'pid':pid}]):
            with self.assertRaisesRegex(C.Rejected, 'PRIOR_CHILD_GROUP_STILL_LIVE'): self.execute(outer, fake)
            self.assertEqual(fake.events, [])
    def test_prior_live_PID_even_if_group_scan_empty_rejected(self):
        with self.fixture() as (outer, fake, *_), mock.patch.object(H, 'proc_identity', lambda pid:{'start_ticks':'100','state':'S'}):
            with self.assertRaisesRegex(C.Rejected, 'PRIOR_CHILD_STILL_LIVE'): self.execute(outer, fake)
            self.assertEqual(fake.events, [])
    def test_prior_run_cannot_be_reused(self):
        with self.fixture() as (outer, fake, *_):
            outer['request']['run_id'] = 'app8ed-prior-synthetic-0001'
            with self.assertRaisesRegex(C.Rejected, 'PRIOR_EXACT_R2_NOT_REUSED'): self.execute(outer, fake)
            self.assertEqual(fake.events, [])
    def test_changed_admission_no_resume(self):
        with self.fixture() as (outer, fake, *_):
            outer['request']['admission']['sha256'] = '0'*64
            with self.assertRaisesRegex(C.Rejected, 'PRIOR_TARGET_OR_BINDING_DRIFT'): self.execute(outer, fake)
            self.assertEqual(fake.events, [])
    def test_occupied_port_has_no_claim_or_start(self):
        with self.fixture() as (outer, fake, *_):
            fake.port_free = lambda:False
            with self.assertRaisesRegex(C.Rejected, 'RESUME_PORT_ALREADY_OCCUPIED'): self.execute(outer, fake)
            self.assertEqual(fake.events, [])
    def test_start_only_does_not_require_build_budget_but_retains_reserve(self):
        with self.fixture() as (outer, fake, *_):
            fake.free = C.EARLY_STOP + 1
            self.assertLess(fake.free, C.START)
            self.assertEqual(self.execute(outer, fake).state, 'ACK_EXACT_APP8ED_RETAINED')
        with self.fixture() as (outer, fake, *_):
            fake.free = C.EARLY_STOP
            with self.assertRaisesRegex(C.Rejected, 'RESUME_START_CAPACITY_HOLD'): self.execute(outer, fake)
            self.assertEqual(fake.events, [])
    def test_probe_failure_prevents_product_start(self):
        with self.fixture() as (outer, fake, *_):
            def fail(*args):
                fake.probe_cleanup = {'resource':'observation_probe','state':'ACK'}
                raise C.Rejected('OBSERVATION_PROBE_FAILED')
            fake.probe_observation = fail
            result = self.execute(outer, fake)
            self.assertEqual(result.first_error['message'], 'OBSERVATION_PROBE_FAILED')
            self.assertNotIn('start', fake.events); self.assertNotIn('build', fake.events)
    def test_build_changes_during_probe_prevents_start(self):
        with self.fixture() as (outer, fake, *_):
            original = fake.probe_observation
            def changed(*args):
                original(*args); fake.new_build['served_manifest_sha256'] = '0'*64
            fake.probe_observation = changed
            result = self.execute(outer, fake)
            self.assertEqual(result.first_error['message'], 'PRIOR_SUCCESSFUL_BUILD_DRIFT')
            self.assertNotIn('start', fake.events)
    def test_start_unknown_cleans_only_owned_start_and_no_second_start(self):
        with self.fixture() as (outer, fake, *_):
            fake.start_error = 'FIXTURE_ACK_UNKNOWN'; result = self.execute(outer, fake)
            self.assertEqual(result.state, 'UNKNOWN_STOPPED_NO_RETRY')
            self.assertEqual(fake.events.count('start'), 1); self.assertIn('cleanup-start-only', fake.events)
            self.assertNotIn('cleanup-build-only', fake.events); self.assertNotIn('stop-old', fake.events)
    def test_receipt_failure_keeps_retained_custody_explicit(self):
        with self.fixture() as (outer, fake, *_):
            fake.finish_error = True; result = self.execute(outer, fake)
            self.assertEqual(result.state, 'UNKNOWN_RECEIPT_PERSISTENCE_NO_RETRY')
            self.assertEqual(result.evidence['custody_followup']['new_app'], 'RETAINED_ACK')
    def test_authority_expiry_during_probe_prevents_product_start(self):
        with self.fixture() as (outer,fake,*_):
            original=fake.probe_observation
            def expired(*args):original(*args);fake.wall_now=1000
            fake.probe_observation=expired;result=self.execute(outer,fake)
            self.assertEqual(result.first_error['message'],'AUTHORITY_EXPIRED_OR_REVOKED')
            self.assertNotIn('start',fake.events)
    def test_authority_expiry_after_HTTP_cleans_new_child_no_retry(self):
        with self.fixture() as (outer,fake,*_):
            original=fake.start_ack
            def expired(*args):value=original(*args);fake.wall_now=1000;return value
            fake.start_ack=expired;result=self.execute(outer,fake)
            self.assertEqual(result.first_error['message'],'AUTHORITY_EXPIRED_OR_REVOKED')
            self.assertEqual(fake.events.count('start'),1);self.assertIn('cleanup-start-only',fake.events)
    def test_cleanup_error_does_not_replace_original_start_failure(self):
        with self.fixture() as (outer,fake,*_):
            fake.start_error='ORIGINAL_START_FAILURE'
            def failed_cleanup(*args):raise C.Unknown('SECONDARY_CLEANUP_FAILURE')
            fake.cleanup_start=failed_cleanup;result=self.execute(outer,fake)
            self.assertEqual(result.first_error['message'],'ORIGINAL_START_FAILURE')
            self.assertEqual(result.state,'UNKNOWN_STOPPED_NO_RETRY')
            self.assertEqual(fake.events.count('start'),1)
    def test_real_resume_CLI_authorization_and_runner_composition(self):
        with self.fixture() as (outer, fake, files, result, path):
            raw = B.encode(outer); digest = C.sha(raw); r = outer['request']
            entry = {'request_sha256':digest,'tool':r['tool'],'run_id':r['run_id'],
                'issued_at_epoch':100,'expires_at_epoch':200,'single_use':True,'owner_decision_sha256':'a'*64}
            files[H.REGISTRY] = B.encode({'contract':'platform17.coordinator-execution-registry.v2','entries':[entry]})
            files[H.AUTHORITY_ROOT/'requests'/(digest+'.json')] = raw
            real = H.NativeHost
            def construct(*args):
                h = real(*args)
                for name in ('observe','claim','preflight','record','spawn_start','sample','read_build',
                    'port_free','start_ack','possible_start','cleanup_start','finish'):
                    setattr(h,name,getattr(fake,name))
                def probe(*args): fake.probe_observation(*args); h.probe_cleanup = fake.probe_cleanup
                h.probe_observation = probe
                return h
            with mock.patch.object(H,'NativeHost',construct), mock.patch.object(H,'seal_identity',lambda:r['tool']['seal_sha256']), \
                 mock.patch.object(H.time,'time',lambda:100.), contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(H.main(['resume-built-once',digest]),0)
            self.assertEqual(json.loads(output.getvalue())['state'],'ACK_EXACT_APP8ED_RETAINED')
            self.assertEqual(fake.events.count('start'),1); self.assertNotIn('build',fake.events)

class KernelObservationTests(unittest.TestCase):
    """Actual disposable Node sockets/PID/session/HTTP, on random loopback ports."""
    @contextlib.contextmanager
    def host(self):
        with tempfile.TemporaryDirectory(prefix='cladora-owned-observation-') as folder:
            root = Path(folder); app = root/'app'; run = root/'run'
            app.mkdir(mode=0o700); run.mkdir(mode=0o700)
            helper = app/'scripts/lib/core-service-assembly-environment-v1.mjs'
            helper.parent.mkdir(parents=True); shutil.copyfile(ROOT/helper.relative_to(app),helper)
            with socket.socket() as sock:
                sock.bind(('127.0.0.1',0)); port = sock.getsockname()[1]
            with mock.patch.object(C,'APP_ROOT',str(app)), mock.patch.object(H,'APP_PORT',port), mock.patch.object(H,'C',C):
                r = B.fixture(); h = H.NativeHost(r,'a'*64,b'synthetic-only',{})
                h.run = run; h.current = lambda request:None
                # Observe the actual disposable fixture filesystem on any runner;
                # the production host remains pinned to /workspace.
                def capacity():
                    sample=os.statvfs(app)
                    return {'available_bytes':sample.f_bavail*sample.f_frsize,'free_inodes':sample.f_favail}
                h.sample=capacity
                fake = B.FakeHost(r); fake.old_ended = True; h.old_stopped = True
                h.observe = fake.observe; h.read_build = fake.read_build
                try:
                    yield h,r,fake,app,port
                finally:
                    for slot in (h._start,h._probe):
                        if slot is not None and slot.get('born') is not None:
                            h._cleanup(slot,'fixture_final_cleanup')

    def script(self, app, body='FIXTURE_BUILD_BYTES', strip=False):
        source = "import http from 'node:http';process.title='next-server (v16.4.1)';" \
            + "const s=http.createServer((q,r)=>{" \
            + ("r.removeHeader('x-cladora-start-observation');" if strip else '') \
            + 'r.end('+json.dumps(body)+');});s.listen('+str(H.APP_PORT)+",'127.0.0.1');" \
            + "process.once('SIGTERM',()=>s.close(()=>process.exit(0)));"
        (app/'scripts/run-core-service-app-assembly-17.mjs').write_text(source)
    def build(self, fake):
        fake.new_build['served_manifest_sha256'] = hashlib.sha256(b'FIXTURE_BUILD_BYTES').hexdigest()
        return fake.new_build
    def test_actual_probe_preserves_guard_environment_and_cleans_itself(self):
        with self.host() as (h,r,fake,app,port):
            h.probe_observation(r,self.build(fake))
            self.assertEqual(h.probe_cleanup['state'],'ACK')
            self.assertEqual(h._probe['child'].returncode,0)
            self.assertEqual(H.group_members(h._probe['born']['pid']),[])
    def test_parent_observation_failure_stops_probe_before_product_start(self):
        with self.host() as (h,r,fake,app,port), mock.patch.object(H,'process_full',mock.Mock(side_effect=PermissionError('CONTROLLED_PARENT_METADATA_DENIED'))):
            with self.assertRaisesRegex(PermissionError,'CONTROLLED_PARENT_METADATA_DENIED'):
                h.probe_observation(r,self.build(fake))
            self.assertEqual(h.probe_cleanup['state'],'ACK')
            self.assertIsNone(h._start)
            self.assertTrue(h._probe['child'].stdin.closed)
            self.assertEqual(H.group_members(h._probe['born']['pid']),[])
    def start(self,h,r,fake,app,body='FIXTURE_BUILD_BYTES',strip=False):
        self.script(app,body,strip); build = self.build(fake)
        return h.spawn_start(r,build),build
    @contextlib.contextmanager
    def deny_foreign_fd(self):
        readlink = os.readlink
        def denied(path,*args,**kwargs):
            if str(path).startswith('/proc/') and '/fd' in str(path):
                raise PermissionError('CONTROLLED_FOREIGN_FD_DENIED')
            return readlink(path,*args,**kwargs)
        with mock.patch.object(H.os,'readlink',denied): yield
    def test_real_start_HTTP_PID_ACK_with_foreign_fd_reads_denied(self):
        with self.host() as (h,r,fake,app,port), self.deny_foreign_fd():
            slot,build = self.start(h,r,fake,app)
            result = h.start_ack(slot,r,build)
            self.assertEqual(result['HTTP'],200)
            self.assertEqual(result['observation'],'child-owned-listen-and-http-nonce.v1')
            self.assertEqual(result['listener']['session'],slot['born']['pid'])
    def test_wrong_served_build_never_ACKs(self):
        with self.host() as (h,r,fake,app,port):
            slot,build = self.start(h,r,fake,app,body='WRONG_BUILD')
            with self.assertRaisesRegex(C.Rejected,'SERVED_BUILD_HASH_MISMATCH'): h.start_ack(slot,r,build)
    def test_HTTP200_without_own_nonce_never_ACKs(self):
        with self.host() as (h,r,fake,app,port):
            slot,build = self.start(h,r,fake,app,strip=True)
            with self.assertRaisesRegex(C.Rejected,'HTTP_LISTENER_PROOF_MISMATCH'): h.start_ack(slot,r,build)
    def test_proof_cannot_name_foreign_process(self):
        with self.host() as (h,r,fake,app,port):
            slot,build = self.start(h,r,fake,app)
            evidence = Path(h.observation['config']['evidence_file']); deadline=time.monotonic()+5
            while not evidence.exists():
                if time.monotonic()>deadline: self.fail('fixture observation deadline')
                time.sleep(.01)
            proof=json.loads(evidence.read_text());proof['pid']=os.getpid()
            evidence.write_text(json.dumps(proof)+'\n')
            with self.assertRaisesRegex(C.Rejected,'OBSERVER_NOT_OWN_GROUP'): h.start_ack(slot,r,build)
    def test_listener_identity_change_after_HTTP_does_not_ACK(self):
        with self.host() as (h,r,fake,app,port):
            slot,build=self.start(h,r,fake,app); original=H.process_full; calls=[0]
            def changed(pid):
                value=original(pid);calls[0]+=1
                if calls[0]>=2:value['start_ticks']='999999999999'
                return value
            with mock.patch.object(H,'process_full',changed):
                with self.assertRaisesRegex(C.Rejected,'LISTENER_CHANGED_AFTER_HTTP_AWAIT'):h.start_ack(slot,r,build)
    def test_start_reserve_failure_cleans_only_own_child(self):
        with self.host() as (h,r,fake,app,port):
            slot,build=self.start(h,r,fake,app)
            h.sample=lambda:{'available_bytes':C.RESERVE,'free_inodes':100}
            with self.assertRaisesRegex(C.Rejected,'START_RESERVE_GUARD'):h.start_ack(slot,r,build)
    def test_capacity_loss_after_HTTP_never_returns_ACK(self):
        with self.host() as (h,r,fake,app,port):
            slot,build=self.start(h,r,fake,app);samples=[0]
            def capacity():
                samples[0]+=1
                return {'available_bytes':C.START if samples[0]==1 else C.RESERVE,'free_inodes':100}
            # Wait for the immutable proof so this counter covers the HTTP boundary.
            evidence=Path(h.observation['config']['evidence_file']);deadline=time.monotonic()+5
            while not evidence.exists():
                if time.monotonic()>deadline:self.fail('fixture observation deadline')
                time.sleep(.01)
            h.sample=capacity
            with self.assertRaisesRegex(C.Rejected,'START_RESERVE_GUARD'):h.start_ack(slot,r,build)

if __name__ == '__main__': unittest.main()
