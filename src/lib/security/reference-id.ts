import { randomBytes } from 'node:crypto';

// Unambiguous, human-readable uppercase characters (no 0, O, 1, I)
const CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates an unguessable, cryptographically secure Reference ID.
 * Examples: CLD-C7X9KM2A, CLD-P3W8NQ5B
 */
export function generateReferenceId(type: 'contact' | 'pilot'): string {
  const prefix = type === 'pilot' ? 'CLD-P' : 'CLD-C';
  const bytes = randomBytes(8);
  let randomStr = '';
  for (let i = 0; i < 8; i++) {
    randomStr += CHARSET[bytes[i] % CHARSET.length];
  }
  return `${prefix}${randomStr}`;
}
