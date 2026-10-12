import {
  ce012EditorIdentitySchema,
  ce012GuideCommandReceiptV1Schema,
  ce012GuideSaveCommandV1Schema,
  coreCe012MapDecisionV1Schema,
  coreCe012MapRequestV1Schema,
  docsCe012ReferenceDecisionV1Schema,
  docsCe012ReferenceRequestV1Schema,
  evaluateCe012GuideSaveCommand,
  type Ce012EditorIdentity,
  type Ce012GuideCommandEvaluationV1,
  type Ce012GuideCommandReceiptV1,
  type Ce012GuideCommandSnapshotV1,
  type Ce012GuideMutationPlanV1,
  type Ce012GuideSaveCommandV1,
} from './experience-guide-command-contract.ts';

export type Ce012GuideRuntimeSnapshotV1 = Omit<
  Ce012GuideCommandSnapshotV1,
  'core_decision' | 'document_decision'
>;

export interface Ce012GuideCommandExecutorDependencies {
  core: {
    evaluate(request: ReturnType<typeof coreCe012MapRequestV1Schema.parse>): Promise<unknown>;
  };
  documents: {
    evaluate(request: ReturnType<typeof docsCe012ReferenceRequestV1Schema.parse>): Promise<unknown>;
  };
  runtime: {
    loadSnapshot(command: Ce012GuideSaveCommandV1): Promise<Ce012GuideRuntimeSnapshotV1>;
    commit(plan: Ce012GuideMutationPlanV1): Promise<unknown>;
  };
}

export interface Ce012GuideEditorSaveInput {
  guide_id: string;
  title: string;
  step_title: string;
  step_body: string;
  target_id: string | null;
}

export interface Ce012GuideEditorAdapterDependencies {
  executor: ReturnType<typeof createCe012GuideCommandExecutor>;
  buildCommand(input: Ce012GuideEditorSaveInput): Promise<unknown> | unknown;
  getActiveIdentity(): Ce012EditorIdentity;
}

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const identitiesMatch = (left: Ce012EditorIdentity, right: Ce012EditorIdentity): boolean => (
  left.context_id === right.context_id
  && left.workspace_id === right.workspace_id
  && left.guide_id === right.guide_id
);

export class Ce012GuideCommitResultError extends Error {
  readonly code = 'CE012_COMMIT_RECEIPT_MISMATCH';

  constructor() {
    super('Runtime commit returned a receipt that differs from the evaluated plan');
  }
}

export class Ce012GuideCommandRejectedError extends Error {
  readonly evaluation: Ce012GuideCommandEvaluationV1;

  constructor(evaluation: Ce012GuideCommandEvaluationV1) {
    super(evaluation.result_code);
    this.evaluation = evaluation;
  }
}

export class Ce012EditorCompletionDiscardedError extends Error {
  readonly code = 'CE012_EDITOR_COMPLETION_DISCARDED';

  constructor() {
    super('The editor identity changed before command completion');
  }
}

export class Ce012ConcurrentSaveConflictError extends Error {
  readonly code = 'CE012_CONCURRENT_SAVE_CONFLICT';

  constructor() {
    super('A different Guide save is already pending');
  }
}

const assertCommitReceipt = (
  committedValue: unknown,
  planned: Ce012GuideCommandReceiptV1,
): Ce012GuideCommandReceiptV1 => {
  const committed = ce012GuideCommandReceiptV1Schema.parse(committedValue);
  if (stableSerialize(committed) !== stableSerialize(planned)) throw new Ce012GuideCommitResultError();
  return committed;
};

export const createCe012GuideCommandExecutor = (
  dependencies: Ce012GuideCommandExecutorDependencies,
) => ({
  async execute(commandValue: unknown): Promise<Ce012GuideCommandEvaluationV1> {
    const command = ce012GuideSaveCommandV1Schema.parse(commandValue);
    const coreRequest = coreCe012MapRequestV1Schema.parse({
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
    const coreDecision = coreCe012MapDecisionV1Schema.parse(
      await dependencies.core.evaluate(coreRequest),
    );
    const runtimeSnapshot = await dependencies.runtime.loadSnapshot(command);

    let documentDecision = null;
    if (coreDecision.authority === 'allowed'
      && coreDecision.entitlement === 'active'
      && command.payload.document_target !== null) {
      const target = command.payload.document_target;
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
        evaluation_mode: runtimeSnapshot.replay === null ? 'new_command' : 'replay',
      });
      documentDecision = docsCe012ReferenceDecisionV1Schema.parse(
        await dependencies.documents.evaluate(documentsRequest),
      );
    }

    const evaluation = evaluateCe012GuideSaveCommand(command, {
      ...runtimeSnapshot,
      core_decision: coreDecision,
      document_decision: documentDecision,
    });
    if (evaluation.mutation_plan === null) return evaluation;

    const committed = assertCommitReceipt(
      await dependencies.runtime.commit(evaluation.mutation_plan),
      evaluation.mutation_plan.receipt,
    );
    return { ...evaluation, receipt: committed };
  },
});

export const createCe012GuideEditorAdapter = (
  dependencies: Ce012GuideEditorAdapterDependencies,
): { saveDraft(input: Ce012GuideEditorSaveInput): Promise<void> } => {
  let retained: { input: string; command: Ce012GuideSaveCommandV1 } | null = null;
  let pending: { input: string; promise: Promise<void> } | null = null;

  return {
    saveDraft(input) {
      const inputFingerprint = stableSerialize(input);
      if (pending !== null) {
        if (pending.input === inputFingerprint) return pending.promise;
        return Promise.reject(new Ce012ConcurrentSaveConflictError());
      }

      const task = (async () => {
        const activeAtStart = ce012EditorIdentitySchema.parse(dependencies.getActiveIdentity());
        if (retained !== null && !identitiesMatch(retained.command, activeAtStart)) retained = null;
        if (retained === null || retained.input !== inputFingerprint) {
          const command = ce012GuideSaveCommandV1Schema.parse(await dependencies.buildCommand(input));
          if (command.guide_id !== input.guide_id || !identitiesMatch(command, activeAtStart)) {
            throw new Ce012EditorCompletionDiscardedError();
          }
          retained = { input: inputFingerprint, command };
        }

        const evaluation = await dependencies.executor.execute(retained.command);
        if (evaluation.result_code !== 'OK' || evaluation.receipt === null) {
          retained = null;
          throw new Ce012GuideCommandRejectedError(evaluation);
        }

        const completedIdentity = {
          context_id: evaluation.receipt.context_id,
          workspace_id: evaluation.receipt.workspace_id,
          guide_id: evaluation.receipt.guide_id,
        };
        retained = null;
        const activeAtCompletion = ce012EditorIdentitySchema.parse(dependencies.getActiveIdentity());
        if (!identitiesMatch(completedIdentity, activeAtCompletion)) {
          throw new Ce012EditorCompletionDiscardedError();
        }
      })();
      pending = { input: inputFingerprint, promise: task };
      void task.finally(() => {
        if (pending?.promise === task) pending = null;
      }).catch(() => {});
      return task;
    },
  };
};
