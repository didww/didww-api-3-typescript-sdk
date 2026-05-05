/**
 * Returns a shallow copy of `obj` with each listed key whose value is
 * non-null replaced by `'[FILTERED]'`. The original object is unchanged.
 *
 * Used by per-resource redactors (e.g. `redactSipConfiguration`,
 * `redactCredentialsAndIpAuthenticationMethod`) to strip credentials before
 * logging — wire serialization is never routed through this helper.
 */
export function redactSensitiveKeys<T extends object>(obj: T, keys: ReadonlyArray<keyof T>): T {
  const out = { ...obj };
  for (const key of keys) {
    if (out[key] != null) {
      (out as Record<string, unknown>)[key as string] = '[FILTERED]';
    }
  }
  return out;
}
