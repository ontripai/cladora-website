/** Target-specific canonical recheck AFTER private Storage wait; no fresh receipt. */
import 'server-only';
import type {Pool} from 'pg';
import type {CoreFunctionalDevelopmentTargetV1} from './functional-command-runtime-v1';
import {createCoreDocumentsCommandBindingV1} from './documents-command-binding-v1';
import {buildDocumentsVaultDownloadExactWorkspaceCommandV2,type DocumentsVaultDownloadExactWorkspaceV2} from '../customer/documents-vault-download-exact-workspace-v2';
import {createDocumentsFunctionalDownloadProviderV1} from '../customer/documents-functional-download-provider-v1';
export const CORE_DOCUMENTS_DOWNLOAD_RECHECK_V1='core-documents-download-recheck.v1' as const;
export async function createCoreDocumentsDownloadRecheckV1(options:Readonly<{pool:Pool;target:CoreFunctionalDevelopmentTargetV1;request:Request}>){
 const binding=await createCoreDocumentsCommandBindingV1(options).bind(options.request);if(!binding)return null;
 return Object.freeze({contract_version:CORE_DOCUMENTS_DOWNLOAD_RECHECK_V1,
  async recheckAfterStorage(input:DocumentsVaultDownloadExactWorkspaceV2,context:Parameters<typeof buildDocumentsVaultDownloadExactWorkspaceCommandV2>[1]){
   const command=buildDocumentsVaultDownloadExactWorkspaceCommandV2(input,context);
   const current=createDocumentsFunctionalDownloadProviderV1(input,context);
   const result=await binding.replayHost.execute(command,current.providers);
   // Historical C03 identity alone cannot populate this: actual provider's
   // validateReplay re-reads target/version/lifecycle/scan/reference after wait.
   return Object.freeze({result,private_candidate:result.status==='exact_replay'?current.readPrivateDownloadCandidate():null,
    outward_projection:null,current_authority_reusable:false as const});
  },
 });
}
