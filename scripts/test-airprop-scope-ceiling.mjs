import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema identity; create schema portfolio; create schema app_private;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('test.aal',true))$$;
create table identity.roles(id uuid,code text);
create table identity.permissions(id uuid,code text);
create table identity.role_permissions(role_id uuid,permission_id uuid,effect text);
create table identity.memberships(id uuid,tenant_id uuid,user_id uuid,role_id uuid,status text,starts_at timestamptz,ends_at timestamptz);
create table identity.context_grants(id uuid,membership_id uuid,tenant_id uuid,scope_type text,property_id uuid,building_id uuid,unit_id uuid,starts_at timestamptz,ends_at timestamptz);
create table portfolio.buildings(id uuid,property_id uuid);
create table portfolio.units(id uuid,building_id uuid);
`);
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
await db.query("select set_config('test.actor',$1,false),set_config('test.aal','aal2',false)",[id(1)]);
await db.query('insert into identity.roles values ($1,$2)',[id(2),'airprop_asset_manager']);
await db.query('insert into identity.permissions values ($1,$2)',[id(3),'airprop.asset.manage']);
await db.query("insert into identity.role_permissions values ($1,$2,'allow')",[id(2),id(3)]);
await db.query("insert into identity.memberships values ($1,$2,$3,$4,'active',now()-interval '1 day',null)",[id(4),id(5),id(1),id(2)]);
await db.query('insert into portfolio.buildings values ($1,$2)',[id(7),id(6)]);
await db.query('insert into portfolio.units values ($1,$2)',[id(8),id(7)]);
for(const [n,scope,p,b,u] of [[10,'tenant',null,null,null],[11,'property',id(6),null,null],[12,'building',null,id(7),null],[13,'unit',null,null,id(8)],[14,'property',id(9),null,null]])
 await db.query("insert into identity.context_grants values ($1,$2,$3,$4,$5,$6,$7,now()-interval '1 day',null)",[id(n),id(4),id(5),scope,p,b,u]);
await db.exec(readFileSync(new URL('../supabase/migrations/20261003074837_airprop_property_scope_ceiling.sql',import.meta.url),'utf8'));
let checks=0;
async function check(n,allowed,prop=id(6),permission='airprop.asset.manage'){
 try{const r=await db.query("select * from app_private.require_airprop_context_v1($1,$2,$3)",[id(n),permission,prop]);assert.equal(allowed,true);assert.equal(r.rows.length,1);}
 catch(e){if(allowed)throw e;assert.equal(e.code,'42501');}
 checks++;
}
await check(10,true);await check(11,true);await check(12,false);await check(13,false);await check(14,false);
await check(10,false,null);
await db.exec("select set_config('test.aal','aal1',false)");await check(11,false);
await db.exec("select set_config('test.aal','aal2',false)");
await db.exec("update identity.memberships set status='revoked'");await check(11,false);
await db.exec("update identity.memberships set status='active'");
await db.query("update identity.context_grants set ends_at=now()-interval '1 second' where id=$1",[id(11)]);await check(11,false);
await db.query("update identity.context_grants set ends_at=null where id=$1",[id(11)]);
await db.exec("update identity.role_permissions set effect='deny'");await check(11,false);
await db.exec("update identity.role_permissions set effect='allow'");
await db.exec("select set_config('test.actor','',false)");await check(11,false);
await db.query("select set_config('test.actor',$1,false)",[id(99)]);await check(11,false);
await db.query("select set_config('test.actor',$1,false)",[id(1)]);
await check(99,false);
await db.query("update identity.context_grants set tenant_id=$1 where id=$2",[id(99),id(11)]);await check(11,false);
await db.query("update identity.context_grants set tenant_id=$1 where id=$2",[id(5),id(11)]);
await db.exec("update identity.memberships set starts_at=now()+interval '1 day'");await check(11,false);
await db.exec("update identity.memberships set starts_at=now()-interval '1 day', ends_at=now()-interval '1 second'");await check(11,false);
await db.exec("update identity.memberships set ends_at=null");
await db.query("update identity.context_grants set starts_at=now()+interval '1 day' where id=$1",[id(11)]);await check(11,false);
await db.query("update identity.context_grants set starts_at=now()-interval '1 day' where id=$1",[id(11)]);
// Preserve the existing read ancestry behavior while restricting configuration.
await db.query('insert into identity.permissions values ($1,$2)',[id(20),'airprop.asset.read']);
await db.query("insert into identity.role_permissions values ($1,$2,'allow')",[id(2),id(20)]);
await check(12,true,id(6),'airprop.asset.read');
await check(13,true,id(6),'airprop.asset.read');
await check(14,false,id(6),'airprop.asset.read');
for(const role of ['anon','authenticated','service_role']){
 const result=await db.query("select has_function_privilege($1,'app_private.require_airprop_context_v1(uuid,text,uuid)','EXECUTE') as allowed",[role]);
 assert.equal(result.rows[0].allowed,false);checks++;
}
await db.close();console.log('PASS '+checks+' PostgreSQL scope/auth cases (PGlite isolated fixture)');
