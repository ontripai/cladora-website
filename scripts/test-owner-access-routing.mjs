import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
const require = createRequire(import.meta.url);
function load(path, mocks) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const mod = new Module(filename);
  mod.require = id => Object.hasOwn(mocks,id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(readFileSync(filename,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop:true } }).outputText,filename);
  return mod.exports;
}
const redirect = path => { throw Object.assign(new Error('redirect'), { path }); };
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  return React.Children.toArray(node.props?.children).map(child=>find(child,predicate)).find(Boolean);
}
let checks=0;
for (const lang of ['ro','en','fa']) for (const platform of [false,true]) {
  for (const mode of ['setup','challenge','satisfied','signed-out']) {
    const assurance = { currentLevel:mode==='satisfied'?'aal2':'aal1',nextLevel:mode==='setup'?'aal1':'aal2' };
    const db = { auth: { getClaims:async()=>({ data:{claims:mode==='signed-out'?null:{sub:'owner'}},error:null }), mfa: { getAuthenticatorAssuranceLevel:async()=>({data:assurance,error:null}) } } };
    const mocks = {
      'next/navigation':{redirect},
      '@/lib/supabase/server':{createClient:async()=>db},
      '@/lib/supabase/env':{isSupabaseConfigured:()=>true},
      '@/types':{isSupportedLocale:x=>['ro','en','fa'].includes(x)},
      '@/lib/auth/post-auth-route':{hasActivePlatformAccess:async()=>platform,getPlatformOverviewRoute:l=>`/${l}/platform/overview`,getCustomerDashboardRoute:l=>`/${l}/app/dashboard`},
      '@/components/auth/MfaChallengeForm':{MfaChallengeForm:()=>null},
      '@/components/auth/AccountSecurityPanel':{AccountSecurityPanel:()=>null},
    };
    for (const setup of [false,true]) {
      const page=load(`src/app/[lang]/mfa/${setup?'setup/':''}page.tsx`,mocks).default;
      let target;
      try { const tree=await page({params:Promise.resolve({lang}),searchParams:Promise.resolve({next:'owner-portfolio'})}); target=find(tree,n=>n.props?.continueTo)?.props.continueTo; }
      catch(e){ if(!e.path)throw e;target=e.path; }
      const expected=mode==='signed-out'?`/${lang}/login?next=owner-portfolio`
        :mode==='satisfied'?`/${lang}/owner-portfolio`
        :setup&&mode==='challenge'?`/${lang}/mfa?next=owner-portfolio`
        :!setup&&mode==='setup'?`/${lang}/mfa/setup?reason=${platform?'platform':'customer'}_required&next=owner-portfolio`
        :`/${lang}/owner-portfolio`;
      assert.equal(target,expected,`${lang}/${platform}/${mode}/${setup}`);checks++;
    }
  }
  for (const destination of [`/${lang}/platform/overview`,`/${lang}/app/dashboard`,`/${lang}/mfa`,`/${lang}/mfa/setup?reason=platform_required`]) {
    let target;
    globalThis.window={location:{assign:p=>{target=p;},replace:p=>{target=p;}}};
    const fakeReact={...React,useState:initial=>[initial,()=>{}]};
    const {LoginForm}=load('src/components/auth/LoginForm.tsx',{
      react:fakeReact,'next/link':()=>null,
      '@/lib/supabase/client':{createClient:()=>({auth:{signInWithPassword:async()=>({error:null}),signOut:async()=>{}}})},
      '@/lib/supabase/env':{isSupabaseConfigured:()=>true},
      '@/components/auth/TurnstileWidget':{TurnstileWidget:()=>null},
      '@/components/brand/CladoraBrand':{CladoraBrand:()=>null},
      '@/lib/auth/post-auth-route':{resolvePostAuthRoute:async()=>destination},
    });
    const tree=LoginForm({lang,captchaRequired:false,ownerPortfolioRequested:true});
    await find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});
    assert.equal(target,destination.includes('/mfa')?`${destination}${destination.includes('?')?'&':'?'}next=owner-portfolio`:`/${lang}/owner-portfolio`);
    checks++;
  }
}
// An explicit navigation intent is not an authorization grant.
for (const lang of ['ro','en','fa']) for (const access of [false, true, 'error']) {
  const Panel=()=>null;
  const db={auth:{getClaims:async()=>({data:{claims:{sub:'owner'}}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})}},schema:()=>({rpc:async()=>({data:access===true,error:access==='error'?new Error('denied'):null})})};
  const page=load('src/app/[lang]/owner-portfolio/page.tsx',{
    'next/navigation':{redirect},'@/lib/supabase/server':{createClient:async()=>db},
    '@/types':{isSupportedLocale:x=>['ro','en','fa'].includes(x)},
    '@/components/owner/OwnerPortfolioPanel':{OwnerPortfolioPanel:Panel},
  }).default;
  const result=await page({params:Promise.resolve({lang})});
  assert.equal(result.type===Panel,access===true,'Only a successful owner access check renders the portfolio');checks++;
}
console.log(`PASS ${checks} owner login/MFA continuation scenarios across RO/EN/FA and platform/customer identities`);
