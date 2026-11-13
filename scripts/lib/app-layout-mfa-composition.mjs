// Controlled Auth/redirect transport around the actual server layout; no hosted Auth claim.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const file = fileURLToPath(new URL('../../src/app/[lang]/app/layout.tsx', import.meta.url));
const Shell = () => null;
class Redirect extends Error { constructor(url) { super(url); this.url = url; } }
function layout(source, state, calls) {
  const mod = new Module(file);
  const client = { auth: {
    getClaims: async () => ({ data: { claims: state.authenticated ? { sub: 'controlled-actor' } : null }, error: null }),
    mfa: {
      listFactors: async () => ({ data: { totp: state.factor ? [{ status: 'verified' }] : [] }, error: state.factorError }),
      getAuthenticatorAssuranceLevel: async () => { calls.assurance++; return { data: { currentLevel: state.aal }, error: state.assuranceError }; },
    },
  }, schema: name => {
    assert.equal(name, 'customer_api');
    return { rpc: async name => { assert.equal(name, 'my_mfa_requirement_v1'); calls.rpc++; return { data: state.required, error: state.requirementError }; } };
  } };
  const mocks = {
    'next/navigation': { redirect: url => { throw new Redirect(url); } },
    '@/types': { isSupportedLocale: lang => ['en', 'ro', 'fa'].includes(lang) },
    '@/components/customer/CustomerAppShell': { CustomerAppShell: Shell },
    '@/lib/supabase/env': { isSupabaseConfigured: () => true },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/app/guide-platform-provider-v1': { isGuideNativeEntrySelectedV1: () => state.guide },
    '@/lib/auth/post-auth-route': { isCoreServiceAssemblyProfile: () => state.service },
  };
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : id === 'react/jsx-runtime' ? require(id) : (() => { throw new Error(`Unexpected layout dependency: ${id}`); })();
  mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
  return mod.exports.default;
}
async function verify(source) {
  let cases = 0;
  async function run(changes, expected, { rpc, assurance }) {
    const state = { authenticated: true, factor: true, aal: 'aal2', required: true, service: false, guide: false, ...changes };
    const calls = { rpc: 0, assurance: 0 };
    let answer;
    try { answer = await layout(source, state, calls)({ params: Promise.resolve({ lang: 'en' }), children: 'protected-child' }); }
    catch (error) { if (!(error instanceof Redirect)) throw error; answer = error.url; }
    if (typeof expected === 'string') assert.equal(answer, expected);
    else {
      assert.equal(answer.type, Shell);
      assert.equal(answer.props.children, 'protected-child');
      assert.equal(answer.props.lang, 'en');
      assert.equal(answer.props.guideNativeSelected, state.guide);
    }
    assert.deepEqual(calls, { rpc, assurance }); cases++;
  }
  await run({ authenticated: false }, '/en/login', { rpc: 0, assurance: 0 });
  await run({ factorError: new Error('controlled') }, '/en/login?reason=security', { rpc: 0, assurance: 0 });
  for (const mode of [{}, { service: true }, { guide: true }]) {
    const native = !!(mode.service || mode.guide), next = mode.guide ? '&next=app%2Fexperience%2Fguides' : '';
    await run({ ...mode, factor: false }, `/en/mfa/setup?reason=customer_required${next}`, { rpc: native ? 0 : 1, assurance: 0 });
    await run({ ...mode, aal: 'aal1' }, `/en/mfa${mode.guide ? '?next=app%2Fexperience%2Fguides' : ''}`, { rpc: native ? 0 : 1, assurance: 1 });
    await run({ ...mode, assuranceError: new Error('controlled') }, '/en/login?reason=security', { rpc: native ? 0 : 1, assurance: 1 });
    await run(mode, null, { rpc: native ? 0 : 1, assurance: 1 });
  }
  await run({ required: false, factor: false }, null, { rpc: 1, assurance: 0 });
  await run({ requirementError: new Error('controlled') }, '/en/login?reason=security', { rpc: 1, assurance: 0 });
  return cases;
}
export async function verifyAppLayoutMfaComposition() {
  const source = readFileSync(file, 'utf8'), cases = await verify(source);
  const mutations = [
    ['native factor gate removed', 'if (!hasVerifiedFactor)', 'if (false)'],
    ['legacy factor gate removed', 'if (mfaRequired && !hasVerifiedFactor)', 'if (false)'],
    ['AAL2 gate removed', "assurance.currentLevel !== 'aal2'", 'false'],
    ['Guide return lost', "guideNativeSelected?'&next=app%2Fexperience%2Fguides':''", "''"],
    ['shell Guide selection lost', 'guideNativeSelected={isGuideNativeEntrySelectedV1()}', 'guideNativeSelected={false}'],
  ];
  for (const [name, before, after] of mutations) {
    assert.ok(source.includes(before), name);
    await assert.rejects(() => verify(source.replaceAll(before, after)), undefined, name);
  }
  return { cases, negative: mutations.length, setupRequired: true, authorizedShell: true };
}
