import { DrizzleService } from '@db/core'
import { IdDto } from '@libs/platform/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, ilike, inArray, isNull } from 'drizzle-orm'
import {
  AssignForumModeratorSectionDto,
  CreateForumModeratorDto,
  QueryForumModeratorDto,
  UpdateForumModeratorDto,
} from './dto/moderator.dto'
import {
  ForumModeratorPermissionEnum,
  ForumModeratorRoleTypeEnum,
} from './moderator.constant'

/**
 * 论坛版主服务类
 * 提供论坛版主的增删改查、板块分配、权限管理等核心业务逻辑
 */
@Injectable()
export class ForumModeratorService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  get forumModerator() {
    return this.drizzle.schema.forumModerator
  }

  get forumModeratorSection() {
    return this.drizzle.schema.forumModeratorSection
  }

  get forumSection() {
    return this.drizzle.schema.forumSection
  }

  get appUser() {
    return this.drizzle.schema.appUser
  }

  /**
   * 添加版主
   * @param dto 创建参数
   * @returns 创建结果
   */
  async createModerator(dto: CreateForumModeratorDto) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: dto.userId },
      columns: { id: true },
    })
    if (!user) {
      throw new BadRequestException(`ID【${dto.userId}】数据不存在`)
    }

    const existing = await this.db.query.forumModerator.findFirst({
      where: {
        userId: dto.userId,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (existing) {
      throw new BadRequestException('该用户已是版主')
    }

    if (dto.roleType === ForumModeratorRoleTypeEnum.SUPER) {
      // 超级版主拥有所有的权限
      dto.permissions = [
        ...Object.values(ForumModeratorPermissionEnum),
      ] as ForumModeratorPermissionEnum[]
    }

    const { sectionIds: _sectionIds, ...moderatorData } = dto
    const [created] = await this.db
      .insert(this.forumModerator)
      .values(moderatorData as any)
      .returning({ id: this.forumModerator.id })
    return created
  }

  /**
   * 移除版主
   * @param dto 移除参数
   * @returns 移除结果
   */
  async removeModerator(dto: IdDto) {
    const moderator = await this.db.query.forumModerator.findFirst({
      where: { id: dto.id, deletedAt: { isNull: true } },
      columns: { id: true },
    })
    if (!moderator) {
      throw new BadRequestException(`ID【${dto.id}】数据不存在`)
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(this.forumModeratorSection)
        .where(eq(this.forumModeratorSection.moderatorId, dto.id))
      await tx
        .update(this.forumModerator)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(this.forumModerator.id, dto.id), isNull(this.forumModerator.deletedAt)),
        )
    })

    return { id: dto.id }
  }

  /**
   * 分配版主管理的板块
   * @param assignDto 分配参数
   * @returns 分配结果
   */
  async assignModeratorSection(assignDto: AssignForumModeratorSectionDto) {
    const { moderatorId, sectionIds, permissions = [] } = assignDto

    const uniqueSectionIds = [...new Set(sectionIds)]

    const moderator = await this.db.query.forumModerator.findFirst({
      where: { id: moderatorId, deletedAt: { isNull: true } },
      columns: { id: true },
    })
    if (!moderator) {
      throw new BadRequestException('版主不存在')
    }

    const sections = uniqueSectionIds.length
      ? await this.db
          .select({ id: this.forumSection.id })
          .from(this.forumSection)
          .where(
            and(
              inArray(this.forumSection.id, uniqueSectionIds),
              isNull(this.forumSection.deletedAt),
            ),
          )
      : []

    const existingSectionIds = sections.map((s) => s.id)
    const missingSectionIds = uniqueSectionIds.filter(
      (id) => !existingSectionIds.includes(id),
    )

    if (missingSectionIds.length > 0) {
      throw new BadRequestException(
        `板块ID不存在: ${missingSectionIds.join(', ')}`,
      )
    }

    await this.db.transaction(async (tx) => {
      await Promise.all(
        uniqueSectionIds.map(async (sectionId) =>
          tx
            .insert(this.forumModeratorSection)
            .values({
              moderatorId,
              sectionId,
              permissions: permissions as number[],
            })
            .onConflictDoUpdate({
              target: [
                this.forumModeratorSection.moderatorId,
                this.forumModeratorSection.sectionId,
              ],
              set: {
                permissions: permissions as number[],
              },
            }),
        ),
      )
    })

    return { moderatorId }
  }

  /**
   * 查看版主列表
   * @param queryDto 查询参数
   * @returns 版主列表
   */
  async getModeratorPage(queryDto: QueryForumModeratorDto) {
    const { nickname, sectionId, ...otherDto } = queryDto
    const where = this.drizzle.buildWhere(this.forumModerator, {
      and: {
        deletedAt: { isNull: true },
        isEnabled: queryDto.isEnabled,
        userId: queryDto.userId,
      },
    })

    const conditions = [where]

    if (nickname) {
      const userIds = await this.db
        .select({ id: this.appUser.id })
        .from(this.appUser)
        .where(ilike(this.appUser.nickname, `%${nickname}%`))
      const ids = userIds.map((item) => item.id)
      conditions.push(ids.length ? inArray(this.forumModerator.userId, ids) : eq(this.forumModerator.id, -1))
    }

    if (sectionId) {
      const moderatorIds = await this.db
        .select({ moderatorId: this.forumModeratorSection.moderatorId })
        .from(this.forumModeratorSection)
        .where(eq(this.forumModeratorSection.sectionId, sectionId))
      const ids = moderatorIds.map((item) => item.moderatorId)
      conditions.push(ids.length ? inArray(this.forumModerator.id, ids) : eq(this.forumModerator.id, -1))
    }

    const page = await this.drizzle.ext.findPagination(this.forumModerator, {
      where: and(...(conditions as [any, ...any[]])),
      ...otherDto,
    })
    const userIds = page.list.map((item) => item.userId)
    const users = userIds.length
      ? await this.db
          .select({
            id: this.appUser.id,
            nickname: this.appUser.nickname,
            avatar: this.appUser.avatarUrl,
          })
          .from(this.appUser)
          .where(inArray(this.appUser.id, userIds))
      : []
    const userMap = new Map(users.map((user) => [user.id, user]))

    return {
      ...page,
      list: page.list.map((item) => ({
        ...item,
        user: userMap.get(item.userId) ?? null,
      })),
    }
  }

  /**
   * 更新版主信息
   * @param updateDto 更新参数
   * @returns 更新结果
   */
  async updateModerator(updateDto: UpdateForumModeratorDto) {
    const { id, sectionIds: _sectionIds, ...updateData } = updateDto

    const moderator = await this.db.query.forumModerator.findFirst({
      where: { id, deletedAt: { isNull: true } },
      columns: { id: true },
    })

    if (!moderator) {
      throw new BadRequestException('版主不存在')
    }

    if (updateData.roleType === ForumModeratorRoleTypeEnum.SUPER) {
      updateData.permissions = [
        ...Object.values(ForumModeratorPermissionEnum),
      ] as ForumModeratorPermissionEnum[]
    }

    const [data] = await this.db
      .update(this.forumModerator)
      .set(updateData as any)
      .where(and(eq(this.forumModerator.id, id), isNull(this.forumModerator.deletedAt)))
      .returning()
    return data
  }
}
