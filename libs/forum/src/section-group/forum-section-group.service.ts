import type { Db, SQL } from '@db/core'
import { buildILikeCondition, DrizzleService } from '@db/core'

import { FollowTargetTypeEnum } from '@libs/interaction/follow/follow.constant'
import { FollowService } from '@libs/interaction/follow/follow.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { ForumPermissionService } from '../permission/forum-permission.service'
import {
  CreateForumSectionGroupDto,
  ForumSectionTreeNodeDto,
  QueryForumSectionGroupDto,
  QueryVisibleForumSectionGroupCommandDto,
  SwapForumSectionGroupSortDto,
  UpdateForumSectionGroupDto,
  UpdateForumSectionGroupEnabledDto,
} from './dto/forum-section-group.dto'
import { FORUM_SECTION_GROUP_MUTATION_LOCK_NAMESPACE } from './forum-section-group.constant'

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

  // 串行化单个分组的删除与关联治理写操作，避免并发下出现悬空引用。
  private async lockSectionGroupForMutation(client: Db, groupId: number) {
    await client.execute(
      sql`SELECT pg_advisory_xact_lock(${FORUM_SECTION_GROUP_MUTATION_LOCK_NAMESPACE}, ${groupId})`,
    )
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
    await this.drizzle.withTransaction(async (tx) => {
      await this.lockSectionGroupForMutation(tx, id)

      const group = await tx.query.forumSectionGroup.findFirst({
        where: { id, deletedAt: { isNull: true } },
        with: {
          sections: {
            where: { deletedAt: { isNull: true } },
            columns: { id: true },
          },
          moderators: {
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

      if (group.moderators.length > 0) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '该分组下还有版主，无法删除',
        )
      }

      const result = await tx
        .update(this.forumSectionGroup)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(this.forumSectionGroup.id, id),
            isNull(this.forumSectionGroup.deletedAt),
          ),
        )
      this.drizzle.assertAffectedRows(result, '板块分组不存在')
    })
    return true
  }

  /**
   * 交换板块分组排序顺序。
   * 仅交换拖拽目标的排序值，不改动其它字段。
   */
  async swapSectionGroupSortOrder(dto: SwapForumSectionGroupSortDto) {
    return this.drizzle.ext.swapField(this.forumSectionGroup, {
      where: [{ id: dto.dragId }, { id: dto.targetId }],
      recordWhere: sql`${this.forumSectionGroup.deletedAt} is null`,
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

  // 按管理端配置页所需结构返回板块树，保留空分组与未分组板块节点。
  async getAdminSectionTree(): Promise<ForumSectionTreeNodeDto[]> {
    const groups = await this.db.query.forumSectionGroup.findMany({
      where: {
        deletedAt: { isNull: true },
      },
      columns: {
        deletedAt: false,
      },
      orderBy: (group, { asc }) => [asc(group.sortOrder), asc(group.id)],
    })

    const sections = await this.db.query.forumSection.findMany({
      where: {
        deletedAt: { isNull: true },
      },
      columns: {
        deletedAt: false,
      },
      orderBy: (section, { asc }) => [asc(section.sortOrder), asc(section.id)],
    })

    const groupIds = new Set(groups.map((group) => group.id))
    const sectionsByGroup = new Map<number, typeof sections>()
    const ungroupedSections: typeof sections = []

    for (const section of sections) {
      if (section.groupId && groupIds.has(section.groupId)) {
        const list = sectionsByGroup.get(section.groupId) ?? []
        list.push(section)
        sectionsByGroup.set(section.groupId, list)
        continue
      }

      ungroupedSections.push(section)
    }

    const nodes: ForumSectionTreeNodeDto[] = groups.map((group) => ({
      isUngrouped: false,
      group,
      sections: sectionsByGroup.get(group.id) ?? [],
    }))

    nodes.push({
      isUngrouped: true,
      sections: ungroupedSections,
    })

    return nodes
  }
}
