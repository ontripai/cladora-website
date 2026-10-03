'use strict';

// CLADORA depth-only backport for CVE-2026-93687. No upstream release claimed.
module.exports = (options = {}) => {
  const value = options.maxDepth;
  if (value === undefined) return 100;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    throw new TypeError('maxDepth must be a finite positive number');
  }
  return Math.min(100, Math.floor(value));
};
