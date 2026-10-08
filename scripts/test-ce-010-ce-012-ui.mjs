import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const root = process.cwd();
async function compile(name) {
  const source = fs.readFileSync(path.join(root, `src/components/customer/${name}.tsx`), 'utf8');
  const target = path.join(root, `scripts/.${name}.runtime.mjs`);
  fs.writeFileSync(target, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText);
  return { target, module: await import(`./.${name}.runtime.mjs?${Date.now()}`) };
}

const communityCompiled = await compile('CustomerCommunityBase');
const guideCompiled = await compile('CustomerExperienceGuide');
const { CustomerCommunityBase } = communityCompiled.module;
const { CustomerExperienceGuide } = guideCompiled.module;
const community = (workspace_id = 'workspace-a', community_id = 'community-a') => ({ community_id, workspace_id, name: 'Named community', audience_label: 'Members', can_create_announcement: true, can_decide_reports: true, announcements: [{ id: 'announcement-a', title: 'Safety notice', body: 'Use the named entrance.', status: 'published', version: 2, can_report: true }], reports: [{ id: 'report-a', target_title: 'Safety notice', report_reason: 'Needs review', status: 'open', version: 1 }] });
const guide = (workspace_id = 'workspace-a', guide_id = 'guide-a') => ({ guide_id, workspace_id, title: 'Arrival guide', audience_label: 'Members', status: 'draft', version: 1, can_edit: true, steps: [{ id: 'step-a', title: 'Arrival', body: 'Use the main entrance.', references: [{ id: 'ref-a', label: 'Building rules' }] }] });
const targets = [{ id: 'document-a', label: 'Building rules', type: 'document' }];
for (const lang of ['ro', 'en', 'fa']) {
  const communityHtml = renderToStaticMarkup(React.createElement(CustomerCommunityBase, { lang, view: community(), commands: {} }));
  const guideHtml = renderToStaticMarkup(React.createElement(CustomerExperienceGuide, { lang, guide: guide(), targets, commands: {} }));
  assert.match(communityHtml, /Named community/); assert.match(communityHtml, /Safety notice/); assert.match(guideHtml, /Arrival guide/); assert.match(guideHtml, /Building rules/);
  assert.doesNotMatch(`${communityHtml}${guideHtml}`, /UUID|permission|Core|CE-010|CE-012/);
  if (lang === 'fa') { assert.match(communityHtml, /dir="rtl"/); assert.match(guideHtml, /dir="rtl"/); assert.match(communityHtml, /گزارش محتوا/); assert.match(guideHtml, /ارجاع اختیاری/); }
}

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { createRoot } = await import('react-dom/client'); const container = document.getElementById('root'); const app = createRoot(container);
const failCommunity = { createAnnouncement: async () => { throw new Error('expected'); }, reportContent: async () => { throw new Error('expected'); }, decideReport: async () => { throw new Error('expected'); } };
await act(async () => app.render(React.createElement(CustomerCommunityBase, { lang: 'fa', view: community(), commands: failCommunity })));
const communityTextarea = container.querySelector('textarea');
await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(communityTextarea, 'متن حفظ شود'); communityTextarea.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
await act(async () => { communityTextarea.closest('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); });
assert.equal(communityTextarea.value, 'متن حفظ شود'); assert.match(container.querySelector('[role="alert"]').textContent, /ورودی شما حفظ شده است/);
await act(async () => app.render(React.createElement(CustomerCommunityBase, { lang: 'fa', view: community('workspace-b'), commands: failCommunity })));
assert.equal(container.querySelector('textarea').value, '');

const failGuide = { saveDraft: async () => { throw new Error('expected'); } };
await act(async () => app.render(React.createElement(CustomerExperienceGuide, { lang: 'fa', guide: guide(), targets, commands: failGuide })));
const guideInput = container.querySelector('input'); await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(guideInput, 'عنوان حفظ شود'); guideInput.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
await act(async () => { guideInput.closest('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); });
assert.equal(guideInput.value, 'عنوان حفظ شود'); assert.match(container.querySelector('[role="alert"]').textContent, /ورودی شما حفظ شده است/);
await act(async () => app.render(React.createElement(CustomerExperienceGuide, { lang: 'fa', guide: guide('workspace-b'), targets, commands: failGuide })));
assert.equal(container.querySelector('input').value, 'Arrival guide');
await act(async () => app.unmount());
fs.unlinkSync(communityCompiled.target); fs.unlinkSync(guideCompiled.target);

console.log('CE-010/CE-012 UI acceptance passed: RO/EN/FA, RTL, named choices, no internal identifiers, input preservation on failure and state reset across Workspace context.');
