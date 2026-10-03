import assert from 'node:assert/strict';
import braces from 'braces';
import micromatch from 'micromatch';

const nested = depth => '{'.repeat(depth) + 'x' + '}'.repeat(depth);

assert.doesNotThrow(() => braces(nested(100)));
assert.throws(() => braces(nested(101)), /depth \(101\).*max depth \(100\)/);
assert.throws(() => braces(nested(3500)), /max depth \(100\)/);
assert.deepEqual(braces('src/{app,lib}/**/*.{js,ts}'), ['src/(app|lib)/**/*.(js|ts)']);
assert.deepEqual(braces('{1..3}'), ['([1-3])']);
assert.equal(micromatch.isMatch('src/app/page.tsx', 'src/{app,lib}/**/*.tsx'), true);
assert.equal(micromatch.isMatch('src/test/page.css', 'src/{app,lib}/**/*.tsx'), false);
assert.throws(() => micromatch.braces(nested(3500)), /max depth \(100\)/);

console.log('braces depth security: 8 assertions passed');
