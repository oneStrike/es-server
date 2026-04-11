import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { FollowTargetTypeEnum } from '@libs/interaction/follow/follow.constant'
import { FollowService } from '@libs/interaction/follow/follow.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { ForumPermissionService } from '../permission/forum-permission.service'
import {
  CreateForumSectionGroupDto,
  QueryForumSectionGroupDto,
  QueryVisibleForumSectionGroupCommandDto,
  SwapForumSectionGroupSortDto,
  UpdateForumSectionGroupDto,
  UpdateForumSectionGroupEnabledDto,
} from './dto/forum-section-group.dto'

/**
 * 论坛板块分组服务。
 * 负责后台分组维护、应用侧可见分组装配以及排序/启停等写路径约束。
 */
@Injectable()
export class ForumSectionGroupService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly forumPermissionService: ForumPermissionService,
    private readonly followService: FollowService,
  ) {}

  /** 数据库连接实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** 板块分组表。 */
  get forumSectionGroup() {
    return this.drizzle.schema.forumSectionGroup
  }

  /** 板块表。 */
  get forumSection() {
    return this.drizzle.schema.forumSection
  }

  /**
   * 创建板块分组。
   * 分组名称全局唯一，重复名称通过 `withErrorHandling` 转换成稳定业务异常。
   */
  async createSectionGroup(dto: CreateForumSectionGroupDto) {
    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.forumSectionGroup).values(dto),
      { duplicate: '板块分组名称已存在' },
    )
    return true
  }

  /**
   * 查询单个板块分组详情。
   * 仅返回未软删除记录，缺失时抛出稳定的 not-found 异常。
   */
  async getSectionGroupById(id: number) {
    const group = await this.db.query.forumSectionGroup.findFirst({
      where: { id, deletedAt: { isNull: true } },
      columns: { deletedAt: false },
    })

    if (!group) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '板块分组不存在',
      )
    }
    return group
  }

  /**
   * 管理端分页查询板块分组。
   * 未显式传入排序时，默认按 sortOrder 升序返回，保持后台拖拽顺序。
   */
  async getSectionGroupPage(dto: QueryForumSectionGroupDto) {
    const conditions: SQL[] = [isNull(this.forumSectionGroup.deletedAt)]

    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.forumSectionGroup.isEnabled, dto.isEnabled))
    }
    if (dto.name) {
      conditions.push(
        buildILikeCondition(this.forumSectionGroup.name, dto.name)!,
      )
    }

    const where = and(...conditions)
    // 空字符串查询参数视为未传排序，避免把分组默认排序误退回到通用回退。
    const orderBy = dto.orderBy?.trim()
      ? dto.orderBy
      : { sortOrder: 'asc' as const }

    return this.drizzle.ext.findPagination(this.forumSectionGroup, {
      where,
      ...dto,
      orderBy,
    })
  }

  /**
   * 查询应用侧板块分组可见列表。
   * 仅返回启用中的分组，并挂载启用板块及访问状态信息。
   */
  async getVisibleSectionGroupList(
    query: QueryVisibleForumSectionGroupCommandDto = {},
  ) {
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
        cover: this.forumSection.cover,
        sortOrder: this.forumSection.sortOrder,
        isEnabled: this.forumSection.isEnabled,
        topicReviewPolicy: this.forumSection.topicReviewPolicy,
        topicCount: this.forumSection.topicCount,
        commentCount: this.forumSection.commentCount,
        followersCount: this.forumSection.followersCount,
        lastPostAt: this.forumSection.lastPostAt,
      })
      .from(this.forumSection)
      .where(
        and(
          inArray(this.forumSection.groupId, groupIds),
          eq(this.forumSection.isEnabled, true),
          isNull(this.forumSection.deletedAt),
        ),
      )
      .orderBy(asc(this.forumSection.sortOrder), asc(this.forumSection.id))

    const sectionIds = sections.map((section) => section.id)
    const [sectionAccessStateMap, sectionFollowStatusMap] = await Promise.all([
      this.forumPermissionService.getSectionAccessStateMap(
        sectionIds,
        query.userId,
      ),
      query.userId && sectionIds.length > 0
        ? this.followService.checkStatusBatch(
            FollowTargetTypeEnum.FORUM_SECTION,
            sectionIds,
            query.userId,
          )
        : Promise.resolve(new Map<number, boolean>()),
    ])

    return groups
      .map((group) => ({
        ...group,
        sections: sections
          .filter((section) => section.groupId === group.id)
          .map((section) => {
            const accessState = sectionAccessStateMap.get(section.id) ?? {
              canAccess: true,
              requiredExperience: null,
            }

            return {
              ...section,
              canAccess: accessState.canAccess,
              requiredExperience: accessState.requiredExperience,
              accessDeniedReason: accessState.canAccess
                ? undefined
                : accessState.accessDeniedReason,
              isFollowed: sectionFollowStatusMap.get(section.id) ?? false,
            }
          }),
      }))
      .filter((group) => group.sections.length > 0)
  }

  /**
   * 更新板块分组。
   * 写后校验受影响行数，确保分组存在且未被软删除。
   */
  async updateSectionGroup(updateSectionGroupDto: UpdateForumSectionGroupDto) {
    const { id, ...updateData } = updateSectionGroupDto
    await this.drizzle.withErrorHandling(
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
      {
        duplicate: '板块分组名称已存在',
        notFound: '板块分组不存在',
      },
    )
    return true
  }

  /**
   * 软删除板块分组。
   * 删除前会阻止仍挂有板块的分组被移除，避免产生悬空的板块归属关系。
   */
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '板块分组不存在',
      )
    }

    if (group.sections.length > 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '该分组下还有板块，无法删除',
      )
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.forumSectionGroup)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(this.forumSectionGroup.id, id),
              isNull(this.forumSectionGroup.deletedAt),
            ),
          ),
      { notFound: '板块分组不存在' },
    )
    return true
  }

  /**
   * 交换板块分组排序顺序。
   * 仅交换拖拽目标的排序值，不改动其它字段。
   */
  async swapSectionGroupSortOrder(dto: SwapForumSectionGroupSortDto) {
    return this.drizzle.ext.swapField(this.forumSectionGroup, {
      where: [{ id: dto.dragId }, { id: dto.targetId }],
    })
  }

  /**
   * 更新板块分组启用状态。
   * 写路径只允许修改启用位，并对软删除记录保持不可见。
   */
  async updateSectionGroupEnabled(
    updateSectionGroupEnabledDto: UpdateForumSectionGroupEnabledDto,
  ) {
    const { id, isEnabled } = updateSectionGroupEnabledDto
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.forumSectionGroup)
          .set({ isEnabled })
          .where(
            and(
              eq(this.forumSectionGroup.id, id),
              isNull(this.forumSectionGroup.deletedAt),
            ),
          ),
      { notFound: '板块分组不存在' },
    )
    return true
  }

  /**
   * 获取全部启用中的板块分组及其启用板块。
   * 该接口供后台配置页一次性读取树形结构，不返回已删除或未启用节点。
   */
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
      .orderBy(
        asc(this.forumSectionGroup.sortOrder),
        asc(this.forumSectionGroup.id),
      )
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
          .orderBy(asc(this.forumSection.sortOrder), asc(this.forumSection.id))
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
