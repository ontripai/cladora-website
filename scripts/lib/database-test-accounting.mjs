// Static accounting only; this never executes SQL or certifies a native proof.
const assertion = /^select\s+(?:has_schema|has_table|has_function|has_trigger|has_column|hasnt_column|results_eq|ok|is|isnt|alike|unalike|cmp_ok|lives_ok|throws_like|throws_ok|col_is_null|matches)\s*\(/i;

export function countTapAssertions(sql) {
  sql = sql.replace(/select\s+\*\s+from\s+skip\(\s*'(?:''|[^'])*'\s*,\s*\d+\s*\)/gim,
    match => match.replace(/\n\s*/g, ' '));
  let count = 0;
  const stack = [];
  for (const line of sql.split('\n')) {
    if (/^\\if\s/.test(line)) {
      stack.push({ before: count, branches: [], hasElse: false });
      continue;
    }
    if (/^\\(?:elif\s|else\s*$)/.test(line)) {
      const frame = stack.at(-1);
      if (!frame || frame.hasElse) throw Error('invalid psql conditional');
      frame.branches.push(count - frame.before);
      frame.hasElse = /^\\else/.test(line);
      count = frame.before;
      continue;
    }
    if (/^\\endif\s*$/.test(line)) {
      const frame = stack.pop();
      if (!frame) throw Error('unmatched psql endif');
      frame.branches.push(count - frame.before);
      if (!frame.hasElse) frame.branches.push(0);
      if (new Set(frame.branches).size !== 1) throw Error('psql branches have unequal TAP assertion counts');
      count = frame.before + frame.branches[0];
      continue;
    }
    if (assertion.test(line)) count++;
    const skip = line.match(/^select\s+\*\s+from\s+skip\(\s*'(?:''|[^'])*'\s*,\s*(\d+)\s*\)/i);
    if (skip) count += Number(skip[1]);
  }
  if (stack.length) throw Error('unterminated psql conditional');
  return count;
}

export function checkTapPlan(sql, assertions) {
  const fixed = [...sql.matchAll(/^select\s+plan\((\d+)\)\s*;/gim)];
  const dynamic = [...sql.matchAll(/^select\s+no_plan\(\)\s*;/gim)];
  if (fixed.length + dynamic.length !== 1) throw Error('expected exactly one TAP plan or no_plan');
  if (dynamic.length) {
    if (!/^select\s+\*\s+from\s+finish\(\)\s*;/im.test(sql)) throw Error('missing TAP finish');
    if (assertions < 1) throw Error('no_plan must have assertions');
    return 'dynamic';
  }
  const plan = Number(fixed[0][1]);
  if (plan !== assertions) throw Error(`plan ${plan} does not match ${assertions} assertions`);
  return 'fixed';
}
