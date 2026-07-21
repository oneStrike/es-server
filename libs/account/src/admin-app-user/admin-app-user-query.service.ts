import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService, toPageResult } from '@db/core'
import { AdminAppUserGrowthService } from '@libs/growth/admin-app-user/admin-app-user-growth.service'
import { AppUserGrowthProfileService } from '@libs/growth/app-user-growth-profile/app-user-growth-profile.service'
import { GrowthBalanceQueryService } from '@libs/growth/growth-ledger/growth-balance-query.service'

import { AppUserDeletedScopeEnum } from '@libs/user/app-user.constant'
import { UserService as UserCoreService } from '@libs/user/user.service'
import { Injectable } from '@nestjs/common'
import { and, eq, gte, inArray, isNotNull, isNull, lt } from 'drizzle-orm'
import { AdminAppUserServiceSupport } from './admin-app-user.service.support'
import { QueryAdminAppUserPageDto } from './dto/admin-app-user.dto'

/**
 * APP 用户查询服务。
 *
 * 负责管理端用户目录读模型，包括分页列表与详情聚合，收口 Drizzle 查询拼装和
 * 跨域摘要组装。
 */
@Injectable()
export class AdminAppUserQueryService extends AdminAppUserServiceSupport {
  constructor(
    drizzle: DrizzleService,
    userCoreService: UserCoreService,
    private readonly growthBalanceQueryService: GrowthBalanceQueryService,
    private readonly adminAppUserGrowthService: AdminAppUserGrowthService,
    private readonly appUserGrowthProfileService: AppUserGrowthProfileService,
  ) {
    super(drizzle, userCoreService)
  }

