import type {
  ForumReplyCreateInput,
  ForumReplyWhereInput,
} from '@libs/base/database'
import { UserStatusEnum } from '@libs/base/constant'

import { BaseService } from '@libs/base/database'
import {
  SensitiveWordDetectService,
  SensitiveWordLevelEnum,
} from '@libs/sensitive-word'
import { UserGrowthEventService } from '@libs/user/growth-event'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../action-log/action-log.constant'
import { ForumUserActionLogService } from '../action-log/action-log.service'
import { ForumCounterService } from '../counter/forum-counter.service'
import { ForumGrowthEventKey } from '../forum-growth-event.constant'
import { ForumNotificationService } from '../notification/notification.service'
import { CreateForumReplyDto, QueryForumReplyDto } from './dto/forum-reply.dto'
import { ForumAuditStatusEnum } from './forum-reply.constant'

/**
 * 论坛回复服务类
 * 提供论坛回复的增删改查等核心业务逻辑
 */
@Injectable()
export class ForumReplyService extends BaseService {
  constructor(
    private readonly notificationService: ForumNotificationService,
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly forumCounterService: ForumCounterService,
    private readonly actionLogService: ForumUserActionLogService,
    private readonly userGrowthEventService: UserGrowthEventService,
  ) {
    super()
  }

  get forumReply() {
    return this.prisma.forumReply
  }

  get forumTopic() {
    return this.prisma.forumTopic
  }

  get forumProfile() {
    return this.prisma.forumProfile
  }

  /**
   * 创建论坛回复
   * 同步处理敏感词检测、楼层计算、计数更新与通知
   * 审核通过后触发成长事件
   * @param createForumReplyDto 创建回复的数据
   * @returns 创建的回复信息
   */
  async createReply(createForumReplyDto: CreateForumReplyDto) {
    const { topicId, replyToId, userId, ...replyData } = createForumReplyDto

    const topic = await this.forumTopic.findUnique({
      where: { id: topicId },
    })

    if (!topic) {
      throw new BadRequestException('主题不存在')
    }

    if (topic.isLocked) {
      throw new BadRequestException('主题已锁定，无法回复')
    }

    const user = await this.prisma.appUser.findFirst({
      where: { id: userId, isEnabled: true },
    })

    if (!user) {
      throw new BadRequestException('用户不存在或已被封禁')
    }

    if (
      [
        UserStatusEnum.MUTED,
        UserStatusEnum.PERMANENT_MUTED,
        UserStatusEnum.BANNED,
        UserStatusEnum.PERMANENT_BANNED,
      ].includes(user.status)
    ) {
      throw new BadRequestException('用户已被禁言或封禁，无法回复')
    }

    if (replyToId) {
      const replyTo = await this.forumReply.findUnique({
        where: { id: replyToId },
      })

      if (!replyTo) {
        throw new BadRequestException('被回复的回复不存在')
      }

      if (replyTo.topicId !== topicId) {
        throw new BadRequestException('被回复的回复不属于该主题')
      }
    }

    // 仅顶层回复才计算楼层
    let newFloor: number | null = null
    if (!replyToId) {
      const maxFloorReply = await this.forumReply.findFirst({
        where: {
          topicId,
          replyToId: null,
          deletedAt: null,
        },
        orderBy: {
          floor: 'desc',
        },
        select: {
          floor: true,
        },
      })
      newFloor = (maxFloorReply?.floor ?? 0) + 1
    }

    // 敏感词检测决定审核状态
    const detectResult = this.sensitiveWordDetectService.detect({
      content: replyData.content,
    })

    let auditStatus = 0
    let auditReason: string | undefined

    if (detectResult.highestLevel === SensitiveWordLevelEnum.SEVERE) {
      auditStatus = 2
      auditReason = '包含严重敏感词，需要审核'
    }

    const updatePayload: ForumReplyCreateInput = {
      ...replyData,
      floor: newFloor,
      auditStatus,
      auditReason,
      sensitiveWordHits:
        detectResult.hits.length > 0
          ? (detectResult.hits as any)
          : undefined,
      actualReplyTo: replyToId
        ? {
            connect: {
              id: replyToId,
            },
          }
        : undefined,
      topic: {
        connect: {
          id: topicId,
        },
      },
      user: {
        connect: {
          id: userId,
        },
      },
    }

    if (replyToId) {
      updatePayload.replyTo = {
        connect: {
          id: replyToId,
        },
      }
    }

    // 创建回复与计数更新放在同一事务中，避免计数不一致
    const reply = await this.prisma.$transaction(async (tx) => {
      const reply = await tx.forumReply.create({
        data: updatePayload,
      })

      await this.forumCounterService.updateReplyRelatedCounts(
        tx,
        topicId,
        topic.sectionId,
        userId,
        1,
      )

      // 回复他人时发送通知
      if (replyToId) {
        const replyTo = await tx.forumReply.findUnique({
          where: { id: replyToId },
          select: {
            userId: true,
          },
        })

        if (replyTo && replyTo.userId !== userId) {
          await this.notificationService.createReplyNotification({
            userId: replyTo.userId,
            title: '收到新回复',
            content: `${user.nickname || '用户'} 回复了你的内容`,
            topicId,
            replyId: reply.id,
            isRead: false,
          })
        }
      }

      await this.actionLogService.createActionLog({
        userId,
        actionType: ForumUserActionTypeEnum.CREATE_REPLY,
        targetType: ForumUserActionTargetTypeEnum.REPLY,
        targetId: reply.id,
        afterData: JSON.stringify(reply),
      })

      return reply
    })

    // 未进入审核队列才触发成长事件
    if (reply.auditStatus !== ForumAuditStatusEnum.PENDING) {
      await this.userGrowthEventService.handleEvent({
        business: 'forum',
        eventKey: ForumGrowthEventKey.ReplyCreate,
        userId,
        targetId: reply.id,
        occurredAt: new Date(),
      })
    }

    return reply
  }

