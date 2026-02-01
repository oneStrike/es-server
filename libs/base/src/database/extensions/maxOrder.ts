import { Prisma } from '../index'

/**
 * 获取当前模型的最大排序值
 */
export async function maxOrder<T>(
  this: T,
  where?: Prisma.Args<T, 'findMany'>['where'],
  field: string = 'order',
): Promise<number> {
  const context = Prisma.getExtensionContext(this) as any

  // 尝试按 `order` 字段倒序获取第一条
  const byOrder = await context.findFirst({
    where,
    orderBy: [{ [field]: 'desc' }],
    select: { [field]: true },
  })
  if (byOrder && typeof byOrder[field] === 'number') {
    return byOrder[field]
  }

  return 0
}
