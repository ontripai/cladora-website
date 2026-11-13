/** Derive ONLY accepted minimal lab prestate; no historical chain or target SQL. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {deriveOrdinaryInstallerV3} from './core15-ordinary-installer-profile-v3.mjs';
import {deriveDomainUnitV1} from '../prepare-core15-service-domain-v1.mjs';
const [accepted,out]=process.argv.slice(2);assert.ok(accepted&&out);mkdirSync(out,{recursive:true});
const foundation=readFileSync(resolve(accepted,'supabase/install/v14-operations/foundation.sql'),'utf8');
writeFileSync(resolve(out,'foundation.sql'),deriveOrdinaryInstallerV3(foundation,'foundation').payload);
for(const[id,path]of[
 ['module-registry','supabase/migrations/20260917120000_workspace_dynamic_composition.sql'],
 ['canonical-sqlstate','supabase/install/core-functional-runtime-v1/03-canonical-sqlstate.sql'],
])writeFileSync(resolve(out,id+'.sql'),deriveDomainUnitV1(readFileSync(path,'utf8'),id));
console.log('Exact accepted foundation + minimal module/SQLSTATE lab derivatives generated; no SQL executed');
