import {
  currentAuthorityTransactionDecisionReceiptV1Schema,
  currentAuthorityTransactionRequestV1Schema,
  type CurrentAuthorityTransactionDecisionReceiptV1,
  type CurrentAuthorityTransactionRequestV1,
  type CurrentAuthorityTransactionalPortV1,
} from '../core/current-authority-transaction-port-v1.ts';
import {
  CORE_CE012_MAP_DECISION_CONTRACT,
  ce012GuideSaveCommandV1Schema,
  coreCe012MapDecisionV1Schema,
  coreCe012MapRequestV1Schema,
  docsCe012ReferenceDecisionV1Schema,
  docsCe012ReferenceRequestV1Schema,
  type Ce012GuideSaveCommandV1,
  type CoreCe012MapDecisionV1,
  type DocsCe012ReferenceDecisionV1,
} from './experience-guide-command-contract.ts';

export type Ce012GuideAuthorityTransactionInputV1 = Pick<
  CurrentAuthorityTransactionRequestV1,
  'decision_id' | 'authority_version' | 'transaction_context'
>;

export interface Ce012GuideProviderBridgePorts {
  coreCommandContext: {
    evaluate(request: ReturnType<typeof coreCe012MapRequestV1Schema.parse>): Promise<unknown>;
  };
  coreTransactionalAuthority: CurrentAuthorityTransactionalPortV1;
  documentsImmutableSelector: {
    select(request: ReturnType<typeof docsCe012ReferenceRequestV1Schema.parse>): Promise<unknown>;
  };
}

export interface Ce012GuideProviderBindingV1 {
  context_id: string;
  workspace_id: string;
  guide_id: string;
  guide_version: number;
  authority_version: number;
  document_version_id: string | null;
  document_version: number | null;
  safe_label: string | null;
  evaluated_at: string;
}

export interface Ce012GuideProviderBridgeResultV1 {
  core_decision: CoreCe012MapDecisionV1;
  authority_receipt: CurrentAuthorityTransactionDecisionReceiptV1 | null;
  document_decision: DocsCe012ReferenceDecisionV1 | null;
  binding: Ce012GuideProviderBindingV1;
}

export class Ce012ProviderBindingMismatchError extends Error {
  readonly code = 'CE012_PROVIDER_BINDING_MISMATCH';
  readonly field: string;

  constructor(field: string) {
    super(`Provider result does not bind the requested ${field}`);
    this.field = field;
  }
}

const requireEqual = (actual: unknown, expected: unknown, field: string): void => {
  if (actual !== expected) throw new Ce012ProviderBindingMismatchError(field);
};

const requireCoreContextBinding = (
  decision: CoreCe012MapDecisionV1,
  request: ReturnType<typeof coreCe012MapRequestV1Schema.parse>,
): void => {
  for (const field of [
    'context_id',
    'workspace_id',
    'guide_id',
    'module_code',
    'entitlement_key',
    'permission_code',
  ] as const) requireEqual(decision[field], request[field], `Core context ${field}`);
};

const requireTransactionBinding = (
  receipt: CurrentAuthorityTransactionDecisionReceiptV1,
  request: CurrentAuthorityTransactionRequestV1,
): void => {
  for (const field of [
    'decision_id',
    'context_id',
    'workspace_id',
    'actor_id',
    'authority_version',
    'permission_code',
    'module_code',
    'evaluation_purpose',
  ] as const) requireEqual(receipt[field], request[field], `Core transaction ${field}`);

  const actual = receipt.transaction_context;
  const expected = request.transaction_context;
  for (const field of ['transaction_id', 'command_id', 'attempt', 'isolation_level'] as const) {
    requireEqual(actual[field], expected[field], `Core transaction context.${field}`);
  }
  for (const field of ['kind', 'workspace_id', 'aggregate_type', 'aggregate_id', 'acquired_at'] as const) {
    requireEqual(actual.lock[field], expected.lock[field], `Core transaction lock.${field}`);
  }
};

const requireGuideLockBinding = (
  command: Ce012GuideSaveCommandV1,
  transaction: Ce012GuideAuthorityTransactionInputV1,
): void => {
  requireEqual(transaction.transaction_context.command_id, command.command_id, 'transaction command_id');
  requireEqual(transaction.transaction_context.lock.workspace_id, command.workspace_id, 'transaction lock Workspace');
  requireEqual(transaction.transaction_context.lock.aggregate_type, 'experience_guide', 'transaction aggregate type');
  requireEqual(transaction.transaction_context.lock.aggregate_id, command.guide_id, 'transaction Guide');
};

const requireDocumentBinding = (
  decision: DocsCe012ReferenceDecisionV1,
  request: ReturnType<typeof docsCe012ReferenceRequestV1Schema.parse>,
): void => {
  for (const field of ['context_id', 'workspace_id', 'guide_id', 'evaluation_mode'] as const) {
    requireEqual(decision[field], request[field], `Documents ${field}`);
  }
  for (const field of ['document_id', 'document_version_id', 'document_version'] as const) {
    requireEqual(decision.target[field], request.target[field], `Documents target.${field}`);
  }
};

