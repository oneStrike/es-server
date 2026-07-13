import type { PoolClient } from 'pg'
import process from 'node:process'

const SESSION_LOCK_KEY = 'es-server:drizzle-rqb-v2:baseline-migrate'
const SESSION_LOCK_SEED = 0
const DEFAULT_LOCK_TIMEOUT_MS = 30_000
const LOCK_RETRY_INTERVAL_MS = 250

export function readMigrationLockTimeoutMs() {
  const rawValue = process.env.DRIZZLE_MIGRATION_LOCK_TIMEOUT_MS
  if (rawValue === undefined) {
    return DEFAULT_LOCK_TIMEOUT_MS
  }
  if (!/^\d+$/u.test(rawValue)) {
    throw new Error('DRIZZLE_MIGRATION_LOCK_TIMEOUT_MS must be an integer')
  }
  const timeout = Number(rawValue)
  if (!Number.isSafeInteger(timeout) || timeout < 1_000 || timeout > 300_000) {
    throw new Error(
      'DRIZZLE_MIGRATION_LOCK_TIMEOUT_MS must be between 1000 and 300000',
    )
  }
  return timeout
}

export async function acquireMigrationSessionLock(
  client: PoolClient,
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs
  let attempts = 0

  while (Date.now() <= deadline) {
    attempts += 1
    const result = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock(hashtextextended($1::text, $2::bigint)) AS acquired',
      [SESSION_LOCK_KEY, SESSION_LOCK_SEED],
    )
    if (result.rows[0]?.acquired) {
      return { attempts }
    }
    await new Promise<void>((resolveDelay) => {
      setTimeout(resolveDelay, LOCK_RETRY_INTERVAL_MS)
    })
  }

  throw new Error(
    `Timed out waiting for the migration session lock after ${timeoutMs}ms`,
  )
}

export async function releaseMigrationSessionLock(client: PoolClient) {
  const result = await client.query<{ released: boolean }>(
    'SELECT pg_advisory_unlock(hashtextextended($1::text, $2::bigint)) AS released',
    [SESSION_LOCK_KEY, SESSION_LOCK_SEED],
  )
  if (!result.rows[0]?.released) {
    throw new Error('Migration session lock was not released by the holder')
  }
}
