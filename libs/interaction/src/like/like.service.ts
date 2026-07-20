import type {
  ILikeTargetResolver,
  LikeTargetMeta,
} from './interfaces/like-target-resolver.type'
import type { LikePageUserQuery } from './like.type'
import {
  acquireIntegrityLocks,
  buildSafeDatabaseDiagnostic,
  DrizzleService,
  toPageResult,
} from '@db/core'
import { UserLevelRuleService } from '@libs/growth/level-rule/level-rule.service'
import { BusinessErrorCode, SceneTypeEnum } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { AppUserCountService } from '@libs/user/app-user-count.service'
import { Injectable, Logger } from '@nestjs/common'
import { and, eq, gte, inArray, lt } from 'drizzle-orm'
import { LikeRecordDto, LikeTargetDetailDto } from './dto/like.dto'
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
  // 目标类型到解析器的映射表，用于根据目标类型路由到对应的解析器。
  private readonly resolvers = new Map<
    LikeTargetTypeEnum,
    ILikeTargetResolver
  >()

  private readonly forumBusiness = 'forum'

  constructor(
    private readonly likeGrowthService: LikeGrowthService,
    private readonly appUserCountService: AppUserCountService,
    private readonly userLevelRuleService: UserLevelRuleService,
    private readonly drizzle: DrizzleService,
  ) {}

  // 复用当前模块共享数据库连接。
  private get db() {
    return this.drizzle.db
  }

  // 复用用户点赞表。
  private get userLike() {
    return this.drizzle.schema.userLike
  }

  // 点赞分页对外 contract；显式固定所有当前可见字段，避免表扩展被列表接口隐式带出。
  private buildUserLikeReadSelect() {
    return {
      id: this.userLike.id,
      targetType: this.userLike.targetType,
      targetId: this.userLike.targetId,
      sceneType: this.userLike.sceneType,
      sceneId: this.userLike.sceneId,
      commentLevel: this.userLike.commentLevel,
      userId: this.userLike.userId,
      createdAt: this.userLike.createdAt,
    }
  }

  // 对目标 ID 数组去重。
  private uniqueTargetIds(targetIds: number[]) {
    return [...new Set(targetIds)]
  }

  // 从异常中提取安全 SQLSTATE，缺失时返回 'unknown'。
  private resolveErrorCode(error: unknown) {
    return this.drizzle.classifyError(error)?.sqlState ?? 'unknown'
  }

  private buildDetailResolveDiagnostic(error: unknown) {
    return JSON.stringify(buildSafeDatabaseDiagnostic(error))
  }

  // 将解析器返回的原始对象安全映射为点赞目标详情 DTO。
  private toLikeTargetDetail(detail: unknown): LikeTargetDetailDto | null {
    if (!detail || typeof detail !== 'object') {
      return null
    }
    const item = detail as Record<string, unknown>
    const id = item.id
    if (typeof id !== 'number') {
      return null
    }
    const user = item.user as Record<string, unknown> | null | undefined
    const userId = user?.id
    const userNickname = user?.nickname

    return {
      id,
      name: typeof item.name === 'string' ? item.name : null,
      cover: typeof item.cover === 'string' ? item.cover : null,
      title: typeof item.title === 'string' ? item.title : null,
      images: Array.isArray(item.images)
        ? item.images.filter(
            (image): image is string => typeof image === 'string',
          )
        : null,
      videos: item.videos ?? null,
      floor: typeof item.floor === 'number' ? item.floor : null,
      content: typeof item.content === 'string' ? item.content : null,
      createdAt: item.createdAt instanceof Date ? item.createdAt : null,
      user:
        typeof userId === 'number' && typeof userNickname === 'string'
          ? {
              id: userId,
              nickname: userNickname,
            }
          : null,
    }
  }

  // 判断点赞目标是否属于论坛业务，返回对应的业务标识或 null。
  private resolveLevelBusiness(
    targetType: LikeTargetTypeEnum,
    targetMeta: LikeTargetMeta,
  ) {
    if (
      targetType === LikeTargetTypeEnum.FORUM_TOPIC ||
      targetMeta.sceneType === SceneTypeEnum.FORUM_TOPIC
    ) {
      return this.forumBusiness
    }
    return null
  }

  // 在事务外解析构建锁计划所需的稳定业务域；仅评论目标需要读取其所属场景。
  private async resolvePlannedLevelBusiness(
    targetType: LikeTargetTypeEnum,
    targetId: number,
    resolver: ILikeTargetResolver,
  ) {
    if (targetType !== LikeTargetTypeEnum.COMMENT) {
      return targetType === LikeTargetTypeEnum.FORUM_TOPIC
        ? this.forumBusiness
        : null
    }

    const targetMeta = await resolver.resolveMeta(this.db, targetId)
    return this.resolveLevelBusiness(targetType, targetMeta)
  }

  // 供其他模块在应用启动时注册自己的点赞目标解析器。
  registerResolver(resolver: ILikeTargetResolver) {
    if (this.resolvers.has(resolver.targetType)) {
      console.warn(
        `Like resolver for type ${resolver.targetType} is being overwritten.`,
      )
    }
    this.resolvers.set(resolver.targetType, resolver)
  }

  // 按目标类型获取已注册的解析器，未注册时抛出 BusinessException。
  private getResolver(targetType: LikeTargetTypeEnum) {
    const resolver = this.resolvers.get(targetType)
    if (!resolver) {
      throw new BusinessException(
        BusinessErrorCode.INVALID_OPERATION_TARGET,
        '不支持的点赞目标类型',
      )
    }
    return resolver
  }

  // 批量查询用户对多个目标的点赞状态，返回 targetId → boolean 映射。
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

  // 分页查询指定目标的点赞记录列表。
  async getTargetLikes(
    targetType: LikeTargetTypeEnum,
    targetId: number,
    pageIndex: number = 1,
    pageSize: number = 20,
  ) {
    const where = and(
      eq(this.userLike.targetType, targetType),
      eq(this.userLike.targetId, targetId),
    )
    const pageQuery = this.drizzle.buildPage({ pageIndex, pageSize })
    const orderQuery = this.drizzle.buildOrderBy(
      { createdAt: 'desc' as const },
      { table: this.userLike },
    )
    const [list, total] = await Promise.all([
      this.db
        .select(this.buildUserLikeReadSelect())
        .from(this.userLike)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.userLike, where),
    ])
    const page = toPageResult(list, total, pageQuery)
    return {
      ...page,
      list: page.list.map((item) => ({
        id: item.id,
        userId: item.userId,
        targetId: item.targetId,
        targetType: item.targetType,
        sceneType: item.sceneType,
        sceneId: item.sceneId,
        commentLevel: item.commentLevel ?? null,
        createdAt: item.createdAt,
      })),
    }
  }

  // 执行点赞：在同一事务中解析目标、写入记录、更新计数并执行后置钩子，事务后发放成长奖励。
  async like(input: LikeRecordDto): Promise<void> {
    const { targetType, targetId, userId } = input
    const resolver = this.getResolver(targetType)
    const plannedBusiness = await this.resolvePlannedLevelBusiness(
      targetType,
      targetId,
      resolver,
    )
    const quotaPlan = this.userLevelRuleService.buildDailyLikeQuotaLockPlan({
      userId,
      business: plannedBusiness,
    })

    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [...quotaPlan.lockRequests])
        const targetMeta = await resolver.resolveMeta(tx, targetId)
        const liveBusiness = this.resolveLevelBusiness(targetType, targetMeta)
        if (liveBusiness !== quotaPlan.business) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '点赞目标业务域已变化，请重试',
          )
        }

        await this.userLevelRuleService.ensureDailyLikeQuotaAfterLockInTx(
          tx,
          quotaPlan,
        )

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
      },
    })

    await this.likeGrowthService.rewardLikeCreated(targetType, targetId, userId)
  }

  // 取消点赞：在同一事务中删除记录、回退计数并执行后置钩子。
  async unlike(input: LikeRecordDto) {
    const { targetType, targetId, userId } = input
    const resolver = this.getResolver(targetType)

    await this.drizzle.withTransaction({
      execute: async (tx) => {
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

        if (resolver.postUnlikeHook) {
          await resolver.postUnlikeHook(tx, targetId, userId)
        }
      },
    })
  }

  // 查询指定用户对单个目标的点赞状态。
  async checkLikeStatus(input: LikeRecordDto): Promise<boolean> {
    const { targetType, targetId, userId } = input
    const [like] = await this.db
      .select({ id: this.userLike.id })
      .from(this.userLike)
      .where(
        and(
          eq(this.userLike.targetType, targetType),
          eq(this.userLike.targetId, targetId),
          eq(this.userLike.userId, userId),
        ),
      )
      .limit(1)
    return !!like
  }

  // 分页查询用户点赞列表，并关联解析器批量获取目标详情。
  async getUserLikes(query: LikePageUserQuery) {
    const pageParams = this.drizzle.buildPageParams(query, {
      table: this.userLike,
      fallbackOrderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const where = and(
      eq(this.userLike.targetType, query.targetType),
      eq(this.userLike.userId, query.userId),
      pageParams.dateRange?.gte
        ? gte(this.userLike.createdAt, pageParams.dateRange.gte)
        : undefined,
      pageParams.dateRange?.lt
        ? lt(this.userLike.createdAt, pageParams.dateRange.lt)
        : undefined,
    )
    const [rows, total] = await Promise.all([
      this.db
        .select(this.buildUserLikeReadSelect())
        .from(this.userLike)
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(this.userLike, where),
    ])
    const page = toPageResult(rows, total, pageParams.page)

    if (page.list.length === 0) {
      return page
    }

    const resolver = this.getResolver(query.targetType)
    if (!resolver.batchGetDetails) {
      return {
        ...page,
        list: page.list.map((item) => ({
          ...item,
          commentLevel: item.commentLevel ?? null,
          targetDetail: null,
        })),
      }
    }

    const targetIds = this.uniqueTargetIds(
      page.list.map((item) => item.targetId),
    )
    if (targetIds.length === 0) {
      return {
        ...page,
        list: page.list.map((item) => ({
          ...item,
          commentLevel: item.commentLevel ?? null,
          targetDetail: null,
        })),
      }
    }

    const startedAt = Date.now()
    let detailMap: Map<number, unknown>
    try {
      detailMap = await resolver.batchGetDetails(targetIds)
    } catch (error) {
      this.logger.warn(
        `like_detail_resolve_failed targetType=${query.targetType} batchSize=${targetIds.length} elapsedMs=${Date.now() - startedAt} errorCode=${this.resolveErrorCode(error)} diagnostic=${this.buildDetailResolveDiagnostic(error)}`,
      )
      return {
        ...page,
        list: page.list.map((item) => ({
          ...item,
          commentLevel: item.commentLevel ?? null,
          targetDetail: null,
        })),
      }
    }
    if (!detailMap || detailMap.size === 0) {
      this.logger.warn(
        `like_detail_empty targetType=${query.targetType} batchSize=${targetIds.length} elapsedMs=${Date.now() - startedAt}`,
      )
      return {
        ...page,
        list: page.list.map((item) => ({
          ...item,
          commentLevel: item.commentLevel ?? null,
          targetDetail: null,
        })),
      }
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
        return {
          ...item,
          commentLevel: item.commentLevel ?? null,
          targetDetail: this.toLikeTargetDetail(detail),
        }
      }),
    }
  }
}