  /**
   * 分页查询论坛回复列表
   * @param queryForumReplyDto 查询条件
   * @returns 分页的回复列表
   */
  async getForumReplyPage(queryForumReplyDto: QueryForumReplyDto) {
    const { content, sortBy, sortOrder, ...otherDto } = queryForumReplyDto

    const where: ForumReplyWhereInput = {}

    if (content) {
      where.content = {
        contains: content,
        mode: 'insensitive',
      }
    }

    const orderBy: any = {}

    if (sortBy) {
      const order = sortOrder || 'asc'
      orderBy[sortBy] = order
    } else {
      orderBy.createdAt = 'desc'
    }

    const result = await this.forumReply.findPagination({
      where: {
        ...where,
        ...otherDto,
      },
      orderBy,
    })

    result.list = this.flattenRepliesToTwoLevels(result.list)

    return result
  }

  /**
   * 获取论坛回复详情
   * @param id 回复ID
   * @returns 回复详情信息
   */
  async getForumReplyDetail(id: number) {
    const reply = await this.forumReply.findUnique({
      where: { id },
      include: {
        topic: {
          include: {
            section: true,
          },
        },
        user: {
          include: {
            level: true,
            userBadges: {
              include: {
                badge: true,
              },
            },
          },
        },
        replyTo: {
          include: {
            user: true,
          },
        },
      },
    })

    if (!reply) {
      throw new BadRequestException('论坛回复不存在')
    }

    return reply
  }

  /**
   * 软删除论坛回复
   * @param id 回复ID
   * @returns 删除结果
   */
  async deleteForumReply(id: number) {
    const reply = await this.forumReply.findUnique({
      where: { id },
    })

    if (!reply) {
      throw new BadRequestException('论坛回复不存在')
    }

    // 级联软删除回复并同步计数
    return this.prisma.$transaction(async (tx) => {
      const childReplies = await tx.forumReply.findMany({
        where: {
          replyToId: id,
          deletedAt: null,
        },
        select: {
          id: true,
          userId: true,
        },
      })

      const childReplyIds = childReplies.map((r) => r.id)
      const totalDeleteCount = childReplyIds.length + 1

      if (childReplyIds.length > 0) {
        // 批量软删除子回复
        await tx.forumReply.updateMany({
          where: {
            id: {
              in: childReplyIds,
            },
          },
          data: {
            deletedAt: new Date(),
          },
        })

        // 子回复作者的个人回复数回收
        for (const childReply of childReplies) {
          await this.forumCounterService.updateProfileReplyCount(
            tx,
            childReply.userId,
            -1,
          )
        }
      }

      // 主题回复数扣减包含主回复与子回复
      await this.forumCounterService.updateTopicReplyCount(
        tx,
        reply.topicId,
        -totalDeleteCount,
      )

      const topic = await tx.forumTopic.findUnique({
        where: { id: reply.topicId },
        select: { sectionId: true },
      })

      if (topic) {
        // 版块回复数同步扣减
        await this.forumCounterService.updateSectionReplyCount(
          tx,
          topic.sectionId,
          -totalDeleteCount,
        )
      }

      await this.forumCounterService.updateProfileReplyCount(
        tx,
        reply.userId,
        -1,
      )

      await this.actionLogService.createActionLog({
        userId: reply.userId,
        actionType: ForumUserActionTypeEnum.DELETE_REPLY,
        targetType: ForumUserActionTargetTypeEnum.REPLY,
        targetId: id,
        beforeData: JSON.stringify(reply),
      })

      return this.forumReply.softDelete({ id })
    })
  }

