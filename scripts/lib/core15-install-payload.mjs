/** Pure explicit compatibility envelope. No SQL parsing/execution or guard deletion. */
import assert from 'node:assert/strict';
export const CORE15_NATIVE_BINDING_V1='core15-development-native-binding.v1';
export const originalTargetGuard="current_setting('cladora.install.target',true) is distinct from 'ryygcqiunqqtfkpkflzf'";
export const developmentTargetGuard=`(current_database()!~'^cladora_dev_[a-z0-9_]+$'
    or current_setting('cladora.install.target',true) is null
    or current_setting('cladora.install.target',true)!~'^core15-dev:[A-Za-z0-9_.:-]{8,160}$'
    or current_setting('cladora.install.target_oid',true) is distinct from
      (select oid::text from pg_database where datname=current_database()))`;
const counts=Object.freeze({foundation:1,assets:1,'maintenance-procurement':2,'building-provisioning':1});
export function deriveCore15NativePayloadV1(source,unit){
 assert.ok(Object.hasOwn(counts,unit));assert.equal(source.split(originalTargetGuard).length-1,counts[unit],'exact native target-guard census');
 assert.equal(source.includes(developmentTargetGuard),false);
 const result=source.split(originalTargetGuard).join(developmentTargetGuard);
 assert.equal(result.split(developmentTargetGuard).join(originalTargetGuard),source,'WHOLE native source round-trip');
 return result;
}
