import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { GrowthBalanceQueryService } from '@libs/growth/growth-ledger/growth-balance-query.service'

import {
  AppUserDeletedScopeEnum,
} from '@libs/user/app-user.constant'
import {
  QueryAdminAppUserPageDto,
} from '@libs/user/dto/admin-app-user.dto'
import { UserService as UserCoreService } from '@libs/user/user.service'
import { Injectable } from '@nestjs/common'
import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
} from 'drizzle-orm'
import { AppUserGrowthService } from './app-user-growth.service'
import { AppUserServiceSupport } from './app-user.service.support'

/**
 * APP 用户查询服务。
 *
 * 负责管理端用户目录读模型，包括分页列表与详情聚合，避免 facade 承担
 * Drizzle 查询拼装和跨域摘要组装。
 */
@Injectable()
export class AppUserQueryService extends AppUserServiceSupport {
  constructor(
    drizzle: DrizzleService,
    userCoreService: UserCoreService,
    private readonly growthBalanceQueryService: GrowthBalanceQueryService,
    private readonly appUserGrowthService: AppUserGrowthService,
  ) {
    super(drizzle, userCoreService)
  }

  /**
   * 获取 APP 用户分页列表。
   *
   * 管理端分页查询继续沿用 `PageDto` 的 `pageIndex/pageSize/orderBy`
   * 契约，并补齐等级名与聚合计数摘要。
   */
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
      pageIndex,
      pageSize,
      orderBy,
    } = query

    const lastLoginAt = this.buildDateRange(
      lastLoginStartDate,
      lastLoginEndDate,
    )
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

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = await this.drizzle.ext.findPagination(this.appUserTable, {
      where,
      pageIndex,
      pageSize,
      orderBy: orderBy ?? { id: 'desc' as const },
    })

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
              followingAuthorCount:
                this.appUserCountTable.followingAuthorCount,
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
    const growthMap = await this.growthBalanceQueryService.getUserGrowthSnapshotMap(
      page.list.map((item) => item.id),
    )

    return {
      ...page,
      list: page.list.map((item) => ({
        ...this.userCoreService.mapBaseUser(
          item,
          growthMap.get(item.id),
        ),
        levelName: item.levelId ? levelMap.get(item.levelId) : undefined,
        counts: this.mapAdminAppUserCounts(countMap.get(item.id)),
      })),
    }
  }

  /**
   * 获取 APP 用户详情。
   *
   * 统一收口等级、计数、徽章数和成长摘要，确保 detail 输出与 DTO 契约一致。
   */
  async getAppUserDetail(userId: number) {
    const user = await this.userCoreService.ensureUserExists(userId)
    const growth = await this.growthBalanceQueryService.getUserGrowthSnapshot(
      userId,
    )

    const [level, counts, badgeCount, pointStats, experienceStats] =
      await Promise.all([
        user.levelId
          ? this.userCoreService.getLevelInfo(user.levelId)
          : undefined,
        this.userCoreService.getUserCounts(userId),
        this.userCoreService.getBadgeCount(userId),
        this.appUserGrowthService.getAppUserPointStats(userId),
        this.appUserGrowthService.getAppUserExperienceStats(userId),
      ])

    return {
      ...this.userCoreService.mapBaseUser(user, growth),
      level: level
        ? {
            id: level.id,
            name: level.name,
            requiredExperience: level.requiredExperience,
          }
        : undefined,
      counts: this.mapAdminAppUserCounts(counts),
      badgeCount,
      pointStats,
      experienceStats,
    }
  }
}
