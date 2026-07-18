import { existsSync } from 'node:fs'
import { env, loadEnvFile } from 'node:process'

/**
 * 为 drizzle-kit 需要连库的子命令（migrate / studio）加载环境变量并返回 DATABASE_URL
 *
 * - 若项目根目录存在 `.env` 文件则自动加载
 * - 读取 `DATABASE_URL` 并 trim，缺失时抛出包含命令标签的明确错误
 *
 * @param commandLabel - 调用方命令标签，用于错误消息（如 `'db:migrate'`）
 * @returns 经过 trim 的 `DATABASE_URL` 字符串
 */
export function loadDatabaseUrl(commandLabel: string): string {
  const localEnvFile = '.env'

  if (existsSync(localEnvFile)) {
    loadEnvFile(localEnvFile)
  }

  const databaseUrl = env.DATABASE_URL?.trim()

  if (!databaseUrl) {
    throw new Error(`${commandLabel} 需要 DATABASE_URL`)
  }

  return databaseUrl
}
