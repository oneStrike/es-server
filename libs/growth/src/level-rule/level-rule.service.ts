import type { Db, PgTable, SQL, TableConfig } from '@db/core'
import type { UserLevelRuleSelect } from '@db/schema'
import type { AnyColumn } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService, toPageResult } from '@db/core'

import { GrowthAssetTypeEnum } from '@libs/growth/growth-ledger/growth-ledger.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { startOfTodayInAppTimeZone } from '@libs/platform/utils'
import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import {
  CheckUserLevelPermissionDto,
  CreateUserLevelRuleDto,
  QueryUserLevelRuleDto,
  UpdateUserLevelRuleDto,
  UserLevelInfoDto,
  UserLevelStatisticsDto,
} from './dto/level-rule.dto'
import { UserLevelRulePermissionEnum } from './level-rule.constant'

type LevelBusiness = string | null | undefined

interface LevelResolveInput {
  userId: number
  business?: LevelBusiness
}

interface LevelRuleResolveInput {
  experience: number
  business?: LevelBusiness
}

interface DailyQuotaInput {
  userId: number
  business?: LevelBusiness
}

interface PurchasePricingInput {
  userId: number
  originalPrice: number
  business?: LevelBusiness
}

interface LevelPurchasePricing {
  originalPrice: number
  levelPayableRate: string
  levelPayablePrice: number
  levelDiscountAmount: number
}

@Injectable()
export class UserLevelRuleService {
  /**
   * 权限统计直接读取 interaction 事实表。
   * 这里保留本地常量，避免 growth 反向依赖 interaction 形成循环引用。
   */
  private readonly forumTopicLikeTargetType = 3
  private readonly commentLikeTargetType = 6
  private readonly forumTopicFavoriteTargetType = 3
  private readonly forumTopicCommentTargetType = 5
  private readonly comicWorkSceneType = 1
  private readonly novelWorkSceneType = 2
  private readonly forumTopicSceneType = 3
  private readonly comicChapterSceneType = 10
  private readonly novelChapterSceneType = 11
  private readonly levelStateRepairMessage = '用户等级状态需要修复'
  private readonly quotaLockNamespace = 902081

  constructor(private readonly drizzle: DrizzleService) {}

  /** 数据库连接实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** 用户表。 */
  get appUser() {
    return this.drizzle.schema.appUser
  }

  /** 等级规则表。 */
  get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  /** 统一用户资产余额表。 */
  get userAssetBalance() {
    return this.drizzle.schema.userAssetBalance
  }

  /** 主题表。 */
  get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  /** 回复/评论表。 */
  get forumReply() {
    return this.drizzle.schema.userComment
  }

  /** 评论事实表。 */
  get userComment() {
    return this.drizzle.schema.userComment
  }

  /** 点赞事实表。 */
  get userLike() {
    return this.drizzle.schema.userLike
  }

  /** 收藏事实表。 */
  get userFavorite() {
    return this.drizzle.schema.userFavorite
  }

  /**
   * 创建等级规则
   * @param dto 等级规则数据
   * @returns 创建的等级规则
   */
  async createLevelRule(dto: CreateUserLevelRuleDto) {
    return this.drizzle.withTransaction(async (tx) => {
      const payload = this.normalizeRulePayload(dto)
      await this.drizzle.withErrorHandling(
        () => tx.insert(this.userLevelRule).values(payload),
        {
          duplicate: '经验规则已经存在',
        },
      )
      await this.assertEnabledBusinessHasOneBaseLevelInTx(
        tx,
        payload.business,
      )
      return true
    })
  }

