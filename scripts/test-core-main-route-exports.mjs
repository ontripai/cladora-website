import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(root, 'src/app');

const remediatedRoutes = [
  'src/app/api/customer/v1/accounting/route.ts',
  'src/app/api/customer/v1/accounting/periods/route.ts',
  'src/app/api/customer/v1/accounting/periods/[id]/close-readiness/route.ts',
  'src/app/api/customer/v1/accounting/periods/[id]/close/route.ts',
  'src/app/api/customer/v1/billing/route.ts',
  'src/app/api/customer/v1/financial-reports/route.ts',
  'src/app/api/customer/v1/payments/route.ts',
  'src/app/api/public/pilot/route.ts',
];

const allowedRouteExports = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'config',
  'generateStaticParams',
  'revalidate',
  'dynamic',
  'dynamicParams',
  'fetchCache',
  'preferredRegion',
  'runtime',
  'maxDuration',
]);

const allowedPageExports = new Set([
  'default',
  'metadata',
  'generateMetadata',
  'viewport',
  'generateViewport',
  'generateStaticParams',
  'revalidate',
  'dynamic',
  'dynamicParams',
  'fetchCache',
  'preferredRegion',
  'runtime',
  'maxDuration',
  'config',
]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function valueExports(source) {
  const names = [];
  const declarations = [
    /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm,
    /^export\s+(?:declare\s+)?(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm,
  ];

  for (const expression of declarations) {
    for (const match of source.matchAll(expression)) names.push(match[1]);
  }

  if (/^export\s+default\b/m.test(source)) names.push('default');
  if (/^export\s+\*/m.test(source)) names.push('*');

  for (const match of source.matchAll(/^export\s*\{([^}]+)\}\s*(?:from\s+[^;]+)?;/gm)) {
    for (const item of match[1].split(',')) {
      const value = item.trim();
      if (!value || value.startsWith('type ')) continue;
      const parts = value.split(/\s+as\s+/);
      names.push(parts.at(-1).trim());
    }
  }

  return [...new Set(names)].sort();
}

for (const route of remediatedRoutes) {
  assert.ok(fs.existsSync(path.join(root, route)), `${route} must remain present`);
}

const invalid = [];
let checked = 0;
for (const file of walk(appRoot)) {
  const basename = path.basename(file);
  const kind = basename.match(/^route\.(?:[jt]sx?)$/)
    ? 'route'
    : basename.match(/^page\.(?:[jt]sx?)$/)
      ? 'page'
      : null;
  if (!kind) continue;

  checked += 1;
  const allowed = kind === 'route' ? allowedRouteExports : allowedPageExports;
  const names = valueExports(fs.readFileSync(file, 'utf8'));
  const unsupported = names.filter((name) => !allowed.has(name));
  if (unsupported.length) {
    invalid.push({
      file: path.relative(root, file),
      exports: unsupported,
    });
  }
}

assert.deepEqual(invalid, [], `Unsupported Next.js page/route exports:\n${JSON.stringify(invalid, null, 2)}`);

console.log(
  `Next.js page/route export contract passed: ${checked} entrypoints checked; ${remediatedRoutes.length} baseline routes remediated.`
);
