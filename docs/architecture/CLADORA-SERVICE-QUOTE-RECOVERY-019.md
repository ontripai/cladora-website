# SERVICE quote draft recovery 019

The coordinator draft form keeps its entered scope, exact decimal amount, currency and expiry when a definitive conflict or permission change blocks a write. Refresh re-reads the scoped request/quote projection in place. A successful read discards the stale command and permits a new idempotency key; a failed read keeps the form blocked and its inputs intact. A missing or changed request must be selected or validated again before a new write. An unknown write outcome still retries the frozen payload and key.

Initial reads distinguish session verification (401), unavailable access (403/404) and retryable network/server/invalid-response failures. The latter offers retry in the same context/workspace. Confirmed saves remain confirmed even if history refresh fails. Existing parent remount boundaries still isolate pending commands across context and workspace.

Validation: 12 mounted quote UI scenarios, including RO/EN/FA, exact minor-unit conversion, conflict recovery with retained inputs and fresh key, offline retry, session denial, frozen unknown-outcome retry, duplicate submission and obsolete reply; TypeScript and focused ESLint pass. This slice changes no database, grant, tax treatment, acceptance, order or payment behavior. Live role-based pilot and keyboard/mobile acceptance remain outstanding.
