export function filterWritableKeys<TWrite>(
  data: TWrite,
  writableKeys: readonly (keyof TWrite)[],
  allowedKeys?: ReadonlySet<string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of writableKeys) {
    if (allowedKeys && !allowedKeys.has(key as string)) continue;
    if (key in (data as Record<string, unknown>)) {
      result[key as string] = (data as Record<string, unknown>)[key as string];
    }
  }
  return result;
}
