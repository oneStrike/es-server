import type {
  ForumTopicCreateInput,
  ForumTopicWhereInput,
} from '@libs/base/database'
import { BaseService } from '@libs/base/database'

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ForumConfigCacheService } from '../config/forum-config-cache.service'
import { ForumReviewPolicyEnum } from '../config/forum-config.constants'
import { ForumCounterService } from '../counter/forum-counter.service'
import { ForumPointRuleTypeEnum } from '../point/point.constant'
import { ForumPointService } from '../point/point.service'
import { ForumProfileStatusEnum } from '../profile/profile.constant'
import { ForumSensitiveWordLevelEnum } from '../sensitive-word/sensitive-word-constant'
import { ForumSensitiveWordDetectService } from '../sensitive-word/sensitive-word-detect.service'
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
    private readonly pointService: ForumPointService,
    private readonly forumConfigCacheService: ForumConfigCacheService,
    private readonly sensitiveWordDetectService: ForumSensitiveWordDetectService,
    private readonly forumCounterService: ForumCounterService,
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

  private calculateAuditStatus(
    reviewPolicy: ForumReviewPolicyEnum,
    highestLevel?: ForumSensitiveWordLevelEnum,
  ) {
    let needAudit = false
    let isHidden = false

    if (reviewPolicy === ForumReviewPolicyEnum.MANUAL) {
      needAudit = true
    } else if (highestLevel) {
      if (highestLevel === ForumSensitiveWordLevelEnum.SEVERE) {
        isHidden = true
      }

      if (reviewPolicy === ForumReviewPolicyEnum.SEVERE_SENSITIVE_WORD) {
        needAudit = highestLevel === ForumSensitiveWordLevelEnum.SEVERE
      } else if (reviewPolicy === ForumReviewPolicyEnum.GENERAL_SENSITIVE_WORD) {
        needAudit =
          highestLevel === ForumSensitiveWordLevelEnum.SEVERE ||
          highestLevel === ForumSensitiveWordLevelEnum.GENERAL
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
   * @param createTopicDto - 创建论坛主题的数据传输对象
   * @returns 创建的论坛主题信息
   * @throws {BadRequestException} 板块不存在或已禁用
   * @throws {BadRequestException} 用户论坛资料不存在或已被封禁
   */
  async createForumTopic(createTopicDto: CreateForumTopicDto) {
    const { sectionId, profileId, ...topicData } = createTopicDto

    const { hits, highestLevel } =
      this.sensitiveWordDetectService.getMatchedWords({
        content: topicData.content + topicData.title,
      })

    const createPayload: ForumTopicCreateInput = {
      ...topicData,
      section: {
        connect: { id: sectionId, isEnabled: true },
      },
      profile: {
        connect: { id: profileId, status: ForumProfileStatusEnum.NORMAL },
      },
    }

    const section = await this.forumSection.findUnique({
      where: { id: sectionId },
      select: { topicReviewPolicy: true },
    })

    const { reviewPolicy: globalReviewPolicy } =
      await this.forumConfigCacheService.getConfig()

    const reviewPolicy = section?.topicReviewPolicy ?? globalReviewPolicy

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
        profileId,
        1,
      )

      return newTopic
    })

    if (topic.auditStatus !== ForumTopicAuditStatusEnum.PENDING) {
      await this.pointService.addPoints({
        profileId,
        ruleType: ForumPointRuleTypeEnum.CREATE_TOPIC,
        remark: `创建主题 ${topic.id}`,
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
        profile: {
          include: {
            user: true,
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
    const { keyword, sectionId, profileId, ...otherDto } = queryForumTopicDto

    const where: ForumTopicWhereInput = {
      ...otherDto,
      deletedAt: null,
      section: {
        id: sectionId,
      },
      profile: {
        id: profileId,
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

    const { hits, highestLevel } =
      this.sensitiveWordDetectService.getMatchedWords({
        content:
          (updateData.content || topic.content) +
          (updateData.title || topic.title),
      })

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

    const updatedTopic = await this.forumTopic.update({
      where: { id },
      data: updatePayload,
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

    await this.prisma.$transaction(async (tx) => {
      await tx.forumReply.softDeleteMany({ topicId: id })
      await tx.forumTopic.softDelete({ id })

      await this.forumCounterService.updateTopicRelatedCounts(
        tx,
        topic.sectionId,
        topic.profileId,
        -1,
      )
    })

    return topic
  }

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
   * @param replyProfileId - 回复者资料ID
   * @returns 更新后的论坛主题信息
   * @throws {NotFoundException} 主题不存在
   */
  async incrementReplyCount(id: number, replyProfileId: number) {
    return this.forumTopic.update({
      where: { id, deletedAt: null },
      data: {
        replyCount: {
          increment: 1,
        },
        lastReplyProfileId: replyProfileId,
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
