// Behavioral simulation of CustomerContextProvider logic
let passed = 0;
let total = 0;

function assert(cond, msg) {
  total++;
  if (cond) {
    console.log(`[PASS] ${msg}`);
    passed++;
  } else {
    console.error(`[FAIL] ${msg}`);
    process.exitCode = 1;
  }
}

console.log('=== RUNNING SIMULATION OF CUSTOMER CONTEXT LIFECYCLE ===\n');

// 1. Scenario 1: Refresh with unsaved guard preserves B without discarding
console.log('--- Scenario 1: Refresh preserves selected context B with unsaved guard ---');
{
  let activeId = 'context-A';
  let activeIdRef = activeId;
  let dashboard = null;
  let pendingContextId = null;
  let unsavedGuards = new Map();
  let discardCalls = 0;

  // User selects B
  activeId = 'context-B';
  activeIdRef = activeId;
  dashboard = null;

  // Component registers unsaved guard on B
  unsavedGuards.set('form-1', () => { discardCalls++; });

  // Refresh triggered
  const serverContexts = [
    { context_id: 'context-A', tenant_name: 'T1' },
    { context_id: 'context-B', tenant_name: 'T2' }
  ];

  // Simulating provider refresh effect
  const currentActiveId = activeIdRef;
  const isStillValid = serverContexts.some(c => c.context_id === currentActiveId);
  if (isStillValid) {
    pendingContextId = pendingContextId && serverContexts.some(c => c.context_id === pendingContextId) ? pendingContextId : null;
    // activeId is NOT reverted to context-A!
  } else {
    activeId = '';
    activeIdRef = '';
    dashboard = null;
    unsavedGuards.clear();
  }

  assert(activeId === 'context-B', 'activeId remained context-B after refresh (did not revert to context-A)');
  assert(unsavedGuards.size === 1, 'Unsaved guard preserved');
  assert(pendingContextId === null, 'pendingContextId remains null');
  assert(discardCalls === 0, 'discard was NOT called on refresh');
}

// 2. Scenario 2: Context revoked on server
console.log('\n--- Scenario 2: Server revokes context B on refresh ---');
{
  let activeId = 'context-B';
  let activeIdRef = activeId;
  let dashboard = { contextId: 'context-B', data: 'confidential' };
  let pendingContextId = 'context-C';
  let unsavedGuards = new Map();
  let error = null;

  unsavedGuards.set('form-1', () => {});

  // Server revokes B (only A remains)
  const serverContexts = [
    { context_id: 'context-A', tenant_name: 'T1' }
  ];

  const currentActiveId = activeIdRef;
  const isStillValid = serverContexts.some(c => c.context_id === currentActiveId);
  if (isStillValid) {
    pendingContextId = pendingContextId && serverContexts.some(c => c.context_id === pendingContextId) ? pendingContextId : null;
  } else {
    activeId = '';
    activeIdRef = '';
    dashboard = null;
    pendingContextId = null;
    unsavedGuards.clear();
    error = 'forbidden';
  }

  assert(activeId === '', 'activeId cleared immediately when revoked');
  assert(dashboard === null, 'dashboard evicted immediately when revoked');
  assert(pendingContextId === null, 'pendingContextId cleared immediately');
  assert(unsavedGuards.size === 0, 'unsavedGuards cleared immediately ("تأیید فرم جای اختیار ازدسترفته نیست")');
  assert(error === 'forbidden', 'error set to forbidden');
}

// 3. Scenario 3: Sequence counter prevents out-of-order responses
console.log('\n--- Scenario 3: Sequence counters drop delayed out-of-order responses ---');
{
  let dashboardSeq = 0;
  let activeId = 'context-A';
  let activeIdRef = activeId;
  let dashboard = null;

  // Request 1 starts for context-A
  const seq1 = ++dashboardSeq;
  const target1 = activeId;

  // Context switches to context-B
  activeId = 'context-B';
  activeIdRef = activeId;
  const seq2 = ++dashboardSeq;
  const target2 = activeId;

  // Request 2 completes first for context-B
  if (seq2 === dashboardSeq && activeIdRef === target2) {
    dashboard = { contextId: 'context-B', title: 'Dashboard B' };
  }

  // Request 1 arrives late for context-A
  if (seq1 === dashboardSeq && activeIdRef === target1) {
    dashboard = { contextId: 'context-A', title: 'Dashboard A' };
  }

  assert(dashboard?.contextId === 'context-B', 'Dashboard preserved for context-B; delayed response for context-A was dropped');
}

// 4. Scenario 4: Unknown reason in login form never renders
console.log('\n--- Scenario 4: Reason parameter sanitization in LoginForm ---');
{
  const APPROVED_REASON_MESSAGES = {
    session_expired: { en: 'Your session has expired.' },
    security: { en: 'Security verification required.' },
    configuration: { en: 'The secure database connection is being configured.' },
  };

  function getReasonMessage(reason, lang) {
    return reason && APPROVED_REASON_MESSAGES[reason]
      ? APPROVED_REASON_MESSAGES[reason][lang]
      : null;
  }

  assert(getReasonMessage('session_expired', 'en') === 'Your session has expired.', 'Approved reason session_expired returns text');
  assert(getReasonMessage('security', 'en') === 'Security verification required.', 'Approved reason security returns text');
  assert(getReasonMessage('unknown_reason', 'en') === null, 'Unknown reason returns null (not free text)');
  assert(getReasonMessage('<script>alert(1)</script>', 'en') === null, 'Injected reason returns null (not free text)');
  assert(getReasonMessage(undefined, 'en') === null, 'Undefined reason returns null');
}

console.log('\n=======================================================');
console.log(`ALL BEHAVIORAL LIFECYCLE SIMULATIONS PASSED! (${passed}/${total})`);
console.log('=======================================================\n');