  /**
   * 更新回复审核状态
   * @param id 回复ID
   * @param auditStatus 审核状态
   * @returns 更新结果
   */
  async updateAuditStatus(id: number, auditStatus: number) {
    const reply = await this.forumReply.findUnique({
      where: { id },
    })

    if (!reply) {
      throw new BadRequestException('论坛回复不存在')
    }

    return this.forumReply.update({
      where: { id },
      data: { auditStatus },
    })
  }

  /**
   * 更新回复隐藏状态
   * @param id 回复ID
   * @param isHidden 是否隐藏
   * @returns 更新结果
   */
  async updateHiddenStatus(id: number, isHidden: boolean) {
    const reply = await this.forumReply.findUnique({
      where: { id },
    })

    if (!reply) {
      throw new BadRequestException('论坛回复不存在')
    }

    return this.forumReply.update({
      where: { id },
      data: { isHidden },
    })
  }

  /**
   * 批量删除回复
   * 要求所选回复无子回复，否则中断删除
   * @param ids 回复ID列表
   * @returns 删除结果
   */
  async batchDeleteReply(ids: number[]) {
    const replies = await this.forumReply.findMany({
      where: { id: { in: ids } },
    })

    if (replies.length === 0) {
      throw new BadRequestException('没有找到可删除的回复')
    }

    const childReplyCount = await this.forumReply.count({
      where: {
        replyToId: { in: ids },
        deletedAt: null,
      },
    })

    if (childReplyCount > 0) {
      throw new BadRequestException(
        `选中的回复还有 ${childReplyCount} 个子回复，无法删除`,
      )
    }

    return this.prisma.$transaction(async (tx) => {
      for (const reply of replies) {
        await this.forumCounterService.updateTopicReplyCount(
          tx,
          reply.topicId,
          -1,
        )

        const topic = await tx.forumTopic.findUnique({
          where: { id: reply.topicId },
          select: { sectionId: true },
        })

        if (topic) {
          await this.forumCounterService.updateSectionReplyCount(
            tx,
            topic.sectionId,
            -1,
          )
        }

        await this.forumCounterService.updateProfileReplyCount(
          tx,
          reply.userId,
          -1,
        )

        await this.actionLogService.createActionLog({
          userId: reply.userId,
          actionType: ForumUserActionTypeEnum.DELETE_REPLY,
          targetType: ForumUserActionTargetTypeEnum.REPLY,
          targetId: reply.id,
          beforeData: JSON.stringify(reply),
        })
      }

      const result = await tx.forumReply.deleteMany({
        where: { id: { in: ids } },
      })

      return { count: result.count }
    })
  }

  /**
   * 将第三层及以上的回复扁平化到第二层
   * 用于前端以两级结构展示回复列表
   * @param replies 回复列表
   * @returns 扁平化后的回复列表
   */
  private flattenRepliesToTwoLevels(replies: any[]): any[] {
    const replyMap = new Map<number, any>()

    replies.forEach((reply) => {
      replyMap.set(reply.id, { ...reply })
    })

    return replies.map((reply) => {
      const flattenedReply = { ...reply }

      if (reply.replyToId !== null) {
        const replyTo = replyMap.get(reply.replyToId)

        if (replyTo && replyTo.replyToId !== null) {
          flattenedReply.replyToId = replyTo.replyToId
          flattenedReply.isFlattened = true
        }
      }

      return flattenedReply
    })
  }
}
