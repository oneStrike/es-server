import { DrizzleService } from '@db/core'
import { InteractionTargetTypeEnum } from '@libs/platform/constant'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { INTERACTION_TARGET_DEFINITIONS } from './interaction-target.definition'

/**
 * 选择字段形状类型
 *
 * 用于定义 Prisma 查询中 select 子句的结构
 * 键为字段名，值为 boolean 表示是否选择该字段
 *
 * @example
 * // 选择 id 和 title 字段
 * const select: SelectShape = { id: true, title: true }
 */
type SelectShape = Record<string, boolean>

/**
 * 交互目标访问服务
 *
 * 该服务是交互模块的核心基础设施服务，为点赞、收藏、浏览、评论、举报等功能
 * 提供统一的目标资源访问能力。
 *
 * 主要职责：
 * 1. 根据目标类型获取对应的 Prisma 模型代理
 * 2. 构建目标查询条件（单个/批量）
 * 3. 验证目标是否存在
 * 4. 原子性地更新目标的计数字段
 *
 * 设计理念：
 * - 消除多个服务中重复的 switch(targetType) 逻辑
 * - 统一目标查询策略，保证一致性和可维护性
 * - 通过定义文件 INTERACTION_TARGET_DEFINITIONS 实现配置化
 *
 * @extends PlatformService
 */
