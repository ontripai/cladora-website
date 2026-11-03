/** Metadata-only issuance from explicit accepted producer receipts. No SQL. */
import assert from 'node:assert/strict';
import {readOwnedInstallerFileV1,issueInstallerCredentialBindingV1,installerTargetV1} from './lib/core-installer-credential-binding-v1.mjs';
const generation=process.argv[2];assert.equal(process.argv.length,3);assert.ok(['historical-v2','v3'].includes(generation));
const root='/workspace/private/cladora-functional-dev-v1';const c=JSON.parse(readOwnedInstallerFileV1(root+'/core15/service-runtime-binding.json',root));
const r=issueInstallerCredentialBindingV1({privateRoot:root,generation,target:installerTargetV1(c.target)});console.log(JSON.stringify({state:'EXPLICIT_INSTALLER_BINDING_CREATED',generation:r.generation,binding_sha256:r.sha256,secret_output:false}));
