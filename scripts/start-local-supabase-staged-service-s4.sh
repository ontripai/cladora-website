#!/usr/bin/env bash
set -euo pipefail

# Local/CI-only replay for the separately authorized SERVICE sequence:
# S3 -> expected S4 rejection -> STEP-SU-02 -> S4.
# This script has no remote target and refuses to run without explicit opt-in.
if [[ "${CLADORA_LOCAL_STEP_SU_02_AUTHORIZED:-}" != "1" ]]; then
  echo "CLADORA_LOCAL_STEP_SU_02_AUTHORIZED=1 is required" >&2
  exit 64
fi

mode="${1:-start}"
if [[ "$mode" != "start" && "$mode" != "reset" ]]; then
  echo "usage: $0 [start|reset]" >&2
  exit 64
fi

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
s4_name="20261018170000_communications_service_role_acl_shutdown_v1.sql"
s4_path="$repository_root/supabase/migrations/$s4_name"
hold_directory="$(mktemp -d)"
held_s4="$hold_directory/$s4_name"
database_container="supabase_db_cladora-local"

restore_s4() {
  if [[ -f "$held_s4" ]]; then
    mv "$held_s4" "$s4_path"
  fi
  rmdir "$hold_directory" 2>/dev/null || true
}
trap restore_s4 EXIT INT TERM

if [[ ! -f "$s4_path" ]]; then
  echo "S4 migration is missing: $s4_path" >&2
  exit 66
fi

mv "$s4_path" "$held_s4"
cd "$repository_root"
if [[ "$mode" == "start" ]]; then
  supabase start
else
  supabase db reset
fi

if ! docker inspect "$database_container" >/dev/null 2>&1; then
  echo "local Supabase database container is unavailable" >&2
  exit 69
fi

set +e
negative_output="$(docker exec -i "$database_container" \
  psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < "$held_s4" 2>&1)"
negative_status=$?
set -e
if [[ $negative_status -eq 0 ]] \
  || [[ "$negative_output" != *"service_subject_link_step_su_02_receipt_missing_or_untrusted"* ]]; then
  echo "S4 did not fail closed before STEP-SU-02" >&2
  echo "$negative_output" >&2
  exit 1
fi
echo "S4 pre-STEP-SU-02 rejection: PASS"

docker exec "$database_container" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 \
  -c "set session authorization supabase_admin; alter table app_private.service_subject_link_step_su_02_receipt_v1 owner to supabase_admin; select app_private.finalize_service_subject_link_role_membership_v1(); reset session authorization;"

receipt_count="$(docker exec "$database_container" psql -U postgres -d postgres -X -A -t \
  -v ON_ERROR_STOP=1 -c "select count(*) from app_private.service_subject_link_step_su_02_receipt_v1 where receipt_key='STEP-SU-02' and finalized_by='supabase_admin' and role_graph_fingerprint='executor>runtime|admin=false|inherit=false|set=true';")"
if [[ "$receipt_count" != "1" ]]; then
  echo "STEP-SU-02 durable receipt read-back failed" >&2
  exit 1
fi
echo "STEP-SU-02 local durable receipt: PASS"

mv "$held_s4" "$s4_path"
supabase migration up --local

remaining_acl="$(docker exec "$database_container" psql -U postgres -d postgres -X -A -t \
  -v ON_ERROR_STOP=1 -c "select count(*) from (values ('communications.private_conversations'::text),('communications.private_participants'),('communications.private_messages'),('communications.private_message_documents')) target(relation_name) cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) privilege_name where has_table_privilege('service_role',relation_name,privilege_name);")"
if [[ "$remaining_acl" != "0" ]]; then
  echo "S4 service_role ACL read-back failed: $remaining_acl effective privileges remain" >&2
  exit 1
fi
echo "S4 local migration and ACL read-back: PASS"
