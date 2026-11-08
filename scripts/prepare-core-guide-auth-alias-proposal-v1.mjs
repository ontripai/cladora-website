/** Proposal only: never writes the product file or connects to a backend. */
import {readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';
import{tmpdir}from'node:os';
import{resolve,join}from'node:path';
import{fileURLToPath}from'node:url';
import{execFileSync}from'node:child_process';
import{createHash}from'node:crypto';
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const PATH='src/lib/core/platform-role-bound-pool-v1.ts';
export const BEFORE='3abeca26ee87ad647ed7af74eaababff9d2308ccc52b1543a2569e29d51ab128';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export function candidate(source=readFileSync(resolve(ROOT,PATH),'utf8')){
 if(sha(source)!==BEFORE)throw Error('GUIDE_ALIAS_PREIMAGE_MISMATCH');
 const declaration=`
// Guide-only proposal: legacy aliases must not shadow its verified plural carrier.
const ceGuideLegacySessionClearSql = \`select
  pg_catalog.set_config('request.jwt.claim','',false),
  pg_catalog.set_config('request.jwt.claim.email','',false)\`;
const ceGuideLegacyTransactionClearSql = \`select
  pg_catalog.set_config('request.jwt.claim','',true),
  pg_catalog.set_config('request.jwt.claim.email','',true)\`;
`;
 const anchor='type FixedRoleBoundProfileV1<Contract extends string>';
 if(source.split(anchor).length!==2)throw Error('GUIDE_ALIAS_ANCHOR_MISMATCH');
 let after=source.replace(anchor,()=>declaration+'\n'+anchor);
 const clean='  await assertRuntimeIdentity(client, profile);\n}';
 if(after.split(clean).length!==2)throw Error('GUIDE_ALIAS_CLEAN_MISMATCH');
 after=after.replace(clean,()=>`  await assertRuntimeIdentity(client, profile);
  if (profile.contract_version === corePlatformRoleBoundPoolContractV1) {
    // RESET ALL can reinstate database/role defaults; blank AFTER it, not before.
    await client.query(ceGuideLegacySessionClearSql);
  }
}`);
 const begin='            await assertExecutorIdentity(client, profile);\n            await assertSafety(client, profile, true);';
 if(after.split(begin).length!==2)throw Error('GUIDE_ALIAS_BEGIN_MISMATCH');
 after=after.replace(begin,()=>`            await assertExecutorIdentity(client, profile);
            if (profile.contract_version === corePlatformRoleBoundPoolContractV1) {
              await client.query(ceGuideLegacyTransactionClearSql);
            }
            await assertSafety(client, profile, true);`);
 return after;
}
export function patch(){
 const temp=mkdtempSync(join(tmpdir(),'core-guide-alias-proposal-'));
 try{
  const before=join(temp,'before'),after=join(temp,'after');writeFileSync(before,readFileSync(resolve(ROOT,PATH)));writeFileSync(after,candidate());
  let output;try{output=execFileSync('git',['diff','--no-index','--',before,after],{encoding:'utf8'});}catch(e){if(e.status!==1)throw e;output=e.stdout;}
  return output.split('\n').map(line=>line===' '?'':line.startsWith('diff --git ')?`diff --git a/${PATH} b/${PATH}`:line.startsWith('--- ')?`--- a/${PATH}`:line.startsWith('+++ ')?`+++ b/${PATH}`:line).join('\n');
 }finally{rmSync(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const output=patch(),file=resolve(ROOT,'docs/core/domain-ports-01/unit05-auth-scope-11/successor-proposal.patch');
 if(process.argv.includes('--check')){if(readFileSync(file,'utf8')!==output)throw Error('GUIDE_ALIAS_PROPOSAL_DRIFT');}
 else writeFileSync(file,output);
 console.log(JSON.stringify({state:'PROPOSED_NOT_APPLIED',preimage:BEFORE,candidate_sha256:sha(candidate()),product_file_changed:false}));
}
