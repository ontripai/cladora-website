import assert from 'node:assert/strict';
import { validateStagingConnection } from './lib/staging-connection-boundary.mjs';

const staging='abcdefghijklmnopqrst', production='tsrqponmlkjihgfedcba';
const policy={purpose:'staging',expectedProjectRef:staging,forbiddenProjectRefs:[production]};
const password='SECRET_CANARY_$&@/%_DO_NOT_LOG';
const configured={projectRef:staging,supabaseUrl:`https://${staging}.supabase.co`,
  databaseUrl:`postgresql://postgres.${staging}:${encodeURIComponent(password)}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require`};
let checks=0;
const result=validateStagingConnection(policy,configured);
assert.equal(result.mode,'session_pooler');
assert.equal(JSON.stringify(result).includes('SECRET_CANARY'),false);checks++;
assert.equal(validateStagingConnection(policy,{...configured,databaseUrl:`postgres://postgres:${encodeURIComponent(password)}@db.${staging}.supabase.co/postgres?sslmode=verify-full`}).mode,'direct');checks++;
function denied(changes,error='MISMATCH',changedPolicy=policy){
  assert.throws(()=>validateStagingConnection(changedPolicy,{...configured,...changes}),e=>{
    assert.equal(e.message.includes('SECRET_CANARY'),false);
    assert.equal(e.message.includes(password),false);
    return new RegExp(error).test(e.message);
  });checks++;
}
denied({projectRef:production});
denied({supabaseUrl:`https://${production}.supabase.co`});
denied({databaseUrl:configured.databaseUrl.replace('postgres.'+staging,'postgres.'+production)});
denied({databaseUrl:`postgres://postgres:${encodeURIComponent(password)}@db.${production}.supabase.co:5432/postgres`});
denied({databaseUrl:configured.databaseUrl.replace(':5432/',':6543/')},'SESSION_CONNECTION_REQUIRED');
denied({databaseUrl:configured.databaseUrl.replace('sslmode=require','sslmode=disable')},'VERIFIED_TLS_REQUIRED');
denied({databaseUrl:configured.databaseUrl+'&sslmode=verify-full'},'VERIFIED_TLS_REQUIRED');
denied({databaseUrl:configured.databaseUrl+'&options=-c%20role%3Dservice_role'},'CONNECTION_OPTION_FORBIDDEN');
denied({databaseUrl:configured.databaseUrl+'&sslrootcert=%2Fetc%2Fpasswd'},'CONNECTION_OPTION_FORBIDDEN');
denied({databaseUrl:configured.databaseUrl.replace('pooler.supabase.com','pooler.supabase.com.attacker.invalid')});
denied({databaseUrl:configured.databaseUrl.replace('/postgres?','/other_database?')},'DATABASE_NAME_INVALID');
denied({databaseUrl:configured.databaseUrl.replace(encodeURIComponent(password),'')},'PASSWORD_REQUIRED');
denied({},'PRODUCTION_TARGET_FORBIDDEN',{...policy,forbiddenProjectRefs:[staging]});
denied({},'STAGING_POLICY_REQUIRED',{...policy,forbiddenProjectRefs:[]});
console.log(JSON.stringify({checks,result:'PASS',connections_opened:0,credentials_logged:false}));