  /**
   * 获取等级规则分页列表
   * @param dto 查询参数
   * @returns 分页的等级规则列表
   */
  async getLevelRulePage(dto: QueryUserLevelRuleDto) {
    const conditions: SQL[] = []

    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.userLevelRule.isEnabled, dto.isEnabled))
    }
    if (dto.business !== undefined) {
      conditions.push(
        dto.business === null
          ? isNull(this.userLevelRule.business)
          : eq(this.userLevelRule.business, dto.business),
      )
    }
    if (dto.name) {
      conditions.push(buildILikeCondition(this.userLevelRule.name, dto.name)!)
    }

    const orderBy = dto.orderBy?.trim()
      ? dto.orderBy
      : { sortOrder: 'asc' as const }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(orderBy, {
      table: this.userLevelRule,
    })
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.userLevelRule)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.userLevelRule, where),
    ])

    return toPageResult(
      list.map((item) => this.toLevelRuleOutputDto(item)),
      total,
      page,
    )
  }

  /**
   * 获取等级规则详情
   * @param id 等级规则ID
   * @returns 等级规则详情
   */
  async getLevelRuleDetail(id: number) {
    const rule = await this.db.query.userLevelRule.findFirst({
      where: { id },
    })
    if (!rule) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '等级规则不存在',
      )
    }
    return this.toLevelRuleOutputDto(rule)
  }

  /**
   * 更新等级规则
   * @param updateLevelRuleDto 更新数据
   * @returns 更新后的等级规则
   */
  async updateLevelRule(updateLevelRuleDto: UpdateUserLevelRuleDto) {
    const { id, ...updateData } = updateLevelRuleDto
    return this.drizzle.withTransaction(async (tx) => {
      const existing = await tx.query.userLevelRule.findFirst({
        where: { id },
        columns: { business: true },
      })
      if (!existing) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '等级规则不存在',
        )
      }

      const payload = this.normalizeRulePayload(updateData)
      await this.drizzle.withErrorHandling(
        () =>
          tx
            .update(this.userLevelRule)
            .set(payload)
            .where(eq(this.userLevelRule.id, id)),
        {
          duplicate: 'Level rule already exists',
          notFound: '等级规则不存在',
        },
      )
      await this.assertEnabledBusinessHasOneBaseLevelInTx(
        tx,
        existing.business,
      )
      await this.assertEnabledBusinessHasOneBaseLevelInTx(
        tx,
        'business' in payload ? payload.business : existing.business,
      )
      return true
    })
  }

  /**
   * 删除等级规则
   * @param id 等级规则ID
   * @returns 删除结果
   */
  async deleteLevelRule(id: number) {
    return this.drizzle.withTransaction(async (tx) => {
      const rule = await tx.query.userLevelRule.findFirst({
        where: { id },
        columns: { id: true, business: true },
      })

      if (!rule) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '等级规则不存在',
        )
      }

      const [activeUsers] = await tx
        .select({ total: sql<number>`count(*)` })
        .from(this.appUser)
        .where(
          and(
            eq(this.appUser.levelId, id),
            isNull(this.appUser.deletedAt),
          ),
        )

      if (Number(activeUsers?.total ?? 0) > 0) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '该等级规则下还有用户，无法删除',
        )
      }

      await this.drizzle.withErrorHandling(() =>
        tx
          .update(this.appUser)
          .set({ levelId: null })
          .where(
            and(
              eq(this.appUser.levelId, id),
              isNotNull(this.appUser.deletedAt),
            ),
          ),
      )

      await this.drizzle.withErrorHandling(
        () => tx.delete(this.userLevelRule).where(eq(this.userLevelRule.id, id)),
        { notFound: '等级规则不存在' },
      )
      await this.assertEnabledBusinessHasOneBaseLevelInTx(tx, rule.business)
      return true
    })
  }

  /**
   * 获取用户等级信息
   * @param userId 用户ID
   * @returns 用户等级信息，包括当前等级、进度、权限等
   */
  /**
   * 获取用户等级信息。
   * 同时计算到下一等级的进度百分比，供前台和后台直接展示当前升级进度。
   */
  async getUserLevelInfo(userId: number): Promise<UserLevelInfoDto> {
    const { level, experience: currentExperience } =
      await this.resolveEffectiveUserLevel({ userId })

    const [nextLevelRule] = await this.db
      .select()
      .from(this.userLevelRule)
      .where(
        and(
          eq(this.userLevelRule.isEnabled, true),
          this.buildBusinessCondition(this.userLevelRule.business, level.business),
          gt(this.userLevelRule.requiredExperience, currentExperience),
        ),
      )
      .orderBy(asc(this.userLevelRule.requiredExperience), asc(this.userLevelRule.id))
      .limit(1)

    let progressPercentage = 0
    let nextLevelExperience: number | null = null

    // 计算当前等级到下一级的进度百分比
    if (nextLevelRule) {
      const nextLevelExperienceValue = nextLevelRule.requiredExperience
      nextLevelExperience = nextLevelExperienceValue
      const previousLevelExperience = level.requiredExperience
      const totalRange = nextLevelExperienceValue - previousLevelExperience
      const currentProgress = currentExperience - previousLevelExperience
      progressPercentage =
        totalRange > 0 ? Math.round((currentProgress / totalRange) * 100) : 100
    } else {
      progressPercentage = 100
    }

    return {
      levelId: level.id,
      levelName: level.name,
      levelDescription: level.description ?? null,
      levelIcon: level.icon ?? null,
      levelColor: level.color ?? null,
      currentExperience,
      nextLevelExperience,
      progressPercentage,
      permissions: {
        dailyTopicLimit: level.dailyTopicLimit,
        dailyReplyCommentLimit: level.dailyReplyCommentLimit,
        postInterval: level.postInterval,
        dailyLikeLimit: level.dailyLikeLimit,
        dailyFavoriteLimit: level.dailyFavoriteLimit,
      },
    }
  }

  async getHighestLevelRuleByExperience(
    experience: number,
    business?: LevelBusiness,
  ) {
    return this.getHighestLevelRuleByExperienceInTx(this.db, {
      experience,
      business,
    })
  }

  private async getCurrentExperience(userId: number) {
    const balance = await this.db.query.userAssetBalance.findFirst({
      where: {
        userId,
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        assetKey: '',
      },
      columns: {
        balance: true,
      },
    })

    return balance?.balance ?? 0
  }

  /**
   * 在指定事务中按经验值反查当前应命中的最高等级。
   * 供账本、升级和修复链路复用，避免不同上下文复制相同排序逻辑。
   */
  async getHighestLevelRuleByExperienceInTx(
    tx: Db,
    input: number | LevelRuleResolveInput,
  ) {
    const resolveInput =
      typeof input === 'number' ? { experience: input } : input
    const business = this.normalizeBusiness(resolveInput.business)
    const [levelRule] = await tx
      .select()
      .from(this.userLevelRule)
      .where(
        and(
          eq(this.userLevelRule.isEnabled, true),
          this.buildBusinessCondition(this.userLevelRule.business, business),
          lte(this.userLevelRule.requiredExperience, resolveInput.experience),
        ),
      )
      .orderBy(desc(this.userLevelRule.requiredExperience), desc(this.userLevelRule.id))
      .limit(1)
    return levelRule ?? null
  }

  async resolveEffectiveUserLevel(input: LevelResolveInput) {
    return this.resolveEffectiveUserLevelInTx(this.db, input)
  }

  async resolveEffectiveUserLevelInTx(tx: Db, input: LevelResolveInput) {
    const business = this.normalizeBusiness(input.business)
    const user = await tx.query.appUser.findFirst({
      where: {
        id: input.userId,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }

    const experience = await this.getCurrentExperienceInTx(tx, input.userId)
    const level = await this.getHighestLevelRuleByExperienceInTx(tx, {
      experience,
      business,
    })
    if (!level) {
      throw this.createLevelStateConflict()
    }
    return { level, experience }
  }

  async resolveLevelPurchasePricingInTx(
    tx: Db,
    input: PurchasePricingInput,
  ): Promise<LevelPurchasePricing> {
    const { level } = await this.resolveEffectiveUserLevelInTx(tx, input)
    const rate = Number(level.purchasePayableRate)
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      throw this.createLevelStateConflict()
    }
    const levelPayablePrice = Math.floor(input.originalPrice * rate)
    return {
      originalPrice: input.originalPrice,
      levelPayableRate: rate.toFixed(2),
      levelPayablePrice,
      levelDiscountAmount: input.originalPrice - levelPayablePrice,
    }
  }

  async ensureDailyLikeQuotaInTx(tx: Db, input: DailyQuotaInput) {
    const { level } = await this.resolveEffectiveUserLevelInTx(tx, input)
    await this.acquireDailyQuotaLockInTx(tx, {
      userId: input.userId,
      permissionType: UserLevelRulePermissionEnum.DAILY_LIKE_LIMIT,
      business: input.business,
    })
    await this.assertDailyQuotaInTx(tx, {
      userId: input.userId,
      limit: level.dailyLikeLimit,
      used: await this.countTodayByConditionInTx(
        tx,
        this.userLike,
        this.userLike.createdAt,
        this.buildLikeQuotaWhere(input.userId, input.business),
      ),
      message: '已达到每日点赞上限',
    })
  }

  async ensureDailyFavoriteQuotaInTx(tx: Db, input: DailyQuotaInput) {
    const { level } = await this.resolveEffectiveUserLevelInTx(tx, input)
    await this.acquireDailyQuotaLockInTx(tx, {
      userId: input.userId,
      permissionType: UserLevelRulePermissionEnum.DAILY_FAVORITE_LIMIT,
      business: input.business,
    })
    await this.assertDailyQuotaInTx(tx, {
      userId: input.userId,
      limit: level.dailyFavoriteLimit,
      used: await this.countTodayByConditionInTx(
        tx,
        this.userFavorite,
        this.userFavorite.createdAt,
        this.buildFavoriteQuotaWhere(input.userId, input.business),
      ),
      message: '已达到每日收藏上限',
    })
  }

  async ensureCommentRateLimitInTx(tx: Db, input: DailyQuotaInput) {
    const { level } = await this.resolveEffectiveUserLevelInTx(tx, input)
    await this.acquireDailyQuotaLockInTx(tx, {
      userId: input.userId,
      permissionType: UserLevelRulePermissionEnum.DAILY_REPLY_COMMENT_LIMIT,
      business: input.business,
    })
    await this.assertDailyQuotaInTx(tx, {
      userId: input.userId,
      limit: level.dailyReplyCommentLimit,
      used: await this.countTodayByConditionInTx(
        tx,
        this.userComment,
        this.userComment.createdAt,
        this.buildCommentQuotaWhere(input.userId, input.business),
      ),
      message: `今日评论次数已达上限（${level.dailyReplyCommentLimit}）`,
    })

    if (level.postInterval <= 0) {
      return
    }

    await this.acquirePermissionLockInTx(tx, {
      userId: input.userId,
      permissionType: UserLevelRulePermissionEnum.POST_INTERVAL,
      business: input.business,
      scopeKey: 'post-interval',
    })
    const lastPostAt = await this.getLatestPostAtInTx(tx, input)

    if (!lastPostAt) {
      return
    }

    const secondsSinceLastPost = Math.floor(
      (Date.now() - lastPostAt.getTime()) / 1000,
    )

    if (secondsSinceLastPost < level.postInterval) {
      throw new HttpException(
        `操作过于频繁，请 ${level.postInterval - secondsSinceLastPost} 秒后再试`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
  }

  async ensureForumTopicRateLimitInTx(tx: Db, input: { userId: number }) {
    const business = 'forum'
    const { level } = await this.resolveEffectiveUserLevelInTx(tx, {
      userId: input.userId,
      business,
    })
    await this.acquireDailyQuotaLockInTx(tx, {
      userId: input.userId,
      permissionType: UserLevelRulePermissionEnum.DAILY_TOPIC_LIMIT,
      business,
    })
    await this.assertDailyQuotaInTx(tx, {
      userId: input.userId,
      limit: level.dailyTopicLimit,
      used: await this.countTodayByConditionInTx(
        tx,
        this.forumTopic,
        this.forumTopic.createdAt,
        eq(this.forumTopic.userId, input.userId),
      ),
      message: `今日发帖次数已达上限（${level.dailyTopicLimit}）`,
    })

    if (level.postInterval <= 0) {
      return
    }

    await this.acquirePermissionLockInTx(tx, {
      userId: input.userId,
      permissionType: UserLevelRulePermissionEnum.POST_INTERVAL,
      business,
      scopeKey: 'post-interval',
    })
    const lastPostAt = await this.getLatestPostAtInTx(tx, {
      userId: input.userId,
      business,
    })

    if (!lastPostAt) {
      return
    }

    const secondsSinceLastPost = Math.floor(
      (Date.now() - lastPostAt.getTime()) / 1000,
    )

    if (secondsSinceLastPost < level.postInterval) {
      throw new HttpException(
        `操作过于频繁，请 ${level.postInterval - secondsSinceLastPost} 秒后再试`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
  }

  /**
   * 检查用户等级权限
   * @param dto 等级权限检查DTO
   * @returns 权限检查结果
   */
  async checkLevelPermission(dto: CheckUserLevelPermissionDto) {
    const { userId, permissionType } = dto
    const business = this.normalizeBusiness(dto.business)

    const { level } = await this.resolveEffectiveUserLevel({
      userId,
      business,
    })
    const today = startOfTodayInAppTimeZone()

    let limit = 0
    let used = 0
    let hasPermission = true

    // 根据权限类型计算限制与已使用数量
    switch (permissionType) {
      case UserLevelRulePermissionEnum.DAILY_TOPIC_LIMIT:
        limit = level.dailyTopicLimit
        if (limit > 0 && business === 'forum') {
          used = await this.countByCondition(
            this.forumTopic,
            and(
              eq(this.forumTopic.userId, userId),
              gte(this.forumTopic.createdAt, today),
            ),
          )
          hasPermission = used < limit
        }
        break

      case UserLevelRulePermissionEnum.DAILY_REPLY_COMMENT_LIMIT:
        limit = level.dailyReplyCommentLimit
        if (limit > 0) {
          used = await this.countByCondition(
            this.userComment,
            and(
              this.buildCommentQuotaWhere(userId, business),
              gte(this.userComment.createdAt, today),
            ),
          )
          hasPermission = used < limit
        }
        break

      case UserLevelRulePermissionEnum.POST_INTERVAL:
        limit = level.postInterval
        if (limit > 0) {
          const lastPostTime = await this.getLatestPostAtInTx(this.db, {
            userId,
            business,
          })
          if (lastPostTime) {
            const secondsSinceLastPost = Math.floor(
              (Date.now() - lastPostTime.getTime()) / 1000,
            )
            used = secondsSinceLastPost
            hasPermission = secondsSinceLastPost >= limit
          } else {
            hasPermission = true
          }
        }
        break

      case UserLevelRulePermissionEnum.DAILY_LIKE_LIMIT:
        limit = level.dailyLikeLimit
        if (limit > 0) {
          used = await this.countByCondition(
            this.userLike,
            and(
              this.buildLikeQuotaWhere(userId, business),
              gte(this.userLike.createdAt, today),
            ),
          )
          hasPermission = used < limit
        }
        break

      case UserLevelRulePermissionEnum.DAILY_FAVORITE_LIMIT:
        limit = level.dailyFavoriteLimit
        if (limit > 0) {
          used = await this.countByCondition(
            this.userFavorite,
            and(
              this.buildFavoriteQuotaWhere(userId, business),
              gte(this.userFavorite.createdAt, today),
            ),
          )
          hasPermission = used < limit
        }
        break

      default:
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '不支持的权限类型',
        )
    }

    const result = {
      hasPermission,
      currentLevel: level.name,
      limit: limit > 0 ? limit : null,
      used: limit > 0 ? used : null,
      remaining: limit > 0 ? limit - used : null,
      limitSeconds: null,
      elapsedSeconds: null,
      remainingSeconds: null,
      nextAllowedAt: null,
    }
    if (permissionType !== UserLevelRulePermissionEnum.POST_INTERVAL) {
      return result
    }
    const remainingSeconds =
      limit > 0 && !hasPermission ? Math.max(0, limit - used) : null
    return {
      ...result,
      limitSeconds: limit > 0 ? limit : null,
      elapsedSeconds: limit > 0 ? used : null,
      remainingSeconds,
      nextAllowedAt:
        remainingSeconds !== null
          ? new Date(Date.now() + remainingSeconds * 1000).toISOString()
          : null,
    }
  }

  /**
   * 获取等级统计信息
   * @returns 等级统计数据
   */
  async getLevelStatistics(): Promise<UserLevelStatisticsDto> {
    const levels = await this.db
      .select({
        id: this.userLevelRule.id,
        name: this.userLevelRule.name,
      })
      .from(this.userLevelRule)
      .where(eq(this.userLevelRule.isEnabled, true))
      .orderBy(asc(this.userLevelRule.sortOrder), asc(this.userLevelRule.id))

    const [allLevelsCount] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(this.userLevelRule)

    const levelIds = levels.map((item) => item.id)
    const distributionRows =
      levelIds.length > 0
        ? await this.db
            .select({
              levelId: this.appUser.levelId,
              total: sql<number>`count(*)`,
            })
            .from(this.appUser)
            .where(inArray(this.appUser.levelId, levelIds))
            .groupBy(this.appUser.levelId)
        : []
    const distributionMap = new Map(
      distributionRows.map((item) => [item.levelId, Number(item.total)]),
    )
    const distribution = levels.map((item) => ({
      levelId: item.id,
      levelName: item.name,
      userCount: distributionMap.get(item.id) ?? 0,
    }))

    return {
      totalLevels: Number(allLevelsCount?.total ?? 0),
      enabledLevels: levels.length,
      levelDistribution: distribution,
    }
  }

  /**
   * 对任意事实表执行 count(*) 聚合。
   * 等级权限校验和统计概览都通过该方法复用统一计数逻辑。
   */
  private async countByCondition(
    table: PgTable<TableConfig>,
    where: SQL | undefined,
  ): Promise<number> {
    const [result] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(table)
      .where(where)
    return Number(result?.total ?? 0)
  }

  private normalizeBusiness(business: LevelBusiness) {
    if (typeof business !== 'string') {
      return null
    }
    const normalized = business.trim()
    return normalized.length > 0 ? normalized : null
  }

  private normalizeRulePayload<T extends { business?: LevelBusiness }>(
    payload: T,
  ): T {
    if (!('business' in payload)) {
      return payload
    }
    return {
      ...payload,
      business: this.normalizeBusiness(payload.business),
    }
  }

  private buildBusinessCondition(
    column: typeof this.userLevelRule.business,
    business: string | null,
  ) {
    return business === null ? isNull(column) : eq(column, business)
  }

  private async getCurrentExperienceInTx(tx: Db, userId: number) {
    const balance = await tx.query.userAssetBalance.findFirst({
      where: {
        userId,
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        assetKey: '',
      },
      columns: {
        balance: true,
      },
    })

    return balance?.balance ?? 0
  }

  private async assertEnabledBusinessHasOneBaseLevelInTx(
    tx: Db,
    inputBusiness: LevelBusiness,
  ) {
    const business = this.normalizeBusiness(inputBusiness)
    const businessWhere = this.buildBusinessCondition(
      this.userLevelRule.business,
      business,
    )
    const [enabled] = await tx
      .select({ total: sql<number>`count(*)` })
      .from(this.userLevelRule)
      .where(and(eq(this.userLevelRule.isEnabled, true), businessWhere))
    if (Number(enabled?.total ?? 0) === 0) {
      return
    }
    const [base] = await tx
      .select({ total: sql<number>`count(*)` })
      .from(this.userLevelRule)
      .where(
        and(
          eq(this.userLevelRule.isEnabled, true),
          businessWhere,
          eq(this.userLevelRule.requiredExperience, 0),
        ),
      )
    if (Number(base?.total ?? 0) !== 1) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '每个启用业务域必须且只能有一个0经验基础等级',
      )
    }
  }

  private async acquireDailyQuotaLockInTx(
    tx: Db,
    input: {
      userId: number
      permissionType: UserLevelRulePermissionEnum
      business?: LevelBusiness
    },
  ) {
    const dateKey = startOfTodayInAppTimeZone().toISOString().slice(0, 10)
    await this.acquirePermissionLockInTx(tx, { ...input, scopeKey: dateKey })
  }

  private async acquirePermissionLockInTx(
    tx: Db,
    input: {
      userId: number
      permissionType: UserLevelRulePermissionEnum
      business?: LevelBusiness
      scopeKey: string
    },
  ) {
    const business = this.normalizeBusiness(input.business) ?? 'default'
    const lockKey = `${input.userId}:${input.permissionType}:${business}:${input.scopeKey}`
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, ${this.quotaLockNamespace}))`,
    )
  }

  private async assertDailyQuotaInTx(
    _tx: Db,
    input: { userId: number, limit: number, used: number, message: string },
  ) {
    if (input.limit > 0 && input.used >= input.limit) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        input.message,
      )
    }
  }

  private async countTodayByConditionInTx(
    tx: Db,
    table: PgTable<TableConfig>,
    createdAt: AnyColumn,
    where: SQL | undefined,
  ) {
    const today = startOfTodayInAppTimeZone()
    const [result] = await tx
      .select({ total: sql<number>`count(*)` })
      .from(table)
      .where(and(where, gte(createdAt, today)))
    return Number(result?.total ?? 0)
  }

  private buildLikeQuotaWhere(userId: number, business: LevelBusiness) {
    const normalizedBusiness = this.normalizeBusiness(business)
    const businessTargetCondition =
      normalizedBusiness === 'forum'
        ? or(
            eq(this.userLike.targetType, this.forumTopicLikeTargetType),
            and(
              eq(this.userLike.targetType, this.commentLikeTargetType),
              eq(this.userLike.sceneType, this.forumTopicSceneType),
            ),
          )
        : or(
            inArray(this.userLike.targetType, [1, 2, 4, 5]),
            and(
              eq(this.userLike.targetType, this.commentLikeTargetType),
              inArray(this.userLike.sceneType, [
                this.comicWorkSceneType,
                this.novelWorkSceneType,
                this.comicChapterSceneType,
                this.novelChapterSceneType,
              ]),
            ),
          )
    return and(eq(this.userLike.userId, userId), businessTargetCondition)
  }

  private buildFavoriteQuotaWhere(userId: number, business: LevelBusiness) {
    const normalizedBusiness = this.normalizeBusiness(business)
    const businessTargetCondition =
      normalizedBusiness === 'forum'
        ? eq(this.userFavorite.targetType, this.forumTopicFavoriteTargetType)
        : inArray(this.userFavorite.targetType, [1, 2])
    return and(eq(this.userFavorite.userId, userId), businessTargetCondition)
  }

  private buildCommentQuotaWhere(userId: number, business: LevelBusiness) {
    const normalizedBusiness = this.normalizeBusiness(business)
    const businessTargetCondition =
      normalizedBusiness === 'forum'
        ? eq(this.userComment.targetType, this.forumTopicCommentTargetType)
        : inArray(this.userComment.targetType, [1, 2, 3, 4])
    return and(eq(this.userComment.userId, userId), businessTargetCondition)
  }

  private async getLatestPostAtInTx(tx: Db, input: DailyQuotaInput) {
    const [lastComment] = await tx
      .select({ createdAt: this.userComment.createdAt })
      .from(this.userComment)
      .where(this.buildCommentQuotaWhere(input.userId, input.business))
      .orderBy(desc(this.userComment.createdAt))
      .limit(1)

    if (this.normalizeBusiness(input.business) !== 'forum') {
      return lastComment?.createdAt ?? null
    }

    const [lastTopic] = await tx
      .select({ createdAt: this.forumTopic.createdAt })
      .from(this.forumTopic)
      .where(eq(this.forumTopic.userId, input.userId))
      .orderBy(desc(this.forumTopic.createdAt))
      .limit(1)

    if (lastTopic && lastComment) {
      return lastTopic.createdAt > lastComment.createdAt
        ? lastTopic.createdAt
        : lastComment.createdAt
    }

    return lastTopic?.createdAt ?? lastComment?.createdAt ?? null
  }

  private toLevelRuleOutputDto(rule: UserLevelRuleSelect) {
    return {
      ...rule,
      description: rule.description ?? null,
      icon: rule.icon ?? null,
      business: rule.business ?? null,
      color: rule.color ?? null,
    }
  }

  private createLevelStateConflict() {
    return new BusinessException(
      BusinessErrorCode.STATE_CONFLICT,
      this.levelStateRepairMessage,
    )
  }
}
