import { Prisma } from '../index'

/**
 * 判断记录是否存在
 * 注意：如果模型支持软删除，请手动在 where 中添加 deletedAt: null 条件
 */
export async function exists<T>(
  this: T,
  where: Prisma.Args<T, 'findFirst'>['where'],
) {
  const context = Prisma.getExtensionContext(this)

  const result = await (context as any).findFirst({
    where,
    select: { id: true },
  })
  return result !== null
}

/**
 * 判断记录是否存在（自动排除已软删除的记录）
 * 仅适用于有 deletedAt 字段的模型
 */
export async function existsActive<T>(
  this: T,
  where: Prisma.Args<T, 'findFirst'>['where'],
) {
  const context = Prisma.getExtensionContext(this)

  // 自动拼接软删除条件
  const whereWithSoftDelete = where && typeof where === 'object'
    ? { deletedAt: null, ...where }
    : { deletedAt: null }

  const result = await (context as any).findFirst({
    where: whereWithSoftDelete,
    select: { id: true },
  })
  return result !== null
}
