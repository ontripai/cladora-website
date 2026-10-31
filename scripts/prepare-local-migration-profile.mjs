import {readFileSync,readdirSync,existsSync,mkdirSync,copyFileSync,cpSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export function prepareProfile(sourceRoot,destination){
 const manifest=JSON.parse(readFileSync(join(sourceRoot,'supabase/local-profiles/baseline-v14.manifest.json'),'utf8'));
 if(manifest.profile!=='baseline-v14'||manifest.inactive_installers.length!==1)throw Error('unsupported profile');
 const inactive=manifest.inactive_installers[0];
 if(inactive.name!=='20261025214155_building_setup_command_receipts_v1.sql'||inactive.sha256!=='254e17c9e5f21ce4e50786d3325c2cc84759097b16cb53028602d1e8db5e02e3')throw Error('inactive source identity changed');
 const dir=join(sourceRoot,'supabase/migrations');
 const names=readdirSync(dir).filter(n=>n.endsWith('.sql')).sort();
 if(JSON.stringify(names)!==JSON.stringify(manifest.source_migrations.map(x=>x.name)))throw Error('migration inventory changed');
 for(const row of manifest.source_migrations){if(createHash('sha256').update(readFileSync(join(dir,row.name))).digest('hex')!==row.sha256)throw Error('migration source changed: '+row.name);}
 const config=readFileSync(join(sourceRoot,'supabase/config.toml'),'utf8');
 if(!/^project_id\s*=\s*"cladora-local"\s*$/m.test(config))throw Error('profile must target cladora-local');
 const active=names.filter(name=>name!==inactive.name);
 if(active.length!==manifest.active_migration_count)throw Error('active migration count mismatch');
 const target=resolve(destination);if(target===resolve(sourceRoot)||target.startsWith(resolve(sourceRoot)+'/'))throw Error('profile must be outside source tree');
 if(existsSync(target)&&readdirSync(target).length)throw Error('profile destination must be fresh');
 // Validate every input before allocation. Never copy linked-project .temp or env files.
 mkdirSync(join(target,'supabase/migrations'),{recursive:true});
 writeFileSync(join(target,'supabase/config.toml'),config);
 for(const row of manifest.source_migrations)if(row.name!==inactive.name)copyFileSync(join(dir,row.name),join(target,'supabase/migrations',row.name));
 cpSync(join(sourceRoot,'supabase/tests'),join(target,'supabase/tests'),{recursive:true});
 if(existsSync(join(sourceRoot,'supabase/seed.sql')))copyFileSync(join(sourceRoot,'supabase/seed.sql'),join(target,'supabase/seed.sql'));
 const receipt={profile:manifest.profile,project_id:'cladora-local',active_migrations:active.length,inactive_source:inactive,hosted_execution:false,g2_runtime:'NOT_INSTALLED_NOT_PROVED'};
 writeFileSync(join(target,'profile.receipt.json'),JSON.stringify(receipt,null,2)+'\n');return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw Error('fresh profile destination required');
 console.log(JSON.stringify(prepareProfile(fileURLToPath(new URL('../',import.meta.url)),process.argv[2])));
}