  // 获取 APP 用户分页列表，补齐等级名与聚合计数摘要。
  async getAppUserPage(query: QueryAdminAppUserPageDto) {
    const {
      id,
      account,
      phoneNumber,
      nickname,
      emailAddress,
      isEnabled,
      status,
      levelId,
      deletedScope,
      lastLoginStartDate,
      lastLoginEndDate,
      startDate,
      endDate,
      pageIndex,
      pageSize,
      orderBy,
    } = query

    const lastLoginAt = this.buildDateRange(
      lastLoginStartDate,
      lastLoginEndDate,
    )
    const createdAt = this.buildDateRange(startDate, endDate)
    const conditions: SQL[] = []

    if (id !== undefined) {
      conditions.push(eq(this.appUserTable.id, id))
    }
    if (account) {
      conditions.push(buildILikeCondition(this.appUserTable.account, account)!)
    }
    if (phoneNumber) {
      conditions.push(
        buildILikeCondition(this.appUserTable.phoneNumber, phoneNumber)!,
      )
    }
    if (nickname) {
      conditions.push(
        buildILikeCondition(this.appUserTable.nickname, nickname)!,
      )
    }
    if (emailAddress) {
      conditions.push(
        buildILikeCondition(this.appUserTable.emailAddress, emailAddress)!,
      )
    }
    if (isEnabled !== undefined) {
      conditions.push(eq(this.appUserTable.isEnabled, isEnabled))
    }
    if (status !== undefined) {
      conditions.push(eq(this.appUserTable.status, status))
    }
    if (levelId !== undefined) {
      conditions.push(
        levelId === null
          ? isNull(this.appUserTable.levelId)
          : eq(this.appUserTable.levelId, levelId),
      )
    }
    if (deletedScope === AppUserDeletedScopeEnum.DELETED) {
      conditions.push(isNotNull(this.appUserTable.deletedAt))
    } else if (deletedScope !== AppUserDeletedScopeEnum.ALL) {
      conditions.push(isNull(this.appUserTable.deletedAt))
    }
    if (lastLoginAt?.gte) {
      conditions.push(gte(this.appUserTable.lastLoginAt, lastLoginAt.gte))
    }
    if (lastLoginAt?.lt) {
      conditions.push(lt(this.appUserTable.lastLoginAt, lastLoginAt.lt))
    }
    if (createdAt?.gte) {
      conditions.push(gte(this.appUserTable.createdAt, createdAt.gte))
    }
    if (createdAt?.lt) {
      conditions.push(lt(this.appUserTable.createdAt, createdAt.lt))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const pageQuery = this.drizzle.buildPage({ pageIndex, pageSize })
    const orderQuery = this.drizzle.buildOrderBy(
      orderBy ?? { id: 'desc' as const },
      { table: this.appUserTable },
    )
    const [list, total] = await Promise.all([
      this.db
        .select({
          id: this.appUserTable.id,
          account: this.appUserTable.account,
          phoneNumber: this.appUserTable.phoneNumber,
          emailAddress: this.appUserTable.emailAddress,
          levelId: this.appUserTable.levelId,
          nickname: this.appUserTable.nickname,
          avatarUrl: this.appUserTable.avatarUrl,
          profileBackgroundImageUrl:
            this.appUserTable.profileBackgroundImageUrl,
          signature: this.appUserTable.signature,
          bio: this.appUserTable.bio,
          isEnabled: this.appUserTable.isEnabled,
          genderType: this.appUserTable.genderType,
          birthDate: this.appUserTable.birthDate,
          status: this.appUserTable.status,
          banReason: this.appUserTable.banReason,
          banUntil: this.appUserTable.banUntil,
          lastLoginAt: this.appUserTable.lastLoginAt,
          lastLoginIp: this.appUserTable.lastLoginIp,
          createdAt: this.appUserTable.createdAt,
          updatedAt: this.appUserTable.updatedAt,
          deletedAt: this.appUserTable.deletedAt,
        })
        .from(this.appUserTable)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.appUserTable, where),
    ])
    const page = toPageResult(list, total, pageQuery)

    const levelIds = [
      ...new Set(page.list.map((item) => item.levelId).filter(Boolean)),
    ]
    const userIds = page.list.map((item) => item.id)
    const [levelRows, countRows] = await Promise.all([
      levelIds.length > 0
        ? this.db
            .select({
              id: this.userLevelRuleTable.id,
              name: this.userLevelRuleTable.name,
            })
            .from(this.userLevelRuleTable)
            .where(inArray(this.userLevelRuleTable.id, levelIds as number[]))
        : [],
      userIds.length > 0
        ? this.db
            .select({
              userId: this.appUserCountTable.userId,
              commentCount: this.appUserCountTable.commentCount,
              likeCount: this.appUserCountTable.likeCount,
              favoriteCount: this.appUserCountTable.favoriteCount,
              followingUserCount: this.appUserCountTable.followingUserCount,
              followingAuthorCount: this.appUserCountTable.followingAuthorCount,
              followingSectionCount:
                this.appUserCountTable.followingSectionCount,
              followersCount: this.appUserCountTable.followersCount,
              forumTopicCount: this.appUserCountTable.forumTopicCount,
              commentReceivedLikeCount:
                this.appUserCountTable.commentReceivedLikeCount,
              forumTopicReceivedLikeCount:
                this.appUserCountTable.forumTopicReceivedLikeCount,
              forumTopicReceivedFavoriteCount:
                this.appUserCountTable.forumTopicReceivedFavoriteCount,
            })
            .from(this.appUserCountTable)
            .where(inArray(this.appUserCountTable.userId, userIds))
        : [],
    ])
    const levelMap = new Map(

      levelRows.map((item) => [item.id, item.name] as const),
    )
    const countMap = new Map(

      countRows.map((item) => [item.userId, item] as const),
    )
    const growthMap =
      await this.growthBalanceQueryService.getUserGrowthSnapshotMap(
        page.list.map((item) => item.id),
      )

    return {
      ...page,
      list: page.list.map((item) => ({
        ...this.userCoreService.mapBaseUser(item, growthMap.get(item.id)),
        deletedAt: item.deletedAt ?? null,

        levelName: item.levelId ? (levelMap.get(item.levelId) ?? null) : null,

        counts: this.mapAdminAppUserCounts(countMap.get(item.id)),
      })),
    }
  }

  // 获取 APP 用户详情，统一收口等级、计数、徽章数和成长摘要。
  async getAppUserDetail(userId: number) {
    const user = await this.userCoreService.getAppUserResponseSource(userId)
    const growth =
      await this.growthBalanceQueryService.getUserGrowthSnapshot(userId)

    const [level, counts, badgeCount, pointStats, experienceStats] =
      await Promise.all([
        user.levelId
          ? this.appUserGrowthProfileService.getLevelInfo(user.levelId)
          : undefined,
        this.userCoreService.getUserCounts(userId),
        this.appUserGrowthProfileService.getBadgeCount(userId),
        this.adminAppUserGrowthService.getAppUserPointStats(userId),
        this.adminAppUserGrowthService.getAppUserExperienceStats(userId),
      ])

    return {
      ...this.userCoreService.mapBaseUser(user, growth),
      deletedAt: null,
      level: level
        ? {
            id: level.id,
            name: level.name,
            requiredExperience: level.requiredExperience,
          }
        : null,
      counts: this.mapAdminAppUserCounts(counts),
      badgeCount,
      pointStats,
      experienceStats,
    }
  }
}
