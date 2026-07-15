import type { DbExecutor, DbTransaction } from '@db/core'
import type { SQL } from 'drizzle-orm'
import type {
  AppUserGrowthSnapshot,
  NewAppUserDefaultLevelLockPlan,
  NewAppUserDefaultLevelResolution,
  NewAppUserDefaultLevelStableResolution,
  NewAppUserGrowthInitializationOutcome,
} from './app-user-growth-profile.type'
import {
  acquireIntegrityLocks,
  buildILikeCondition,
  DrizzleService,
  sharedIntegrityLock,
  tableIntegrityLock,
  toPageResult,
} from '@db/core'
import { GrowthBalanceQueryService } from '@libs/growth/growth-ledger/growth-balance-query.service'
import { GrowthAssetTypeEnum } from '@libs/growth/growth-ledger/growth-ledger.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { startOfTodayInAppTimeZone } from '@libs/platform/utils'
import { AppUserCountService } from '@libs/user/app-user-count.service'
import { UserDefaults, UserStatusEnum } from '@libs/user/app-user.constant'
import { UserService } from '@libs/user/user.service'
import { Injectable } from '@nestjs/common'
import { and, asc, eq, gt, gte, isNull, lt, sql } from 'drizzle-orm'
import {
  QueryMyBadgeDto,
  UserLevelSummaryDto,
} from './dto/app-user-growth-profile.dto'

/**
 * APP 用户成长资料服务。
 *
 * 负责新用户成长初始化、等级与徽章资料读取；用户基础身份和状态语义仍由 UserService 持有。
 */
