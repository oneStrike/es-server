import type { Db, PgTable, SQL, TableConfig } from '@db/core'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { startOfTodayInAppTimeZone } from '@libs/platform/utils/time';
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, asc, desc, eq, gt, gte, inArray, isNull, sql } from 'drizzle-orm'
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
  get appUserLevelRule() {
    return this.drizzle.schema.appUserLevelRule
  }

  /** 主题表。 */
  get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  /** 回复/评论表。 */
  get forumReply() {
    return this.drizzle.schema.appUserComment
  }

  /** 点赞事实表。 */
  get appUserLike() {
    return this.drizzle.schema.appUserLike
  }

  /** 收藏事实表。 */
  get appUserFavorite() {
    return this.drizzle.schema.appUserFavorite
  }

  /**
   * 创建等级规则
   * @param dto 等级规则数据
   * @returns 创建的等级规则
   */
  async createLevelRule(dto: CreateUserLevelRuleDto) {
    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.appUserLevelRule).values(dto),
      {
        duplicate: '经验规则已经存在',
      },
    )
    return true
  }

  /**
   * 获取等级规则分页列表
   * @param dto 查询参数
   * @returns 分页的等级规则列表
   */
  async getLevelRulePage(dto: QueryUserLevelRuleDto) {
    const conditions: SQL[] = []

    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.appUserLevelRule.isEnabled, dto.isEnabled))
    }
    if (dto.business !== undefined) {
      conditions.push(
        dto.business === null
          ? isNull(this.appUserLevelRule.business)
          : eq(this.appUserLevelRule.business, dto.business),
      )
    }
    if (dto.name) {
      conditions.push(
        buildILikeCondition(this.appUserLevelRule.name, dto.name)!,
      )
    }

    const orderBy = dto.orderBy?.trim()
      ? dto.orderBy
      : { sortOrder: 'asc' as const }

    return this.drizzle.ext.findPagination(this.appUserLevelRule, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      ...dto,
      orderBy,
    })
  }

  /**
   * 获取等级规则详情
   * @param id 等级规则ID
   * @returns 等级规则详情
   */
  async getLevelRuleDetail(id: number) {
    const rule = await this.db.query.appUserLevelRule.findFirst({
      where: { id },
    })
    if (!rule) {
      throw new BadRequestException('等级规则不存在')
    }
    return rule
  }

  /**
   * 更新等级规则
   * @param updateLevelRuleDto 更新数据
   * @returns 更新后的等级规则
   */
  async updateLevelRule(updateLevelRuleDto: UpdateUserLevelRuleDto) {
    const { id, ...updateData } = updateLevelRuleDto
    const result = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.appUserLevelRule)
          .set(updateData)
          .where(eq(this.appUserLevelRule.id, id)),
      {
        duplicate: 'Level rule already exists',
      },
    )
    this.drizzle.assertAffectedRows(result, '等级规则不存在')
    return true
  }

  /**
   * 删除等级规则
   * @param id 等级规则ID
   * @returns 删除结果
   */
  async deleteLevelRule(id: number) {
    const rule = await this.db.query.appUserLevelRule.findFirst({
      where: { id },
      columns: { id: true },
    })

    if (!rule) {
      throw new BadRequestException('等级规则不存在')
    }

    const users = await this.countByCondition(
      this.appUser,
      eq(this.appUser.levelId, id),
    )
    if (users > 0) {
      throw new BadRequestException('该等级规则下还有用户，无法删除')
    }

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .delete(this.appUserLevelRule)
        .where(eq(this.appUserLevelRule.id, id)),
    )
    this.drizzle.assertAffectedRows(result, '等级规则不存在')
    return true
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
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
      with: {
        level: true,
      },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    if (!user.level) {
      throw new BadRequestException('用户等级规则不存在')
    }

    const [nextLevelRule] = await this.db
      .select()
      .from(this.appUserLevelRule)
      .where(
        and(
          eq(this.appUserLevelRule.isEnabled, true),
          gt(this.appUserLevelRule.requiredExperience, user.experience),
        ),
      )
      .orderBy(asc(this.appUserLevelRule.requiredExperience))
      .limit(1)

    let progressPercentage = 0
    let nextLevelExperience: number | undefined

    // 计算当前等级到下一级的进度百分比
    if (nextLevelRule) {
      const nextLevelExperienceValue = nextLevelRule.requiredExperience
      nextLevelExperience = nextLevelExperienceValue
      const previousLevelExperience = user.level.requiredExperience
      const totalRange = nextLevelExperienceValue - previousLevelExperience
      const currentProgress = user.experience - previousLevelExperience
      progressPercentage =
        totalRange > 0 ? Math.round((currentProgress / totalRange) * 100) : 100
    } else {
      progressPercentage = 100
    }

    return {
      levelId: user.level.id,
      levelName: user.level.name,
      levelDescription: user.level.description ?? '',
      levelIcon: user.level.icon ?? '',
      levelColor: user.level.color ?? '',
      levelBadge: user.level.badge ?? '',
      currentExperience: user.experience,
      nextLevelExperience,
      progressPercentage,
      permissions: {
        dailyTopicLimit: user.level.dailyTopicLimit,
        dailyReplyCommentLimit: user.level.dailyReplyCommentLimit,
        postInterval: user.level.postInterval,
        dailyLikeLimit: user.level.dailyLikeLimit,
        dailyFavoriteLimit: user.level.dailyFavoriteLimit,
      },
    }
  }

  async getHighestLevelRuleByExperience(experience: number) {
    return this.getHighestLevelRuleByExperienceInTx(this.db, experience)
  }

  /**
   * 在指定事务中按经验值反查当前应命中的最高等级。
   * 供账本、升级和修复链路复用，避免不同上下文复制相同排序逻辑。
   */
  async getHighestLevelRuleByExperienceInTx(tx: Db, experience: number) {
    return tx.query.appUserLevelRule.findFirst({
      where: {
        isEnabled: true,
        requiredExperience: { lte: experience },
      },
      orderBy: { requiredExperience: 'desc' },
    })
  }

  /**
   * 检查用户等级权限
   * @param dto 等级权限检查DTO
   * @returns 权限检查结果
   */
  async checkLevelPermission(dto: CheckUserLevelPermissionDto) {
    const { userId, permissionType } = dto

    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
      with: {
        level: true,
      },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    if (!user.level) {
      throw new BadRequestException('用户等级规则不存在')
    }

    const level = user.level
    const today = startOfTodayInAppTimeZone()

    let limit = 0
    let used = 0
    let hasPermission = true

    // 根据权限类型计算限制与已使用数量
    switch (permissionType) {
      case UserLevelRulePermissionEnum.DAILY_TOPIC_LIMIT:
        limit = level.dailyTopicLimit
        if (limit > 0) {
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
            this.forumReply,
            and(
              eq(this.forumReply.userId, userId),
              gte(this.forumReply.createdAt, today),
            ),
          )
          hasPermission = used < limit
        }
        break

      case UserLevelRulePermissionEnum.POST_INTERVAL:
        limit = level.postInterval
        if (limit > 0) {
          const [lastTopic] = await this.db
            .select({ createdAt: this.forumTopic.createdAt })
            .from(this.forumTopic)
            .where(eq(this.forumTopic.userId, userId))
            .orderBy(desc(this.forumTopic.createdAt))
            .limit(1)
          const [lastReply] = await this.db
            .select({ createdAt: this.forumReply.createdAt })
            .from(this.forumReply)
            .where(eq(this.forumReply.userId, userId))
            .orderBy(desc(this.forumReply.createdAt))
            .limit(1)

          let lastPostTime: Date | null = null
          if (lastTopic && lastReply) {
            lastPostTime =
              lastTopic.createdAt > lastReply.createdAt
                ? lastTopic.createdAt
                : lastReply.createdAt
          } else if (lastTopic) {
            lastPostTime = lastTopic.createdAt
          } else if (lastReply) {
            lastPostTime = lastReply.createdAt
          }

          if (lastPostTime) {
            const secondsSinceLastPost = Math.floor(
              (Date.now() - lastPostTime.getTime()) / 1000,
            )
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
            this.appUserLike,
            and(
              eq(this.appUserLike.userId, userId),
              inArray(this.appUserLike.targetType, [
                this.forumTopicLikeTargetType,
                this.commentLikeTargetType,
              ]),
              gte(this.appUserLike.createdAt, today),
            ),
          )
          hasPermission = used < limit
        }
        break

      case UserLevelRulePermissionEnum.DAILY_FAVORITE_LIMIT:
        limit = level.dailyFavoriteLimit
        if (limit > 0) {
          used = await this.countByCondition(
            this.appUserFavorite,
            and(
              eq(this.appUserFavorite.userId, userId),
              eq(this.appUserFavorite.targetType, this.forumTopicFavoriteTargetType),
              gte(this.appUserFavorite.createdAt, today),
            ),
          )
          hasPermission = used < limit
        }
        break

      default:
        throw new BadRequestException('不支持的权限类型')
    }

    return {
      hasPermission,
      currentLevel: level.name,
      limit: limit > 0 ? limit : null,
      used: limit > 0 ? used : null,
      remaining: limit > 0 ? limit - used : null,
    }
  }

  /**
   * 获取等级统计信息
   * @returns 等级统计数据
   */
  async getLevelStatistics(): Promise<UserLevelStatisticsDto> {
    const levels = await this.db
      .select({
        id: this.appUserLevelRule.id,
        name: this.appUserLevelRule.name,
      })
      .from(this.appUserLevelRule)
      .where(eq(this.appUserLevelRule.isEnabled, true))
      .orderBy(asc(this.appUserLevelRule.sortOrder), asc(this.appUserLevelRule.id))

    const [allLevelsCount] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(this.appUserLevelRule)

    const levelIds = levels.map((item) => item.id)
    const distributionRows = levelIds.length > 0
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
}
