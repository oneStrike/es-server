import { Prisma } from '../index'

/**
 * 判断记录是否存在
 * 仅查询主键以降低开销
 */
export async function exists<T>(
  this: T,
  where: Prisma.Args<T, 'findFirst'>['where'],
): Promise<boolean> {
  const context = Prisma.getExtensionContext(this)

  const result = await (context as any).findFirst({
    where,
    select: { id: true },
  })
  return result !== null
}
