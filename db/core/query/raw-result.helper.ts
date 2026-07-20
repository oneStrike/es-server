/**
 * 从可能为空或不规范的结果对象中安全提取 rows 数组。
 */
export function extractRows<T>(
  result: { rows?: T[] | null } | object | null | undefined,
): T[] {
  if (!result || typeof result !== 'object' || !('rows' in result)) {
    return []
  }
  const rows = result.rows
  return Array.isArray(rows) ? rows : []
}