@Injectable()
export class AppUserGrowthProfileService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly userService: UserService,
    private readonly appUserCountService: AppUserCountService,
    private readonly growthBalanceQueryService: GrowthBalanceQueryService,
  ) {}

  // 复用当前领域模块显式导入的数据库连接。
  private get db() {
    return this.drizzle.db
  }

  // 复用 APP 用户身份表，仅用于成长资料所需的等级外键和注册初始化。
  private get appUser() {
    return this.drizzle.schema.appUser
  }

  // 复用等级规则表。
  private get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  // 复用用户徽章分配事实表。
  private get userBadgeAssignment() {
    return this.drizzle.schema.userBadgeAssignment
  }

  // 复用用户徽章定义表。
  private get userBadge() {
    return this.drizzle.schema.userBadge
  }

  // 复用用户成长资产余额表。
  private get userAssetBalance() {
    return this.drizzle.schema.userAssetBalance
  }

  // 复用成长台账记录表。
  private get growthLedgerRecord() {
    return this.drizzle.schema.growthLedgerRecord
  }

  // 按 canonical 谓词读取新用户默认等级，供事务外发现与持锁重读共同复用。
  private async findNewUserDefaultLevel(db: DbExecutor) {
    const [defaultLevel] = await db
      .select({ id: this.userLevelRule.id })
      .from(this.userLevelRule)
      .where(
        and(
          eq(this.userLevelRule.isEnabled, true),
          isNull(this.userLevelRule.business),
        ),
      )
      .orderBy(asc(this.userLevelRule.sortOrder), asc(this.userLevelRule.id))
      .limit(1)

    return defaultLevel
  }

  // 在事务外冻结新用户默认等级 ID，并一次性构造 outer root 所需完整锁集。
  async discoverNewUserDefaultLevelLockPlan(): Promise<NewAppUserDefaultLevelLockPlan> {
    const defaultLevel = await this.findNewUserDefaultLevel(this.db)
    return {
      defaultLevelId: defaultLevel?.id ?? null,
      lockRequests: defaultLevel
        ? [
            sharedIntegrityLock(
              tableIntegrityLock('user_level_rule', defaultLevel.id),
            ),
          ]
        : [],
    }
  }

  /**
   * outer root 持有计划内完整锁集后，以同一谓词权威重读默认等级。
   * 返回 snapshot-drift 时调用方必须回滚并在事务外重新发现。
   */
  async resolveNewUserDefaultLevelAfterLockInTx(
    tx: DbTransaction,
    plan: NewAppUserDefaultLevelLockPlan,
  ): Promise<NewAppUserDefaultLevelResolution> {
    const defaultLevel = await this.findNewUserDefaultLevel(tx)
    const defaultLevelId = defaultLevel?.id ?? null
    if (defaultLevelId !== plan.defaultLevelId) {
      return { outcome: 'snapshot-drift' }
    }

    return { outcome: 'stable', defaultLevelId }
  }

  /**
   * 注册事务内的 canonical acquisition root：一次获取完整锁集，权威重读后初始化。
   * 快照漂移时不写入任何初始化事实，由 Auth 使用全新事务重试一次。
   */
  async initializeNewUser(
    tx: DbTransaction,
    userId: number,
    plan: NewAppUserDefaultLevelLockPlan,
  ): Promise<NewAppUserGrowthInitializationOutcome> {
    await acquireIntegrityLocks(tx, plan.lockRequests)
    const resolution = await this.resolveNewUserDefaultLevelAfterLockInTx(
      tx,
      plan,
    )
    if (resolution.outcome === 'snapshot-drift') {
      return 'snapshot-drift'
    }

    await this.applyNewUserInitializationAfterLockInTx(tx, userId, resolution)
    return 'initialized'
  }

  // 默认等级已持锁并完成权威重读后写入成长事实；本 helper 不再获取 advisory lock。
  private async applyNewUserInitializationAfterLockInTx(
    tx: DbTransaction,
    userId: number,
    resolution: NewAppUserDefaultLevelStableResolution,
  ) {
    await tx
      .update(this.appUser)
      .set({
        levelId: resolution.defaultLevelId,
        status: UserStatusEnum.NORMAL,
        signature: '',
        bio: '',
      })
      .where(eq(this.appUser.id, userId))

    await tx
      .insert(this.userAssetBalance)
      .values([
        {
          userId,
          assetType: GrowthAssetTypeEnum.POINTS,
          assetKey: '',
          balance: UserDefaults.INITIAL_POINTS,
        },
        {
          userId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          assetKey: '',
          balance: UserDefaults.INITIAL_EXPERIENCE,
        },
      ])
      .onConflictDoNothing()

    await this.appUserCountService.initUserCounts(tx, userId)
  }

  // 读取成长统计需要的等级外键，并保留用户不存在时的稳定业务异常。
  private async getUserLevelSource(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId, deletedAt: { isNull: true } },
      columns: { levelId: true },
    })
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '应用用户不存在',
      )
    }
    return user
  }

  // 读取用户当前积分与经验余额。
  async getUserGrowthSnapshot(userId: number): Promise<AppUserGrowthSnapshot> {
    return this.growthBalanceQueryService.getUserGrowthSnapshot(userId)
  }

  // 获取用户经验统计，包含今日新增经验及当前/下一等级摘要。
  async getUserExperienceStats(userId: number) {
    const user = await this.getUserLevelSource(userId)
    const growth = await this.getUserGrowthSnapshot(userId)
    const today = startOfTodayInAppTimeZone()

    const [todayEarnedRows, levelRows, nextLevelRows] = await Promise.all([
      this.db
        .select({
          sum: sql<number>`COALESCE(SUM(${this.growthLedgerRecord.delta}), 0)::int`.mapWith(
            Number,
          ),
        })
        .from(this.growthLedgerRecord)
        .where(
          and(
            eq(this.growthLedgerRecord.userId, userId),
            eq(
              this.growthLedgerRecord.assetType,
              GrowthAssetTypeEnum.EXPERIENCE,
            ),
            gt(this.growthLedgerRecord.delta, 0),
            gte(this.growthLedgerRecord.createdAt, today),
          ),
        ),
      user.levelId
        ? this.db
            .select({
              id: this.userLevelRule.id,
              name: this.userLevelRule.name,
              icon: this.userLevelRule.icon,
              color: this.userLevelRule.color,
              requiredExperience: this.userLevelRule.requiredExperience,
            })
            .from(this.userLevelRule)
            .where(eq(this.userLevelRule.id, user.levelId))
        : [],
      this.db
        .select({
          id: this.userLevelRule.id,
          name: this.userLevelRule.name,
          icon: this.userLevelRule.icon,
          color: this.userLevelRule.color,
          requiredExperience: this.userLevelRule.requiredExperience,
        })
        .from(this.userLevelRule)
        .where(
          and(
            eq(this.userLevelRule.isEnabled, true),
            gt(this.userLevelRule.requiredExperience, growth.experience),
          ),
        )
        .orderBy(this.userLevelRule.requiredExperience)
        .limit(1),
    ])
    const level = levelRows[0]
    const nextLevel = nextLevelRows[0]

    return {
      currentExperience: growth.experience,
      todayEarned: Number(todayEarnedRows[0]?.sum ?? 0),
      level: level
        ? {
            id: level.id,
            name: level.name,
            icon: level.icon,
            color: level.color,
            requiredExperience: level.requiredExperience,
          }
        : null,
      nextLevel: nextLevel
        ? {
            id: nextLevel.id,
            name: nextLevel.name,
            icon: nextLevel.icon,
            color: nextLevel.color,
            requiredExperience: nextLevel.requiredExperience,
          }
        : null,
      gapToNextLevel: nextLevel
        ? Math.max(nextLevel.requiredExperience - growth.experience, 0)
        : null,
    }
  }

  // 分页读取用户已获得的徽章，筛选和排序由成长域统一收敛。
  async getUserBadgePage(userId: number, query: QueryMyBadgeDto) {
    await this.userService.assertActiveUserExists(userId)

    const { name, type, isEnabled } = query
    const pageParams = this.drizzle.buildPageParams(query, {
      table: this.userBadgeAssignment,
      fallbackOrderBy: [{ createdAt: 'desc' }, { badgeId: 'desc' }],
    })
    const badgeConditions: SQL[] = []

    if (name) {
      badgeConditions.push(buildILikeCondition(this.userBadge.name, name)!)
    }
    if (type !== undefined) {
      badgeConditions.push(eq(this.userBadge.type, type))
    }
    if (isEnabled !== undefined) {
      badgeConditions.push(eq(this.userBadge.isEnabled, isEnabled))
    }

    const assignmentConditions: SQL[] = [
      eq(this.userBadgeAssignment.userId, userId),
      ...badgeConditions,
    ]
    if (pageParams.dateRange?.gte) {
      assignmentConditions.push(
        gte(this.userBadgeAssignment.createdAt, pageParams.dateRange.gte),
      )
    }
    if (pageParams.dateRange?.lt) {
      assignmentConditions.push(
        lt(this.userBadgeAssignment.createdAt, pageParams.dateRange.lt),
      )
    }
    const assignmentWhere = and(...assignmentConditions)
    const [rows, totalRows] = await Promise.all([
      this.db
        .select({
          createdAt: this.userBadgeAssignment.createdAt,
          badge: {
            id: this.userBadge.id,
            name: this.userBadge.name,
            type: this.userBadge.type,
            description: this.userBadge.description,
            icon: this.userBadge.icon,
            business: this.userBadge.business,
            eventKey: this.userBadge.eventKey,
            sortOrder: this.userBadge.sortOrder,
            isEnabled: this.userBadge.isEnabled,
            createdAt: this.userBadge.createdAt,
            updatedAt: this.userBadge.updatedAt,
          },
        })
        .from(this.userBadgeAssignment)
        .innerJoin(
          this.userBadge,
          eq(this.userBadgeAssignment.badgeId, this.userBadge.id),
        )
        .where(assignmentWhere)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db
        .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
        .from(this.userBadgeAssignment)
        .innerJoin(
          this.userBadge,
          eq(this.userBadgeAssignment.badgeId, this.userBadge.id),
        )
        .where(assignmentWhere),
    ])
    const total = Number(totalRows[0]?.count ?? 0)
    const page = toPageResult(rows, total, pageParams.page)

    return {
      ...page,
      list: page.list.map((item) => ({
        createdAt: item.createdAt,
        badge: {
          ...item.badge,
          description: item.badge.description ?? null,
          icon: item.badge.icon ?? null,
          business: item.badge.business ?? null,
          eventKey: item.badge.eventKey ?? null,
        },
      })),
    }
  }

  // 获取用户已分配徽章总数。
  async getBadgeCount(userId: number): Promise<number> {
    const [rows] = await this.db
      .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
      .from(this.userBadgeAssignment)
      .where(eq(this.userBadgeAssignment.userId, userId))
    return Number(rows?.count ?? 0)
  }

  // 获取等级摘要；等级被删除或不存在时维持 undefined 语义。
  async getLevelInfo(
    levelId: number,
  ): Promise<UserLevelSummaryDto | undefined> {
    const [level] = await this.db
      .select({
        id: this.userLevelRule.id,
        name: this.userLevelRule.name,
        icon: this.userLevelRule.icon,
        color: this.userLevelRule.color,
        requiredExperience: this.userLevelRule.requiredExperience,
      })
      .from(this.userLevelRule)
      .where(eq(this.userLevelRule.id, levelId))
      .limit(1)

    return level
      ? {
          id: level.id,
          name: level.name,
          icon: level.icon ?? null,
          color: level.color ?? null,
          requiredExperience: level.requiredExperience,
        }
      : undefined
  }
}
