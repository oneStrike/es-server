import { NotFoundException } from '@nestjs/common'
import { Prisma } from '../index'

/**
 * 应用计数变化（支持增减）
 * 使用 updateMany 避免 select 查询，提升性能
 * @param where - 查询条件
 * @param field - 计数字段名
 * @param delta - 变化量（正数增加，负数减少）
 */
export async function applyCountDelta<T>(
  this: T,
  where: Prisma.Args<T, 'findUnique'>['where'],
  field: string,
  delta: number,
) {
  if (delta === 0) {
    return
  }

  const context = Prisma.getExtensionContext(this) as any

  if (delta > 0) {
    const updated = await context.updateMany({
      where,
      data: { [field]: { increment: delta } },
    })

    if (updated.count === 0) {
      throw new NotFoundException('目标不存在')
    }
    return
  }

  // delta < 0 时，确保不会减到负数
  const amount = Math.abs(delta)
  await context.updateMany({
    where: {
      ...where,
      [field]: { gte: amount },
    },
    data: { [field]: { decrement: amount } },
  })
}
