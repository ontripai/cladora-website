/** Bounded source-only failures. Never include SQL, rows or caller-private details. */
export class CoreS01UnavailableV1 extends Error {
  constructor(readonly code: 'SOURCE_NOT_READY'|'INVALID_INPUT'|'SOURCE_UNAVAILABLE'|'SOURCE_INVARIANT') {
    super(code);this.name='CoreS01UnavailableV1';
  }
}
