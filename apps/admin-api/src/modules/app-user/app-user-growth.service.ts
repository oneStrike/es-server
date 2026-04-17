import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'

import { AssignUserBadgeDto } from '@libs/growth/badge/dto/user-badge-management.dto'
import { UserBadgeService } from '@libs/growth/badge/user-badge.service'
import { QueryUserExperienceRecordDto } from '@libs/growth/experience/dto/experience-record.dto'
import { UserExperienceService } from '@libs/growth/experience/experience.service'
import { GrowthAssetTypeEnum } from '@libs/growth/growth-ledger/growth-ledger.constant'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { QueryUserPointRecordDto } from '@libs/growth/point/dto/point-record.dto'
import { UserPointService } from '@libs/growth/point/point.service'
import { startOfTodayInAppTimeZone } from '@libs/platform/utils'
import {
  AdminAppUserGrowthRuleActionDto,
  ConsumeAdminAppUserPointsDto,
  QueryAdminAppUserBadgeDto,
  QueryAdminAppUserGrowthLedgerDto,
} from '@libs/user/dto/admin-app-user.dto'
import { UserService as UserCoreService } from '@libs/user/user.service'
import { Injectable } from '@nestjs/common'
import { and, eq, gt, gte, inArray, isNull, sql } from 'drizzle-orm'
import { AppUserServiceSupport } from './app-user.service.support'

/**
 * APP 用户成长域服务。
 *
 * 负责积分、经验、成长流水与徽章相关的读写能力，并复用 support 基类中的
 * 权限、用户存在性和幂等辅助逻辑。
 */
@Injectable()
export class AppUserGrowthService extends AppUserServiceSupport {
  constructor(
    drizzle: DrizzleService,
    userCoreService: UserCoreService,
    private readonly userPointService: UserPointService,
    private readonly userExperienceService: UserExperienceService,
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly userBadgeService: UserBadgeService,
  ) {
    super(drizzle, userCoreService)
  }

  /** 获取 APP 用户积分统计。 */
  async getAppUserPointStats(userId: number) {
    await this.userCoreService.ensureUserExists(userId)
    return this.userPointService.getUserPointStats(userId)
  }

  /** 获取 APP 用户积分记录分页。 */
  async getAppUserPointRecords(query: QueryUserPointRecordDto) {
    await this.userCoreService.ensureUserExists(query.userId)
    return this.userPointService.getPointRecordPage(query)
  }

  /**
   * 手动增加 APP 用户积分。
   *
   * 入口层先拦截软删除用户，避免共享成长服务继续对无效账号写入资产。
   */
  async addAppUserPoints(
    adminUserId: number,
    dto: AdminAppUserGrowthRuleActionDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(dto.userId)

    return this.userPointService.addPoints({
      ...dto,
      bizKey: this.buildManualOperationBizKey(
        'app-user:points:add',
        adminUserId,
        dto.userId,
        dto.operationKey,
      ),
      source: 'admin_app_user_module',
    })
  }

  /**
   * 手动扣减 APP 用户积分。
   *
   * 入口层先拦截软删除用户，避免共享成长服务继续对无效账号写入资产。
   */
  async consumeAppUserPoints(
    adminUserId: number,
    dto: ConsumeAdminAppUserPointsDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(dto.userId)

    return this.userPointService.consumePoints({
      ...dto,
      bizKey: this.buildManualOperationBizKey(
        'app-user:points:consume',
        adminUserId,
        dto.userId,
        dto.operationKey,
      ),
      source: 'admin_app_user_module',
    })
  }

  /**
   * 获取 APP 用户经验统计。
   *
   * 统一汇总当日新增、当前等级和下一等级差值，供详情页和独立统计接口复用。
   */
  async getAppUserExperienceStats(userId: number) {
    const user = await this.userCoreService.ensureUserExists(userId)

    const today = startOfTodayInAppTimeZone()

    const [todayEarnedRows, level, nextLevelRows] = await Promise.all([
      this.db
        .select({
          sum: sql<number>`COALESCE(SUM(${this.growthLedgerRecordTable.delta}), 0)::int`,
        })
        .from(this.growthLedgerRecordTable)
        .where(
          and(
            eq(this.growthLedgerRecordTable.userId, userId),
            eq(
              this.growthLedgerRecordTable.assetType,
              GrowthAssetTypeEnum.EXPERIENCE,
            ),
            gt(this.growthLedgerRecordTable.delta, 0),
            gte(this.growthLedgerRecordTable.createdAt, today),
          ),
        ),
      user.levelId
        ? this.userCoreService.getLevelInfo(user.levelId)
        : undefined,
      this.db
        .select({
          id: this.userLevelRuleTable.id,
          name: this.userLevelRuleTable.name,
          requiredExperience: this.userLevelRuleTable.requiredExperience,
        })
        .from(this.userLevelRuleTable)
        .where(
          and(
            eq(this.userLevelRuleTable.isEnabled, true),
            gt(this.userLevelRuleTable.requiredExperience, user.experience),
          ),
        )
        .orderBy(this.userLevelRuleTable.requiredExperience)
        .limit(1),
    ])
    const todayEarned = Number(todayEarnedRows[0]?.sum ?? 0)
    const nextLevel = nextLevelRows[0]

    return {
      currentExperience: user.experience,
      todayEarned,
      level: level
        ? {
            id: level.id,
            name: level.name,
            requiredExperience: level.requiredExperience,
          }
        : undefined,
      nextLevel: nextLevel
        ? {
            id: nextLevel.id,
            name: nextLevel.name,
            requiredExperience: nextLevel.requiredExperience,
          }
        : undefined,
      gapToNextLevel: nextLevel
        ? Math.max(nextLevel.requiredExperience - user.experience, 0)
        : undefined,
    }
  }

