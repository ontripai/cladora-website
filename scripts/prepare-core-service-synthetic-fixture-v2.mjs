/** Fresh/current fixture consumer: explicit binding before imports/connection. */
import assert from 'node:assert/strict';
import {readOwnedInstallerFileV1,installerTargetV1,loadInstallerCredentialBindingV1} from './lib/core-installer-credential-binding-v1.mjs';
const root='/workspace/private/cladora-functional-dev-v1',generation=process.argv[2],bindingPath=process.argv[3];assert.equal(process.argv.length,4);assert.ok(['v3','historical-v2'].includes(generation));
const c=JSON.parse(readOwnedInstallerFileV1(root+'/core15/service-runtime-binding.json',root)),expectedTarget=installerTargetV1(c.target);
loadInstallerCredentialBindingV1({privateRoot:root,generation,bindingPath,expectedTarget});
const {prepareCore15ServiceSyntheticFixtureV1}=await import('./prepare-core15-service-synthetic-fixture-v1.mjs');
await prepareCore15ServiceSyntheticFixtureV1({generation,bindingPath,expectedTarget});
