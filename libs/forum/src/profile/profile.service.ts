import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'

import { GrowthAssetTypeEnum, UserPointService } from '@libs/growth'
import { FavoriteService, FavoriteTargetTypeEnum } from '@libs/interaction'
import {
  UserDefaults,
  UserStatusEnum,
} from '@libs/platform/constant'

import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, ilike, inArray, isNull } from 'drizzle-orm'
import {
  QueryForumProfileListDto,
  UpdateForumProfileStatusDto,
} from './dto/profile.dto'

/**
 * 论坛用户画像服务
 * 提供用户论坛资料、积分记录、收藏等管理功能
 */
@Injectable()
export class ForumProfileService {
  constructor(
    private readonly drizzle: DrizzleService,
    /** 用户积分服务 */
    protected readonly pointService: UserPointService,
    /** 收藏服务 */
    protected readonly favoriteService: FavoriteService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  get appUser() {
    return this.drizzle.schema.appUser
  }

  get forumProfile() {
    return this.drizzle.schema.forumProfile
  }

  get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  get forumSection() {
    return this.drizzle.schema.forumSection
  }

  get growthLedgerRecord() {
    return this.drizzle.schema.growthLedgerRecord
  }

  get userBadge() {
    return this.drizzle.schema.userBadge
  }

  get userBadgeAssignment() {
    return this.drizzle.schema.userBadgeAssignment
  }

  get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  /**
   * 查询用户资料列表
   * @param queryDto - 查询参数，包含用户ID、昵称、状态等过滤条件
   * @returns 分页的用户资料列表，包含用户信息和徽章信息
   */
  async queryProfileList(queryDto: QueryForumProfileListDto) {
    const { levelId, status, nickname, ...rest } = queryDto

    const where = this.drizzle.buildWhere(this.appUser, {
      and: {
        levelId,
        status,
      },
      ...(nickname ? { or: [ilike(this.appUser.nickname, `%${nickname}%`)] } : {}),
    })

    const page = await this.drizzle.ext.findPagination(this.appUser, {
      where,
      ...rest,
    })
    const userIds = page.list.map((item) => item.id)
    const profiles = userIds.length
      ? await this.db
          .select()
          .from(this.forumProfile)
          .where(inArray(this.forumProfile.userId, userIds))
      : []
    const profileMap = new Map(profiles.map((item) => [item.userId, item]))
    const badgeRows = userIds.length
      ? await this.db
          .select({
            userId: this.userBadgeAssignment.userId,
            assignmentId: this.userBadgeAssignment.id,
            createdAt: this.userBadgeAssignment.createdAt,
            badge: this.userBadge,
          })
          .from(this.userBadgeAssignment)
          .innerJoin(this.userBadge, eq(this.userBadge.id, this.userBadgeAssignment.badgeId))
          .where(inArray(this.userBadgeAssignment.userId, userIds))
      : []
    const badgeMap = new Map<number, any[]>()
    for (const row of badgeRows) {
      const list = badgeMap.get(row.userId) ?? []
      list.push({ id: row.assignmentId, createdAt: row.createdAt, badge: row.badge })
      badgeMap.set(row.userId, list)
    }

    const list = page.list.map((item) => {
      return {
        ...item,
        avatar: item.avatarUrl,
        forumProfile: profileMap.get(item.id) ?? null,
        userBadges: badgeMap.get(item.id) ?? [],
      }
    })
    return { ...page, list }
  }

  /**
   * 查看用户资料
   * @param userId - 用户ID
   * @returns 用户资料详情，包含用户信息和徽章信息
   * @throws Error 用户不存在
   */
  async getProfile(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }
    const [profile] = await this.db
      .select()
      .from(this.forumProfile)
      .where(eq(this.forumProfile.userId, userId))
    const userBadges = await this.db
      .select({
        id: this.userBadgeAssignment.id,
        userId: this.userBadgeAssignment.userId,
        badgeId: this.userBadgeAssignment.badgeId,
        createdAt: this.userBadgeAssignment.createdAt,
        badge: this.userBadge,
      })
      .from(this.userBadgeAssignment)
      .innerJoin(this.userBadge, eq(this.userBadge.id, this.userBadgeAssignment.badgeId))
      .where(eq(this.userBadgeAssignment.userId, userId))
    return {
      ...user,
      avatar: user.avatarUrl,
      forumProfile: profile ?? null,
      userBadges,
    }
  }

  /**
   * 更新用户资料状态
   * @param updateDto - 更新参数，包含用户ID、状态和封禁原因
   * @throws Error 用户不存在
   */
  async updateProfileStatus(
    updateDto: UpdateForumProfileStatusDto,
  ): Promise<void> {
    const { userId, status, banReason } = updateDto

    const user = await this.db.query.appUser.findFirst({ where: { id: userId } })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    await this.db
      .update(this.appUser)
      .set({ status, banReason })
      .where(eq(this.appUser.id, userId))
  }