const mapTransactionalAuthority = (
  context: CoreCe012MapDecisionV1,
  receipt: CurrentAuthorityTransactionDecisionReceiptV1,
): CoreCe012MapDecisionV1 => coreCe012MapDecisionV1Schema.parse({
  contract: CORE_CE012_MAP_DECISION_CONTRACT,
  version: 1,
  decision_id: receipt.decision_id,
  context_id: context.context_id,
  workspace_id: receipt.workspace_id,
  guide_id: context.guide_id,
  actor_id: receipt.actor_id,
  membership_id: context.membership_id,
  module_code: receipt.module_code,
  entitlement_key: context.entitlement_key,
  permission_code: receipt.permission_code,
  authority: receipt.decision === 'allowed'
    ? 'allowed'
    : receipt.denial_reason === 'ACTOR_REVOKED' ? 'revoked' : 'denied',
  entitlement: context.entitlement,
  evaluated_at: receipt.evaluated_at,
});

const coreContextRequestFor = (
  command: Ce012GuideSaveCommandV1,
) => coreCe012MapRequestV1Schema.parse({
  contract: 'core-ce012-map-request.v1',
  version: 1,
  context_id: command.context_id,
  workspace_id: command.workspace_id,
  guide_id: command.guide_id,
  action: command.action,
  module_code: 'experience_guides',
  entitlement_key: 'module.experience_guides',
  permission_code: 'experience.guide.manage',
});

const transactionRequestFor = (
  command: Ce012GuideSaveCommandV1,
  context: CoreCe012MapDecisionV1,
  transaction: Ce012GuideAuthorityTransactionInputV1,
): CurrentAuthorityTransactionRequestV1 => currentAuthorityTransactionRequestV1Schema.parse({
  contract_version: 'core-current-authority-transaction-port-request.v1',
  decision_id: transaction.decision_id,
  context_id: command.context_id,
  workspace_id: command.workspace_id,
  actor_id: context.actor_id,
  authority_version: transaction.authority_version,
  permission_code: 'experience.guide.manage',
  module_code: 'experience_guides',
  evaluation_purpose: 'experience.guide.command',
  transaction_context: transaction.transaction_context,
});

const latestEvaluation = (left: string, right: string | null): string => (
  right !== null && Date.parse(right) >= Date.parse(left) ? right : left
);

export const createCe012GuideProviderBridge = (ports: Ce012GuideProviderBridgePorts) => ({
  async evaluate(
    commandValue: unknown,
    transaction: Ce012GuideAuthorityTransactionInputV1,
    evaluationMode: 'new_command' | 'replay',
  ): Promise<Ce012GuideProviderBridgeResultV1> {
    const command = ce012GuideSaveCommandV1Schema.parse(commandValue);
    requireGuideLockBinding(command, transaction);

    const contextRequest = coreContextRequestFor(command);
    const initialContext = coreCe012MapDecisionV1Schema.parse(
      await ports.coreCommandContext.evaluate(contextRequest),
    );
    requireCoreContextBinding(initialContext, contextRequest);

    let authorityReceipt: CurrentAuthorityTransactionDecisionReceiptV1 | null = null;
    let coreDecision = initialContext;
    if (initialContext.authority === 'allowed' && initialContext.entitlement === 'active') {
      const transactionRequest = transactionRequestFor(command, initialContext, transaction);
      authorityReceipt = currentAuthorityTransactionDecisionReceiptV1Schema.parse(
        await ports.coreTransactionalAuthority.recheckAfterLock(transactionRequest),
      );
      requireTransactionBinding(authorityReceipt, transactionRequest);
      coreDecision = mapTransactionalAuthority(initialContext, authorityReceipt);
    }

    let documentDecision: DocsCe012ReferenceDecisionV1 | null = null;
    const target = command.payload.document_target;
    if (authorityReceipt?.decision === 'allowed'
      && coreDecision.entitlement === 'active'
      && target !== null) {
      const documentsRequest = docsCe012ReferenceRequestV1Schema.parse({
        contract: 'docs-ce012-reference-request.v1',
        version: 1,
        context_id: command.context_id,
        workspace_id: command.workspace_id,
        guide_id: command.guide_id,
        target: {
          document_id: target.document_id,
          document_version_id: target.document_version_id,
          document_version: target.document_version,
        },
        evaluation_mode: evaluationMode,
      });
      documentDecision = docsCe012ReferenceDecisionV1Schema.parse(
        await ports.documentsImmutableSelector.select(documentsRequest),
      );
      requireDocumentBinding(documentDecision, documentsRequest);
    }

    const releasedLabel = documentDecision?.decision === 'current_authorized'
      || documentDecision?.decision === 'historical_authorized'
      ? documentDecision.safe_label
      : null;
    const evaluatedAt = latestEvaluation(
      authorityReceipt?.evaluated_at ?? initialContext.evaluated_at,
      documentDecision?.evaluated_at ?? null,
    );

    return {
      core_decision: coreDecision,
      authority_receipt: authorityReceipt,
      document_decision: documentDecision,
      binding: {
        context_id: command.context_id,
        workspace_id: command.workspace_id,
        guide_id: command.guide_id,
        guide_version: command.expected_guide_version,
        authority_version: transaction.authority_version,
        document_version_id: target?.document_version_id ?? null,
        document_version: target?.document_version ?? null,
        safe_label: releasedLabel,
        evaluated_at: evaluatedAt,
      },
    };
  },
});
