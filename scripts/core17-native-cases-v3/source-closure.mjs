/** Static JS/TS import census only; never a SQL parser or compiler. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import ts from 'typescript';
export const PRODUCT_ROOTS=['supabase/migrations/20261003200211_20261003141918_service_catalog_persistence_v1.sql','src/lib/core/functional-command-runtime-v1.ts','src/lib/core/functional-request-auth-v1.ts','src/lib/customer/service-request-read-schema.ts','src/lib/customer/service-catalog-schema.ts','src/lib/customer/service-v14-execution/http.ts','src/lib/customer/service-v14-execution/runtime-binding.ts','src/lib/core/private-service-development-binding-v1.ts','src/app/api/customer/v1/services/offering-request-flow/route.ts','src/app/api/customer/v1/services/assembly-bootstrap/route.ts','src/app/api/customer/v1/services/catalog/route.ts','src/app/api/customer/v1/services/requests/route.ts'];
export function productSourceClosure(root){
const seen=new Set();
function visit(file){file=relative(root,resolve(root,file));if(seen.has(file))return;assert.ok(!file.startsWith('..'));seen.add(file);if(file.endsWith('.json')||file.endsWith('.sql'))return;
 for(const imp of ts.preProcessFile(readFileSync(file,'utf8'),true,true).importedFiles){const spec=imp.fileName;if(!spec.startsWith('.')&&!spec.startsWith('@/'))continue;let found=spec.startsWith('@/')?resolve(root,'src',spec.slice(2)):resolve(root,dirname(file),spec);found=[found,found+'.ts',found+'.tsx',found+'.json',found+'/index.ts'].find(p=>existsSync(p)&&!p.endsWith('/'));assert.ok(found,'MISSING_STATIC_SOURCE '+spec);visit(found);}}
for(const file of PRODUCT_ROOTS)visit(file);
return [...seen].sort();
}
