/** Reconstruct exactly one source-only rollback capsule, no SQL/connection/runner. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export function composeStoreProofV1(store,proof){
 const marker='-- CORE_S01_PROOF_INSERTION_POINT\n';
 assert.equal(store.split(marker).length,2,'exact single insertion boundary');
 assert.ok(store.endsWith('ROLLBACK;\n'));
 assert.ok(!/\b(?:BEGIN|COMMIT|ROLLBACK)\s*;/.test(proof),'fixture must not own transaction');
 const value=store.replace(marker,marker+proof+'\n');
 assert.ok(value.endsWith('ROLLBACK;\n'));
 return value;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const store=readFileSync(resolve(root,'supabase/proposals/core-service-s01/store-v1.sql'),'utf8');
 const proof=readFileSync(resolve(root,'supabase/proposals/core-service-s01/store-proof-v1.sql'),'utf8');
 const value=composeStoreProofV1(store,proof);const bytes=Buffer.from(value);
 if(process.argv[2])writeFileSync(process.argv[2],bytes);
 console.log(JSON.stringify({bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
   git_blob:createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
   execute:false,sql:'NOT_RUN',transaction:'single BEGIN / final ROLLBACK'}));
}
