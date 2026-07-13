import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

// 递归排序对象键；数组顺序由调用方按领域稳定键提前确定。
export function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJson(item))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort((left, right) =>
    left.localeCompare(right),
  )) {
    sorted[key] = canonicalizeJson((value as Record<string, unknown>)[key])
  }
  return sorted
}

// 生成跨平台稳定的 UTF-8/LF JSON 文本。
export function stringifyCanonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalizeJson(value), null, 2)}\n`
}

// 计算 canonical JSON payload 的 SHA-256。
export function hashCanonicalJson(value: unknown): string {
  return createHash('sha256')
    .update(stringifyCanonicalJson(value), 'utf8')
    .digest('hex')
}

// 将 canonical JSON 写入指定路径。
export function writeCanonicalJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, stringifyCanonicalJson(value), 'utf8')
}
