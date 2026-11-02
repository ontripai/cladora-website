"""Typed consumer admission. No executable consumer is admitted by this source.

Only coordinator-reviewed, code-pinned records can grant admission. Neither JSON
nor environment nor a supplied import/command/SQL string can extend this registry.
"""
from dataclasses import dataclass
import hashlib
import json
import re
from types import MappingProxyType
from pathlib import Path

MAX_REQUEST_BYTES = 32768
STAGE = 'after-health-before-cleanup'
EFFECTS = ('fixture_catalog_read', 'fixture_synthetic_privilege_witness')
# Intentionally unbound pending Core ACL-PROJECTION-02 delivery AND review.
REVIEW_REGISTRY = Path(__file__).resolve().parents[1] / 'supabase/local-profiles/runtime-consumer-reviews-v1.json'
CODE_ADAPTERS = MappingProxyType({})


class AdmissionError(ValueError):
    pass


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def exact_keys(value, keys):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise AdmissionError('REQUEST_SHAPE')


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise AdmissionError('DUPLICATE_KEY')
        result[key] = value
    return result


@dataclass(frozen=True)
class Admission:
    request_sha256: str
    review_id: str
    consumer_id: str
    source_commit: str
    adapter_id: str
    runner_sha256: str
    profile_sha256: str
    payloads: tuple
    effects: tuple
    review_record_sha256: str


@dataclass(frozen=True)
class Fixture:
    run_id: str
    pg_cid: str
    auth_cid: str
    # No caller-provided URL, credentials, general Lane.cmd, SQL or shell.


def reviewed_records():
    # Fixed repository data path, never request/env-selected. Records are reviewed
    # separately from executable source to avoid a request/source self-hash cycle.
    try:
        value = json.loads(REVIEW_REGISTRY.read_bytes(), object_pairs_hook=unique_object)
        exact_keys(value, ('format', 'reviews'))
        if value['format'] != 'cladora-curated-consumer-reviews-v1' or not isinstance(value['reviews'], dict):
            raise AdmissionError('REVIEW_REGISTRY_SHAPE')
        return value['reviews']
    except OSError as error:
        raise AdmissionError('REVIEW_REGISTRY_UNAVAILABLE') from error


def admit(raw, binding, *, reviews=None, adapters=CODE_ADAPTERS):
    if not isinstance(raw, bytes) or len(raw) > MAX_REQUEST_BYTES:
        raise AdmissionError('REQUEST_BOUND')
    try:
        request = json.loads(raw, object_pairs_hook=unique_object)
    except (UnicodeError, json.JSONDecodeError) as error:
        raise AdmissionError('REQUEST_JSON') from error
    exact_keys(request, ('format', 'consumer_id', 'source_commit', 'stage', 'target',
                         'adapter_id', 'runner_sha256', 'profile_sha256', 'effects', 'payloads'))
    if (request['format'] != 'cladora-local-consumer-v1'
            or request['consumer_id'] != 'Core/ACL-PROJECTION-02'
            or request['stage'] != STAGE or request['target'] != 'owned-disposable-pg17-auth'
            or request['adapter_id'] != 'core-acl-projection-v1'):
        raise AdmissionError('REQUEST_SCOPE')
    if not isinstance(request['source_commit'], str) or not re.fullmatch('[0-9a-f]{40}', request['source_commit']):
        raise AdmissionError('SOURCE_PIN')
    for field in ('runner_sha256', 'profile_sha256'):
        if request[field] != binding.get(field) or not re.fullmatch('[0-9a-f]{64}', str(request[field])):
            raise AdmissionError('BINDING_' + field)
    if request['effects'] != list(EFFECTS):
        raise AdmissionError('EFFECT_SCOPE')
    payloads = request['payloads']
    if not isinstance(payloads, list) or not 1 <= len(payloads) <= 8:
        raise AdmissionError('PAYLOAD_BOUND')
    identities = []
    for payload in payloads:
        exact_keys(payload, ('id', 'sha256', 'bytes'))
        if (not isinstance(payload['id'], str) or not re.fullmatch('[a-z][a-z0-9_-]{0,63}', payload['id'])
                or not re.fullmatch('[0-9a-f]{64}', str(payload['sha256']))
                or type(payload['bytes']) is not int or not 0 < payload['bytes'] <= 1048576):
            raise AdmissionError('PAYLOAD_PIN')
        identities.append((payload['id'], payload['sha256'], payload['bytes']))
    if len({p[0] for p in identities}) != len(identities):
        raise AdmissionError('PAYLOAD_DUPLICATE')
    request_hash = digest(raw)
    reviews = reviewed_records() if reviews is None else reviews
    review = reviews.get(request_hash)
    if review is None:
        raise AdmissionError('HOLD_NO_COORDINATOR_REVIEW')
    # Independent reviewed record, never request.approved or a nonempty ID alone.
    if (review.get('reviewer') != 'coordinator'
            or not re.fullmatch(r'https://github.com/ontripai/cladora-website/issues/463#issuecomment-[0-9]+', str(review.get('review_id')))
            or review.get('consumer_id') != request['consumer_id']
            or review.get('source_commit') != request['source_commit']
            or review.get('effects') != list(EFFECTS)
            or review.get('payloads') != [list(x) for x in identities]
            or review.get('runner_sha256') != request['runner_sha256']
            or review.get('profile_sha256') != request['profile_sha256']):
        raise AdmissionError('REVIEW_BINDING')
    adapter = adapters.get(request['adapter_id'])
    if adapter is None or adapter['source_commit'] != request['source_commit']:
        raise AdmissionError('HOLD_NO_PINNED_ADAPTER')
    # A reviewed adapter contains immutable payload BYTES in code/source, not paths
    # or SQL supplied by the request. Verify their actual hashes/lengths now.
    actual = adapter['payload_bytes']
    if set(actual) != {p[0] for p in identities}:
        raise AdmissionError('ADAPTER_PAYLOAD_SET')
    for identity, sha, size in identities:
        data = actual[identity]
        if not isinstance(data, bytes) or len(data) != size or digest(data) != sha:
            raise AdmissionError('ADAPTER_PAYLOAD_BYTES')
    return Admission(request_hash, review['review_id'], request['consumer_id'], request['source_commit'],
                     request['adapter_id'], request['runner_sha256'], request['profile_sha256'],
                     tuple(identities), tuple(EFFECTS), digest(json.dumps(review, sort_keys=True, separators=(',', ':')).encode()))


def dispatch(admission, raw, binding, fixture):
    # Re-admit exact bytes against production code registry immediately at effect.
    current = admit(raw, binding)
    if admission != current or not isinstance(fixture, Fixture):
        raise AdmissionError('EFFECT_BINDING')
    if (not re.fullmatch('cladora-lane-[0-9a-f]{12}', fixture.run_id)
            or not re.fullmatch('[0-9a-f]{64}', fixture.pg_cid)
            or not re.fullmatch('[0-9a-f]{64}', fixture.auth_cid)
            or fixture.pg_cid == fixture.auth_cid):
        raise AdmissionError('FIXTURE_CUSTODY')
    # Registry has no implementation until exact Core bytes/source review arrive.
    return CODE_ADAPTERS[current.adapter_id]['run'](current, fixture)
