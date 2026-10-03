import { createHash } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const manifest = JSON.parse(readFileSync(join(root, 'patches/braces-3.0.3-depth-guard.json'), 'utf8'));
const hash = (value) => createHash('sha256').update(value).digest('hex');

export function prepareBracesDepthGuard(packageRoot) {
  const metadata = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  if (metadata.name !== 'braces' || metadata.version !== '3.0.3') {
    throw new Error('Unexpected braces release; review and retire/rebase the backport');
  }
  // Validate EVERY source before changing any of it. Accept only the pinned
  // original or our exact patched bytes; never guess how to patch an unknown file.
  return manifest.files.map((file) => {
    if (!/^lib\/[a-z-]+\.js$/.test(file.path)) throw new Error('Invalid patch path');
    const path = join(packageRoot, file.path);
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (current !== null && hash(current) === file.patched_sha256) return { path, content: current, changed: false };
    if ((current === null ? null : hash(current)) !== file.original_sha256) {
      throw new Error(`Unexpected braces source bytes: ${file.path}`);
    }
    let content = current;
    if (file.content !== undefined) content = file.content;
    else for (const replacement of file.replacements) {
      if (content.split(replacement.before).length !== 2) throw new Error(`Non-unique patch context: ${file.path}`);
      content = content.replace(replacement.before, replacement.after);
    }
    if (hash(content) !== file.patched_sha256) throw new Error(`Incorrect patched bytes: ${file.path}`);
    return { path, content, changed: true };
  });
}

export function applyBracesDepthGuard(packageRoot) {
  const plan = prepareBracesDepthGuard(packageRoot);
  for (const file of plan) if (file.changed) writeFileSync(file.path, file.content);
  return plan.filter((file) => file.changed).length;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  const locations = Object.keys(lock.packages).filter((path) => /(^|\/)node_modules\/braces$/.test(path));
  if (!locations.length) throw new Error('No locked braces installation; review and retire the backport');
  const installed = locations.filter((path) => {
    if (existsSync(join(root, path, 'package.json'))) return true;
    // npm ci --omit=dev legitimately omits this build-tool dependency.
    if (lock.packages[path].dev === true) return false;
    throw new Error(`Missing non-development braces installation: ${path}`);
  });
  if (!installed.length) {
    console.log('No installed braces copies; development toolchain was omitted.');
    process.exit(0);
  }
  const resolved = dirname(require.resolve('braces/package.json'));
  const roots = installed.map((path) => resolve(root, path));
  if (!roots.includes(resolved)) throw new Error('Resolved braces is outside the locked installations');
  // Prepare every locked copy before writing any copy. Future nested installs
  // must also match the pinned release; unknown sources abort installation.
  const plans = roots.map((path) => prepareBracesDepthGuard(path));
  let changed = 0;
  for (const plan of plans) for (const file of plan) if (file.changed) {
    writeFileSync(file.path, file.content); changed++;
  }
  console.log(`braces@3.0.3 depth backport: ${roots.length} installation(s), ${changed} files changed`);
  console.log('Original package identity and npm audit advisory remain visible. No audit exemption is applied.');
}