  /** 获取 APP 用户经验记录分页。 */
  async getAppUserExperienceRecords(query: QueryUserExperienceRecordDto) {
    await this.userCoreService.ensureUserExists(query.userId)
    return this.userExperienceService.getExperienceRecordPage(query)
  }

  /** 获取 APP 用户混合成长流水分页。 */
  async getAppUserGrowthLedgerRecords(query: QueryAdminAppUserGrowthLedgerDto) {
    await this.userCoreService.ensureUserExists(query.userId)
    return this.growthLedgerService.getGrowthLedgerPage(query)
  }

  /**
   * 手动增加 APP 用户经验。
   *
   * 入口层先拦截软删除用户，避免共享成长服务继续对无效账号写入资产。
   */
  async addAppUserExperience(
    adminUserId: number,
    dto: AdminAppUserGrowthRuleActionDto,
  ) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(dto.userId)

    return this.userExperienceService.addExperience({
      ...dto,
      bizKey: this.buildManualOperationBizKey(
        'app-user:experience:add',
        adminUserId,
        dto.userId,
        dto.operationKey,
      ),
      source: 'admin_app_user_module',
    })
  }

  /**
   * 获取 APP 用户徽章分页。
   *
   * 先按徽章维度过滤候选集合，再回到分配表分页，保持管理端筛选语义稳定。
   */
  async getAppUserBadges(query: QueryAdminAppUserBadgeDto) {
    await this.userCoreService.ensureUserExists(query.userId)

    const { userId, name, type, isEnabled, business, eventKey, ...pageQuery } =
      query

    const badgeConditions: SQL[] = []

    if (name) {
      badgeConditions.push(buildILikeCondition(this.userBadgeTable.name, name)!)
    }
    if (type !== undefined) {
      badgeConditions.push(eq(this.userBadgeTable.type, type))
    }
    if (isEnabled !== undefined) {
      badgeConditions.push(eq(this.userBadgeTable.isEnabled, isEnabled))
    }
    if (business !== undefined) {
      badgeConditions.push(
        business === null
          ? isNull(this.userBadgeTable.business)
          : eq(this.userBadgeTable.business, business),
      )
    }
    if (eventKey !== undefined) {
      badgeConditions.push(
        eventKey === null
          ? isNull(this.userBadgeTable.eventKey)
          : eq(this.userBadgeTable.eventKey, eventKey),
      )
    }

    const badgeWhere =
      badgeConditions.length > 0 ? and(...badgeConditions) : undefined
    const badges = await this.db
      .select({ id: this.userBadgeTable.id })
      .from(this.userBadgeTable)
      .where(badgeWhere)
    const badgeIds = badges.map((item) => item.id)
    if (badgeIds.length === 0) {
      return {
        list: [],
        total: 0,
        pageIndex: pageQuery.pageIndex,
        pageSize: pageQuery.pageSize,
        totalPages: 0,
      }
    }

    const page = await this.drizzle.ext.findPagination(
      this.userBadgeAssignmentTable,
      {
        where: and(
          eq(this.userBadgeAssignmentTable.userId, userId),
          inArray(this.userBadgeAssignmentTable.badgeId, badgeIds),
        ),
        ...pageQuery,
        orderBy: pageQuery.orderBy ?? [
          { createdAt: 'desc' as const },
          { badgeId: 'asc' as const },
        ],
      },
    )
    const pageBadgeIds = page.list.map((item) => item.badgeId)
    const pageBadges = pageBadgeIds.length
      ? await this.db
          .select()
          .from(this.userBadgeTable)
          .where(inArray(this.userBadgeTable.id, pageBadgeIds))
      : []
    const badgeMap = new Map(pageBadges.map((item) => [item.id, item]))

    return {
      ...page,
      list: page.list.map((item) => ({
        createdAt: item.createdAt,
        badge: badgeMap.get(item.badgeId),
      })),
    }
  }

  /**
   * 为 APP 用户分配徽章。
   *
   * 入口层先拦截软删除用户，避免恢复账号时暴露隐藏写入。
   */
  async assignAppUserBadge(adminUserId: number, dto: AssignUserBadgeDto) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(dto.userId)

    await this.userBadgeService.assignBadge(dto)
    return true
  }

  /**
   * 撤销 APP 用户徽章。
   *
   * 入口层先拦截软删除用户，避免恢复账号时暴露隐藏写入。
   */
  async revokeAppUserBadge(adminUserId: number, dto: AssignUserBadgeDto) {
    await this.ensureSuperAdmin(adminUserId)
    await this.userCoreService.ensureUserExists(dto.userId)

    await this.userBadgeService.revokeBadge(dto)
    return true
  }
}
