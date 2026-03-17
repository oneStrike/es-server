import { DrizzleService } from '@db/core'
import { GrowthRuleTypeEnum, UserGrowthRewardService } from '@libs/growth'

import { AuditStatusEnum, UserStatusEnum } from '@libs/platform/constant'
import {
  SensitiveWordDetectService,
  SensitiveWordLevelEnum,
} from '@libs/sensitive-word'

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, ilike, isNull, sql } from 'drizzle-orm'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../action-log/action-log.constant'
import { ForumUserActionLogService } from '../action-log/action-log.service'
import { ForumConfigCacheService } from '../config/forum-config-cache.service'
import { ForumReviewPolicyEnum } from '../config/forum-config.constant'
import { ForumCounterService } from '../counter/forum-counter.service'
import {
  CreateForumTopicDto,
  QueryForumTopicDto,
  UpdateForumTopicAuditStatusDto,
  UpdateForumTopicDto,
  UpdateForumTopicFeaturedDto,
  UpdateForumTopicHiddenDto,
  UpdateForumTopicLockedDto,
  UpdateForumTopicPinnedDto,
} from './dto/forum-topic.dto'

/**
 * 论坛主题服务类
 * 提供论坛主题的增删改查、置顶、精华、锁定等核心业务逻辑
 */
@Injectable()
export class ForumTopicService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly userGrowthRewardService: UserGrowthRewardService,
    private readonly forumConfigCacheService: ForumConfigCacheService,
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly forumCounterService: ForumCounterService,
    private readonly actionLogService: ForumUserActionLogService,
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

  /**
   * 计算主题审核状态与隐藏策略
   * 根据板块或全局的审核策略以及最高敏感词等级决定是否审核与隐藏
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
  async createForumTopic(createTopicDto: CreateForumTopicDto) {
    const { sectionId, userId, ...topicData } = createTopicDto

    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
      columns: { status: true },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    if (
      [
        UserStatusEnum.MUTED,
        UserStatusEnum.PERMANENT_MUTED,
        UserStatusEnum.BANNED,
        UserStatusEnum.PERMANENT_BANNED,
      ].includes(user.status)
    ) {
      throw new BadRequestException('用户已被禁言或封禁，无法发布主题')
    }

    // 合并标题与内容进行敏感词检测
    const { hits, highestLevel } =
      this.sensitiveWordDetectService.getMatchedWords({
        content: topicData.content + topicData.title,
      })

    // 优先使用板块审核策略，若未配置则回退到全局策略
    const section = await this.db.query.forumSection.findFirst({
      where: { id: sectionId, deletedAt: { isNull: true } },
      columns: { topicReviewPolicy: true, isEnabled: true },
    })
    if (!section || !section.isEnabled) {
      throw new BadRequestException('板块不存在或已禁用')
    }

    const { reviewPolicy: globalReviewPolicy } =
      await this.forumConfigCacheService.getConfig()

    const reviewPolicy = section?.topicReviewPolicy ?? globalReviewPolicy

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
      ...(highestLevel ? { sensitiveWordHits: JSON.stringify(hits) } : {}),
      ...(isHidden ? { isHidden: true } : {}),
    }

    // 创建主题与计数更新放在同一事务中，避免数据与计数不一致
    const topic = await this.db.transaction(async (tx) => {
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

      const { version, deletedAt, sensitiveWordHits, ...data } = newTopic
      return data
    })

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

  /**
   * 获取论坛主题列表（分页）
   * @param queryForumTopicDto - 查询参数对象
   * @returns 分页的论坛主题列表
   */
  async getTopics(queryForumTopicDto: QueryForumTopicDto) {
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

  /**
   * 更新论坛主题
   * @param updateForumTopicDto - 更新论坛主题的数据传输对象
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   * @throws {BadRequestException} 主题已锁定，无法编辑
   */
  async updateTopic(updateForumTopicDto: UpdateForumTopicDto) {
    const { id, ...updateData } = updateForumTopicDto

    const topic = await this.db.query.forumTopic.findFirst({
      where: { id, deletedAt: { isNull: true } },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    if (topic.isLocked) {
      throw new BadRequestException('主题已锁定，无法编辑')
    }

    const section = await this.db.query.forumSection.findFirst({
      where: { id: topic.sectionId, deletedAt: { isNull: true } },
      columns: { topicReviewPolicy: true },
    })

    const { reviewPolicy: globalReviewPolicy } =
      await this.forumConfigCacheService.getConfig()

    const reviewPolicy = (section?.topicReviewPolicy ??
      globalReviewPolicy) as ForumReviewPolicyEnum

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
      ...(highestLevel ? { sensitiveWordHits: JSON.stringify(hits) } : {}),
      ...(isHidden ? { isHidden: true } : {}),
    }

    // 更新主题内容与审核状态
    const [updatedTopic] = await this.db
      .update(this.forumTopicTable)
      .set(updatePayload)
      .where(
        and(
          eq(this.forumTopicTable.id, id),
          isNull(this.forumTopicTable.deletedAt),
        ),
      )
      .returning()
    if (!updatedTopic) {
      throw new NotFoundException('主题不存在')
    }

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
    await this.db.transaction(async (tx) => {
      await tx
        .update(this.userCommentTable)
        .set({ deletedAt: new Date() })
        .where(
          and(
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
    })

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
  ) {
    const [topic] = await this.db
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
    return topic
  }

  /**
   * 更新主题置顶状态
   * @param updateTopicPinnedDto - 更新置顶状态的数据传输对象
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async updateTopicPinned(updateTopicPinnedDto: UpdateForumTopicPinnedDto) {
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
    updateTopicFeaturedDto: UpdateForumTopicFeaturedDto,
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
  async updateTopicLocked(updateTopicLockedDto: UpdateForumTopicLockedDto) {
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
  async updateTopicHidden(updateTopicHiddenDto: UpdateForumTopicHiddenDto) {
    return this.updateTopicStatus(updateTopicHiddenDto.id, {
      isHidden: updateTopicHiddenDto.isHidden,
    })
  }

  /**
   * 更新主题审核状态
   * @param updateTopicAuditStatusDto - 更新审核状态的数据传输对象
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async updateTopicAuditStatus(
    updateTopicAuditStatusDto: UpdateForumTopicAuditStatusDto,
  ) {
    const { id, auditStatus, auditReason } = updateTopicAuditStatusDto
    return this.updateTopicStatus(id, {
      auditStatus,
      auditReason,
    })
  }

  /**
   * 增加主题浏览量
   * @param id - 论坛主题ID
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async incrementViewCount(id: number) {
    const [topic] = await this.db
      .update(this.forumTopicTable)
      .set({ viewCount: sql`${this.forumTopicTable.viewCount} + 1` })
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
    const [topic] = await this.db
      .update(this.forumTopicTable)
      .set({
        replyCount: sql`${this.forumTopicTable.replyCount} + 1`,
        lastReplyUserId: replyUserId,
        lastReplyAt: new Date(),
      })
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
    return topic
  }

  /**
   * 增加主题点赞数
   * @param id - 论坛主题ID
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async incrementLikeCount(id: number) {
    const [topic] = await this.db
      .update(this.forumTopicTable)
      .set({ likeCount: sql`${this.forumTopicTable.likeCount} + 1` })
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
    return topic
  }

  /**
   * 减少主题点赞数
   * @param id - 论坛主题ID
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async decrementLikeCount(id: number) {
    const [topic] = await this.db
      .update(this.forumTopicTable)
      .set({ likeCount: sql`${this.forumTopicTable.likeCount} - 1` })
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
    return topic
  }
}
