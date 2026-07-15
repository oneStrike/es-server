import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService, toPageResult } from '@db/core'

import {
  AdminAppUserGrowthRuleActionDto,
  ConsumeAdminAppUserPointsDto,
  QueryAdminAppUserBadgeDto,
  QueryAdminAppUserGrowthLedgerDto,
} from '@libs/growth/admin-app-user/dto/admin-app-user-growth.dto'
import { AppUserGrowthProfileService } from '@libs/growth/app-user-growth-profile/app-user-growth-profile.service'
import { AssignUserBadgeDto } from '@libs/growth/badge/dto/user-badge-management.dto'
import { UserBadgeService } from '@libs/growth/badge/user-badge.service'
import { QueryScopedUserExperienceRecordDto } from '@libs/growth/experience/dto/experience-record.dto'
import { UserExperienceService } from '@libs/growth/experience/experience.service'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { QueryUserPointRecordDto } from '@libs/growth/point/dto/point-record.dto'
import { UserPointService } from '@libs/growth/point/point.service'
import { UserService as UserCoreService } from '@libs/user/user.service'
import { Injectable } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

/**
 * APP 用户成长域服务。
 *
 * 负责积分、经验、成长流水与徽章相关的读写能力，并复用 support 基类中的
 * 权限、用户存在性和幂等辅助逻辑。
 */
@Injectable()
export class AdminAppUserGrowthService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly userCoreService: UserCoreService,
    private readonly userPointService: UserPointService,
    private readonly userExperienceService: UserExperienceService,
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly userBadgeService: UserBadgeService,
    private readonly appUserGrowthProfileService: AppUserGrowthProfileService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get userBadgeAssignmentTable() {
    return this.drizzle.schema.userBadgeAssignment
  }

  private get userBadgeTable() {
    return this.drizzle.schema.userBadge
  }

  // 构建后台人工操作稳定业务键，同一 operationKey 重试时保持 bizKey 不变。
  private buildManualOperationBizKey(
    action: string,
    adminUserId: number,
    appUserId: number,
    operationKey: string,
  ) {
    return `${action}:admin:${adminUserId}:user:${appUserId}:operation:${operationKey}`
  }

  // 获取 APP 用户积分统计。
  async getAppUserPointStats(userId: number) {
    await this.userCoreService.assertActiveUserExists(userId)
    return this.userPointService.getUserPointStats(userId)
  }

  // 获取 APP 用户积分记录分页。
  async getAppUserPointRecords(query: QueryUserPointRecordDto) {
    await this.userCoreService.assertActiveUserExists(query.userId)
    return this.userPointService.getPointRecordPage(query)
  }

  // 手动增加 APP 用户积分，入口层先拦截软删除用户。
  async addAppUserPoints(
    adminUserId: number,
    dto: AdminAppUserGrowthRuleActionDto,
  ) {
    await this.userCoreService.assertActiveUserExists(dto.userId)

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

  // 手动扣减 APP 用户积分，入口层先拦截软删除用户。
  async consumeAppUserPoints(
    adminUserId: number,
    dto: ConsumeAdminAppUserPointsDto,
  ) {
    await this.userCoreService.assertActiveUserExists(dto.userId)

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

  // 获取 APP 用户经验统计，含当日新增、当前等级和下一等级差值。
  async getAppUserExperienceStats(userId: number) {
    return this.appUserGrowthProfileService.getUserExperienceStats(userId)
  }

  // 获取 APP 用户经验记录分页。
  async getAppUserExperienceRecords(query: QueryScopedUserExperienceRecordDto) {
    await this.userCoreService.assertActiveUserExists(query.userId)
    return this.userExperienceService.getExperienceRecordPage(query)
  }

  // 获取 APP 用户混合成长流水分页。
  async getAppUserGrowthLedgerRecords(query: QueryAdminAppUserGrowthLedgerDto) {
    await this.userCoreService.assertActiveUserExists(query.userId)
    return this.growthLedgerService.getGrowthLedgerPage(query)
  }

  // 手动增加 APP 用户经验，入口层先拦截软删除用户。
  async addAppUserExperience(
    adminUserId: number,
    dto: AdminAppUserGrowthRuleActionDto,
  ) {
    await this.userCoreService.assertActiveUserExists(dto.userId)

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

  // 获取 APP 用户徽章分页，在分配表分页查询中关联徽章过滤。
  async getAppUserBadges(query: QueryAdminAppUserBadgeDto) {
    await this.userCoreService.assertActiveUserExists(query.userId)

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

    const where = and(
      eq(this.userBadgeAssignmentTable.userId, userId),
      ...badgeConditions,
    )
    const pageParams = this.drizzle.buildPage(pageQuery)
    const orderQuery = this.drizzle.buildOrderBy(
      pageQuery.orderBy ?? [
        { createdAt: 'desc' as const },
        { badgeId: 'asc' as const },
      ],
      { table: this.userBadgeAssignmentTable },
    )
    const [list, totalRows] = await Promise.all([
      this.db
        .select({
          assignment: this.userBadgeAssignmentTable,
          badge: this.userBadgeTable,
        })
        .from(this.userBadgeAssignmentTable)
        .innerJoin(
          this.userBadgeTable,
          eq(this.userBadgeAssignmentTable.badgeId, this.userBadgeTable.id),
        )
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageParams.limit)
        .offset(pageParams.offset),
      this.db
        .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
        .from(this.userBadgeAssignmentTable)
        .innerJoin(
          this.userBadgeTable,
          eq(this.userBadgeAssignmentTable.badgeId, this.userBadgeTable.id),
        )
        .where(where),
    ])
    const total = Number(totalRows[0]?.count ?? 0)
    const page = toPageResult(list, total, pageParams)

    return {
      ...page,
      list: page.list.map((item) => ({
        createdAt: item.assignment.createdAt,
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

  // 为 APP 用户分配徽章，入口层先拦截软删除用户。
  async assignAppUserBadge(adminUserId: number, dto: AssignUserBadgeDto) {
    await this.userCoreService.assertActiveUserExists(dto.userId)

    await this.userBadgeService.assignBadge(dto)
    return true
  }

  // 撤销 APP 用户徽章，入口层先拦截软删除用户。
  async revokeAppUserBadge(adminUserId: number, dto: AssignUserBadgeDto) {
    await this.userCoreService.assertActiveUserExists(dto.userId)

    await this.userBadgeService.revokeBadge(dto)
    return true
  }
}
