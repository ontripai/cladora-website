import { readSync, openSync, closeSync, fstatSync, constants, writeFileSync } from 'node:fs';
import { loadPinnedPlanCompiler } from './loader.mjs';

// Only these explicit input files and one explicit new private plan output.
// No stdin/stdout plan, default output, target/env discovery or overwrite.
const flags = ['--platform-input', '--documents-input', '--private-plan-output'];
try {
  const args = process.argv.slice(2), paths = new Map();
  if (args.length !== 6) throw Error('EXPLICIT_PRIVATE_PLAN_ARGUMENTS_REQUIRED');
  for (let i = 0; i < args.length; i += 2) {
    if (!flags.includes(args[i]) || paths.has(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw Error('EXPLICIT_PRIVATE_PLAN_ARGUMENTS_REQUIRED');
    paths.set(args[i], args[i + 1]);
  }
  const compiler = loadPinnedPlanCompiler();
  const read = flag => {
    const fd = openSync(paths.get(flag), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = fstatSync(fd);
      if (!stat.isFile() || stat.size > 1048576) throw Error('INPUT_BYTES_BOUND');
      const buffer = Buffer.alloc(stat.size + 1);
      let length = 0, read;
      while (length < buffer.length && (read = readSync(fd, buffer, length, buffer.length - length, null)) > 0) length += read;
      if (length !== stat.size) throw Error('INPUT_BYTES_BOUND');
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, length));
    } finally { closeSync(fd); }
  };
  const result = compiler.compileCasePlanJson(read('--platform-input'), read('--documents-input'));
  if (!result.plan_bytes) {
    console.error(JSON.stringify({ result: 'INVALID_INPUT_NO_PLAN_WRITTEN', code: result.code }));
    process.exitCode = 2;
  } else {
    writeFileSync(paths.get('--private-plan-output'), result.plan_bytes, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    console.error(JSON.stringify({ result: 'PRIVATE_PLAN_WRITTEN_NON_AUTHORIZING', status: result.status,
      compiled_shapes: result.case_results.filter(c => c.outcome === 'COMPILED_SHAPE').length,
      blocked_cases: result.case_results.filter(c => c.outcome === 'BLOCKED').length }));
    process.exitCode = 3; // historical verifier unavailable: never claim all nine ready
  }
} catch (error) {
  const codes = new Set(['EXPLICIT_PRIVATE_PLAN_ARGUMENTS_REQUIRED', 'COMPILER_SOURCE_PIN_MISMATCH',
    'COMPILER_SOURCE_MANIFEST_INVALID', 'COMPILER_UNPINNED_IMPORT', 'INPUT_BYTES_BOUND']);
  console.error(JSON.stringify({ result: 'NO_PLAN_WRITTEN', code: error.code === 'EEXIST'
    ? 'PRIVATE_OUTPUT_ALREADY_EXISTS' : codes.has(error.message) ? error.message : 'INPUT_SOURCE_OR_PRIVATE_OUTPUT_UNAVAILABLE' }));
  process.exitCode = 2;
}
