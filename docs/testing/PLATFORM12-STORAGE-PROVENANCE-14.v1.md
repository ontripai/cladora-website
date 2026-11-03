# PLATFORM12-STORAGE-PROVENANCE-14 — addendum v1

Parent: `50d4f6f41f08d93a2d158051377e388be6fe6322`.
Branch: `codex/program-local-runtime-lane-01`.
Scope: read-only image/package/release metadata and static Documents ABI impact.

**Conclusion: different version identifiers; no pin mismatch was observed.**
`v1.82.1` identifies the Docker/service release. The root npm manifest belongs to
`supa-storage` and says `1.11.2`. That exact manifest is present in the official
v1.82.1 source commit, byte-for-byte; it is not evidence that the running image
silently changed to a different release. It is not the Storage client SDK version.
This is a metadata clarification; none of the five sealed files was edited.

## Identity chain actually checked

| Layer | Observed value and reference |
| --- | --- |
| Repository profile service release | `versions.storage = v1.82.1` |
| Approved amd64 image manifest | `sha256:31c11d93a3c7840f97acba43f6df9894028dc85dd9c0781d23427e2009be5b76` |
| Local running image/config ID | `sha256:ed2afc0194b24a697cfa9b245c60d5fd0b41a9ba5a255083418cd643577098a3` |
| Platform | Registry `linux/amd64`, local image `linux/amd64`, Node `x64` |
| Image and container VERSION | `1.82.1`; only this public version field was selected |
| Static package | `/app/package.json`, realpath identical, name `supa-storage`, version `1.11.2` |
| Package bytes | 9725; SHA256 `f80f12401fcb54ad481a8a86a01faa564f87272f7ca17cebcca1d77d28b97cfd` |
| Package Git identity | `00d0524b59a13049dae0491022232e94b59a3089`, exactly the official release file |
| Lock root | `/app/package-lock.json`: name `supa-storage`, version `1.11.2`, lockfileVersion2 |
| Lock Git identity | `aa5e2c6f1d5b5d7bf08f715ad771c9180982099c`, matching the official release tree |
| Lock bytes/hash | 992577; SHA256 `5e49d802934c5565dad1e65d1c034a2770100246eb8f219c6a0aabad147d33fa` |
| Entrypoint | Working directory `/app`, `node dist/start/server.js` |
| Runtime engine metadata | Node `v24.21.0` inside Storage, distinct from the host toolchain |

The official Docker Hub tag `supabase/storage-api:v1.82.1` was read as manifest
metadata, without pull: its linux/amd64 descriptor is exactly the approved
31c11d… digest. The raw OCI manifest SHA256 was independently recomputed and
matched; its `config.digest` is exactly the local ed2afc… image ID. Manifest and
image/config IDs are different object kinds, not conflicting digests. The tag
observation is time-specific; the immutable digest remains the identity pin.

## Exact official source and release mechanism

Official release:
https://github.com/supabase/storage/releases/tag/v1.82.1

Release metadata ID412642582, tag v1.82.1, published
2026-10-14T15:01:33+03:30. It is not marked immutable. The official Git tag resolves
to **a3a588586b937a24d1a5a4f2a0197cca78990469**; `target_commitish=master` alone was
not used as source proof.

Every source link below is pinned to that full commit:

