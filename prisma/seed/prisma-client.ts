/**
 * 独立的 Prisma Client 创建模块
 * 不依赖项目中的其他文件，可在 seed 目录独立运行
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../prismaClient/client'

/**
 * 判断当前是否为生产环境
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * 创建带有扩展的 Prisma Client
 * @param connectionString 数据库连接字符串
 * @returns 扩展后的 PrismaClient 实例
 */
export function makePrismaClient(connectionString: string) {
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

/**
 * 获取数据库连接 URL
 * 优先从环境变量 DATABASE_URL 读取，否则使用默认值
 */
export function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  // 生产环境使用环境变量，开发环境使用默认值
  if (isProduction()) {
    throw new Error('生产环境必须设置 DATABASE_URL 环境变量')
  }

  return 'postgresql://postgres:259158@localhost:5432/foo'
}

// 导出 PrismaClient 类型
export type { PrismaClient }
