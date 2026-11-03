"""New packet/coverage tests only. No SQL parser, PostgreSQL or old mapper suite."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).parent
spec=importlib.util.spec_from_file_location('acl02_packet',ROOT/'packet.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
REQUEST=json.loads((ROOT/'request.json').read_text())
FILES={n:(ROOT/n).read_bytes() for n in ['witness.sql','verify-clean.sql']}
CONTRACT=json.loads((ROOT/'catalog-contract.json').read_text())

def packet():return copy.deepcopy(REQUEST),dict(FILES)

def reseal(r,files):
    for entry in r['order']:
        name=Path(entry['payload']['path']).name
        entry['payload'].update(p.identity(files[name]))

class PacketTests(unittest.TestCase):
    def test_source_packet_is_not_execution(self):
        result=p.validate(*packet())
        self.assertEqual(result['status'],'SOURCE_PACKET_CONSISTENT_EXECUTION_HOLD')
        self.assertFalse(result['execute']);self.assertIsNone(result['authorization'])
        self.assertEqual(result['pg_witness'],'NOT_RUN')

    def test_wrong_payload_identity(self):
        r,f=packet();f['witness.sql']+=b'\n'
        self.assertIn('PAYLOAD_IDENTITY_witness.sql',p.validate(r,f)['errors'])

    def test_coherently_resealed_target_invariants(self):
        cases=[
            ('LANGUAGE sql SECURITY INVOKER','LANGUAGE sql SECURITY DEFINER','FACADE_INVOKER_PATH'),
            ('NOSUPERUSER NOCREATEDB','SUPERUSER NOCREATEDB','ROLE_ATTRIBUTES'),
            ('NOCREATEROLE NOINHERIT','NOCREATEROLE INHERIT','ROLE_ATTRIBUTES'),
            ('NOREPLICATION NOBYPASSRLS','NOREPLICATION BYPASSRLS','ROLE_ATTRIBUTES'),
            ('pg_auth_members','pg_roles','OWNERSHIP_MEMBERSHIP_ASSERTIONS'),
            ("IS DISTINCT FROM TRUE THEN","= TRUE THEN",'NULL_UNSAFE_PRECONDITION'),
            ("EXCEPTION WHEN SQLSTATE '42501' THEN NULL;","EXCEPTION WHEN OTHERS THEN NULL;",'CATCH_ALL'),
            ('ROLLBACK;','COMMIT;','WITNESS_TRANSACTION'),
            ("SET LOCAL lock_timeout = '3s';","SET LOCAL lock_timeout = '0';",'DEADLINE_witness'),
            ("v := ops_acl02_private.command_v1('allow');","v := ops_acl02_api.facade_v1('allow');",'DIRECT_PRIVATE_POSITIVE'),
            ("p_value IS DISTINCT FROM 'allow'","false",'PRIVATE_TOY_GUARD'),
            ('DO $case_D03$','DO $case_REMOVED$', 'CASE_BODY_D03'),
        ]
        for old,new,code in cases:
            with self.subTest(code=code):
                r,f=packet();self.assertIn(old.encode(),f['witness.sql'])
                f['witness.sql']=f['witness.sql'].replace(old.encode(),new.encode())
                reseal(r,f)
                self.assertIn(code,p.validate(r,f)['errors'])
                self.assertNotIn('PAYLOAD_IDENTITY_witness.sql',p.validate(r,f)['errors'])

    def test_coherent_public_grant_is_not_allowed(self):
        r,f=packet()
        f['witness.sql']=f['witness.sql'].replace(b'ROLLBACK;',b'GRANT EXECUTE ON FUNCTION ops_acl02_private.command_v1(text) TO PUBLIC;\nROLLBACK;')
        reseal(r,f);self.assertIn('PUBLIC_POSITIVE_GRANT',p.validate(r,f)['errors'])

    def test_request_target_order_and_approval(self):
        cases=[('WRONG_TARGET',lambda r:r['target'].update(kind='hosted',project_ref='ryygcqiunqqtfkpkflzf')),
               ('SELF_AUTHORIZATION',lambda r:r.update(execution_authorized=True)),
               ('UNSUPPORTED_ADMISSION_FIELD',lambda r:r.update(exec='arbitrary hook')),
               ('SOURCE_REQUEST_BINDINGS_NOT_NULL',lambda r:r['bindings'].update(coordinator_review='self-approved')),
               ('STAGE_ORDER',lambda r:r['order'].reverse()),
               ('EFFECT_BOUNDARY',lambda r:r['allowed_effects'].update(tables=['maintenance.work_orders'])),
               ('CLEANUP_OR_NATIVE_CLAIM',lambda r:r['success_contract'].update(rollback_ack_same_backend=False)),
               ('CLEANUP_OR_NATIVE_CLAIM',lambda r:r['success_contract'].update(native_or_staging_acceptance=True))]
        for code,mutate in cases:
            with self.subTest(code=code):
                r,f=packet();mutate(r);self.assertIn(code,p.validate(r,f)['errors'])

    def test_residue_must_be_read_only_and_bounded(self):
        r,f=packet();f['verify-clean.sql']=f['verify-clean.sql'].replace(b'READ ONLY',b'READ WRITE')
        reseal(r,f);self.assertIn('RESIDUE_READ_ONLY',p.validate(r,f)['errors'])

    def capture(self):
        return dict(format='OPS_PRIVATE_CATALOG_RAW_02',server_version_num=170011,
                    read_only='on',isolation='repeatable read',sections={
                    name:dict(rows=[],total=0,returned=0,truncated=False) for name in CONTRACT['required_sections']})

    def test_complete_shape_never_proves_lineage_or_writer_coverage(self):
        result=p.inspect_catalog(self.capture(),CONTRACT)
        self.assertEqual(result['catalog_coverage'],'CAPTURE_SHAPE_ONLY')
        self.assertEqual(result['status'],'BLOCKED');self.assertFalse(result['mapper_ready'])
        self.assertFalse(result['execute'])

    def test_missing_section_truncation_and_count_forgery(self):
        for mutation in [lambda x:x.pop('rows'),lambda x:x.update(truncated=True),
                         lambda x:x.update(total=5001),lambda x:x.update(returned=1),
                         lambda x:x.update(total=False),lambda x:x.update(rows=[{'synthetic':'unreviewed'}])]:
            raw=self.capture();name=CONTRACT['required_sections'][0];mutation(raw['sections'][name])
            self.assertIn('INCOMPLETE_SECTION_'+name,p.inspect_catalog(raw,CONTRACT)['errors'])

    def test_projection_sections_match_sql(self):
        import re
        sql=(ROOT/'catalog-projection.sql').read_text()
        actual=re.findall(r"SELECT '([a-z_]+)'(?: AS name)?,",sql)
        self.assertEqual(CONTRACT['required_sections'],actual)
        self.assertEqual(len(actual),len(set(actual)))
        self.assertIn('WITH RECURSIVE',sql)
        self.assertIn('t.tgrelid,t.tgname',sql)
        self.assertIn('grantor,admin_option,inherit_option,set_option',sql)
        self.assertIn("'mapper_ready',false",sql)

    def test_projection_is_separately_pinned_not_admitted_sql(self):
        pin=CONTRACT['source'];data=(ROOT/'catalog-projection.sql').read_bytes()
        self.assertTrue(all(pin[k]==v for k,v in p.identity(data).items()))
        self.assertTrue(CONTRACT['reuse_existing_first'])
        self.assertFalse(CONTRACT['execution_authorized'])
        self.assertNotIn('catalog-projection.sql',[Path(x['payload']['path']).name for x in REQUEST['order']])

if __name__=='__main__':unittest.main(verbosity=2)
