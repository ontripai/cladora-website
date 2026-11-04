import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { coreServiceAppReadV1 } from '@/lib/core/service-app-read-v1';

const HEADERS = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Vary: 'Cookie' };

export async function GET(request: NextRequest) {
  // In approved Core assembly profile, consume Context selections from Core's official bootstrap
  if (process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE === 'core-service-real-app-assembly.v1') {
    const bootstrapRes = await coreServiceAppReadV1(request, 'selections');
    if (!bootstrapRes) {
      return NextResponse.json({ error: { code: 'CORE_SERVICE_ASSEMBLY_NOT_READY' } }, { status: 503, headers: HEADERS });
    }
    if (!bootstrapRes.ok) {
      return bootstrapRes;
    }
    const body = (await bootstrapRes.json()) as {
      selections?: Array<{
        context_id: string;
        membership_id: string;
        tenant_name: string;
        role_code: string;
        role_name: string;
      }>;
    };
    const seen = new Set<string>();
    const contexts = [];
    for (const s of body.selections ?? []) {
      if (!seen.has(s.context_id)) {
        seen.add(s.context_id);
        contexts.push({
          context_id: s.context_id,
          membership_id: s.membership_id,
          tenant_name: s.tenant_name,
          role_code: s.role_code,
          role_name: s.role_name,
          scope_type: 'tenant',
          context_label: s.tenant_name,
        });
      }
    }
    return NextResponse.json({ contexts }, { headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims?.sub) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401, headers: HEADERS });

  // Customer API Gateway: delegates to platform.list_my_customer_contexts
  const { data, error: queryError } = await supabase.schema('customer_api').rpc('list_contexts_v1');
  if (queryError) return NextResponse.json({ error: { code: 'CONTEXT_QUERY_FAILED' } }, { status: 500, headers: HEADERS });
  // Setup reviewers use their dedicated, time-limited review flow, not a customer dashboard.
  const contexts = (data ?? []).filter(context => context.role_code !== 'building_setup_reviewer');
  return NextResponse.json({ contexts }, { headers: HEADERS });
}
