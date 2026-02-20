import type {
  ForumTopicCreateInput,
  ForumTopicWhereInput,
} from '@libs/base/database'
import { UserStatusEnum } from '@libs/base/constant'

import { BaseService } from '@libs/base/database'
import {
  SensitiveWordDetectService,
  SensitiveWordLevelEnum,
} from '@libs/sensitive-word'
import { UserGrowthEventService } from '@libs/user/growth-event'

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../action-log/action-log.constant'
import { ForumUserActionLogService } from '../action-log/action-log.service'
import { ForumConfigCacheService } from '../config/forum-config-cache.service'
import { ForumReviewPolicyEnum } from '../config/forum-config.constant'
import { ForumCounterService } from '../counter/forum-counter.service'
import { ForumGrowthEventKey } from '../forum-growth-event.constant'
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
import { ForumTopicAuditStatusEnum } from './forum-topic.constant'

/**
 * 论坛主题服务类
 * 提供论坛主题的增删改查、置顶、精华、锁定等核心业务逻辑
 */
@Injectable()
export class ForumTopicService extends BaseService {
  constructor(
    private readonly userGrowthEventService: UserGrowthEventService,
    private readonly forumConfigCacheService: ForumConfigCacheService,
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly forumCounterService: ForumCounterService,
    private readonly actionLogService: ForumUserActionLogService,
  ) {
    super()
  }

  get forumTopic() {
    return this.prisma.forumTopic
  }

  get forumSection() {
    return this.prisma.forumSection
  }

  /**
   * 获取论坛资料模型
   * @returns 论坛资料模型实例
   */
  get forumProfile() {
    return this.prisma.forumProfile
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
        ? ForumTopicAuditStatusEnum.PENDING
        : ForumTopicAuditStatusEnum.APPROVED,
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

    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: { status: true },
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

    const createPayload: ForumTopicCreateInput = {
      ...topicData,
      section: {
        connect: { id: sectionId, isEnabled: true },
      },
      user: {
        connect: { id: userId },
      },
    }

    // 优先使用板块审核策略，若未配置则回退到全局策略
    const section = await this.forumSection.findUnique({
      where: { id: sectionId },
      select: { topicReviewPolicy: true },
    })

    const { reviewPolicy: globalReviewPolicy } =
      await this.forumConfigCacheService.getConfig()

    const reviewPolicy = section?.topicReviewPolicy ?? globalReviewPolicy

    // 根据策略与敏感词等级计算审核与隐藏状态
    const { auditStatus, isHidden } = this.calculateAuditStatus(
      reviewPolicy,
      highestLevel,
    )

    if (highestLevel) {
      createPayload.sensitiveWordHits = JSON.stringify(hits)
    }

    if (isHidden) {
      createPayload.isHidden = true
    }

    createPayload.auditStatus = auditStatus

    // 创建主题与计数更新放在同一事务中，避免数据与计数不一致
    const topic = await this.prisma.$transaction(async (tx) => {
      const newTopic = await tx.forumTopic.create({
        data: createPayload,
        omit: {
          version: true,
          deletedAt: true,
          sensitiveWordHits: true,
        },
      })

      await this.forumCounterService.updateTopicRelatedCounts(
        tx,
        sectionId,
        userId,
        1,
      )

      return newTopic
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
    if (topic.auditStatus !== ForumTopicAuditStatusEnum.PENDING) {
      await this.userGrowthEventService.handleEvent({
        business: 'forum',
        eventKey: ForumGrowthEventKey.TopicCreate,
        userId,
        targetId: topic.id,
        occurredAt: new Date(),
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
    const topic = await this.forumTopic.findUnique({
      where: { id, deletedAt: null },
      include: {
        topicTags: true,
        section: true,
        user: {
          include: {
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

    const where: ForumTopicWhereInput = {
      ...otherDto,
      deletedAt: null,
      section: {
        id: sectionId,
      },
      user: {
        id: userId,
      },
    }

    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { content: { contains: keyword } },
      ]
    }

    return this.forumTopic.findPagination({
      where,
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

    const topic = await this.forumTopic.findUnique({
      where: { id, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    if (topic.isLocked) {
      throw new BadRequestException('主题已锁定，无法编辑')
    }

    const section = await this.forumSection.findUnique({
      where: { id: topic.sectionId },
      select: { topicReviewPolicy: true },
    })

    const { reviewPolicy: globalReviewPolicy } =
      await this.forumConfigCacheService.getConfig()

    const reviewPolicy = section?.topicReviewPolicy ?? globalReviewPolicy

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

    const updatePayload: any = { ...updateData }

    if (highestLevel) {
      updatePayload.sensitiveWordHits = JSON.stringify(hits)
    }

    if (isHidden) {
      updatePayload.isHidden = true
    }

    updatePayload.auditStatus = auditStatus

    // 更新主题内容与审核状态
    const updatedTopic = await this.forumTopic.update({
      where: { id },
      data: updatePayload,
    })

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
    const topic = await this.forumTopic.findUnique({
      where: { id, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    // 主题与回复软删除保持一致
    await this.prisma.$transaction(async (tx) => {
      await tx.forumReply.softDeleteMany({ topicId: id })
      await tx.forumTopic.softDelete({ id })

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
  private async updateTopicStatus(id: number, updateData: Record<string, any>) {
    const topic = await this.forumTopic.update({
      where: { id, deletedAt: null },
      data: updateData,
    })

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
    return this.forumTopic.update({
      where: { id, deletedAt: null },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })
  }

  /**
   * 增加主题回复数并更新最后回复信息
   * @param id - 论坛主题ID
   * @param replyUserId - 回复者用户ID
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async incrementReplyCount(id: number, replyUserId: number) {
    return this.forumTopic.update({
      where: { id, deletedAt: null },
      data: {
        replyCount: {
          increment: 1,
        },
        lastReplyUserId: replyUserId,
        lastReplyAt: new Date(),
      },
    })
  }

  /**
   * 增加主题点赞数
   * @param id - 论坛主题ID
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async incrementLikeCount(id: number) {
    return this.forumTopic.update({
      where: { id, deletedAt: null },
      data: {
        likeCount: {
          increment: 1,
        },
      },
    })
  }

  /**
   * 减少主题点赞数
   * @param id - 论坛主题ID
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async decrementLikeCount(id: number) {
    return this.forumTopic.update({
      where: { id, deletedAt: null },
      data: {
        likeCount: {
          decrement: 1,
        },
      },
    })
  }
}
