import type { SeedClientDb } from './db-client.type'
import process from 'node:process'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { relations } from '../core/drizzle-relations'

export type { Db } from './db-client.type'

/** Seed client 与其显式生命周期 owner。 */
export interface SeedDbClient {
  db: SeedClientDb
  pool: Pool
}

// 从环境变量读取 DATABASE_URL，缺失时抛出异常。
export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  return url
}

// 使用连接字符串创建 Drizzle + pg.Pool 客户端实例。
export function createDbClient(connectionString: string): SeedDbClient {
  const pool = new Pool({ connectionString })

  const db = drizzle({
    client: pool,
    relations,
    jit: true,
    logger: process.env.NODE_ENV === 'development',
  })

  return { db, pool }
}

// 关闭 seed 客户端的底层连接池。
export async function disconnectDbClient({ pool }: SeedDbClient) {
  await pool.end()
}
