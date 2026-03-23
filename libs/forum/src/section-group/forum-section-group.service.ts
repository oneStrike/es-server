import type {
  CreateForumSectionGroupInput,
  QueryForumSectionGroupInput,
  QueryPublicForumSectionGroupInput,
  SwapForumSectionGroupSortInput,
  UpdateForumSectionGroupEnabledInput,
  UpdateForumSectionGroupInput,
} from './section-group.type'
import { DrizzleService } from '@db/core'
import {
  FollowService,
  FollowTargetTypeEnum,
} from '@libs/interaction/follow'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, eq, ilike, inArray, isNull } from 'drizzle-orm'
import { ForumPermissionService } from '../permission'

@Injectable()
export class ForumSectionGroupService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly forumPermissionService: ForumPermissionService,
    private readonly followService: FollowService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  get forumSectionGroup() {
    return this.drizzle.schema.forumSectionGroup
  }

  get forumSection() {
    return this.drizzle.schema.forumSection
  }

  async createSectionGroup(dto: CreateForumSectionGroupInput) {
    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.forumSectionGroup).values(dto),
      { duplicate: '板块分组名称已存在' },
    )
    return true
  }

  async getSectionGroupById(id: number) {
    const group = await this.db.query.forumSectionGroup.findFirst({
      where: { id, deletedAt: { isNull: true } },
      columns: { deletedAt: false },
    })

    if (!group) {
      throw new NotFoundException('板块分组不存在')
    }
    return group
  }

  async getSectionGroupPage(dto: QueryForumSectionGroupInput) {
    const where = this.drizzle.buildWhere(this.forumSectionGroup, {
      and: {
        deletedAt: { isNull: true },
        isEnabled: dto.isEnabled,
      },
      ...(dto.name ? { or: [ilike(this.forumSectionGroup.name, `%${dto.name}%`)] } : {}),
    })

    return this.drizzle.ext.findPagination(this.forumSectionGroup, {
      where,
      ...dto,
      orderBy: dto.orderBy ? undefined : { sortOrder: 'desc' as const },
    })
  }

  /**
   * 查询应用侧公开板块分组列表。
   * 仅返回启用中的分组，并挂载当前用户可访问的启用板块。
   */
  async getPublicSectionGroupList(
    query: QueryPublicForumSectionGroupInput = {},
  ) {
    const accessibleSectionIds =
      await this.forumPermissionService.getAccessibleSectionIds(query.userId)

    if (accessibleSectionIds.length === 0) {
      return []
    }

    const groups = await this.db
      .select({
        id: this.forumSectionGroup.id,
        name: this.forumSectionGroup.name,
        description: this.forumSectionGroup.description,
        sortOrder: this.forumSectionGroup.sortOrder,
        isEnabled: this.forumSectionGroup.isEnabled,
      })
      .from(this.forumSectionGroup)
      .where(
        and(
          eq(this.forumSectionGroup.isEnabled, true),
          isNull(this.forumSectionGroup.deletedAt),
        ),
      )
      .orderBy(
        asc(this.forumSectionGroup.sortOrder),
        asc(this.forumSectionGroup.id),
      )

    const groupIds = groups.map((group) => group.id)
    if (groupIds.length === 0) {
      return []
    }

    const sections = await this.db
      .select({
        id: this.forumSection.id,
        groupId: this.forumSection.groupId,
        userLevelRuleId: this.forumSection.userLevelRuleId,
        name: this.forumSection.name,
        description: this.forumSection.description,
        icon: this.forumSection.icon,
        sortOrder: this.forumSection.sortOrder,
        isEnabled: this.forumSection.isEnabled,
        topicReviewPolicy: this.forumSection.topicReviewPolicy,
        topicCount: this.forumSection.topicCount,
        replyCount: this.forumSection.replyCount,
        followersCount: this.forumSection.followersCount,
        lastPostAt: this.forumSection.lastPostAt,
      })
      .from(this.forumSection)
      .where(
        and(
          inArray(this.forumSection.groupId, groupIds),
          eq(this.forumSection.isEnabled, true),
          isNull(this.forumSection.deletedAt),
          accessibleSectionIds.length === 1
            ? eq(this.forumSection.id, accessibleSectionIds[0])
            : inArray(this.forumSection.id, accessibleSectionIds),
        ),
      )
      .orderBy(asc(this.forumSection.sortOrder), asc(this.forumSection.id))

    const sectionFollowStatusMap =
      query.userId && sections.length > 0
        ? await this.followService.checkStatusBatch(
            FollowTargetTypeEnum.FORUM_SECTION,
            sections.map((section) => section.id),
            query.userId,
          )
        : undefined

    return groups
      .map((group) => ({
        ...group,
        sections: sections
          .filter((section) => section.groupId === group.id)
          .map((section) => ({
            ...section,
            isFollowed:
              sectionFollowStatusMap?.get(section.id) ?? false,
          })),
      }))
      .filter((group) => group.sections.length > 0)
  }

  async updateSectionGroup(
    updateSectionGroupDto: UpdateForumSectionGroupInput,
  ) {
    const { id, ...updateData } = updateSectionGroupDto
    const result = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.forumSectionGroup)
          .set(updateData)
          .where(
            and(
              eq(this.forumSectionGroup.id, id),
              isNull(this.forumSectionGroup.deletedAt),
            ),
          ),
      { duplicate: '板块分组名称已存在' },
    )
    this.drizzle.assertAffectedRows(result, '板块分组不存在')
    return true
  }

  async deleteSectionGroup(id: number) {
    const group = await this.db.query.forumSectionGroup.findFirst({
      where: { id, deletedAt: { isNull: true } },
      with: {
        sections: {
          where: { deletedAt: { isNull: true } },
          columns: { id: true },
        },
      },
    })

    if (!group) {
      throw new NotFoundException('板块分组不存在')
    }

    if (group.sections.length > 0) {
      throw new BadRequestException('该分组下还有板块，无法删除')
    }

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.forumSectionGroup)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(this.forumSectionGroup.id, id),
            isNull(this.forumSectionGroup.deletedAt),
          ),
        ),
    )
    this.drizzle.assertAffectedRows(result, '板块分组不存在')
    return true
  }

  async swapSectionGroupSortOrder(dto: SwapForumSectionGroupSortInput) {
    return this.drizzle.ext.swapField(this.forumSectionGroup, {
      where: [{ id: dto.dragId }, { id: dto.targetId }],
    })
  }

  async updateSectionGroupEnabled(
    updateSectionGroupEnabledDto: UpdateForumSectionGroupEnabledInput,
  ) {
    const { id, isEnabled } = updateSectionGroupEnabledDto
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.forumSectionGroup)
        .set({ isEnabled })
        .where(
          and(
            eq(this.forumSectionGroup.id, id),
            isNull(this.forumSectionGroup.deletedAt),
          ),
        ),
    )
    this.drizzle.assertAffectedRows(result, '板块分组不存在')
    return true
  }

  async getAllEnabledGroups() {
    const groups = await this.db
      .select({
        id: this.forumSectionGroup.id,
        name: this.forumSectionGroup.name,
        description: this.forumSectionGroup.description,
        sortOrder: this.forumSectionGroup.sortOrder,
        isEnabled: this.forumSectionGroup.isEnabled,
        maxModerators: this.forumSectionGroup.maxModerators,
        createdAt: this.forumSectionGroup.createdAt,
        updatedAt: this.forumSectionGroup.updatedAt,
      })
      .from(this.forumSectionGroup)
      .where(
        and(
          eq(this.forumSectionGroup.isEnabled, true),
          isNull(this.forumSectionGroup.deletedAt),
        ),
      )
      .orderBy(asc(this.forumSectionGroup.sortOrder))
    const groupIds = groups.map((group) => group.id)
    const sections = groupIds.length
      ? await this.db
          .select({
            id: this.forumSection.id,
            groupId: this.forumSection.groupId,
            name: this.forumSection.name,
            description: this.forumSection.description,
            sortOrder: this.forumSection.sortOrder,
            topicCount: this.forumSection.topicCount,
          })
          .from(this.forumSection)
          .where(
            and(
              inArray(this.forumSection.groupId, groupIds),
              eq(this.forumSection.isEnabled, true),
              isNull(this.forumSection.deletedAt),
            ),
          )
          .orderBy(asc(this.forumSection.sortOrder))
      : []

    return groups.map((group) => ({
      ...group,
      sections: sections
        .filter((section) => section.groupId === group.id)
        .map((section) => ({
        ...section,
        _count: { topics: section.topicCount },
      })),
    }))
  }
}
