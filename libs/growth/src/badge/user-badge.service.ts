import type { IdDto } from '@libs/platform/dto/base.dto'
import type { SQL } from 'drizzle-orm'
import type {
  AssignUserBadgeDto,
  CreateUserBadgeDto,
  QueryBadgeUserPageDto,
  QueryUserBadgeDto,
  UpdateUserBadgeDto,
  UpdateUserBadgeStatusDto,
} from './dto/user-badge-management.dto'
import { buildILikeCondition, DrizzleService } from '@db/core'

import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

@Injectable()
export class UserBadgeService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 数据库连接实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** 徽章定义表。 */
  get userBadge() {
    return this.drizzle.schema.userBadge
  }

  /** 用户徽章分发表。 */
  get userBadgeAssignment() {
    return this.drizzle.schema.userBadgeAssignment
  }

  /** 用户表。 */
  get appUser() {
    return this.drizzle.schema.appUser
  }

  /** 等级规则表。 */
  get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  /**
   * 检查徽章是否已经被分配给任意用户。
   * 用于删除或禁用前的完整性校验，避免把已生效的徽章定义直接下线。
   */
  private async checkBadgeHasAssignments(badgeId: number) {
    const rows = await this.db
      .select({ badgeId: this.userBadgeAssignment.badgeId })
      .from(this.userBadgeAssignment)
      .where(eq(this.userBadgeAssignment.badgeId, badgeId))
      .limit(1)

    return rows.length > 0
  }

  /**
   * 创建徽章定义。
   * 唯一约束和其他写入异常统一交给 `withErrorHandling`，避免泄露底层数据库错误。
   */
  async createBadge(dto: CreateUserBadgeDto) {
    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.userBadge).values(dto),
    )
    return true
  }

  /**
   * 更新徽章主体字段。
   * 若请求显式禁用徽章，会先校验该徽章尚未分配给任何用户。
   */
  async updateBadge(dto: UpdateUserBadgeDto) {
    const { id, ...updateData } = dto

    if (
      updateData.isEnabled === false &&
      (await this.checkBadgeHasAssignments(id))
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '徽章已被分配，无法禁用',
      )
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.userBadge)
          .set(updateData)
          .where(eq(this.userBadge.id, id)),
      { notFound: '徽章不存在' },
    )
    return true
  }

  /**
   * 删除徽章定义。
   * 已被分配的徽章禁止删除，避免历史用户数据出现悬空引用。
   */
  async deleteBadge(dto: IdDto) {
    if (await this.checkBadgeHasAssignments(dto.id)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '徽章已被分配，无法删除',
      )
    }

    await this.drizzle.withErrorHandling(
      () => this.db.delete(this.userBadge).where(eq(this.userBadge.id, dto.id)),
      { notFound: '徽章不存在' },
    )
    return true
  }

  /**
   * 切换徽章启用状态。
   * 禁用校验与编辑入口保持一致，避免通过状态接口绕过分配关系约束。
   */
  async updateBadgeStatus(dto: UpdateUserBadgeStatusDto) {
    if (!dto.isEnabled && (await this.checkBadgeHasAssignments(dto.id))) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '徽章已被分配，无法禁用',
      )
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.userBadge)
          .set({ isEnabled: dto.isEnabled })
          .where(eq(this.userBadge.id, dto.id)),
      { notFound: '徽章不存在' },
    )
    return true
  }

  /**
   * 根据查询 DTO 组装徽章筛选条件。
   * `business` 与 `eventKey` 允许显式传 `null` 表达“筛选空值”，因此这里需要区分未传与传空。
   */
  private buildBadgeWhere(dto: QueryUserBadgeDto) {
    const conditions: SQL[] = []

    if (dto.name) {
      conditions.push(buildILikeCondition(this.userBadge.name, dto.name)!)
    }
    if (dto.type !== undefined) {
      conditions.push(eq(this.userBadge.type, dto.type))
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.userBadge.isEnabled, dto.isEnabled))
    }
    if (dto.business !== undefined) {
      conditions.push(
        dto.business === null
          ? isNull(this.userBadge.business)
          : eq(this.userBadge.business, dto.business),
      )
    }
    if (dto.eventKey !== undefined) {
      conditions.push(
        dto.eventKey === null
          ? isNull(this.userBadge.eventKey)
          : eq(this.userBadge.eventKey, dto.eventKey),
      )
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  /**
   * 获取徽章详情。
   * 未命中时抛出 `BusinessException`，供后台详情页和编辑页复用。
   */
  async getBadgeDetail(dto: IdDto) {
    const badge = await this.db.query.userBadge.findFirst({
      where: { id: dto.id },
    })

    if (!badge) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '徽章不存在',
      )
    }

    return badge
  }

  /**
   * 分页查询徽章列表。
   * 未显式传入排序时，默认遵循后台维护的 sortOrder 升序。
   */
  async getBadges(dto: QueryUserBadgeDto) {
    const orderBy = dto.orderBy?.trim()
      ? dto.orderBy
      : { sortOrder: 'asc' as const }

    return this.drizzle.ext.findPagination(this.userBadge, {
      where: this.buildBadgeWhere(dto),
      ...dto,
      orderBy,
    })
  }

  /**
   * 给用户分配徽章。
   * 写入前会同时校验用户和徽章存在；重复分配按业务异常返回，不允许静默覆盖。
   */
  async assignBadge(dto: AssignUserBadgeDto) {
    const { userId, badgeId } = dto

    const badge = await this.db.query.userBadge.findFirst({
      where: { id: badgeId },
    })
    if (!badge) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '徽章不存在',
      )
    }

    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
    })
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db.insert(this.userBadgeAssignment).values({
          userId,
          badgeId,
        }),
      {
        duplicate: '用户已拥有该徽章',
      },
    )
    return true
  }

  /**
   * 撤销用户徽章。
   * 仅删除指定用户与指定徽章的分配关系，不影响徽章定义本身。
   */
  async revokeBadge(dto: AssignUserBadgeDto) {
    const { userId, badgeId } = dto

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .delete(this.userBadgeAssignment)
          .where(
            and(
              eq(this.userBadgeAssignment.userId, userId),
              eq(this.userBadgeAssignment.badgeId, badgeId),
            ),
          ),
      { notFound: '用户徽章记录不存在' },
    )
    return true
  }

  /**
   * 获取指定用户拥有的徽章列表。
   * 列表按分配时间倒序返回，便于后台优先查看最近发放的徽章。
   */
  async getUserBadges(userId: number, dto: QueryUserBadgeDto) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
    })
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
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

  /**
   * 分页查询某个徽章对应的用户列表。
   * 结果补充用户等级和积分信息，供后台查看徽章发放范围。
   */
  async getBadgeUsers(dto: QueryBadgeUserPageDto) {
    const { badgeId } = dto
    const badge = await this.db.query.userBadge.findFirst({
      where: { id: badgeId },
    })
    if (!badge) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '徽章不存在',
      )
    }

    const page = this.drizzle.buildPage(dto)
    const order = this.drizzle.buildOrderBy(dto.orderBy, {
      table: this.userBadgeAssignment,
      fallbackOrderBy: [{ createdAt: 'desc' }, { userId: 'asc' }],
    })

    const where = eq(this.userBadgeAssignment.badgeId, badgeId)

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
      .innerJoin(
        this.appUser,
        eq(this.appUser.id, this.userBadgeAssignment.userId),
      )
      .leftJoin(
        this.userLevelRule,
        eq(this.userLevelRule.id, this.appUser.levelId),
      )
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

  /**
   * 统计徽章总量、启用量、分配量和热门徽章。
   * 该接口服务于后台看板，因此会额外查询热门徽章详情并拼装返回。
   */
  async getBadgeStatistics() {
    const [
      totalBadgesRow,
      enabledCountRow,
      totalAssignmentsRow,
      typeCounts,
      topBadges,
    ] = await Promise.all([
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
