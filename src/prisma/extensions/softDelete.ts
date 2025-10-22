import { BadRequestException } from '@nestjs/common'
import { Prisma } from '../client/client'

/**
 * 软删除：单条
 */
export async function softDelete<T>(
  this: T,
  where: Prisma.Args<T, 'findUnique'>['where'],
): Promise<number> {
  const context = Prisma.getExtensionContext(this) as any
  const target = await context.findUnique({
    where,
    select: { deletedAt: true },
  })
  if (!target) {
    throw new BadRequestException('删除失败：数据不存在')
  }

  if (target.deletedAt !== null) {
    throw new BadRequestException('删除失败：数据已被删除')
  }

  await context.update({
    where,
    data: {
      deletedAt: new Date(),
    },
  })
  return target.id
}

/**
 * 软删除：批量
 */
export async function softDeleteMany<T>(
  this: T,
  where: Prisma.Args<T, 'findMany'>['where'],
): Promise<number> {
  const context = Prisma.getExtensionContext(this) as any

  // 尝试批量写入 deletedAt 与可选 deletedBy
  const result = await context.updateMany({
    where,
    data: {
      deletedAt: new Date(),
    },
  })
  return result.count
}
