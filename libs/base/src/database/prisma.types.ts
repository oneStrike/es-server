import type { makePrismaClient } from './prisma.service'

/**
 * Prisma Client 类型别名
 * 与自定义扩展后的 PrismaClient 保持一致
 */
export type PrismaClientType = ReturnType<typeof makePrismaClient>
