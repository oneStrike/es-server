export function extractRows<T>(
  result: { rows?: T[] | null } | object | null | undefined,
): T[] {
  if (!result || typeof result !== 'object' || !('rows' in result)) {
    return []
  }
  const rows = (result).rows
  return Array.isArray(rows) ? rows : []
}