- [package.json](https://github.com/supabase/storage/blob/a3a588586b937a24d1a5a4f2a0197cca78990469/package.json): same root manifest/version and Git identity as the running image.
- [.releaserc](https://github.com/supabase/storage/blob/a3a588586b937a24d1a5a4f2a0197cca78990469/.releaserc): semantic release prepares docs with `VERSION=nextRelease.version`; its listed plugins do not include the npm package-version publisher.
- [release workflow](https://github.com/supabase/storage/blob/a3a588586b937a24d1a5a4f2a0197cca78990469/.github/workflows/release.yml): publishes `v<new_release_version>` image tags, amd64/arm64, and passes `VERSION=<new_release_version>` as a build argument.
- [Dockerfile](https://github.com/supabase/storage/blob/a3a588586b937a24d1a5a4f2a0197cca78990469/Dockerfile): copies package/lock without replacing their version, declares final `ARG VERSION`/`ENV VERSION=$VERSION`, and starts the observed server path.
- [src/config.ts](https://github.com/supabase/storage/blob/a3a588586b937a24d1a5a4f2a0197cca78990469/src/config.ts#L397): application version reads VERSION, with0.0.0 fallback, not package.json.version.

No source/package import or config getter was executed. Existing-container Node
ran only core fs/crypto metadata readers. Read-only root and absence of an /app
mount override were checked. Five distributed source-map embedded files matched
the exact official source bytes/Git identity: config, createObject, getObjectInfo,
getObject and InfoRenderer. Hashes and source URLs are in the JSON companion.

These checks establish the observed release/package mechanism and selected source
identity. The image has no OCI version/revision/source labels. A signed whole-image
source/build attestation or reproducible rebuild was not verified: **UNKNOWN**.
The source-map match is not silently promoted to that stronger proof.

## Effect on Documents ABI

The pinned consumer considered is Documents11
`e38b0d39dbb840a508b5e1d47e9d93d3060c6411`,
`src/lib/customer/documents-storage-readback-v1.ts` (Git
`3e4f4fa01f826ef451f14f6e48f6e83e47f375a6`). Its prior independent tests are
consumed, not rerun. Its client SDK version is a separate dependency identity;
root service package1.11.2 must not replace that client pin.

| Required operation | Pinned release source evidence | Boundary still open |
| --- | --- | --- |
| New upload without upsert | createObject.ts: relative POST `/:bucketName/*`; `x-upsert === true` selects upsert; response sends `Id` and `Key` | Source schema requires Key but does not require Id; consumer correctly rejects missing/invalid upload ID. Actual ACK/duplicate/UNKNOWN behavior NOT_RUN here. |
| info before and after | getObjectInfo.ts authenticated info routes; InfoRenderer supplies id/name/version/bucket_id/size/content_type/etag | Client must preserve the required mapping to bucketId/contentType. Actual SDK-to-running-route mapping and current RLS/intent access NOT_RUN. |
| Private full download | getObject.ts authenticated route reads private objects through the scoped storage path and returns asset bytes | No object/bucket/readback was requested; real data/hash/MIME/size and post-wait current authority remain unproved. |
| Generation/ETag | InfoRenderer exposes version and nullable ETag; consumer explicitly represents not_exposed | Version/ETag remain conditional capabilities, not non-overwrite/custody or canonical download authority. |

Relevant object-router and renderer source-map identities match the official
release. This establishes static API source presence, not connected ABI acceptance.
Raw info response uses snake_case; the consumer expects its client representation.
No full SDK package was inferred from a manifest-only/private materialization stub.
No route request, SQL, Auth, bucket creation, upload or scan ran in this task.

The version-label discrepancy therefore does **not** require an image replacement,
package edit, dependency downgrade, relaxed guard or permission change. Keep the
approved digest. Before functional acceptance, Documents/Core/Platform still need
the accepted install/intent/RLS/limited-client binding, actual UUID/info/bytes
readback, non-overwrite verification and actual scanner evidence. Unknowns remain
UNKNOWN; this addendum does not block independent Core15 development.

## Preservation, limitations and automation

Storage CID/image/start timestamp stayed unchanged; all five sealed task12 files
remain byte-identical. No stack/volume/config/privilege mutation. Native restore13
receipt SHA256 remains
`9273d0da59e70b8b73ccd6c0d144a9228aeb8018121804c54ad6f5476c91b74d`.
No pull, image switch, bootstrap/users/restore/health replay, SQL/Auth, grant,
scanner, install, CI or deployment command was executed. No credential/env dump
or application-module import. A nil-label formatter was corrected and a connector
schema mistake was resolved with the official tag-ref endpoint; neither was an
access denial, data mutation or bypass. Raw metadata/public upstream source copies
are retained privately; Git receives only this addendum and safe metadata JSON.

No test suite was rerun: metadata hashes, registry linkage, official Git identities
and byte comparisons are the actual checks. They are not functional app tests.

قابل خودکارسازی: **نیازمند بررسی**. Input: exact image digest/platform and official
release/package metadata. Automatable: compare digest→config→package/source-map
identities while distinguishing version namespaces. Human decision: Platform/
Documents/coordinator accept ABI evidence and any future image change. Conditions:
read-only scope and exact official refs; unknown attestation/ABI is not success.
Exception owner: Platform/coordinator. Dependency: official Storage release and
Documents exact consumer contract. Value: prevent wrong upgrades and false ABI
claims; estimate UNKNOWN. No automation engine or parallel Tracker was created.
