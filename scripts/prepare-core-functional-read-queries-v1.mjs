/** TS source census only; never parses/executes SQL or treats a hash as authority. */
import ts from 'typescript';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const paths=['src/lib/core/current-authority-postgres-provider-v1.ts','src/lib/core/service-s01/provider-agreement-reader-v1.ts',
 'src/lib/customer/service-offering-disclosure-source-v1.ts','src/lib/customer/service-v14-execution/request-source-ports.ts',
 'src/lib/core/functional-producers-v1.ts'];
const pins=[],queries=new Set();
for(const path of paths){const source=readFileSync(new URL(path,root),'utf8');pins.push({path,sha256:createHash('sha256').update(source).digest('hex')});
 const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
 function visit(n){if((ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))&&/^\s*select\b/i.test(n.text)&&!n.text.includes(';'))queries.add(n.text);ts.forEachChild(n,visit);}
 visit(ast);
}
const result=JSON.stringify({contract:'core-functional-read-query-census.v1',pins,queries:[...queries].sort().map(sql=>({sql,sha256:createHash('sha256').update(sql).digest('hex')}))},null,2)+'\n';
const output=new URL('src/lib/core/functional-read-queries-v1.json',root);
if(process.argv.includes('--check'))assert.equal(readFileSync(output,'utf8'),result);else writeFileSync(output,result);
console.log(JSON.stringify({queries:queries.size,sql_native:'NOT_RUN'}));
