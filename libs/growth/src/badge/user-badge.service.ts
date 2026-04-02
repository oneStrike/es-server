import type { SQL } from 'drizzle-orm'
import type {
  AssignUserBadgeInput,
  CreateUserBadgeInput,
  QueryUserBadgePageInput,
  UpdateUserBadgeInput,
  UpdateUserBadgeStatusInput,
} from './badge.type'
import { buildILikeCondition, DrizzleService } from '@db/core'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'

@Injectable()
export class UserBadgeService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  get userBadge() {
    return this.drizzle.schema.userBadge
  }

  get userBadgeAssignment() {
    return this.drizzle.schema.userBadgeAssignment
  }

  get appUser() {
    return this.drizzle.schema.appUser
  }

  get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  private async checkBadgeHasAssignments(badgeId: number) {
    const rows = await this.db
      .select({ badgeId: this.userBadgeAssignment.badgeId })
      .from(this.userBadgeAssignment)
      .where(eq(this.userBadgeAssignment.badgeId, badgeId))
      .limit(1)

    return rows.length > 0
  }

  async createBadge(dto: CreateUserBadgeInput) {
    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.userBadge).values(dto),
    )
    return true
  }

  async updateBadge(dto: UpdateUserBadgeInput) {
    const { id, ...updateData } = dto

    if (updateData.isEnabled === false && (await this.checkBadgeHasAssignments(id))) {
      throw new BadRequestException('徽章已被分配，无法禁用')
    }

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.userBadge)
        .set(updateData)
        .where(eq(this.userBadge.id, id)),
    )
    this.drizzle.assertAffectedRows(result, '徽章不存在')
    return true
  }

  async deleteBadge(dto: { id: number }) {
    if (await this.checkBadgeHasAssignments(dto.id)) {
      throw new BadRequestException('徽章已被分配，无法删除')
    }

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .delete(this.userBadge)
        .where(eq(this.userBadge.id, dto.id)),
    )

    this.drizzle.assertAffectedRows(result, '徽章不存在')
    return true
  }

  async updateBadgeStatus(dto: UpdateUserBadgeStatusInput) {
    if (!dto.isEnabled && (await this.checkBadgeHasAssignments(dto.id))) {
      throw new BadRequestException('徽章已被分配，无法禁用')
    }

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.userBadge)
        .set({ isEnabled: dto.isEnabled })
        .where(eq(this.userBadge.id, dto.id)),
    )
    this.drizzle.assertAffectedRows(result, '徽章不存在')
    return true
  }

  private buildBadgeWhere(dto: QueryUserBadgePageInput) {
    const conditions: SQL[] = []

    if (dto.name) {
      conditions.push(
        buildILikeCondition(this.userBadge.name, dto.name)!,
      )
    }
    if (dto.type !== undefined) {
      conditions.push(eq(this.userBadge.type, dto.type))
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.userBadge.isEnabled, dto.isEnabled))
    }
    if (dto.business !== undefined) {
      conditions.push(eq(this.userBadge.business, dto.business))
    }
    if (dto.eventKey !== undefined) {
      conditions.push(eq(this.userBadge.eventKey, dto.eventKey))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  async getBadgeDetail(dto: { id: number }) {
    const badge = await this.db.query.userBadge.findFirst({ where: { id: dto.id } })

    if (!badge) {
      throw new NotFoundException('徽章不存在')
    }

    return badge
  }

  /**
   * 分页查询徽章列表。
   * 未显式传入排序时，默认遵循后台维护的 sortOrder 升序。
   */
  async getBadges(dto: QueryUserBadgePageInput) {
    const orderBy = dto.orderBy?.trim()
      ? dto.orderBy
      : { sortOrder: 'asc' as const }

    return this.drizzle.ext.findPagination(this.userBadge, {
      where: this.buildBadgeWhere(dto),
      ...dto,
      orderBy,
    })
  }

  async assignBadge(dto: AssignUserBadgeInput) {
    const { userId, badgeId } = dto

    const badge = await this.db.query.userBadge.findFirst({ where: { id: badgeId } })
    if (!badge) {
      throw new NotFoundException('徽章不存在')
    }

    const user = await this.db.query.appUser.findFirst({ where: { id: userId } })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .insert(this.userBadgeAssignment)
          .values({
            userId,
            badgeId,
          }),
      {
        duplicate: '用户已拥有该徽章',
      },
    )
    return true
  }

  async revokeBadge(dto: AssignUserBadgeInput) {
    const { userId, badgeId } = dto

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .delete(this.userBadgeAssignment)
        .where(
          and(
            eq(this.userBadgeAssignment.userId, userId),
            eq(this.userBadgeAssignment.badgeId, badgeId),
          ),
        ),
    )
    this.drizzle.assertAffectedRows(result, '用户徽章记录不存在')
    return true
  }

  async getUserBadges(userId: number, dto: QueryUserBadgePageInput) {
    const user = await this.db.query.appUser.findFirst({ where: { id: userId } })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    const badgeWhere = this.buildBadgeWhere(dto)
    const where = badgeWhere
      ? and(eq(this.userBadgeAssignment.userId, userId), badgeWhere)
      : eq(this.userBadgeAssignment.userId, userId)

    return this.db
      .select({
        userId: this.userBadgeAssignment.userId,
        badgeId: this.userBadgeAssignment.badgeId,
        createdAt: this.userBadgeAssignment.createdAt,
        badge: this.userBadge,
      })
      .from(this.userBadgeAssignment)
      .innerJoin(
        this.userBadge,
        eq(this.userBadge.id, this.userBadgeAssignment.badgeId),
      )
      .where(where)
      .orderBy(
        desc(this.userBadgeAssignment.createdAt),
        asc(this.userBadgeAssignment.badgeId),
      )
  }

  async getBadgeUsers(badgeId: number, dto: QueryUserBadgePageInput) {
    const badge = await this.db.query.userBadge.findFirst({ where: { id: badgeId } })
    if (!badge) {
      throw new NotFoundException('徽章不存在')
    }

    const page = this.drizzle.buildPage(dto)
    const order = this.drizzle.buildOrderBy(dto.orderBy, {
      table: this.userBadgeAssignment,
      fallbackOrderBy: [{ createdAt: 'desc' }, { userId: 'asc' }],
    })

    const badgeWhere = this.buildBadgeWhere(dto)
    const where = badgeWhere
      ? and(eq(this.userBadgeAssignment.badgeId, badgeId), badgeWhere)
      : eq(this.userBadgeAssignment.badgeId, badgeId)

    const [totalRow] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(this.userBadgeAssignment)
      .innerJoin(
        this.userBadge,
        eq(this.userBadge.id, this.userBadgeAssignment.badgeId),
      )
      .where(where)

    const list = await this.db
      .select({
        userId: this.userBadgeAssignment.userId,
        badgeId: this.userBadgeAssignment.badgeId,
        createdAt: this.userBadgeAssignment.createdAt,
        user: {
          id: this.appUser.id,
          nickname: this.appUser.nickname,
          avatar: this.appUser.avatarUrl,
          level: this.userLevelRule.name,
          point: this.appUser.points,
        },
      })
      .from(this.userBadgeAssignment)
      .innerJoin(
        this.userBadge,
        eq(this.userBadge.id, this.userBadgeAssignment.badgeId),
      )
      .innerJoin(this.appUser, eq(this.appUser.id, this.userBadgeAssignment.userId))
      .leftJoin(this.userLevelRule, eq(this.userLevelRule.id, this.appUser.levelId))
      .where(where)
      .orderBy(...order.orderBySql)
      .limit(page.limit)
      .offset(page.offset)

    const total = Number(totalRow?.total ?? 0)
    return {
      list,
      total,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
      totalPage: Math.ceil(total / page.pageSize),
    }
  }

  async getBadgeStatistics() {
    const [totalBadgesRow, enabledCountRow, totalAssignmentsRow, typeCounts, topBadges] =
      await Promise.all([
        this.db.select({ total: sql<number>`count(*)` }).from(this.userBadge),
        this.db
          .select({ total: sql<number>`count(*)` })
          .from(this.userBadge)
          .where(eq(this.userBadge.isEnabled, true)),
        this.db
          .select({ total: sql<number>`count(*)` })
          .from(this.userBadgeAssignment),
        this.db
          .select({
            type: this.userBadge.type,
            count: sql<number>`count(*)`,
          })
          .from(this.userBadge)
          .groupBy(this.userBadge.type),
        this.db
          .select({
            badgeId: this.userBadgeAssignment.badgeId,
            count: sql<number>`count(*)`,
          })
          .from(this.userBadgeAssignment)
          .groupBy(this.userBadgeAssignment.badgeId)
          .orderBy(sql`count(*) desc`)
          .limit(5),
      ])

    const badgeIds = topBadges.map((item) => item.badgeId)
    const badges =
      badgeIds.length > 0
        ? await this.db
            .select()
            .from(this.userBadge)
            .where(inArray(this.userBadge.id, badgeIds))
        : []

    const badgeMap = new Map(badges.map((badge) => [badge.id, badge]))
    const topBadgesWithDetails = topBadges.map((item) => ({
      badge: badgeMap.get(item.badgeId),
      count: Number(item.count),
    }))

    const totalBadges = Number(totalBadgesRow[0]?.total ?? 0)
    const enabledCount = Number(enabledCountRow[0]?.total ?? 0)
    const totalAssignments = Number(totalAssignmentsRow[0]?.total ?? 0)

    return {
      totalBadges,
      enabledCount,
      disabledCount: totalBadges - enabledCount,
      totalAssignments,
      typeDistribution: typeCounts.map((item) => ({
        type: item.type,
        count: Number(item.count),
      })),
      topBadges: topBadgesWithDetails,
    }
  }
}
