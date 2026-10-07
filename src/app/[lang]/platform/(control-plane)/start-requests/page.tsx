import { redirect } from 'next/navigation';
import { getPlatformAuthContext, hasPlatformRole } from '@/lib/platform/auth';
import { createClient } from '@/lib/supabase/server';
import { StartRequestsPanel, type StartRequest, type SalesOperator } from '@/components/platform/StartRequestsPanel';

export const dynamic = 'force-dynamic';

function currentSalesIds(assignments: { platform_user_id: string; valid_from: string; valid_until: string | null }[]) {
  const now = Date.now();
  return new Set(assignments.filter(a => new Date(a.valid_from).getTime() <= now && (!a.valid_until || new Date(a.valid_until).getTime() > now)).map(a => a.platform_user_id));
}

export default async function StartRequestsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const auth = await getPlatformAuthContext();
  if (!hasPlatformRole(auth,['PLATFORM_SUPER_ADMIN','PLATFORM_OPERATIONS','PLATFORM_SALES'])) redirect(`/${lang}/platform/overview`);
  const manager = hasPlatformRole(auth,['PLATFORM_SUPER_ADMIN','PLATFORM_OPERATIONS']);
  const db = await createClient();
  const { data, error } = await db.schema('customer_api').rpc('list_start_requests_v1', { p_limit: 100 });
  let sales: SalesOperator[] = [];
  if (manager) {
    const [users, assignments] = await Promise.all([
      db.schema('customer_api').from('platform_users_v1').select('id,display_name,status,deactivated_at').eq('status','active').is('deactivated_at',null),
      db.schema('customer_api').from('platform_role_assignments_v1').select('platform_user_id,role,status,valid_from,valid_until').eq('role','PLATFORM_SALES').eq('status','active'),
    ]);
    if (users.error || assignments.error) throw users.error ?? assignments.error;
    const ids = currentSalesIds(assignments.data ?? []);
    sales = (users.data ?? []).filter(u => ids.has(u.id)).map(u => ({ id:u.id, display_name:u.display_name }));
  }
  if (error) throw error;
  return <StartRequestsPanel lang={lang} requests={data as unknown as StartRequest[]} sales={sales} manager={manager} />;
}
