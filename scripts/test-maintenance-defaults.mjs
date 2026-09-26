import assert from 'node:assert/strict';
import {DEFAULT_MAINTENANCE_PLANS,localizedMaintenanceText,suggestedMaintenancePlans} from '../src/lib/customer/maintenance-defaults.ts';

const codes=new Set();
for(const plan of DEFAULT_MAINTENANCE_PLANS){
 assert.ok(/^CLADORA_PM_[A-Z_]+$/.test(plan.code));
 assert.ok(!codes.has(plan.code),'Program codes must be unique');
 codes.add(plan.code);
 assert.ok(plan.suggestedEvery>=1 && plan.suggestedEvery<=120);
 assert.ok(plan.assetCategories.length>0);
 for(const category of plan.assetCategories) assert.ok(suggestedMaintenancePlans(category).includes(plan));
 assert.ok(plan.steps.length>0);
 for(const step of plan.steps){
  assert.ok(/^CLADORA_PM_[A-Z_]+$/.test(step.code));
  assert.ok(!codes.has(step.code),'Checklist codes must be unique');
  codes.add(step.code);
 }
 for(const lang of ['ro','en','fa']){
  assert.ok(plan.title[lang]);
  assert.equal(localizedMaintenanceText(plan.code,lang),plan.title[lang]);
  for(const step of plan.steps){
   assert.ok(step.label[lang]);
   assert.equal(localizedMaintenanceText(step.code,lang),step.label[lang]);
  }
 }
}
assert.equal(DEFAULT_MAINTENANCE_PLANS.length,4);
assert.deepEqual(suggestedMaintenancePlans('ELEVATOR').map(plan=>plan.code),['CLADORA_PM_ELEVATOR']);
assert.deepEqual(suggestedMaintenancePlans('unknown'),[]);
assert.equal(localizedMaintenanceText('Custom plan','fa'),'Custom plan','Legacy custom plans remain untouched');
console.log('Maintenance defaults: unique canonical codes and complete RO/EN/FA text');
