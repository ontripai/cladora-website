/** Pure request-local error brands, not authority or caller-supplied flags. */
const accessDenied = new WeakSet<object>();
const authenticationRequired = new WeakSet<object>();

function branded(cause: unknown, code: string, brand: WeakSet<object>): Error {
  const error = new Error(code);
  Object.defineProperty(error, 'cause', { value: cause });
  brand.add(error);
  return error;
}

export function serviceRequestReadAccessDeniedV1(cause: unknown): Error {
  return branded(cause, 'SERVICE_ACCESS_DENIED', accessDenied);
}

export function serviceRequestReadAuthenticationRequiredV1(cause: unknown): Error {
  return branded(cause, 'UNAUTHORIZED', authenticationRequired);
}

export function isServiceRequestReadAccessDeniedV1(error: unknown): boolean {
  return typeof error === 'object' && error !== null && accessDenied.has(error);
}

export function isServiceRequestReadAuthenticationRequiredV1(error: unknown): boolean {
  return typeof error === 'object' && error !== null && authenticationRequired.has(error);
}
