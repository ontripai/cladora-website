/** Offline proposal renderer. Input receipt hashes select a source proposal,
 * never establish authority/admission. No connection, role or GRANT is created. */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {z} from 'zod';
const contract=JSON.parse(readFileSync(new URL('../supabase/proposals/core-finance-invoice-decisions-v2/rls-contract.json',import.meta.url),'utf8'));
const binding=z.strictObject({contract_version:z.literal('core-finance-invoice-decisions-role-source.v2'),
 core_base:z.literal('ef5beb10900b04a85cb75ceb6f9c0301a969b945'),finance_head:z.literal('75c51eac67408b181b014749a393997c8363cda4'),
 runtime_role:z.string().regex(/^[a-z_][a-z0-9_]{0,62}$/),runtime_role_oid:z.number().int().positive().max(4294967295).safe(),
 target_receipt_sha256:z.string().regex(/^[a-f0-9]{64}$/),role_receipt_sha256:z.string().regex(/^[a-f0-9]{64}$/)});
export function renderCoreFinanceInvoiceDecisionsRlsV2(value){
 const b=binding.parse(value);if(['postgres','anon','authenticated','service_role','authenticator','supabase_admin','supabase_auth_admin','cladora_rpc_owner'].includes(b.runtime_role))throw Error('PRIVATE_PRINCIPAL_REQUIRED');
 let sql=`-- SOURCE PROPOSAL ONLY: not admission/permit. Platform must verify actual target/role/ACL first.\n-- target receipt ${b.target_receipt_sha256}; role receipt ${b.role_receipt_sha256}\nBEGIN;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='30s';\n`;
 sql+=`DO $principal$ BEGIN\n IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=${b.runtime_role_oid} AND rolname='${b.runtime_role}' AND NOT rolsuper AND NOT rolbypassrls)\n THEN RAISE EXCEPTION 'finance_private_principal_mismatch' USING ERRCODE='55000'; END IF;\nEND $principal$;\n`;
 for(const table of contract.tables)for(const p of contract.policies_per_table){
  sql+=`CREATE POLICY ${table.prefix+p.suffix} ON ${table.relation} AS ${p.permissive?'PERMISSIVE':'RESTRICTIVE'} FOR ${p.command} TO "${b.runtime_role}" USING (${p.using==='EXACT_TABLE_QUAL'?table.qual:p.using})${p.with_check===null?'':` WITH CHECK (${p.with_check})`};\n`;
 }
 return sql+'COMMIT;\n';
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const input=process.argv.find(a=>a.startsWith('--binding='))?.slice(10),out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);
 if(!input||!out)throw Error('PRIVATE_ACTUAL_PLATFORM_BINDING_AND_OUTPUT_REQUIRED');
 writeFileSync(out,renderCoreFinanceInvoiceDecisionsRlsV2(JSON.parse(readFileSync(input,'utf8'))));
}
