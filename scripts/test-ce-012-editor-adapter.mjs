import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import {
  Ce012EditorCompletionDiscardedError,
  Ce012GuideCommandRejectedError,
  createCe012GuideCommandExecutor,
  createCe012GuideEditorAdapter,
} from '../src/lib/community/experience-guide-editor-adapter.ts';
import {
  CE012_GUIDE_COMMAND_CONTRACT,
  CORE_CE012_MAP_DECISION_CONTRACT,
  DOCS_CE012_REFERENCE_DECISION_CONTRACT,
  fingerprintCe012GuideSavePayload,
} from '../src/lib/community/experience-guide-command-contract.ts';

const uuid = (suffix) => `10000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
const now = '2026-10-11T15:00:00.000Z';
const baseIdentity = { context_id: uuid(1), workspace_id: uuid(2), guide_id: uuid(3) };
const target = { document_id: uuid(4), document_version_id: uuid(5), document_version: 11, label: 'Browser target label' };
const uiInput = { guide_id: baseIdentity.guide_id, title: 'Arrival guide', step_title: 'Before arrival', step_body: 'Read the current instructions.', target_id: 'target-document' };

function createHarness() {
  const state = {
    active: { ...baseIdentity },
    buildIdentity: null,
    guide: { ...baseIdentity, current_version: 1, state: 'draft' },
    authority: 'allowed',
    entitlement: 'active',
    documentResult: 'current_authorized',
    documentLabel: 'Provider safe label',
    receipts: new Map(),
    commitCount: 0,
    buildCount: 0,
    coreCalls: 0,
    documentCalls: 0,
    failCommit: null,
    waitForCore: null,
    lastCommand: null,
  };
  let serial = 100;
  const nextId = () => uuid(serial++);

  const core = {
    async evaluate(request) {
      state.coreCalls += 1;
      if (state.waitForCore) await state.waitForCore.promise;
      return {
        contract: CORE_CE012_MAP_DECISION_CONTRACT,
        version: 1,
        decision_id: nextId(),
        context_id: request.context_id,
        workspace_id: request.workspace_id,
        guide_id: request.guide_id,
        actor_id: uuid(6),
        membership_id: uuid(7),
        module_code: request.module_code,
        entitlement_key: request.entitlement_key,
        permission_code: request.permission_code,
        authority: state.authority,
        entitlement: state.entitlement,
        evaluated_at: now,
      };
    },
  };
  const documents = {
    async evaluate(request) {
      state.documentCalls += 1;
      const allowed = state.documentResult === 'current_authorized' || state.documentResult === 'historical_authorized';
      return {
        contract: DOCS_CE012_REFERENCE_DECISION_CONTRACT,
        version: 1,
        decision_id: nextId(),
        context_id: request.context_id,
        workspace_id: request.workspace_id,
        guide_id: request.guide_id,
        target: request.target,
        evaluation_mode: request.evaluation_mode,
        authority_basis: 'current_server_session',
        decision: state.documentResult,
        safe_label: allowed ? state.documentLabel : null,
        redaction: allowed ? 'safe_label_only' : 'none',
        evaluated_at: now,
      };
    },
  };
  const runtime = {
    async loadSnapshot(command) {
      const receipt = state.receipts.get(command.idempotency_key) ?? null;
      return {
        guide: { ...state.guide },
        issuance: { receipt_id: nextId(), idempotency_binding_id: nextId(), evaluated_at: now },
        replay: receipt === null ? null : {
          idempotency_key: command.idempotency_key,
          payload_fingerprint: command.payload_fingerprint,
          receipt,
        },
      };
    },
    async commit(plan) {
      const failure = state.failCommit;
      state.failCommit = null;
      if (failure === 'before') throw new Error('transport failed before commit');
      state.guide.current_version = plan.resulting_guide_version;
      state.receipts.set(plan.receipt.idempotency_key, plan.receipt);
      state.commitCount += 1;
      if (failure === 'after') throw new Error('transport failed with unknown commit state');
      return plan.receipt;
    },
  };
  const executor = createCe012GuideCommandExecutor({ core, documents, runtime });
  const buildCommand = (input) => {
    state.buildCount += 1;
    const command = {
      contract: CE012_GUIDE_COMMAND_CONTRACT,
      version: 1,
      command_id: nextId(),
      action: 'save_draft',
      ...(state.buildIdentity ?? state.active),
      guide_id: input.guide_id,
      expected_guide_version: state.guide.current_version,
      payload: {
        title: input.title,
        step_id: uuid(8),
        step_title: input.step_title,
        instructions: input.step_body,
        document_target: input.target_id === null ? null : target,
      },
      idempotency_key: `ce012:editor:${nextId()}`,
    };
    command.payload_fingerprint = fingerprintCe012GuideSavePayload(command);
    state.lastCommand = command;
    return command;
  };
  const editor = createCe012GuideEditorAdapter({
    executor,
    buildCommand,
    getActiveIdentity: () => ({ ...state.active }),
  });
  return { state, executor, editor, buildCommand };
}

const saved = createHarness();
await saved.editor.saveDraft(uiInput);
assert.equal(saved.state.guide.current_version, 2);
assert.equal(saved.state.commitCount, 1);
assert.equal(saved.state.receipts.get(saved.state.lastCommand.idempotency_key).document_target.label, 'Provider safe label');
const replay = await saved.executor.execute(saved.state.lastCommand);
assert.equal(replay.result_code, 'OK');
assert.equal(replay.replayed, true);
assert.equal(saved.state.commitCount, 1, 'replay does not commit again');

const failed = createHarness();
failed.state.failCommit = 'before';
await assert.rejects(failed.editor.saveDraft(uiInput), /before commit/);
await Promise.resolve();
assert.equal(failed.state.guide.current_version, 1);
assert.equal(failed.state.commitCount, 0);
await failed.editor.saveDraft(uiInput);
assert.equal(failed.state.buildCount, 1, 'failure retry retains the exact command and idempotency key');
assert.equal(failed.state.guide.current_version, 2);
assert.equal(failed.state.commitCount, 1);

const unknown = createHarness();
unknown.state.failCommit = 'after';
await assert.rejects(unknown.editor.saveDraft(uiInput), /unknown commit state/);
await Promise.resolve();
assert.equal(unknown.state.guide.current_version, 2);
assert.equal(unknown.state.commitCount, 1);
await unknown.editor.saveDraft(uiInput);
assert.equal(unknown.state.buildCount, 1, 'unknown-commit retry reuses the exact command');
assert.equal(unknown.state.commitCount, 1, 'unknown-commit retry resolves through replay');

const staleGuide = createHarness();
const staleCommand = staleGuide.buildCommand(uiInput);
staleGuide.state.guide.current_version = 2;
const staleGuideResult = await staleGuide.executor.execute(staleCommand);
assert.equal(staleGuideResult.result_code, 'STALE_GUIDE');
assert.equal(staleGuideResult.mutation_plan, null);
assert.equal(staleGuide.state.commitCount, 0);

const staleDocument = createHarness();
staleDocument.state.documentResult = 'stale';
await assert.rejects(
  staleDocument.editor.saveDraft(uiInput),
  (error) => error instanceof Ce012GuideCommandRejectedError && error.evaluation.result_code === 'DOCUMENT_STALE',
);
assert.equal(staleDocument.state.commitCount, 0);

const revoked = createHarness();
revoked.state.authority = 'revoked';
await assert.rejects(
  revoked.editor.saveDraft(uiInput),
  (error) => error instanceof Ce012GuideCommandRejectedError && error.evaluation.result_code === 'AUTHORITY_DENIED',
);
assert.equal(revoked.state.documentCalls, 0, 'revoked authority never calls Documents');
assert.equal(revoked.state.commitCount, 0);

const switched = createHarness();
let releaseCore;
switched.state.waitForCore = { promise: new Promise((resolve) => { releaseCore = resolve; }) };
const lateSave = switched.editor.saveDraft(uiInput);
await Promise.resolve();
switched.state.active = { ...switched.state.active, workspace_id: uuid(40) };
releaseCore();
await assert.rejects(lateSave, (error) => error instanceof Ce012EditorCompletionDiscardedError);
assert.equal(switched.state.commitCount, 1, 'server command stays scoped to its original Workspace');

const duplicate = createHarness();
let releaseDuplicate;
duplicate.state.waitForCore = { promise: new Promise((resolve) => { releaseDuplicate = resolve; }) };
const firstPending = duplicate.editor.saveDraft(uiInput);
const secondPending = duplicate.editor.saveDraft(uiInput);
assert.equal(firstPending, secondPending, 'identical concurrent saves share one promise');
releaseDuplicate();
await firstPending;
assert.equal(duplicate.state.coreCalls, 1);
assert.equal(duplicate.state.commitCount, 1);

const switchedBeforeStart = createHarness();
switchedBeforeStart.state.active = { ...switchedBeforeStart.state.active, workspace_id: uuid(41) };
switchedBeforeStart.state.buildIdentity = { ...baseIdentity };
await assert.rejects(switchedBeforeStart.editor.saveDraft(uiInput), (error) => error instanceof Ce012EditorCompletionDiscardedError);
assert.equal(switchedBeforeStart.state.coreCalls, 0, 'mismatched active Workspace is rejected before Provider calls');
assert.equal(switchedBeforeStart.state.commitCount, 0);

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { createRoot } = await import('react-dom/client');
const runtimeFile = path.resolve('work/ce012-editor-adapter-runtime.mjs');
fs.mkdirSync(path.dirname(runtimeFile), { recursive: true });
fs.writeFileSync(runtimeFile, ts.transpileModule(fs.readFileSync('src/components/customer/CustomerExperienceGuide.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText);
const { CustomerExperienceGuide } = await import(runtimeFile);
const root = createRoot(document.getElementById('root'));
const localizedSuccess = {
  ro: 'Ciorna ghidului a fost salvată.',
  en: 'Guide draft saved.',
  fa: 'پیش‌نویس راهنما ذخیره شد.',
};

try {
  for (const [lang, expected] of Object.entries(localizedSuccess)) {
    const harness = createHarness();
    const guide = {
      guide_id: baseIdentity.guide_id,
      workspace_id: baseIdentity.workspace_id,
      title: 'Arrival guide',
      audience_label: 'Residents',
      status: 'draft',
      version: 1,
      can_edit: true,
      steps: [{ id: uuid(8), title: 'Before arrival', body: 'Read the current instructions.', references: [] }],
    };
    const targets = [{ id: 'target-document', label: 'Named document', type: 'document' }];
    await act(async () => root.render(React.createElement(CustomerExperienceGuide, {
      key: `adapter:${lang}`,
      lang,
      guide,
      targets,
      commands: harness.editor,
    })));
    const form = document.querySelector('form');
    await act(async () => {
      form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.equal(form.querySelector('[role="status"]').textContent, expected);
    assert.equal(harness.state.commitCount, 1);
    assert.equal(document.querySelector('section').getAttribute('dir'), lang === 'fa' ? 'rtl' : 'ltr');
  }
} finally {
  await act(async () => root.unmount());
  fs.rmSync(runtimeFile, { force: true });
}

console.log('CE012 editor adapter harness passed: injected save/retry/replay, stale Guide/document, revoked authority, Workspace switch, late completion and mounted RO/EN/FA');
