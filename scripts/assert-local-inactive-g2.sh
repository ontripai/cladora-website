#!/usr/bin/env bash
set -euo pipefail
test "${CLADORA_LOCAL_STEP_SU_02_AUTHORIZED:-}" = 1
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_file="$repository_root/supabase/migrations/20261025214155_building_setup_command_receipts_v1.sql"
test "$(sha256sum "$source_file" | cut -d' ' -f1)" = '254e17c9e5f21ce4e50786d3325c2cc84759097b16cb53028602d1e8db5e02e3'
set +e
answer="$(docker exec -i supabase_db_cladora-local psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate < "$source_file" 2>&1)"
status=$?
set -e
if [[ $status -ne 3 || ! "$answer" =~ ERROR:[[:space:]]+55000 ]]; then
 echo 'Inactive G2 guard did not reject with SQLSTATE55000' >&2;exit 1
fi
count="$(docker exec supabase_db_cladora-local psql -U postgres -d postgres -X -A -t -v ON_ERROR_STOP=1 -c "select count(*) from supabase_migrations.schema_migrations where version='20261025214155';")"
test "$count" = 0
echo 'Baseline profile: inactive G2 exact-source guard rejected; no migration-history claim; G2 runtime NOT_INSTALLED_NOT_PROVED'
