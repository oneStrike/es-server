/*
 * 简化版：仅导出一个安全 JSON 解析函数。
 * 使用：jsonParse(input, defaultValue)
 * - input 可为对象/数组/string/Buffer/Uint8Array/number/boolean
 * - 解析失败时返回 defaultValue
 */

function isObjectLike(
  value: unknown,
): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null
}

function normalizeInputToString(input: unknown): string | null {
  if (input == null) {
    return null
  } // null 或 undefined

  // 若已是对象/数组，直接交由调用方处理，不再做字符串解析
  if (isObjectLike(input)) {
    return null
  }

  let str: string
  if (typeof input === 'string') {
    str = input
  } else if (typeof input === 'number' || typeof input === 'boolean') {
    // 允许顶级字面量解析（JSON.parse 支持），故转为字符串
    str = String(input)
  } else {
    return ''
  }

  // 去除 BOM 与首尾空白
  str = str.replace(/^\uFEFF/, '').trim()
  return str
}

/**
 * 安全解析 JSON。
 * 仅两个参数：原始值与解析失败时的默认值。
 */
export function jsonParse<T>(input: unknown, defaultValue: T): T {
  // 若已是对象/数组，直接交由调用方处理，不再做字符串解析
  if (isObjectLike(input)) {
    return input as T
  }
  const str = normalizeInputToString(input)
  if (!str) {
    return defaultValue
  }

  // 快速处理空值/占位符
  const lowered = str.toLowerCase()
  if (lowered === 'undefined' || lowered === 'null') {
    return defaultValue
  }

  try {
    const parsed = JSON.parse(str)
    return parsed as T
  } catch {
    return defaultValue
  }
}