@Injectable()
export class InteractionTargetAccessService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  getTargetTable(targetType: InteractionTargetTypeEnum) {
    const definition = INTERACTION_TARGET_DEFINITIONS[targetType]
    if (!definition) {
      throw new BadRequestException('不支持的交互目标类型')
    }
    const table = (this.drizzle.schema as any)[definition.tableKey]
    if (!table) {
      throw new BadRequestException(`目标模型不存在: ${definition.tableKey}`)
    }
    return table
  }

  /**
   * 获取目标类型对应的 Prisma 模型代理
   *
   * 根据交互目标类型，从定义中查找对应的模型键名，并返回 Prisma 客户端中的模型代理对象。
   * 这消除了多个服务中重复的 switch(targetType) 逻辑。
   *
   * @param client - Prisma 客户端实例（可以是普通客户端或事务客户端）
   * @param targetType - 交互目标类型枚举值
   * @returns 对应的 Prisma 模型代理对象
   * @throws {BadRequestException} 当目标类型不支持时抛出
   * @throws {BadRequestException} 当模型在客户端中不存在时抛出
   *
   * @example
   * // 获取漫画作品模型
   * const workModel = this.getTargetModel(prismaClient, InteractionTargetTypeEnum.COMIC)
   * // 现在可以使用 workModel 进行数据库操作
   * const work = await workModel.findFirst({ where: { id: 1 } })
   */
  getTargetModel(client: any, targetType: InteractionTargetTypeEnum) {
    // 从定义中获取目标类型对应的配置
    const definition = INTERACTION_TARGET_DEFINITIONS[targetType]
    if (!definition) {
      throw new BadRequestException('不支持的交互目标类型')
    }

    // 通过模型键名动态获取 Prisma 模型
    const model = client?.[definition.tableKey]
    if (!model) {
      throw new BadRequestException(
        `目标模型不存在: ${definition.tableKey}`,
      )
    }

    return model
  }

  /**
   * 构建单个目标的查询条件
   *
   * 根据目标类型和目标ID，构建用于 Prisma 查询的 where 条件对象。
   * 不同类型的目标可能需要不同的查询条件结构（如作品需要过滤类型和删除状态）。
   *
   * @param targetType - 交互目标类型枚举值
   * @param targetId - 目标的唯一标识ID
   * @returns Prisma where 条件对象
   * @throws {BadRequestException} 当目标类型不支持时抛出
   *
   * @example
   * // 构建漫画作品的查询条件
   * const where = this.buildTargetWhere(InteractionTargetTypeEnum.COMIC, 123)
   * // 结果: { id: 123, type: 1, deletedAt: null }
   *
   * // 构建评论的查询条件
   * const where = this.buildTargetWhere(InteractionTargetTypeEnum.COMMENT, 456)
   * // 结果: { id: 456, deletedAt: null }
   */
  buildTargetWhere(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Record<string, unknown> {
    const definition = INTERACTION_TARGET_DEFINITIONS[targetType]
    if (!definition) {
      throw new BadRequestException('不支持的交互目标类型')
    }

    // 委托给定义中的构建函数
    return definition.whereBuilder(targetId)
  }

  /**
   * 构建批量查询条件
   *
   * 根据目标类型和目标ID数组，构建用于批量查询的 where 条件对象。
   * 主要用于需要一次性查询多个目标的场景，如批量获取收藏列表、批量更新计数等。
   *
   * @param targetType - 交互目标类型枚举值
   * @param targetIds - 目标ID数组
   * @returns 包含 in 条件的 Prisma where 条件对象
   * @throws {BadRequestException} 当目标类型不支持时抛出
   *
   * @example
   * // 构建漫画作品的批量查询条件
   * const where = this.buildTargetListWhere(InteractionTargetTypeEnum.COMIC, [1, 2, 3])
   * // 结果: { id: { in: [1, 2, 3] }, type: 1, deletedAt: null }
   */
  buildTargetListWhere(
    targetType: InteractionTargetTypeEnum,
    targetIds: number[],
  ): Record<string, unknown> {
    const definition = INTERACTION_TARGET_DEFINITIONS[targetType]
    if (!definition) {
      throw new BadRequestException('不支持的交互目标类型')
    }

    // 委托给定义中的批量构建函数
    return definition.whereInBuilder(targetIds)
  }

  /**
   * 确保目标存在
   *
   * 验证指定的目标是否存在，如果存在则返回目标数据。
   * 这是所有交互操作的前置检查，确保用户操作的目标是有效的。
   *
   * @typeParam T - 返回的目标数据类型，默认为 { id: number }
   * @param targetType - 交互目标类型枚举值
   * @param targetId - 目标的唯一标识ID
   * @param options - 可选配置项
   * @param options.select - 自定义选择字段，默认只选择 id
   * @param options.notFoundMessage - 自定义未找到时的错误消息
   * @returns 目标数据对象
   * @throws {NotFoundException} 当目标不存在时抛出
   *
   * @example
   * // 基础用法 - 只检查存在性
   * await this.ensureTargetExists(InteractionTargetTypeEnum.COMIC, 123)
   *
   * @example
   * // 获取完整数据
   * const work = await this.ensureTargetExists<{ id: number; title: string; authorId: number }>(
   *   InteractionTargetTypeEnum.COMIC,
   *   123,
   *   { select: { id: true, title: true, authorId: true } }
   * )
   *
   * @example
   * // 自定义错误消息
   * await this.ensureTargetExists(
   *   InteractionTargetTypeEnum.COMIC,
   *   123,
   *   { notFoundMessage: '漫画作品不存在或已下架' }
   * )
   */
  async ensureTargetExists<T = { id: number }>(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    options?: {
      select?: SelectShape
      notFoundMessage?: string
    },
  ): Promise<T> {
    const definition = INTERACTION_TARGET_DEFINITIONS[targetType]
    if (!definition) {
      throw new BadRequestException('不支持的交互目标类型')
    }
    const modelKey = definition.tableKey
    const model = (this.db.query as any)[modelKey]
    if (!model) {
      throw new BadRequestException(`目标模型不存在: ${modelKey}`)
    }
    // 构建查询条件
    const where = definition.whereBuilder(targetId)

    const columns = options?.select ?? { id: true }
    const target = await model.findFirst({
      where,
      columns,
    })

    // 目标不存在时抛出异常
    if (!target) {
      throw new NotFoundException(options?.notFoundMessage ?? '目标不存在')
    }

    return target as T
  }

  /**
   * 应用目标计数字段的原子性增量更新
   *
   * 为所有交互目标提供统一的计数更新能力。
   * 使用原子操作确保在并发场景下计数的准确性。
   *
   * 典型应用场景：
   * - 点赞/取消点赞时更新 likeCount
   * - 收藏/取消收藏时更新 favoriteCount
   * - 浏览时更新 viewCount
   * - 评论/删除评论时更新 commentCount
   *
   * @param tx - Prisma 事务客户端（必须使用事务以确保原子性）
   * @param targetType - 交互目标类型枚举值
   * @param targetId - 目标的唯一标识ID
   * @param field - 要更新的计数字段名（如 'likeCount', 'viewCount' 等）
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns Promise<void>
   *
   * @example
   * // 点赞时增加点赞计数
   * await this.applyTargetCountDelta(
   *   tx,
   *   InteractionTargetTypeEnum.COMIC,
   *   123,
   *   'likeCount',
   *   1  // 增加 1
   * )
   *
   * @example
   * // 取消点赞时减少点赞计数
   * await this.applyTargetCountDelta(
   *   tx,
   *   InteractionTargetTypeEnum.COMIC,
   *   123,
   *   'likeCount',
   *   -1  // 减少 1
   * )
   *
   * @example
   * // 在事务中使用（推荐做法）
   * await this.prisma.$transaction(async (tx) => {
   *   // 1. 创建点赞记录
   *   await tx.userLike.create({ data: { ... } })
   *   // 2. 更新目标的点赞计数
   *   await this.applyTargetCountDelta(tx, targetType, targetId, 'likeCount', 1)
   * })
   */
  async applyTargetCountDelta(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    field: string,
    delta: number,
  ) {
    void tx
    // 增量为 0 时无需操作，直接返回
    if (delta === 0) {
      return
    }

    const table = this.getTargetTable(targetType)
    const definition = INTERACTION_TARGET_DEFINITIONS[targetType]
    if (!definition) {
      throw new BadRequestException('不支持的交互目标类型')
    }
    const where = definition.whereBuilder(targetId)
    const condition = this.drizzle.buildWhere(table, {
      and: where as any,
    })
    if (!condition) {
      throw new NotFoundException('目标不存在')
    }
    await this.drizzle.ext.applyCountDelta(table, condition, field, delta)
  }
}
