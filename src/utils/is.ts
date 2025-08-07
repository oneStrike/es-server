/**
 * 检查值是否不为 null 或 undefined
 * @param value 要检查的值
 * @returns 如果值不为 null 或 undefined 则返回 true，否则返回 false
 */
export function isNotNil<T>(value: T): value is NonNullable<T> {
  return value != null
}

/**
 * 检查值是否为布尔类型
 * @param value 要检查的值
 * @returns 如果值是布尔类型则返回 true，否则返回 false
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}
