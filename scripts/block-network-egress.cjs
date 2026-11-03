// scripts/block-network-egress.cjs
// Enforces strict fail-closed network egress blocking for test processes.
// Only loopback connections (127.0.0.1, localhost, ::1) are permitted.

// Keep the synchronous CommonJS preloader compatible with the Node 22 CI runtime.
const net = process.getBuiltinModule('node:net');

const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function isAllowed(host) {
  if (!host) return true; // Unix socket or local IPC
  const h = String(host).toLowerCase();
  return ALLOWED_HOSTS.has(h) || h.startsWith('127.');
}

function extractHost(args) {
  let first = args[0];
  if (Array.isArray(first)) {
    first = first[0];
  }
  if (typeof first === 'object' && first !== null) {
    return first.host || first.hostname || '127.0.0.1';
  }
  if (typeof args[1] === 'string') {
    return args[1];
  }
  return '127.0.0.1';
}

const originalSocketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const host = extractHost(args);
  if (!isAllowed(host)) {
    const err = new Error(`[EGRESS_BLOCKED] Outbound network egress blocked by test harness for host: ${host}`);
    err.code = 'ECONNREFUSED_EGRESS_BLOCKED';
    process.stderr.write(`[EGRESS_GUARD] Blocked outbound socket connection to: ${host}\n`);
    this.destroy(err);
    return this;
  }
  return originalSocketConnect.apply(this, args);
};

if (typeof globalThis.fetch === 'function') {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = function (input, init) {
    let urlString;
    if (typeof input === 'string') urlString = input;
    else if (input && typeof input.url === 'string') urlString = input.url;
    else if (input && input.href) urlString = input.href;

    if (urlString) {
      try {
        const parsed = new URL(urlString);
        if (!isAllowed(parsed.hostname)) {
          process.stderr.write(`[EGRESS_GUARD] Blocked outbound fetch to: ${parsed.hostname}\n`);
          return Promise.reject(new Error(`[EGRESS_BLOCKED] Outbound fetch blocked for host: ${parsed.hostname}`));
        }
      } catch (e) {
        // ignore parse error, allow fetch to handle invalid URL
      }
    }
    return originalFetch.apply(this, arguments);
  };
}

process.stderr.write('[EGRESS_GUARD] Strict loopback-only network egress blocker active.\n');
