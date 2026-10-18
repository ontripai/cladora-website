import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routes = [
  ['attachments', 'src/app/api/customer/v1/private-conversations/[id]/attachments/route.ts'],
  ['files', 'src/app/api/customer/v1/private-conversations/[id]/files/route.ts'],
  ['file status', 'src/app/api/customer/v1/private-conversations/[id]/files/status/route.ts'],
  ['upload context', 'src/app/api/customer/v1/private-conversations/[id]/upload-context/route.ts'],
  ['attachment download',
    'src/app/api/customer/v1/private-conversations/attachments/[id]/download/route.ts'],
];

for (const [name, path] of routes) {
  const source = readFileSync(path, 'utf8');
  assert.match(source, /CANONICAL_PRIVATE_ATTACHMENT_UNAVAILABLE/,
    `${name} uses the canonical D6 maintenance code`);
  assert.match(source, /status:\s*503/, `${name} is explicitly unavailable before activation`);
  assert.doesNotMatch(source, /\.rpc\(|createAdminClient|createSignedUrl|\.storage\b/,
    `${name} cannot reach a legacy RPC or Storage effect`);
  assert.doesNotMatch(source, /communications-document-attachment-workspace-v2/,
    `${name} does not activate the inactive D6 adapter`);
}

const mutationRoutes = routes.slice(0, 4).map(([, path]) => readFileSync(path, 'utf8'));
for (const source of mutationRoutes) {
  if (/export async function POST/.test(source)) {
    assert.match(source, /hasTrustedMutationOrigin/);
    assert.match(source, /isApplicationJson/);
    assert.match(source, /parseJsonWithLimit/);
  }
}

console.log('Communications document attachment HTTP V2: 5/5 maintenance routes PASS');
