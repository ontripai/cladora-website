import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = new URL('../docs/airprop/AIRPROP-CORE-DEPENDENCY-BOUNDARIES-v1.0.md', import.meta.url);
const text = readFileSync(path, 'utf8');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`ok ${passed} - ${name}`); };

check('AP10 dependency is named exactly', () => assert.match(text, /`AP10-AUTH-E2E-FIXTURE`/));
check('AP10 owner is Control and Core test infrastructure', () => assert.match(text, /Dependency owner:\*\* CLADORA Control\/Core test infrastructure/));
check('AP10 requires non-Production synthetic AAL2', () => assert.match(text, /private, non-Production, resettable synthetic fixture/));
check('AP10 keeps secrets outside Git and logs', () => assert.match(text, /without placing credentials in Git, test output or PR metadata/));
check('AP10 covers current authority revocation', () => assert.match(text, /Revoking current authority removes the property on the next read/));
check('AP10 creates no parallel authentication store', () => assert.match(text, /not create a parallel user\/session store/));

check('AP-PF02 package is named exactly', () => assert.match(text, /## 2\. `AP-PF02`/));
check('recorded Core dependency name is preserved', () => assert.match(text, /Exact dependency name already recorded by AIRPROP:\*\* Accepted Core Resource snapshot, relationship and authority contract/));
check('Core delivery and PM acceptance owners are explicit', () => assert.match(text, /Dependency owner:\*\* Core\/Platform for delivery; CLADORA Control & PM for acceptance/));
check('physical Core fields remain unspecified', () => assert.match(text, /Field names, RPC names, tables, roles and permission codes are deliberately unspecified/));
check('natural and legal owners plus revocation are covered', () => assert.match(text, /Natural-person owner, legal-entity owner.*revoked software role/s));
check('AP-PF02 creates no parallel registries', () => assert.match(text, /not persist a second Resource, Party, relationship, authority, role or grant registry/));

check('dynamic read dependency is AP-PF02', () => assert.match(text, /Exact dependency name:\*\* `AP-PF02`, completed against the PM-accepted Core contract/));
check('dynamic read starts only after AP-PF02 passes', () => assert.match(text, /After .*accepted.*and `AP-PF02` passes its consumer tests/s));
check('read visibility does not imply a Listing action', () => assert.match(text, /Listing action remains a separate command and is not implied by read visibility/));
check('CI and receipts are not acceptance', () => assert.match(text, /No claim that CI, a receipt.*PM acceptance or package completion/));

console.log(`AIRPROP dependency boundaries: ${passed} contract checks passed`);
