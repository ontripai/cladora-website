import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createApplicationTestModuleLoader } from './load-application-test-module.mjs';

const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const loadServerModule = createApplicationTestModuleLoader({ server: true });

// Actual server handlers with only a modeled identity boundary. No connection,
// SQL, native Auth or successful command is supplied by this negative check.
export async function assertCeGuideInactiveRuntime(load = loadServerModule) {
  const runtime = load(new URL('../../src/lib/community/experience-guide-functional-http-v1.ts', import.meta.url));
  assert.deepEqual(runtime.ce012FunctionalDependenciesV1, { role_bound_pool: null });
  const scope = { context_id: id(1), workspace_id: id(2) };
  for (const authenticated of [false, true]) {
    const handlers = runtime.createCe012FunctionalHandlersV1({
      ...runtime.ce012FunctionalDependenciesV1,
      authenticate: async () => authenticated ? {
        source: 'supabase_verified_session', actor_id: id(3), assurance_level: 'aal2', expires_at: 4070908800,
      } : null,
    });
    const requests = [
      ['GET', new NextRequest(`https://cladora.test/api/customer/v1/experience/guides/draft?${new URLSearchParams(scope)}`)],
      ['POST', new NextRequest('https://cladora.test/api/customer/v1/experience/guides/draft', {
        method: 'POST', headers: { origin: 'https://cladora.test', 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'prepare', ...scope, guide_id: id(4), expected_guide_version: 1,
          command_id: id(5), idempotency_key: 'inactive-guide-proof-01', title: 'Guide',
          step_title: 'Step', instructions: 'Synthetic instructions' }),
      })],
    ];
    for (const [method, request] of requests) {
      const response = await handlers[method](request);
      assert.equal(response.status, authenticated ? 503 : 401);
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.deepEqual(await response.json(), {
        error: { code: authenticated ? 'CE_GUIDE_CONNECTION_NOT_READY' : 'UNAUTHORIZED' },
      });
    }
  }
}
