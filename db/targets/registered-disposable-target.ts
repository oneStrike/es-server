import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

type DatabaseTargetClassification =
  'disposable' | 'preserve' | 'production-shared-unknown'

type DatabaseTargetResetPolicy = 'denied' | 'explicit-local-only'

interface DatabaseTargetRegistryEntry {
  allowedLocalHosts: string[]
  databaseName?: string
  id: string
  plannedClassification: Exclude<
    DatabaseTargetClassification,
    'production-shared-unknown'
  >
  purpose: string
  resetPolicy: DatabaseTargetResetPolicy
  sourceEnv: string
  sourcePort: number
}

interface DatabaseTargetRegistry {
  targets: DatabaseTargetRegistryEntry[]
  version: 2
}

const DATABASE_TARGET_REGISTRY_PATH = resolve(
  __dirname,
  '..',
  'database-targets.json',
)
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

export interface RegisteredDisposableDatabaseTarget {
  databaseName: string
  id: string
  safeLabel: string
  sourceUrl: string
  url: string
}

/**
 * 只为会实际连接数据库的本地验证/修复脚本派生目标 URL。
 *
 * 不接受 preserve、共享或未登记目标；调用方仍必须在已连接的 session 上断言
 * `current_database()`，避免 URL 配置漂移把写入落到错误数据库。
 */
export function readRegisteredDisposableDatabaseTarget(
  targetId: string,
): RegisteredDisposableDatabaseTarget {
  if (!/^[a-z0-9-]+$/i.test(targetId)) {
    throw new Error('target id must be a registered identifier')
  }

  const entry = readRegistry().targets.find(
    (candidate) => candidate.id === targetId,
  )
  if (!entry) {
    throw new Error(`database target registry is missing ${targetId}`)
  }
  if (
    entry.plannedClassification !== 'disposable' ||
    entry.resetPolicy !== 'explicit-local-only' ||
    !entry.databaseName
  ) {
    throw new Error(`${targetId} is not a registered local disposable target`)
  }

  const allowedHosts = new Set(
    entry.allowedLocalHosts.map((host) => normalizeHost(host)),
  )
  if (
    allowedHosts.size === 0 ||
    [...allowedHosts].some((host) => !LOOPBACK_HOSTS.has(host))
  ) {
    throw new Error(`${targetId} declares an unsafe local host allowlist`)
  }

  const connectionString = process.env[entry.sourceEnv]?.trim()
  if (!connectionString) {
    throw new Error(`${entry.sourceEnv} is required for ${targetId}`)
  }

  let sourceUrl: URL
  try {
    sourceUrl = new URL(connectionString)
  } catch {
    throw new Error(`${entry.sourceEnv} must be a valid PostgreSQL URL`)
  }
  if (
    sourceUrl.protocol !== 'postgres:' &&
    sourceUrl.protocol !== 'postgresql:'
  ) {
    throw new Error(`${entry.sourceEnv} must use a PostgreSQL URL`)
  }
  sourceUrl.port = String(entry.sourcePort)
  if (!allowedHosts.has(normalizeHost(sourceUrl.hostname))) {
    throw new Error(`${targetId} rejects non-local DATABASE_URL host`)
  }
  if (decodeDatabaseName(sourceUrl) === entry.databaseName) {
    throw new Error(
      `${entry.sourceEnv} must point to a source database, not ${targetId}`,
    )
  }

  const targetUrl = new URL(sourceUrl)
  targetUrl.pathname = `/${encodeURIComponent(entry.databaseName)}`
  return {
    databaseName: entry.databaseName,
    id: entry.id,
    safeLabel: `${targetUrl.protocol}//${targetUrl.hostname}:${targetUrl.port || '5432'}/${entry.databaseName}`,
    sourceUrl: sourceUrl.toString(),
    url: targetUrl.toString(),
  }
}

function readRegistry(): DatabaseTargetRegistry {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(DATABASE_TARGET_REGISTRY_PATH, 'utf8'))
  } catch (error) {
    throw new Error(
      `cannot read database target registry: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (
    !isRecord(parsed) ||
    parsed.version !== 2 ||
    !Array.isArray(parsed.targets)
  ) {
    throw new Error('database target registry is invalid')
  }

  const targets = parsed.targets.map((value, index) =>
    readRegistryEntry(value, index),
  )
  if (new Set(targets.map((entry) => entry.id)).size !== targets.length) {
    throw new Error('database target registry contains duplicate ids')
  }
  return { targets, version: 2 }
}

function readRegistryEntry(
  value: unknown,
  index: number,
): DatabaseTargetRegistryEntry {
  if (!isRecord(value)) {
    throw new Error(`database target registry entry ${index + 1} is invalid`)
  }

  const id = readRequiredString(value, 'id', index)
  const purpose = readRequiredString(value, 'purpose', index)
  const sourceEnv = readRequiredString(value, 'sourceEnv', index)
  const sourcePort = readSourcePort(value, index)
  const databaseName = readOptionalString(value, 'databaseName', index)
  const allowedLocalHosts = readStringArray(value, 'allowedLocalHosts', index)
  const plannedClassification = value.plannedClassification
  const resetPolicy = value.resetPolicy
  const hasValidClassification =
    plannedClassification === 'disposable' ||
    plannedClassification === 'preserve'
  const hasValidResetPolicy =
    resetPolicy === 'denied' || resetPolicy === 'explicit-local-only'
  if (!hasValidClassification || !hasValidResetPolicy) {
    throw new Error(`database target registry ${id} has an invalid policy`)
  }

  return {
    allowedLocalHosts,
    ...(databaseName ? { databaseName } : {}),
    id,
    plannedClassification,
    purpose,
    resetPolicy,
    sourceEnv,
    sourcePort,
  }
}

function readSourcePort(value: Record<string, unknown>, index: number): number {
  const sourcePort = value.sourcePort
  if (
    typeof sourcePort !== 'number' ||
    !Number.isSafeInteger(sourcePort) ||
    sourcePort < 1 ||
    sourcePort > 65_535
  ) {
    throw new Error(
      `database target registry entry ${index + 1} has an invalid sourcePort`,
    )
  }
  return sourcePort
}

function readRequiredString(
  value: Record<string, unknown>,
  key: string,
  index: number,
): string {
  const field = value[key]
  if (typeof field !== 'string' || !field.trim()) {
    throw new Error(`database target registry entry ${index + 1} lacks ${key}`)
  }
  return field.trim()
}

function readOptionalString(
  value: Record<string, unknown>,
  key: string,
  index: number,
): string | undefined {
  if (!(key in value)) {
    return undefined
  }
  return readRequiredString(value, key, index)
}

function readStringArray(
  value: Record<string, unknown>,
  key: string,
  index: number,
): string[] {
  const field = value[key]
  if (!Array.isArray(field) || field.length === 0) {
    throw new Error(`database target registry entry ${index + 1} lacks ${key}`)
  }
  return field.map((entry) => {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new Error(
        `database target registry entry ${index + 1} has an invalid ${key}`,
      )
    }
    return entry.trim()
  })
}

function normalizeHost(host: string): string {
  return host
    .replace(/^\[|\]$/gu, '')
    .replace(/\/(?:32|128)$/u, '')
    .trim()
    .toLowerCase()
}

function decodeDatabaseName(url: URL): string {
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
  if (!databaseName || url.pathname.split('/').filter(Boolean).length !== 1) {
    throw new Error('DATABASE_URL must contain exactly one database name')
  }
  return databaseName
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
