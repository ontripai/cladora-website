import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20260929172509_property_scoped_property_manager_invitations_v1.sql';
assert.ok(fs.existsSync(migrationPath), 'Property manager invitation migration exists');
const sql = fs.readFileSync(migrationPath, 'utf8');
assert.match(sql, /^begin;/m, 'Migration is transactional');
assert.match(sql, /^commit;/m, 'Migration commits');
assert.match(sql, /create table communications\.property_manager_invitations/i, 'Invitation records are stored separately');
assert.match(sql, /enable row level security/i, 'Invitation table has RLS enabled');
assert.match(sql, /revoke all on communications\.property_manager_invitations from public,anon,authenticated/i, 'Clients cannot access invitation rows directly');
assert.match(sql, /status text not null default 'pending' check \(status in \('pending','accepted','revoked','expired'\)\)/i, 'Invitation lifecycle is constrained');
assert.match(sql, /default \(statement_timestamp\(\)\+interval '72 hours'\)/i, 'Invitations expire after 72 hours');
assert.match(sql, /coalesce\(auth\.jwt\(\)->>'aal','aal1'\)='aal2'/i, 'Invitation management requires MFA');
assert.match(sql, /c\.workspace_id=w\.id/i, 'Authorization binds the selected workspace to the supplied context');
assert.match(sql, /lower\(c\.role_code\) in \('association_admin','property_manager'\)/i, 'Only authorized workspace roles can invite managers');
assert.match(sql, /c\.scope_type='property' and c\.property_id=p_property/i, 'Property managers are restricted to their own property');
assert.match(sql, /c\.scope_type='building' and exists/i, 'Building managers can invite only within their building property');
assert.match(sql, /p\.status='active'/i, 'Inactive properties cannot receive invitations');
assert.match(sql, /email_confirmed_at is not null/i, 'Only verified matching email addresses can claim invitations');
assert.match(sql, /i\.normalized_email<>v_email/i, 'Invitations cannot be claimed by another email address');
assert.match(sql, /identity\.memberships\.status='invited'/i, 'An existing active manager membership lifetime is never extended');
assert.match(sql, /insert into identity\.memberships\(tenant_id,user_id,role_id,status,starts_at,ends_at\)/i, 'New manager membership lifetime is bounded by its access basis');
assert.match(sql, /v_access_expires:=least\(v_access_expires,v_membership\.ends_at\)/i, 'An existing manager membership cannot receive a longer property grant');
assert.match(sql, /or ends_at>v_access_expires/i, 'An existing property grant is shortened to the inviter and binding lifetime');
assert.match(sql, /if i\.status='accepted' then[\s\S]*?return jsonb_build_object\('membership_id',i\.accepted_membership_id[\s\S]*?if i\.status<>'pending' or i\.expires_at<=statement_timestamp\(\)/i, 'Accepted retries are idempotent while expired pending invitations are rejected');
assert.match(sql, /'property',i\.property_id/i, 'Acceptance grants only the invited property scope');
assert.doesNotMatch(sql, /scope_type='tenant'.{0,100}property_manager/i, 'Acceptance never grants tenant-wide manager scope');
assert.match(sql, /can_manage_property_manager_invites\(i\.invited_by,i\.inviter_context_id/i, 'Inviter authorization is rechecked at claim time');
assert.match(sql, /audit\.events/i, 'Create, revoke and claim operations are audited');
for (const fn of [
  'list_invitable_manager_properties_v1', 'create_property_manager_invitation_v1',
  'list_managed_property_manager_invitations_v1', 'revoke_property_manager_invitation_v1',
  'list_my_property_manager_invitations_v1', 'claim_property_manager_invitation_v1',
]) {
  assert.match(sql, new RegExp(`function customer_api\\.${fn}`, 'i'), `${fn} is exposed through customer_api`);
  assert.match(sql, new RegExp(`grant execute on function customer_api\\.[\\s\\S]*?${fn}`, 'i'), `${fn} is executable by authenticated users`);
}
console.log('Property manager invitation security contract passed.');
