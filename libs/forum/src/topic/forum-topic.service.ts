import type { Db } from '@db/core'
import type {
  CreateForumTopicInput,
  QueryForumTopicInput,
  QueryPublicForumTopicInput,
  UpdateForumTopicAuditStatusInput,
  UpdateForumTopicFeaturedInput,
  UpdateForumTopicHiddenInput,
  UpdateForumTopicInput,
  UpdateForumTopicLockedInput,
  UpdateForumTopicPinnedInput,
} from './forum-topic.type'
import { DrizzleService } from '@db/core'
import { GrowthRuleTypeEnum, UserGrowthRewardService } from '@libs/growth'

import { CommentTargetTypeEnum } from '@libs/interaction'
import { AuditStatusEnum } from '@libs/platform/constant'

import {
  SensitiveWordDetectService,
  SensitiveWordLevelEnum,
} from '@libs/sensitive-word'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, desc, eq, ilike, isNull, sql } from 'drizzle-orm'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../action-log/action-log.constant'
import { ForumUserActionLogService } from '../action-log/action-log.service'
import { ForumCounterService } from '../counter/forum-counter.service'
import { ForumReviewPolicyEnum } from '../forum.constant'
import { ForumPermissionService } from '../permission'

/**
 * 论坛主题服务类
 * 提供论坛主题的增删改查、置顶、精华、锁定等核心业务逻辑
 */
