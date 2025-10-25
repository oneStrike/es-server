import { BadRequestException } from '@nestjs/common'
import { Prisma } from '../client/client'

/**
 * 交换两条数据的指定字段值
 * 注意：此方法不包含事务，如需保证原子性，请在外部使用 $transaction 包裹
 * @example
 * ```ts
 * // 不使用事务（存在数据不一致风险）
 * await prisma.someModel.swapField({ id: 1 }, { id: 2 }, 'order')
 *
 * // 推荐：使用事务确保原子性
 * await prisma.$transaction(async (tx) => {
 *   await tx.someModel.swapField({ id: 1 }, { id: 2 }, 'order')
 * })
 * ```
 * @param where1 第一条数据的查询条件
 * @param where2 第二条数据的查询条件
 * @param field 要交换的字段名
 * @returns 交换成功返回 true
 */
export async function swapField<T>(
  this: T,
  where1: Prisma.Args<T, 'findUnique'>['where'],
  where2: Prisma.Args<T, 'findUnique'>['where'],
  field: string,
): Promise<boolean> {
  const context = Prisma.getExtensionContext(this) as any

  // 并行查询两条数据
  const [record1, record2] = await Promise.all([
    context.findUnique({
      where: where1,
    }),
    context.findUnique({
      where: where2,
    }),
  ])

  // 数据存在性校验
  if (!record1 || !record2) {
    throw new BadRequestException('数据不存在')
  }

  // 字段存在性校验
  if (!(field in record1) || !(field in record2)) {
    throw new BadRequestException(`字段 "${field}" 不存在`)
  }

  // 提取字段值
  const value1 = record1[field]
  const value2 = record2[field]

  // 并行更新两条数据
  await Promise.all([
    context.update({
      where: where1,
      data: { [field]: value2 },
    }),
    context.update({
      where: where2,
      data: { [field]: value1 },
    }),
  ])

  return true
}
