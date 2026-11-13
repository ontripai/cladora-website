// Exact source-only replacement of two obsolete textual MFA checks.
// The historical fixture pin is preserved; no runtime/native admission follows.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const shellPath = 'scripts/test-real-authenticated-service-08.mjs';
const helperPath = 'scripts/lib/app-layout-mfa-composition.mjs';
const sha = b => createHash('sha256').update(b).digest('hex');
const transitions = [
  ["import ts from 'typescript';\n", "import ts from 'typescript';\nimport { verifyAppLayoutMfaComposition } from './lib/app-layout-mfa-composition.mjs';\n"],
  ["check(appLayoutCode.includes(\"redirect(`/${lang}/mfa/setup?reason=customer_required`)\"), 'AppLayout forces MFA setup when required');", "const layoutMfa = await verifyAppLayoutMfaComposition();\nconsole.log(\"AppLayout controlled MFA composition:\", layoutMfa);\ncheck(layoutMfa.setupRequired, 'AppLayout forces MFA setup when required');"],
  ["check(appLayoutCode.includes(\"<CustomerAppShell lang={lang}>{children}</CustomerAppShell>\"), 'AppLayout renders CustomerAppShell for authorized sessions');", "check(layoutMfa.authorizedShell, 'AppLayout renders CustomerAppShell for authorized sessions');"],
];
export function readReviewedServiceShellPreimage(entry, read = p => readFileSync(p)) {
  assert.equal(entry.path, shellPath);
  assert.equal(entry.bytes, 77113);
  assert.equal(entry.sha256, 'b603383d56aaf6ef99f19adc368a7653bc8dd5e9b28b65b4263cd21a20e00303');
  assert.equal(entry.git_blob, '106b8f6d790ee57444c6a9938b6e6006028b9b92');
  assert.equal(sha(read(helperPath)), 'e59ec13fb15a4ca9ffdcd0da68b5530e301963efc7ec282d064b8ddf7ead2f84', 'MFA_COMPOSITION_HELPER_DRIFT');
  let previous = read(shellPath).toString();
  for (const [before, after] of transitions) {
    assert.equal(previous.split(after).length, 2, 'EXACT_REVIEWED_SHELL_TRANSITION');
    previous = previous.replace(after, before);
  }
  const bytes = Buffer.from(previous);
  assert.equal(bytes.length, entry.bytes, 'SHELL_UNREVIEWED_CHANGE');
  assert.equal(sha(bytes), entry.sha256, 'SHELL_UNREVIEWED_CHANGE');
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), entry.git_blob);
  return bytes;
}
