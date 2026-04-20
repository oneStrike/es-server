import type { PostgresErrorSourceObject } from '@db/core'
import { DrizzleService } from '@db/core'
import { AppUserCountService } from '@libs/user/app-user-count.service';
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { and, eq, inArray } from 'drizzle-orm'
import {
  LikePageQueryDto,
  LikeRecordDto,
} from './dto/like.dto'
import { ILikeTargetResolver } from './interfaces/like-target-resolver.interface'
import { LikeGrowthService } from './like-growth.service'
import { LikeTargetTypeEnum } from './like.constant'

/**
 * 点赞服务
 * 提供点赞、取消点赞、查询点赞状态等核心业务逻辑
 * 通过解析器模式支持多种目标类型（作品、章节、评论、论坛主题等）的点赞操作
 */
@Injectable()
export class LikeService {
  private readonly logger = new Logger(LikeService.name)
  /** 目标类型到解析器的映射表，用于根据目标类型路由到对应的解析器 */
  private readonly resolvers = new Map<
    LikeTargetTypeEnum,
    ILikeTargetResolver
  >()

  constructor(
    private readonly likeGrowthService: LikeGrowthService,
    private readonly appUserCountService: AppUserCountService,
    private readonly drizzle: DrizzleService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get userLike() {
    return this.drizzle.schema.userLike
  }

  private uniqueTargetIds(targetIds: number[]) {
    return [...new Set(targetIds)]
  }

  private resolveErrorCode(
    error: Error | PostgresErrorSourceObject | null | undefined,
  ) {
    return this.drizzle.extractError(error)?.code ?? 'unknown'
  }

  /**
   * 注册目标解析器
   * 供其他模块在应用启动时注册自己的点赞解析器
   * @param resolver - 点赞目标解析器实例
   */
  registerResolver(resolver: ILikeTargetResolver) {
    if (this.resolvers.has(resolver.targetType)) {
      console.warn(
        `Like resolver for type ${resolver.targetType} is being overwritten.`,
      )
    }
    this.resolvers.set(resolver.targetType, resolver)
  }

  /**
   * 获取指定目标类型的解析器
   * @param targetType - 点赞目标类型
   * @returns 对应的目标解析器
   * @throws BadRequestException 当目标类型不支持时抛出异常
   */
  private getResolver(targetType: LikeTargetTypeEnum) {
    const resolver = this.resolvers.get(targetType)
    if (!resolver) {
      throw new BadRequestException('不支持的点赞目标类型')
    }
    return resolver
  }

  /**
   * 批量检查点赞状态
   * 用于在列表页批量查询用户对多个目标的点赞状态
   * @param targetType - 点赞目标类型
   * @param targetIds - 目标ID数组
   * @param userId - 用户ID
   * @returns 目标ID到点赞状态的映射Map（true表示已点赞）
   */
  async checkStatusBatch(
    targetType: LikeTargetTypeEnum,
    targetIds: number[],
    userId: number,
  ): Promise<Map<number, boolean>> {
    if (targetIds.length === 0) {
      return new Map()
    }
    const uniqueTargetIds = this.uniqueTargetIds(targetIds)

    const likes = await this.db
      .select({
        targetId: this.userLike.targetId,
      })
      .from(this.userLike)
      .where(
        and(
          eq(this.userLike.targetType, targetType),
          inArray(this.userLike.targetId, uniqueTargetIds),
          eq(this.userLike.userId, userId),
        ),
      )

    const likedSet = new Set(likes.map((item) => item.targetId))
    const statusMap = new Map<number, boolean>()

    for (const targetId of uniqueTargetIds) {
      statusMap.set(targetId, likedSet.has(targetId))
    }

    return statusMap
  }

  /**
   * 获取目标的点赞列表
   * 查询指定目标的点赞记录，支持分页
   * @param targetType - 点赞目标类型
   * @param targetId - 目标ID
   * @param pageIndex - 页码（默认1）
   * @param pageSize - 每页数量（默认20）
   * @returns 分页点赞记录列表
   */
  async getTargetLikes(
    targetType: LikeTargetTypeEnum,
    targetId: number,
    pageIndex: number = 1,
    pageSize: number = 20,
  ) {
    const page = await this.drizzle.ext.findPagination(this.userLike, {
      where: and(
        eq(this.userLike.targetType, targetType),
        eq(this.userLike.targetId, targetId),
      ),
      pageIndex,
      pageSize,
      orderBy: { createdAt: 'desc' },
    })
    return {
      ...page,
      list: page.list.map((item) => ({
        id: item.id,
        userId: item.userId,
        sceneType: item.sceneType,
        sceneId: item.sceneId,
        commentLevel: item.commentLevel,
        createdAt: item.createdAt,
      })),
    }
  }

  /**
   * 点赞操作
   * 执行完整的点赞流程：解析目标元数据、创建点赞记录、更新计数、执行后置钩子、发放成长奖励
   * @param input - 点赞参数
   * @param input.targetType - 点赞目标类型
   * @param input.targetId - 目标ID
   * @param input.userId - 用户ID
   * @throws BadRequestException 当已点赞或目标不存在时抛出异常
   */
  async like(input: LikeRecordDto): Promise<void> {
    const { targetType, targetId, userId } = input
    const resolver = this.getResolver(targetType)

    await this.drizzle.withTransaction(async (tx) => {
      const targetMeta = await resolver.resolveMeta(tx, targetId)

      await this.drizzle.withErrorHandling(
        () =>
          tx.insert(this.userLike).values({
            targetType,
            targetId,
            sceneType: targetMeta.sceneType,
            sceneId: targetMeta.sceneId,
            commentLevel: targetMeta.commentLevel,
            userId,
          }),
        {
          duplicate: '已点赞',
        },
      )

      await this.appUserCountService.updateLikeCount(tx, userId, 1)
      await resolver.applyCountDelta(tx, targetId, 1)

      if (resolver.postLikeHook) {
        await resolver.postLikeHook(tx, targetId, userId, targetMeta)
      }
    })

    await this.likeGrowthService.rewardLikeCreated(targetType, targetId, userId)
  }

  /**
   * 取消点赞操作
   * 执行完整的取消点赞流程：删除点赞记录、更新计数
   * @param input - 取消点赞参数
   * @param input.targetType - 点赞目标类型
   * @param input.targetId - 目标ID
   * @param input.userId - 用户ID
   * @throws BadRequestException 当点赞记录不存在时抛出异常
   */
  async unlike(input: LikeRecordDto) {
    const { targetType, targetId, userId } = input
    const resolver = this.getResolver(targetType)

    await this.drizzle.withTransaction(async (tx) => {
      const deleted = await tx
        .delete(this.userLike)
        .where(
          and(
            eq(this.userLike.targetType, targetType),
            eq(this.userLike.targetId, targetId),
            eq(this.userLike.userId, userId),
          ),
        )
      this.drizzle.assertAffectedRows(deleted, '点赞记录不存在')

      await this.appUserCountService.updateLikeCount(tx, userId, -1)
      await resolver.applyCountDelta(tx, targetId, -1)
    })
  }

  /**
   * 检查点赞状态
   * 查询指定用户对指定目标的点赞状态
   * @param input - 查询参数
   * @param input.targetType - 点赞目标类型
   * @param input.targetId - 目标ID
   * @param input.userId - 用户ID
   * @returns 是否已点赞（true表示已点赞）
   */
  async checkLikeStatus(input: LikeRecordDto): Promise<boolean> {
    const { targetType, targetId, userId } = input
    return this.drizzle.ext.exists(
      this.userLike,
      and(
        eq(this.userLike.targetType, targetType),
        eq(this.userLike.targetId, targetId),
        eq(this.userLike.userId, userId),
      ),
    )
  }

  /**
   * 获取用户的点赞列表
   * 查询指定用户的点赞记录，支持分页，并关联查询目标详情
   * @param query - 查询参数
   * @param query.targetType - 点赞目标类型
   * @param query.pageIndex - 页码（默认1）
   * @param query.pageSize - 每页数量（默认15）
   * @returns 分页点赞记录列表，包含目标详情
   */
  async getUserLikes(query: LikePageQueryDto & Pick<LikeRecordDto, 'userId'>) {
    const page = await this.drizzle.ext.findPagination(this.userLike, {
      where: and(
        eq(this.userLike.targetType, query.targetType),
        eq(this.userLike.userId, query.userId),
      ),
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      orderBy: { createdAt: 'desc' },
    })

    if (page.list.length === 0) {
      return page
    }

    const resolver = this.getResolver(query.targetType)
    if (!resolver.batchGetDetails) {
      return page
    }

    const targetIds = this.uniqueTargetIds(
      page.list.map((item) => item.targetId),
    )
    if (targetIds.length === 0) {
      return page
    }

    const startedAt = Date.now()
    let detailMap: Map<number, unknown>
    try {
      detailMap = await resolver.batchGetDetails(targetIds)
    } catch (error) {
      const drizzleError =
        error instanceof Error
          ? error
          : typeof error === 'object' && error !== null
            ? (error as PostgresErrorSourceObject)
            : undefined
      this.logger.warn(
        `like_detail_resolve_failed targetType=${query.targetType} batchSize=${targetIds.length} elapsedMs=${Date.now() - startedAt} errorCode=${this.resolveErrorCode(drizzleError)} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return page
    }
    if (!detailMap || detailMap.size === 0) {
      this.logger.warn(
        `like_detail_empty targetType=${query.targetType} batchSize=${targetIds.length} elapsedMs=${Date.now() - startedAt}`,
      )
      return page
    }
    if (detailMap.size < targetIds.length) {
      this.logger.warn(
        `like_detail_partial_missing targetType=${query.targetType} batchSize=${targetIds.length} resolvedSize=${detailMap.size} missingSize=${targetIds.length - detailMap.size} elapsedMs=${Date.now() - startedAt}`,
      )
    }

    return {
      ...page,
      list: page.list.map((item) => {
        const detail = detailMap.get(item.targetId)
        if (detail) {
          return {
            ...item,
            targetDetail: detail,
          }
        }
        return item
      }),
    }
  }
}
