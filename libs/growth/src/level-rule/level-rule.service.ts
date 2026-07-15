import type {
  DbExecutor,
  DbTransaction,
  IntegrityLockRequest,
  PgTable,
  SQL,
  TableConfig,
} from '@db/core'
import type { AnyColumn } from 'drizzle-orm'
import type {
  CommentRateLimitLockPlan,
  DailyFavoriteQuotaLockPlan,
  DailyLikeQuotaLockPlan,
  DailyQuotaInput,
  ForumTopicRateLimitLockPlan,
  LevelBusiness,
  LevelPurchasePricing,
  LevelResolveInput,
  LevelRuleOutputRow,
  LevelRuleRateLimitKind,
  LevelRuleRateLimitLockPlan,
  LevelRuleResolveInput,
  PurchasePricingInput,
} from './level-rule.type'
import {
  acquireIntegrityLocks,
  buildILikeCondition,
  DrizzleService,
  exclusiveIntegrityLock,
  relationIntegrityLock,
  tableIntegrityLock,
  toPageResult,
} from '@db/core'

import { GrowthAssetTypeEnum } from '@libs/growth/growth-ledger/growth-ledger.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { startOfTodayInAppTimeZone } from '@libs/platform/utils'
import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import {
  CheckUserLevelPermissionDto,
  CreateUserLevelRuleDto,
  QueryUserLevelRuleDto,
  UpdateUserLevelRuleDto,
  UserLevelInfoDto,
  UserLevelStatisticsDto,
} from './dto/level-rule.dto'
import { UserLevelRulePermissionEnum } from './level-rule.constant'

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
  constructor(private readonly drizzle: DrizzleService) {}

  // 数据库连接实例。
  private get db() {
    return this.drizzle.db
  }

  // 用户表。
  get appUser() {
    return this.drizzle.schema.appUser
  }

  // 论坛板块表。
  get forumSection() {
    return this.drizzle.schema.forumSection
  }

  // 作品表。
  get work() {
    return this.drizzle.schema.work
  }

  // 作品章节表。
  get workChapter() {
    return this.drizzle.schema.workChapter
  }

  // 等级规则表。
  get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  // 统一用户资产余额表。
  get userAssetBalance() {
    return this.drizzle.schema.userAssetBalance
  }

  // 主题表。
  get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  // 回复/评论表。
  get forumReply() {
    return this.drizzle.schema.userComment
  }

  // 评论事实表。
  get userComment() {
    return this.drizzle.schema.userComment
  }

  // 点赞事实表。
  get userLike() {
    return this.drizzle.schema.userLike
  }

  // 收藏事实表。
  get userFavorite() {
    return this.drizzle.schema.userFavorite
  }

  // 后台等级规则的稳定输出模型；不把内部索引、生命周期或变更控制字段隐式带入接口。
  private buildLevelRuleOutputSelect() {
    return {
      id: this.userLevelRule.id,
      name: this.userLevelRule.name,
      requiredExperience: this.userLevelRule.requiredExperience,
      description: this.userLevelRule.description,
      icon: this.userLevelRule.icon,
      color: this.userLevelRule.color,
      sortOrder: this.userLevelRule.sortOrder,
      isEnabled: this.userLevelRule.isEnabled,
      business: this.userLevelRule.business,
      dailyTopicLimit: this.userLevelRule.dailyTopicLimit,
      dailyReplyCommentLimit: this.userLevelRule.dailyReplyCommentLimit,
      postInterval: this.userLevelRule.postInterval,
      dailyLikeLimit: this.userLevelRule.dailyLikeLimit,
      dailyFavoriteLimit: this.userLevelRule.dailyFavoriteLimit,
      purchasePayableRate: this.userLevelRule.purchasePayableRate,
      createdAt: this.userLevelRule.createdAt,
      updatedAt: this.userLevelRule.updatedAt,
    }
  }

  private getLevelRuleOutputColumns() {
    return {
      id: true,
      name: true,
      requiredExperience: true,
      description: true,
      icon: true,
      color: true,
      sortOrder: true,
      isEnabled: true,
      business: true,
      dailyTopicLimit: true,
      dailyReplyCommentLimit: true,
      postInterval: true,
      dailyLikeLimit: true,
      dailyFavoriteLimit: true,
      purchasePayableRate: true,
      createdAt: true,
      updatedAt: true,
    } as const
  }

  // 当前等级解析的热路径只读取进度、权限和计价所需字段。
  private buildEffectiveLevelRuleSelect() {
    return {
      id: this.userLevelRule.id,
      name: this.userLevelRule.name,
      requiredExperience: this.userLevelRule.requiredExperience,
      description: this.userLevelRule.description,
      icon: this.userLevelRule.icon,
      color: this.userLevelRule.color,
      business: this.userLevelRule.business,
      dailyTopicLimit: this.userLevelRule.dailyTopicLimit,
      dailyReplyCommentLimit: this.userLevelRule.dailyReplyCommentLimit,
      postInterval: this.userLevelRule.postInterval,
      dailyLikeLimit: this.userLevelRule.dailyLikeLimit,
      dailyFavoriteLimit: this.userLevelRule.dailyFavoriteLimit,
      purchasePayableRate: this.userLevelRule.purchasePayableRate,
    }
  }

  // 创建等级规则
  async createLevelRule(dto: CreateUserLevelRuleDto) {
    return this.drizzle.withTransaction({
      execute: async (tx) => {
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
      },
    })
  }

  // 获取等级规则分页列表
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
        .select(this.buildLevelRuleOutputSelect())
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

  // 获取等级规则详情
  async getLevelRuleDetail(id: number) {
    const rule = await this.db.query.userLevelRule.findFirst({
      where: { id },
      columns: this.getLevelRuleOutputColumns(),
    })
    if (!rule) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '等级规则不存在',
      )
    }
    return this.toLevelRuleOutputDto(rule)
  }

  // 更新等级规则
  async updateLevelRule(updateLevelRuleDto: UpdateUserLevelRuleDto) {
    const { id, ...updateData } = updateLevelRuleDto
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.lockLevelRulesForMutation(tx, [id])
        const existing = await tx.query.userLevelRule.findFirst({
          where: { id },
          columns: { business: true, isEnabled: true },
        })
        if (!existing) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '等级规则不存在',
          )
        }

        const payload = this.normalizeRulePayload(updateData)
        const nextBusiness =
          'business' in payload ? payload.business : existing.business
        const nextIsEnabled =
          'isEnabled' in payload ? payload.isEnabled : existing.isEnabled

        if (!(nextBusiness === 'forum' && nextIsEnabled)) {
          const [referencingSection] = await tx
            .select({ id: this.forumSection.id })
            .from(this.forumSection)
            .where(
              and(
                eq(this.forumSection.userLevelRuleId, id),
                isNull(this.forumSection.deletedAt),
              ),
            )
            .limit(1)
          if (referencingSection) {
            throw new BusinessException(
              BusinessErrorCode.OPERATION_NOT_ALLOWED,
              '该等级规则仍被论坛板块引用，无法停用或变更业务域',
            )
          }
        }

        if (!(nextBusiness === null && nextIsEnabled)) {
          const [referencingUser] = await tx
            .select({ id: this.appUser.id })
            .from(this.appUser)
            .where(
              and(eq(this.appUser.levelId, id), isNull(this.appUser.deletedAt)),
            )
            .limit(1)
          if (referencingUser) {
            throw new BusinessException(
              BusinessErrorCode.OPERATION_NOT_ALLOWED,
              '该等级规则仍被用户引用，无法停用或变更业务域',
            )
          }
        }

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
      },
    })
  }

  // 删除等级规则
  async deleteLevelRule(id: number) {
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.lockLevelRulesForMutation(tx, [id])
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

        const [referencingSection] = await tx
          .select({ id: this.forumSection.id })
          .from(this.forumSection)
          .where(
            and(
              eq(this.forumSection.userLevelRuleId, id),
              isNull(this.forumSection.deletedAt),
            ),
          )
          .limit(1)
        if (referencingSection) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '该等级规则仍被论坛板块引用，无法删除',
          )
        }

        const [activeUser] = await tx
          .select({ id: this.appUser.id })
          .from(this.appUser)
          .where(
            and(eq(this.appUser.levelId, id), isNull(this.appUser.deletedAt)),
          )
          .limit(1)

        if (activeUser) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '该等级规则下还有用户，无法删除',
          )
        }

        await this.clearLevelRuleReferencesInTx(tx, id)

        await this.drizzle.withErrorHandling(
          () =>
            tx.delete(this.userLevelRule).where(eq(this.userLevelRule.id, id)),
          { notFound: '等级规则不存在' },
        )
        await this.assertEnabledBusinessHasOneBaseLevelInTx(tx, rule.business)
        return true
      },
    })
  }

  /**
   * 获取用户等级信息
   * @param userId 用户ID
   * @returns 用户等级信息，包括当前等级、进度、权限等
   */
  // 获取用户等级信息。 同时计算到下一等级的进度百分比，供前台和后台直接展示当前升级进度。
  async getUserLevelInfo(userId: number): Promise<UserLevelInfoDto> {
    const { level, experience: currentExperience } =
      await this.resolveEffectiveUserLevel({ userId })

    const [nextLevelRule] = await this.db
      .select({ requiredExperience: this.userLevelRule.requiredExperience })
      .from(this.userLevelRule)
      .where(
        and(
          eq(this.userLevelRule.isEnabled, true),
          this.buildBusinessCondition(
            this.userLevelRule.business,
            level.business,
          ),
          gt(this.userLevelRule.requiredExperience, currentExperience),
        ),
      )
      .orderBy(
        asc(this.userLevelRule.requiredExperience),
        asc(this.userLevelRule.id),
      )
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

  // 在指定事务中按经验值反查当前应命中的最高等级。 供账本、升级和修复链路复用，避免不同上下文复制相同排序逻辑。
  async getHighestLevelRuleByExperienceInTx(
    tx: DbExecutor,
    input: number | LevelRuleResolveInput,
  ) {
    const resolveInput =
      typeof input === 'number' ? { experience: input } : input
    const business = this.normalizeBusiness(resolveInput.business)
    const [levelRule] = await tx
      .select(this.buildEffectiveLevelRuleSelect())
      .from(this.userLevelRule)
      .where(
        and(
          eq(this.userLevelRule.isEnabled, true),
          this.buildBusinessCondition(this.userLevelRule.business, business),
          lte(this.userLevelRule.requiredExperience, resolveInput.experience),
        ),
      )
      .orderBy(
        desc(this.userLevelRule.requiredExperience),
        desc(this.userLevelRule.id),
      )
      .limit(1)
    return levelRule ?? null
  }

  async resolveEffectiveUserLevel(input: LevelResolveInput) {
    return this.resolveEffectiveUserLevelInTx(this.db, input)
  }

  async resolveEffectiveUserLevelInTx(
    tx: DbExecutor,
    input: LevelResolveInput,
  ) {
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
    tx: DbExecutor,
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

  // 在事务外构建每日点赞额度锁计划。
  buildDailyLikeQuotaLockPlan(input: DailyQuotaInput): DailyLikeQuotaLockPlan {
    return this.buildRateLimitLockPlan(
      'daily-like-quota',
      input,
      UserLevelRulePermissionEnum.DAILY_LIKE_LIMIT,
      false,
    )
  }

  // 在事务外构建每日收藏额度锁计划。
  buildDailyFavoriteQuotaLockPlan(
    input: DailyQuotaInput,
  ): DailyFavoriteQuotaLockPlan {
    return this.buildRateLimitLockPlan(
      'daily-favorite-quota',
      input,
      UserLevelRulePermissionEnum.DAILY_FAVORITE_LIMIT,
      false,
    )
  }

  // 在事务外构建评论额度与发帖间隔锁计划。
  buildCommentRateLimitLockPlan(
    input: DailyQuotaInput,
  ): CommentRateLimitLockPlan {
    return this.buildRateLimitLockPlan(
      'comment-rate-limit',
      input,
      UserLevelRulePermissionEnum.DAILY_REPLY_COMMENT_LIMIT,
      true,
    )
  }

  // 在事务外构建论坛主题额度与发帖间隔锁计划。
  buildForumTopicRateLimitLockPlan(input: {
    userId: number
  }): ForumTopicRateLimitLockPlan {
    return this.buildRateLimitLockPlan(
      'forum-topic-rate-limit',
      { userId: input.userId, business: 'forum' },
      UserLevelRulePermissionEnum.DAILY_TOPIC_LIMIT,
      true,
    )
  }

  // 外层持有完整锁计划后校验每日点赞额度。
  async ensureDailyLikeQuotaAfterLockInTx(
    tx: DbTransaction,
    plan: DailyLikeQuotaLockPlan,
  ) {
    const { level } = await this.resolveEffectiveUserLevelInTx(tx, plan)
    this.assertDailyQuota({
      limit: level.dailyLikeLimit,
      used: await this.countTodayByConditionInTx(
        tx,
        this.userLike,
        this.userLike.createdAt,
        this.buildLikeQuotaWhere(plan.userId, plan.business),
        plan.dayStartMs,
      ),
      message: '已达到每日点赞上限',
    })
  }

  // 外层持有完整锁计划后校验每日收藏额度。
  async ensureDailyFavoriteQuotaAfterLockInTx(
    tx: DbTransaction,
    plan: DailyFavoriteQuotaLockPlan,
  ) {
    const { level } = await this.resolveEffectiveUserLevelInTx(tx, plan)
    this.assertDailyQuota({
      limit: level.dailyFavoriteLimit,
      used: await this.countTodayByConditionInTx(
        tx,
        this.userFavorite,
        this.userFavorite.createdAt,
        this.buildFavoriteQuotaWhere(plan.userId, plan.business),
        plan.dayStartMs,
      ),
      message: '已达到每日收藏上限',
    })
  }

  // 外层持有完整锁计划后校验评论额度与发帖间隔。
  async ensureCommentRateLimitAfterLockInTx(
    tx: DbTransaction,
    plan: CommentRateLimitLockPlan,
  ) {
    const { level } = await this.resolveEffectiveUserLevelInTx(tx, plan)
    this.assertDailyQuota({
      limit: level.dailyReplyCommentLimit,
      used: await this.countTodayByConditionInTx(
        tx,
        this.userComment,
        this.userComment.createdAt,
        this.buildCommentQuotaWhere(plan.userId, plan.business),
        plan.dayStartMs,
      ),
      message: `今日评论次数已达上限（${level.dailyReplyCommentLimit}）`,
    })
    await this.ensurePostIntervalAfterLockInTx(tx, plan, level.postInterval)
  }

  // 外层持有完整锁计划后校验论坛主题额度与发帖间隔。
  async ensureForumTopicRateLimitAfterLockInTx(
    tx: DbTransaction,
    plan: ForumTopicRateLimitLockPlan,
  ) {
    const { level } = await this.resolveEffectiveUserLevelInTx(tx, plan)
    this.assertDailyQuota({
      limit: level.dailyTopicLimit,
      used: await this.countTodayByConditionInTx(
        tx,
        this.forumTopic,
        this.forumTopic.createdAt,
        eq(this.forumTopic.userId, plan.userId),
        plan.dayStartMs,
      ),
      message: `今日发帖次数已达上限（${level.dailyTopicLimit}）`,
    })
    await this.ensurePostIntervalAfterLockInTx(tx, plan, level.postInterval)
  }

  // 检查用户等级权限
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

  // 获取等级统计信息
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
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(this.userLevelRule)

    const levelIds = levels.map((item) => item.id)
    const distributionRows =
      levelIds.length > 0
        ? await this.db
            .select({
              levelId: this.appUser.levelId,
              total: sql<number>`count(*)`.mapWith(Number),
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

  // 对任意事实表执行 count(*) 聚合。 等级权限校验和统计概览都通过该方法复用统一计数逻辑。
  private async countByCondition(
    table: PgTable<TableConfig>,
    where: SQL | undefined,
  ): Promise<number> {
    const [result] = await this.db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
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

  private async getCurrentExperienceInTx(tx: DbExecutor, userId: number) {
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
    tx: DbTransaction,
    inputBusiness: LevelBusiness,
  ) {
    const business = this.normalizeBusiness(inputBusiness)
    const businessWhere = this.buildBusinessCondition(
      this.userLevelRule.business,
      business,
    )
    const [enabled] = await tx
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(this.userLevelRule)
      .where(and(eq(this.userLevelRule.isEnabled, true), businessWhere))
    if (Number(enabled?.total ?? 0) === 0) {
      return
    }
    const [base] = await tx
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
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

  // 用一次捕获的业务域与日界线构建完整配额/频控请求集。
  private buildRateLimitLockPlan<TKind extends LevelRuleRateLimitKind>(
    kind: TKind,
    input: DailyQuotaInput,
    dailyPermissionType: UserLevelRulePermissionEnum,
    includePostInterval: boolean,
  ): LevelRuleRateLimitLockPlan<TKind> {
    const business = this.normalizeBusiness(input.business)
    const dayStartMs = startOfTodayInAppTimeZone().getTime()
    const lockRequests = [
      this.buildPermissionLockRequest({
        userId: input.userId,
        permissionType: dailyPermissionType,
        business,
        scopeKey: dayStartMs,
      }),
      ...(includePostInterval
        ? [
            this.buildPermissionLockRequest({
              userId: input.userId,
              permissionType: UserLevelRulePermissionEnum.POST_INTERVAL,
              business,
              scopeKey: 'post-interval',
            }),
          ]
        : []),
    ]

    return {
      kind,
      userId: input.userId,
      business,
      dayStartMs,
      lockRequests,
    }
  }

  // 构建 canonical 等级配额锁请求；实际获取只能由事务 outer owner 完成。
  private buildPermissionLockRequest(input: {
    userId: number
    permissionType: UserLevelRulePermissionEnum
    business?: LevelBusiness
    scopeKey: number | string
  }): IntegrityLockRequest {
    const business = this.normalizeBusiness(input.business) ?? 'default'
    return exclusiveIntegrityLock(
      relationIntegrityLock(
        'level-rule-quota',
        input.userId,
        input.permissionType,
        business,
        input.scopeKey,
      ),
    )
  }

  /**
   * user_level_rule 不使用物理外键。父规则删除/更新与所有子引用写入必须争用
   * 同一个 canonical record lock，锁后再在当前事务内读取目标记录。
   */
  private async lockLevelRulesForMutation(
    tx: DbTransaction,
    ruleIds: readonly number[],
  ) {
    await acquireIntegrityLocks(
      tx,
      [...new Set(ruleIds)].map((ruleId) =>
        exclusiveIntegrityLock(tableIntegrityLock('user_level_rule', ruleId)),
      ),
    )
  }

  /**
   * 删除等级规则时保留既有“仍有有效用户则拒绝删除”的语义；其余 nullable
   * 引用统一清空，避免无物理外键场景留下悬挂 ID。
   */
  private async clearLevelRuleReferencesInTx(
    tx: DbTransaction,
    ruleId: number,
  ) {
    await this.drizzle.withErrorHandling(() =>
      tx
        .update(this.appUser)
        .set({ levelId: null })
        .where(
          and(
            eq(this.appUser.levelId, ruleId),
            isNotNull(this.appUser.deletedAt),
          ),
        ),
    )
    await this.drizzle.withErrorHandling(() =>
      tx
        .update(this.forumSection)
        .set({ userLevelRuleId: null })
        .where(eq(this.forumSection.userLevelRuleId, ruleId)),
    )
    await this.drizzle.withErrorHandling(() =>
      tx
        .update(this.work)
        .set({ requiredViewLevelId: null })
        .where(eq(this.work.requiredViewLevelId, ruleId)),
    )
    await this.drizzle.withErrorHandling(() =>
      tx
        .update(this.workChapter)
        .set({ requiredViewLevelId: null })
        .where(eq(this.workChapter.requiredViewLevelId, ruleId)),
    )
  }

  // 保留既有“正数上限才生效”的业务语义。
  private assertDailyQuota(input: {
    limit: number
    used: number
    message: string
  }) {
    if (input.limit > 0 && input.used >= input.limit) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        input.message,
      )
    }
  }

  private async countTodayByConditionInTx(
    tx: DbExecutor,
    table: PgTable<TableConfig>,
    createdAt: AnyColumn,
    where: SQL | undefined,
    dayStartMs: number,
  ) {
    const [result] = await tx
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(table)
      .where(and(where, gte(createdAt, new Date(dayStartMs))))
    return Number(result?.total ?? 0)
  }

  // 外层持有 post-interval 锁后校验最近一次发帖或评论时间。
  private async ensurePostIntervalAfterLockInTx(
    tx: DbExecutor,
    plan: CommentRateLimitLockPlan | ForumTopicRateLimitLockPlan,
    postInterval: number,
  ) {
    if (postInterval <= 0) {
      return
    }

    const lastPostAt = await this.getLatestPostAtInTx(tx, plan)
    if (!lastPostAt) {
      return
    }

    const secondsSinceLastPost = Math.floor(
      (Date.now() - lastPostAt.getTime()) / 1000,
    )
    if (secondsSinceLastPost < postInterval) {
      throw new HttpException(
        `操作过于频繁，请 ${postInterval - secondsSinceLastPost} 秒后再试`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
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

  private async getLatestPostAtInTx(tx: DbExecutor, input: DailyQuotaInput) {
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

  private toLevelRuleOutputDto(rule: LevelRuleOutputRow) {
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
