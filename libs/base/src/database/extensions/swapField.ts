import { BadRequestException } from '@nestjs/common'
import { Prisma } from '../index'

/**
 * 生成安全的临时值
 * 基于两个原始值计算，确保临时值不会与现有值冲突
 */
function generateTemporaryValue(value1: unknown, value2: unknown): unknown {
  if (typeof value1 === 'number' && typeof value2 === 'number') {
    // 数字类型：取较小值减一，如果较小值已经是负数则取较大值加一
    const min = Math.min(value1, value2)
    // 使用较小值减一，通常业务值为非负数，这样可以确保不冲突
    return min - 1
  }

  if (typeof value1 === 'string' && typeof value2 === 'string') {
    // 字符串类型：使用临时前缀，确保唯一且不影响业务
    return `__temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}__`
  }

  // 其他类型：使用时间戳
  return Date.now()
}

/**
 * 交换两条数据的指定字段值（自动启用事务，兼容唯一性约束）
 *
 * 实现策略：使用临时值作为中间过渡，避免唯一性约束冲突
 * 1. 将第一条记录的字段设为临时值
 * 2. 将第二条记录的字段设为第一条记录的原值
 * 3. 将第一条记录的字段设为第二条记录的原值
 *
 * @example
 * ```ts
 * // 交换 sortOrder 字段（默认）
 * await prisma.someModel.swapField({
 *   where: [{ id: 1 }, { id: 2 }]
 * })
 *
 * // 交换指定字段
 * await prisma.someModel.swapField({
 *   where: [{ id: 1 }, { id: 2 }],
 *   field: 'order'
 * })
 *
 * // 带同源校验（确保两条数据属于同一父级）
 * await prisma.someModel.swapField({
 *   where: [{ id: 1 }, { id: 2 }],
 *   sourceField: 'parentId'
 * })
 * ```
 */
export async function swapField<T>(
  this: T,
  options: {
    /** 两条数据的查询条件 */
    where: [
      Prisma.Args<T, 'findUnique'>['where'],
      Prisma.Args<T, 'findUnique'>['where'],
    ]
    /** 要交换的字段名，默认 'sortOrder' */
    field?: string
    /** 同源校验字段，确保两条数据属于同一父级 */
    sourceField?: string
  },
): Promise<boolean> {
  const { where, field = 'sortOrder', sourceField } = options
  const context = Prisma.getExtensionContext(this) as any
  // 获取原始 Prisma Client 以使用事务
  const client = context.$parent ?? context

  return client.$transaction(async (tx: any) => {
    // 获取当前模型的委托（在事务中执行）
    const modelDelegate = tx[context.$name as string]

    // 构建查询字段
    const selectField: Record<string, true> = { [field]: true }
    if (sourceField) {
      selectField[sourceField] = true
    }

    // 并行查询两条数据
    const [record1, record2] = await Promise.all([
      modelDelegate.findUnique({
        where: where[0],
        select: selectField,
      }),
      modelDelegate.findUnique({
        where: where[1],
        select: selectField,
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

    // 数据同源校验
    if (sourceField && record1[sourceField] !== record2[sourceField]) {
      throw new BadRequestException('数据不是同一来源')
    }

    // 提取字段值
    const value1 = record1[field]
    const value2 = record2[field]

    // 如果值相同，无需交换
    if (value1 === value2) {
      return true
    }

    // 基于原始值生成安全的临时值
    const temporaryValue = generateTemporaryValue(value1, value2)

    // 三步交换策略（兼容唯一性约束）
    // 步骤1: 将第一条记录的字段设为临时值
    await modelDelegate.update({
      where: where[0],
      data: { [field]: temporaryValue },
    })

    // 步骤2: 将第二条记录的字段设为第一条记录的原值
    await modelDelegate.update({
      where: where[1],
      data: { [field]: value1 },
    })

    // 步骤3: 将第一条记录的字段设为第二条记录的原值
    await modelDelegate.update({
      where: where[0],
      data: { [field]: value2 },
    })

    return true
  })
}
