# DB-HIST-01 forward convergence rollout

Migration version `20260913132945` is a new forward-only migration with SHA-256 `fdff99135db6cba70ff480552aff1e8e24516d79c31b50ee9394293c977d0602`. This backdated version is intentionally ordered immediately after the existing `20260913132944` history entry so a fresh bootstrap reaches the same final state as an environment whose product history is already complete.

Merging the migration into the repository does not authorize applying it to any Remote environment. Remote application requires separate, independent Remote authorization bound to the exact migration version, filename, hash, project, database target, and environment classification. The preflight must fail closed if the new version is already present, the product-history baseline has changed, the target cannot be proven, or the reviewed hash differs.

Applying this version is a new forward migration. It is not migration repair or replay, does not replace or edit an existing history row, and does not authorize any historical statement to run again. The four private PM control-plane entries and the eleven recorded historical hash exceptions remain separate from this rollout.

Before an authorized application, preserve a rollback boundary at the unchanged Remote state and record the live inventory and catalog/security fingerprints. After application, validate that the new version is recorded exactly once, the expected fingerprints converge, object and permission differences are zero, and the existing application and concurrency suites have no new failures. If validation fails after the transaction boundary, stop further rollout and use a separately reviewed forward correction; do not delete or rewrite migration history.