  /**
   * 查看我的主题
   * @param userId - 用户ID
   * @returns 分页的主题列表，包含板块信息和回复数统计
   */
  async getMyTopics(userId: number) {
    const page = await this.drizzle.ext.findPagination(this.forumTopic, {
      where: and(eq(this.forumTopic.userId, userId), isNull(this.forumTopic.deletedAt)),
    })
    const sectionIds = page.list.map((item) => item.sectionId).filter((id) => !!id)
    const sections = sectionIds.length
      ? await this.db
          .select({ id: this.forumSection.id, name: this.forumSection.name })
          .from(this.forumSection)
          .where(inArray(this.forumSection.id, sectionIds))
      : []
    const sectionMap = new Map(sections.map((item) => [item.id, item]))
    const list = page.list.map((item) => {
      return {
        ...item,
        section: item.sectionId ? sectionMap.get(item.sectionId) ?? null : null,
      }
    })
    return { ...page, list }
  }

  /**
   * 获取我的收藏
   * @param userId - 用户ID
   * @returns 分页的收藏列表，包含主题信息
   */
  async getMyFavorites(userId: number) {
    const result = await this.favoriteService.getUserFavorites(
      { targetType: FavoriteTargetTypeEnum.FORUM_TOPIC },
      userId,
    )

    if (result.list.length === 0) {
      return { list: [], total: result.total }
    }

    const topicIds = result.list.map((f) => f.targetId)
    const topics = await this.db
      .select()
      .from(this.forumTopic)
      .where(inArray(this.forumTopic.id, topicIds))
    const sectionIds = topics.map((item) => item.sectionId).filter((id) => !!id)
    const sections = sectionIds.length
      ? await this.db
          .select({ id: this.forumSection.id, name: this.forumSection.name })
          .from(this.forumSection)
          .where(inArray(this.forumSection.id, sectionIds))
      : []
    const sectionMap = new Map(sections.map((item) => [item.id, item]))
    const topicsWithSection = topics.map((item) => ({
      ...item,
      section: item.sectionId ? sectionMap.get(item.sectionId) ?? null : null,
    }))

    const topicMap = new Map(topicsWithSection.map((t) => [t.id, t]))
    const orderedTopics = topicIds
      .map((id) => topicMap.get(id))
      .filter(Boolean) as Array<{ id: number }>

    return {
      list: orderedTopics.map((topic) => ({
        topic,
        createdAt: result.list.find((f) => f.targetId === topic.id)?.createdAt,
      })),
      total: result.total,
    }
  }

  /**
   * 查看积分记录
   * @param userId - 用户ID
   * @returns 分页的积分记录列表
   */
  async getPointRecords(userId: number) {
    const page = await this.drizzle.ext.findPagination(this.growthLedgerRecord, {
      where: and(
        eq(this.growthLedgerRecord.userId, userId),
        eq(this.growthLedgerRecord.assetType, GrowthAssetTypeEnum.POINTS),
      ),
      orderBy: { id: 'desc' },
    })
    return {
      ...page,
      list: page.list.map((item) => ({
        id: item.id,
        userId: item.userId,
        ruleId: item.ruleId ?? undefined,
        points: item.delta,
        beforePoints: item.beforeValue,
        afterPoints: item.afterValue,
        remark: item.remark ?? undefined,
        createdAt: item.createdAt,
      })),
    }
  }

  /**
   * 初始化用户论坛资料
   * @param tx - 事务客户端
   * @param userId - 用户 ID
   * @throws {BadRequestException} 系统配置错误：找不到默认论坛等级
   */
  async initForumProfile(tx: Db | undefined, userId: number) {
    const client = tx ?? this.db
    const [defaultLevel] = await client
      .select({ id: this.userLevelRule.id })
      .from(this.userLevelRule)
      .where(eq(this.userLevelRule.isEnabled, true))
      .orderBy(this.userLevelRule.sortOrder)
      .limit(1)

    await client
      .update(this.appUser)
      .set({
        points: UserDefaults.INITIAL_POINTS,
        experience: UserDefaults.INITIAL_EXPERIENCE,
        levelId: defaultLevel?.id ?? null,
        status: UserStatusEnum.NORMAL,
      })
      .where(eq(this.appUser.id, userId))

    await client.insert(this.forumProfile).values({
      userId,
      topicCount: 0,
      replyCount: 0,
      likeCount: 0,
      favoriteCount: 0,
      signature: '',
      bio: '',
    })
  }
}
