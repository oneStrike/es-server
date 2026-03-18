export function extractRows<T>(result: unknown): T[] {
  if (!result || typeof result !== 'object' || !('rows' in result)) {
    return []
  }
  const rows = (result as { rows?: unknown }).rows
  return Array.isArray(rows) ? (rows as T[]) : []
}