@Injectable()
export class ForumTopicService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly userGrowthRewardService: UserGrowthRewardService,
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly forumCounterService: ForumCounterService,
    private readonly actionLogService: ForumUserActionLogService,
    private readonly forumPermissionService: ForumPermissionService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  get forumTopicTable() {
    return this.drizzle.schema.forumTopic
  }

  get forumSectionTable() {
    return this.drizzle.schema.forumSection
  }

  get userCommentTable() {
    return this.drizzle.schema.userComment
  }

  private async getSectionTopicReviewPolicy(
    sectionId: number,
    options?: {
      requireEnabled?: boolean
      notFoundMessage?: string
    },
  ) {
    const section = await this.db.query.forumSection.findFirst({
      where: {
        id: sectionId,
        deletedAt: { isNull: true },
      },
      columns: {
        topicReviewPolicy: true,
        isEnabled: true,
      },
    })

    if (!section) {
      throw new BadRequestException(
        options?.notFoundMessage ?? '板块不存在或已禁用',
      )
    }

    if (options?.requireEnabled && !section.isEnabled) {
      throw new BadRequestException('板块不存在或已禁用')
    }

    return section.topicReviewPolicy as ForumReviewPolicyEnum
  }

  async syncTopicReplyState(tx: Db | undefined, topicId: number) {
    const client = tx ?? this.db
    const visibleReplyWhere = and(
      eq(this.userCommentTable.targetType, CommentTargetTypeEnum.FORUM_TOPIC),
      eq(this.userCommentTable.targetId, topicId),
      eq(this.userCommentTable.auditStatus, AuditStatusEnum.APPROVED),
      eq(this.userCommentTable.isHidden, false),
      isNull(this.userCommentTable.deletedAt),
    )

    const [replySummaryRows, latestReplyRows] = await Promise.all([
      client
        .select({
          replyCount: sql<number>`count(*)::int`,
        })
        .from(this.userCommentTable)
        .where(visibleReplyWhere),
      client
        .select({
          userId: this.userCommentTable.userId,
          createdAt: this.userCommentTable.createdAt,
        })
        .from(this.userCommentTable)
        .where(visibleReplyWhere)
        .orderBy(
          desc(this.userCommentTable.createdAt),
          desc(this.userCommentTable.id),
        )
        .limit(1),
    ])

    const replyCount = replySummaryRows[0]?.replyCount ?? 0
    const latestReply = latestReplyRows[0]

    const result = await this.drizzle.withErrorHandling(() =>
      client
        .update(this.forumTopicTable)
        .set({
          replyCount,
          commentCount: replyCount,
          lastReplyAt: latestReply?.createdAt ?? null,
          lastReplyUserId: latestReply?.userId ?? null,
        })
        .where(
          and(
            eq(this.forumTopicTable.id, topicId),
            isNull(this.forumTopicTable.deletedAt),
          ),
        ),
    )
    this.drizzle.assertAffectedRows(result, '主题不存在')
  }

  async syncSectionVisibleState(tx: Db | undefined, sectionId: number) {
    const client = tx ?? this.db
    const visibleTopicWhere = and(
      eq(this.forumTopicTable.sectionId, sectionId),
      eq(this.forumTopicTable.auditStatus, AuditStatusEnum.APPROVED),
      eq(this.forumTopicTable.isHidden, false),
      isNull(this.forumTopicTable.deletedAt),
    )

    const activityAtSql =
      sql<Date | null>`coalesce(${this.forumTopicTable.lastReplyAt}, ${this.forumTopicTable.createdAt})`

    const [summaryRows, latestTopicRows] = await Promise.all([
      client
        .select({
          topicCount: sql<number>`count(*)::int`,
          replyCount: sql<number>`coalesce(sum(${this.forumTopicTable.replyCount}), 0)::int`,
        })
        .from(this.forumTopicTable)
        .where(visibleTopicWhere),
      client
        .select({
          id: this.forumTopicTable.id,
          lastPostAt: activityAtSql,
        })
        .from(this.forumTopicTable)
        .where(visibleTopicWhere)
        .orderBy(desc(activityAtSql), desc(this.forumTopicTable.id))
        .limit(1),
    ])

    const summary = summaryRows[0]
    const latestTopic = latestTopicRows[0]

    const result = await this.drizzle.withErrorHandling(() =>
      client
        .update(this.forumSectionTable)
        .set({
          topicCount: summary?.topicCount ?? 0,
          replyCount: summary?.replyCount ?? 0,
          lastTopicId: latestTopic?.id ?? null,
          lastPostAt: latestTopic?.lastPostAt ?? null,
        })
        .where(
          and(
            eq(this.forumSectionTable.id, sectionId),
            isNull(this.forumSectionTable.deletedAt),
          ),
        ),
    )
    this.drizzle.assertAffectedRows(result, '板块不存在')
  }

  /**
   * 计算主题审核状态与隐藏策略
   * 根据板块审核策略以及最高敏感词等级决定是否审核与隐藏
   * @param reviewPolicy 审核策略
   * @param highestLevel 命中的最高敏感词等级
   * @returns 审核状态与是否隐藏
   */
  private calculateAuditStatus(
    reviewPolicy: ForumReviewPolicyEnum,
    highestLevel?: SensitiveWordLevelEnum,
  ) {
    let needAudit = false
    let isHidden = false

    if (reviewPolicy === ForumReviewPolicyEnum.MANUAL) {
      needAudit = true
    } else if (highestLevel) {
      if (highestLevel === SensitiveWordLevelEnum.SEVERE) {
        isHidden = true
      }

      if (reviewPolicy === ForumReviewPolicyEnum.SEVERE_SENSITIVE_WORD) {
        needAudit = highestLevel === SensitiveWordLevelEnum.SEVERE
      } else if (
        reviewPolicy === ForumReviewPolicyEnum.GENERAL_SENSITIVE_WORD
      ) {
        needAudit =
          highestLevel === SensitiveWordLevelEnum.SEVERE ||
          highestLevel === SensitiveWordLevelEnum.GENERAL
      } else if (reviewPolicy === ForumReviewPolicyEnum.MILD_SENSITIVE_WORD) {
        needAudit = true
      }
    }

    return {
      auditStatus: needAudit
        ? AuditStatusEnum.PENDING
        : AuditStatusEnum.APPROVED,
      isHidden,
    }
  }

  /**
   * 创建论坛主题
   * 同步处理敏感词检测、审核策略、计数器与操作日志
   * 审核通过后触发成长事件
   * @param createTopicDto - 创建论坛主题的数据传输对象
   * @returns 创建的论坛主题信息
   * @throws {BadRequestException} 板块不存在或已禁用
   * @throws {BadRequestException} 用户论坛资料不存在或已被封禁
   */
  async createForumTopic(createTopicDto: CreateForumTopicInput) {
    const { sectionId, userId, ...topicData } = createTopicDto

    const section = await this.forumPermissionService.ensureUserCanCreateTopic(
      userId,
      sectionId,
    )

    // 合并标题与内容进行敏感词检测
    const { hits, highestLevel } =
      this.sensitiveWordDetectService.getMatchedWords({
        content: topicData.content + topicData.title,
      })

    const reviewPolicy = section.topicReviewPolicy as ForumReviewPolicyEnum

    // 根据策略与敏感词等级计算审核与隐藏状态
    const { auditStatus, isHidden } = this.calculateAuditStatus(
      reviewPolicy,
      highestLevel,
    )

    const createPayload = {
      ...topicData,
      sectionId,
      userId,
      auditStatus,
      sensitiveWordHits: hits?.length ? hits : undefined,
      isHidden,
    }

    // 创建主题与计数更新放在同一事务中，避免数据与计数不一致
    const topic = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const [newTopic] = await tx
          .insert(this.forumTopicTable)
          .values(createPayload)
          .returning()

        await this.forumCounterService.updateTopicRelatedCounts(
          tx,
          sectionId,
          userId,
          1,
        )
        await this.syncSectionVisibleState(tx, sectionId)

        const { deletedAt, ...data } = newTopic
        return data
      }),
    )

    // 记录创建行为，便于审计追踪
    await this.actionLogService.createActionLog({
      userId,
      actionType: ForumUserActionTypeEnum.CREATE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId: topic.id,
      afterData: JSON.stringify(topic),
    })

    // 未进入审核队列才触发成长事件
    if (topic.auditStatus !== AuditStatusEnum.PENDING) {
      await this.userGrowthRewardService.tryRewardByRule({
        userId,
        ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
        bizKey: `forum:topic:create:${topic.id}:user:${userId}`,
        source: 'forum_topic',
        remark: `create forum topic #${topic.id}`,
        targetId: topic.id,
      })
    }

    return topic
  }

  /**
   * 根据ID获取论坛主题详情
   * @param id - 论坛主题ID
   * @returns 论坛主题详情信息
   * @throws {NotFoundException} 主题不存在
   */
  async getTopicById(id: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
      with: {
        topicTags: true,
        section: true,
        user: {
          with: {
            forumProfile: true,
            level: true,
          },
        },
      },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    return topic
  }

  async getPublicTopicById(id: number, userId?: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
      },
      with: {
        topicTags: true,
        section: true,
        user: {
          with: {
            forumProfile: true,
            level: true,
          },
        },
      },
    })

    if (!topic || !topic.section || topic.section.deletedAt || !topic.section.isEnabled) {
      throw new NotFoundException('主题不存在')
    }

    await this.forumPermissionService.ensureUserCanAccessSection(
      topic.section.id,
      userId,
      {
        requireEnabled: true,
        notFoundMessage: '主题不存在',
      },
    )

    return topic
  }

  /**
   * 获取论坛主题列表（分页）
   * @param queryForumTopicDto - 查询参数对象
   * @returns 分页的论坛主题列表
   */
  async getTopics(queryForumTopicDto: QueryForumTopicInput) {
    const { keyword, sectionId, userId, ...otherDto } = queryForumTopicDto
    const where = this.drizzle.buildWhere(this.forumTopicTable, {
      and: {
        deletedAt: { isNull: true },
        sectionId,
        userId,
        isPinned: otherDto.isPinned,
        isFeatured: otherDto.isFeatured,
        isLocked: otherDto.isLocked,
        isHidden: otherDto.isHidden,
        auditStatus: otherDto.auditStatus,
      },
      ...(keyword
        ? {
            or: [
              ilike(this.forumTopicTable.title, `%${keyword}%`),
              ilike(this.forumTopicTable.content, `%${keyword}%`),
            ],
          }
        : {}),
    })

    return this.drizzle.ext.findPagination(this.forumTopicTable, {
      where,
      ...otherDto,
    })
  }

  async getPublicTopics(query: QueryPublicForumTopicInput) {
    await this.forumPermissionService.ensureUserCanAccessSection(
      query.sectionId,
      query.userId,
      {
        requireEnabled: true,
      },
    )

    return this.drizzle.ext.findPagination(this.forumTopicTable, {
      where: this.drizzle.buildWhere(this.forumTopicTable, {
        and: {
          sectionId: query.sectionId,
          deletedAt: { isNull: true },
          auditStatus: AuditStatusEnum.APPROVED,
          isHidden: false,
        },
      }),
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      orderBy: [{ isPinned: 'desc' }, { lastReplyAt: 'desc' }, { createdAt: 'desc' }],
    })
  }

  /**
   * 更新论坛主题
   * @param updateForumTopicDto - 更新论坛主题的数据传输对象
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   * @throws {BadRequestException} 主题已锁定，无法编辑
   */
  async updateTopic(updateForumTopicDto: UpdateForumTopicInput) {
    const { id, ...updateData } = updateForumTopicDto

    if (updateData.title === undefined && updateData.content === undefined) {
      throw new BadRequestException('至少需要更新标题或内容')
    }

    const topic = await this.db.query.forumTopic.findFirst({
      where: { id, deletedAt: { isNull: true } },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    if (topic.isLocked) {
      throw new BadRequestException('主题已锁定，无法编辑')
    }

    const reviewPolicy = await this.getSectionTopicReviewPolicy(
      topic.sectionId,
      {
        notFoundMessage: '主题所属板块不存在',
      },
    )

    // 合并标题与内容进行敏感词检测
    const { hits, highestLevel } =
      this.sensitiveWordDetectService.getMatchedWords({
        content:
          (updateData.content || topic.content) +
          (updateData.title || topic.title),
      })

    // 根据策略与敏感词等级计算审核与隐藏状态
    const { auditStatus, isHidden } = this.calculateAuditStatus(
      reviewPolicy,
      highestLevel,
    )

    const updatePayload = {
      ...updateData,
      auditStatus,
      sensitiveWordHits: hits?.length ? hits : null,
      isHidden,
    }

    // 更新主题内容与审核状态
    const updatedTopic = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const [nextTopic] = await tx
          .update(this.forumTopicTable)
          .set(updatePayload)
          .where(
            and(
              eq(this.forumTopicTable.id, id),
              isNull(this.forumTopicTable.deletedAt),
            ),
          )
          .returning()
        if (!nextTopic) {
          throw new NotFoundException('主题不存在')
        }

        await this.syncSectionVisibleState(tx, topic.sectionId)
        return nextTopic
      }),
    )

    // 记录编辑行为，保存前后差异
    await this.actionLogService.createActionLog({
      userId: topic.userId,
      actionType: ForumUserActionTypeEnum.UPDATE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId: id,
      beforeData: JSON.stringify(topic),
      afterData: JSON.stringify(updatedTopic),
    })

    return updatedTopic
  }

  /**
   * 删除论坛主题（软删除）
   * @param id - 论坛主题ID
   * @returns 删除结果
   * @throws {NotFoundException} 主题不存在
   */
  async deleteTopic(id: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: { id, deletedAt: { isNull: true } },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    // 主题与回复软删除保持一致
    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const visibleReplies = await tx.query.userComment.findMany({
          where: {
            targetType: CommentTargetTypeEnum.FORUM_TOPIC,
            targetId: id,
            auditStatus: AuditStatusEnum.APPROVED,
            isHidden: false,
            deletedAt: { isNull: true },
          },
          columns: { userId: true },
        })

        await tx
          .update(this.userCommentTable)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(this.userCommentTable.targetType, CommentTargetTypeEnum.FORUM_TOPIC),
              eq(this.userCommentTable.targetId, id),
              isNull(this.userCommentTable.deletedAt),
            ),
          )

        const result = await tx
          .update(this.forumTopicTable)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(this.forumTopicTable.id, id),
              isNull(this.forumTopicTable.deletedAt),
            ),
          )
        this.drizzle.assertAffectedRows(result, '主题不存在')

        await this.forumCounterService.updateTopicRelatedCounts(
          tx,
          topic.sectionId,
          topic.userId,
          -1,
        )

        const replyCountByUser = new Map<number, number>()
        for (const reply of visibleReplies) {
          replyCountByUser.set(
            reply.userId,
            (replyCountByUser.get(reply.userId) ?? 0) + 1,
          )
        }

        await Promise.all(
          Array.from(replyCountByUser.entries(), async ([userId, count]) =>
            this.forumCounterService.updateProfileReplyCount(tx, userId, -count)),
        )

        await this.syncSectionVisibleState(tx, topic.sectionId)
      }),
    )

    await this.actionLogService.createActionLog({
      userId: topic.userId,
      actionType: ForumUserActionTypeEnum.DELETE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId: id,
      beforeData: JSON.stringify(topic),
    })

    return topic
  }

  /**
   * 更新主题状态通用方法
   * @param id 主题ID
   * @param updateData 更新字段
   * @returns 更新后的主题
   */
  private async updateTopicStatus(
    id: number,
    updateData: Record<string, unknown>,
    options?: {
      syncSectionVisibility?: boolean
    },
  ) {
    const currentTopic = await this.db.query.forumTopic.findFirst({
      where: { id, deletedAt: { isNull: true } },
      columns: { sectionId: true },
    })

    if (!currentTopic) {
      throw new NotFoundException('主题不存在')
    }

    return this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const [topic] = await tx
          .update(this.forumTopicTable)
          .set(updateData)
          .where(
            and(
              eq(this.forumTopicTable.id, id),
              isNull(this.forumTopicTable.deletedAt),
            ),
          )
          .returning()
        if (!topic) {
          throw new NotFoundException('主题不存在')
        }

        if (options?.syncSectionVisibility) {
          await this.syncSectionVisibleState(tx, currentTopic.sectionId)
        }

        return topic
      }),
    )
  }

  /**
   * 更新主题置顶状态
   * @param updateTopicPinnedDto - 更新置顶状态的数据传输对象
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async updateTopicPinned(updateTopicPinnedDto: UpdateForumTopicPinnedInput) {
    return this.updateTopicStatus(updateTopicPinnedDto.id, {
      isPinned: updateTopicPinnedDto.isPinned,
    })
  }

  /**
   * 更新主题精华状态
   * @param updateTopicFeaturedDto - 更新精华状态的数据传输对象
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async updateTopicFeatured(
    updateTopicFeaturedDto: UpdateForumTopicFeaturedInput,
  ) {
    return this.updateTopicStatus(updateTopicFeaturedDto.id, {
      isFeatured: updateTopicFeaturedDto.isFeatured,
    })
  }

  /**
   * 更新主题锁定状态
   * @param updateTopicLockedDto - 更新锁定状态的数据传输对象
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async updateTopicLocked(updateTopicLockedDto: UpdateForumTopicLockedInput) {
    return this.updateTopicStatus(updateTopicLockedDto.id, {
      isLocked: updateTopicLockedDto.isLocked,
    })
  }

  /**
   * 更新主题隐藏状态
   * @param updateTopicHiddenDto - 更新隐藏状态的数据传输对象
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async updateTopicHidden(updateTopicHiddenDto: UpdateForumTopicHiddenInput) {
    return this.updateTopicStatus(
      updateTopicHiddenDto.id,
      {
        isHidden: updateTopicHiddenDto.isHidden,
      },
      {
        syncSectionVisibility: true,
      },
    )
  }

  /**
   * 更新主题审核状态
   * @param updateTopicAuditStatusDto - 更新审核状态的数据传输对象
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async updateTopicAuditStatus(
    updateTopicAuditStatusDto: UpdateForumTopicAuditStatusInput,
  ) {
    const { id, auditStatus, auditReason } = updateTopicAuditStatusDto
    return this.updateTopicStatus(
      id,
      {
        auditStatus,
        auditReason,
      },
      {
        syncSectionVisibility: true,
      },
    )
  }

  /**
   * 增加主题浏览量
   * @param id - 论坛主题ID
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async incrementViewCount(id: number) {
    const [topic] = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.forumTopicTable)
        .set({ viewCount: sql`${this.forumTopicTable.viewCount} + 1` })
        .where(
          and(
            eq(this.forumTopicTable.id, id),
            isNull(this.forumTopicTable.deletedAt),
          ),
        )
        .returning(),
    )
    if (!topic) {
      throw new NotFoundException('主题不存在')
    }
    return topic
  }

  /**
   * 增加主题回复数并更新最后回复信息
   * @param id - 论坛主题ID
   * @param replyUserId - 回复者用户ID
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async incrementReplyCount(id: number, replyUserId: number) {
    const [topic] = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.forumTopicTable)
        .set({
          replyCount: sql`${this.forumTopicTable.replyCount} + 1`,
          commentCount: sql`${this.forumTopicTable.commentCount} + 1`,
          lastReplyUserId: replyUserId,
          lastReplyAt: new Date(),
        })
        .where(
          and(
            eq(this.forumTopicTable.id, id),
            isNull(this.forumTopicTable.deletedAt),
          ),
        )
        .returning(),
    )
    if (!topic) {
      throw new NotFoundException('主题不存在')
    }
    return topic
  }

  /**
   * 增加主题点赞数
   * @param id - 论坛主题ID
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async incrementLikeCount(id: number) {
    const [topic] = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.forumTopicTable)
        .set({ likeCount: sql`${this.forumTopicTable.likeCount} + 1` })
        .where(
          and(
            eq(this.forumTopicTable.id, id),
            isNull(this.forumTopicTable.deletedAt),
          ),
        )
        .returning(),
    )
    if (!topic) {
      throw new NotFoundException('主题不存在')
    }
    return topic
  }

  /**
   * 减少主题点赞数
   * @param id - 论坛主题ID
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async decrementLikeCount(id: number) {
    const [topic] = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.forumTopicTable)
        .set({ likeCount: sql`${this.forumTopicTable.likeCount} - 1` })
        .where(
          and(
            eq(this.forumTopicTable.id, id),
            isNull(this.forumTopicTable.deletedAt),
          ),
        )
        .returning(),
    )
    if (!topic) {
      throw new NotFoundException('主题不存在')
    }
    return topic
  }

  async updateUserTopic(userId: number, input: UpdateForumTopicInput) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: { id: input.id, deletedAt: { isNull: true } },
      columns: { userId: true },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    if (topic.userId !== userId) {
      throw new BadRequestException('无权修改该主题')
    }

    return this.updateTopic(input)
  }

  async deleteUserTopic(userId: number, id: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: { id, deletedAt: { isNull: true } },
      columns: { userId: true },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    if (topic.userId !== userId) {
      throw new BadRequestException('无权删除该主题')
    }

    return this.deleteTopic(id)
  }
}
