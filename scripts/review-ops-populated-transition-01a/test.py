"""Synthetic mapper tests only; not PostgreSQL or target evidence."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).parent
spec = importlib.util.spec_from_file_location('transition_mapper', ROOT / 'map.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
P = json.loads((ROOT / 'proposal.json').read_text())

def fixture():
    names = {f: f + '(synthetic_signature)' for f in P['dependency_routine_families']}
    objects = []
    for name in sorted(set(names.values()) | set(P['dependency_relations'])):
        objects.append(dict(id=name, kind='routine' if '(' in name else 'relation',
                            owner='synthetic_owner', acl=[], effective_acl=[],
                            definition_sha256=m.digest(name), dependencies=[],
                            security='synthetic', search_path=['pg_catalog']))
    for obj in objects:
        if obj['kind']=='routine':
            obj.update(arguments='synthetic_signature',result='synthetic',language='synthetic',volatility='synthetic',parallel='synthetic')
        else:
            obj.update(columns=[],constraints=[],indexes=[],policies=[],rls=False,generated_objects=[])
    principal = dict(name='postgres', bypassrls=True, superuser=False)
    edges = [dict(role='synthetic_owner', member='postgres', grantor='synthetic_provider',
                  admin=True, inherit=False, set=False)]
    r = dict(format='OPS_REVIEWED_REFERENCE_01A', project_ref=P['target'],
             proposal_sha256=m.digest(P), source_native_sha256=P['source']['native_sha256'],
             transitive_closure_reviewed=True, reference_kind='reviewed_pg17_catalog_projection',
             lineage_sha256=m.digest('synthetic lineage'), dependencies=objects,
             direct_family_to_signature=names,
             affected_boundary=[x['id'] for x in objects + P['effects']],
             default_acl_sha256=m.digest('defaults'), protected_sha256=m.digest('protected'),
             approved_incremental_principal=principal, preserved_role_edges=edges,
             nested_invoker_execution_path_reviewed=True, synthetic=True)
    s = dict(format='OPS_TARGET_CATALOG_01A', project_ref=P['target'], truncated=False,
             server_version_num=170011, complete_sections={k: True for k in P['catalog_sections']},
             objects=copy.deepcopy(objects), lineage_sha256=r['lineage_sha256'],
             default_acl_sha256=r['default_acl_sha256'], protected_sha256=r['protected_sha256'],
             principal=copy.deepcopy(principal), role_edges=copy.deepcopy(edges),
             fresh300_single_admin_no_set_edge=False)
    return copy.deepcopy(P), s, r

class MapperTests(unittest.TestCase):
    def test_synthetic_never_authorizes(self):
        out = m.assess(*fixture())
        self.assertEqual(out['status'], 'MAPPED_SYNTHETIC_ONLY')
        self.assertFalse(out['execute']); self.assertFalse(out['activation'])
        self.assertIsNone(out['authorization'])
        self.assertTrue(out['fresh_guard300']['incompatible_principal_bypassrls'])
        self.assertFalse(out['fresh_guard300']['applicable_to_this_additive_slice'])

    def test_negative_families(self):
        def object_change(s, field, value): s['objects'][0][field] = value
        cases = [
            ('target', lambda p,s,r:s.update(project_ref='foreign'), 'WRONG_TARGET'),
            ('missing', lambda p,s,r:s['objects'].pop(), 'DEPENDENCY_MISSING'),
            ('extra', lambda p,s,r:s['objects'].append(dict(id='private.extra',kind='relation',in_affected_boundary=True)), 'EXTRA_UNMAPPED_OBJECT'),
            ('duplicate', lambda p,s,r:s['objects'].append(copy.deepcopy(s['objects'][0])), 'DUPLICATE_OBJECT'),
            ('partial structural projection', lambda p,s,r:(s['objects'][0].pop('columns'),r['dependencies'][0].pop('columns')), 'STRUCTURAL_PROJECTION_INCOMPLETE'),
            ('definition', lambda p,s,r:object_change(s,'definition_sha256','0'*64), 'DEFINITION_OWNER_ACL_OR_EDGE_DRIFT'),
            ('bad digest', lambda p,s,r:object_change(s,'definition_sha256','catalog-md5'), 'INVALID_DEFINITION_IDENTITY'),
            ('owner', lambda p,s,r:object_change(s,'owner','other'), 'DEFINITION_OWNER_ACL_OR_EDGE_DRIFT'),
            ('security', lambda p,s,r:object_change(s,'security','invoker'), 'DEFINITION_OWNER_ACL_OR_EDGE_DRIFT'),
            ('path', lambda p,s,r:object_change(s,'search_path',['public']), 'DEFINITION_OWNER_ACL_OR_EDGE_DRIFT'),
            ('effective grant', lambda p,s,r:object_change(s,'effective_acl',[{'role':'authenticated','execute':True}]), 'DEFINITION_OWNER_ACL_OR_EDGE_DRIFT'),
            ('edge', lambda p,s,r:object_change(s,'dependencies',['missing']), 'DEFINITION_OWNER_ACL_OR_EDGE_DRIFT'),
            ('defaults', lambda p,s,r:s.update(default_acl_sha256='wrong'), 'DEFAULT_ACL_DRIFT_OR_UNKNOWN'),
            ('protected', lambda p,s,r:s.update(protected_sha256='wrong'), 'PROTECTED_STATE_DRIFT_OR_UNKNOWN'),
            ('lineage', lambda p,s,r:s.update(lineage_sha256=None), 'LINEAGE_UNKNOWN_OR_DRIFT'),
            ('send image', lambda p,s,r:r.update(source_native_sha256='reduced-image'), 'SOURCE_IMAGE_OR_LINEAGE_MISMATCH'),
            ('partial', lambda p,s,r:s['complete_sections'].update(triggers=False), 'CATALOG_COVERAGE_UNKNOWN'),
            ('truncated', lambda p,s,r:s.update(truncated=True), 'INCOMPLETE_OR_NON_PG17'),
            ('boolean PG', lambda p,s,r:s.update(server_version_num=True), 'INCOMPLETE_OR_NON_PG17'),
            ('command overload', lambda p,s,r:s['objects'].append(dict(id='customer_api.operations_command_v1(integer)',kind='routine')), 'COMMAND_NAME_COLLISION'),
            ('trigger pair', lambda p,s,r:s['objects'].append(dict(id=P['effects'][4]['id'],kind='trigger')), 'TRIGGER_PAIR_COLLISION'),
            ('mapping', lambda p,s,r:r['direct_family_to_signature'].pop(next(iter(r['direct_family_to_signature']))), 'MISSING_EXTRA_ROUTINE_MAPPING'),
            ('closure', lambda p,s,r:r.update(transitive_closure_reviewed=False), 'TRANSITIVE_CLOSURE_UNKNOWN'),
            ('active proposal', lambda p,s,r:p.update(activation=True), 'UNAUTHORIZED_EFFECT'),
            ('positive grant', lambda p,s,r:p['effects'][0]['intended_effective_acl'].update(authenticated=True), 'ACTIVE_OR_UNKNOWN_NEW_ACL'),
            ('new ledger', lambda p,s,r:p.update(new_role_or_ledger=True), 'UNAUTHORIZED_ROLE_OR_LEDGER'),
            ('principal', lambda p,s,r:s['principal'].update(superuser=True), 'INCREMENTAL_PRINCIPAL_PROFILE_UNPROVEN'),
            ('edge types', lambda p,s,r:s['role_edges'][0].update(set=0), 'ROLE_EDGE_FIELDS_UNKNOWN'),
            ('grantor', lambda p,s,r:s['role_edges'][0].update(grantor='other'), 'ROLE_GRAPH_DRIFT_OR_UNKNOWN'),
            ('invoker', lambda p,s,r:r.update(nested_invoker_execution_path_reviewed=False), 'INVOKER_FACADE_PRIVATE_ACL_UNRESOLVED'),
        ]
        for name, mutate, expected in cases:
            with self.subTest(name=name):
                p,s,r = fixture(); mutate(p,s,r)
                # Re-seal changed proposal: targeted invariant must still reject.
                r['proposal_sha256'] = m.digest(p)
                result = m.assess(p,s,r)
                self.assertEqual(result['status'],'BLOCKED')
                self.assertIn(expected,[x['code'] for x in result['problems']])

    def test_reference_is_not_authentication(self):
        p,s,r = fixture(); r['synthetic'] = False
        self.assertEqual(m.assess(p,s,r)['status'],'SOURCE_CONFORMANCE_ONLY_RUNTIME_HOLD')

    def test_unavailable_snapshot_is_not_match(self):
        p,s,r=fixture(); s['objects']=[]; s['complete_sections']={}
        self.assertEqual(m.assess(p,s,r)['status'],'BLOCKED')

    def test_acl_order_neutral(self):
        p,s,r=fixture()
        acl=[{'grantee':'a','privilege':'SELECT'},{'grantee':'b','privilege':'REFERENCES'}]
        r['dependencies'][0]['acl']=acl
        s['objects'][0]['acl']=list(reversed(acl))
        self.assertEqual(m.assess(p,s,r)['status'],'MAPPED_SYNTHETIC_ONLY')

if __name__ == '__main__': unittest.main(verbosity=2)
