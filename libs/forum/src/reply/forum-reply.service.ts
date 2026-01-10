import type {
  ForumReplyCreateInput,
  ForumReplyWhereInput,
} from '@libs/base/database'
import { BaseService } from '@libs/base/database'

import { BadRequestException, Injectable } from '@nestjs/common'
import { ForumCounterService } from '../counter/forum-counter.service'
import { NotificationService } from '../notification/notification.service'
import { SensitiveWordDetectService } from '../sensitive-word/sensitive-word-detect.service'
import { CreateForumReplyDto, QueryForumReplyDto } from './dto/forum-reply.dto'

/**
 * 论坛回复服务类
 * 提供论坛回复的增删改查等核心业务逻辑
 */
@Injectable()
export class ForumReplyService extends BaseService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly forumCounterService: ForumCounterService,
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
   * @param createForumReplyDto 创建回复的数据
   * @returns 创建的回复信息
   */
  async createForumReply(createForumReplyDto: CreateForumReplyDto) {
    const { topicId, replyToId, ...replyData } = createForumReplyDto

    const topic = await this.forumTopic.findUnique({
      where: { id: topicId },
    })

    if (!topic) {
      throw new BadRequestException('主题不存在')
    }

    if (topic.isLocked) {
      throw new BadRequestException('主题已锁定，无法回复')
    }

    const profile = await this.forumProfile.findFirst({
      where: { id: replyData.profileId, status: 1 },
      include: {
        user: true,
      },
    })

    if (!profile) {
      throw new BadRequestException('用户论坛资料不存在或已被封禁')
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

    const detectResult = await this.sensitiveWordDetectService.detect({
      content: replyData.content,
    })

    let auditStatus = 0
    let auditReason: string | undefined

    if (detectResult.hasSevere) {
      auditStatus = 2
      auditReason = '包含严重敏感词，需要审核'
    }

    const updatePayload: ForumReplyCreateInput = {
      ...replyData,
      floor: newFloor,
      auditStatus,
      auditReason,
      sensitiveWordHits: detectResult.hits.length > 0 ? detectResult.hits : null,
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
      profile: {
        connect: {
          id: profile.id,
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

    return this.prisma.$transaction(async (tx) => {
      const reply = await tx.forumReply.create({
        data: updatePayload,
      })

      await this.forumCounterService.updateReplyRelatedCounts(
        tx,
        topicId,
        topic.sectionId,
        profile.id,
        1,
      )

      if (replyToId) {
        const replyTo = await tx.forumReply.findUnique({
          where: { id: replyToId },
          select: {
            profileId: true,
          },
        })

        if (replyTo && replyTo.profileId !== profile.id) {
          await this.notificationService.createReplyNotification({
            profileId: replyTo.profileId,
            title: '收到新回复',
            content: `${profile.user?.nickname || '用户'} 回复了你的内容`,
            topicId,
            replyId: reply.id,
            isRead: false,
          })
        }
      }

      return reply
    })
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
        profile: {
          include: {
            user: true,
            level: true,
            badges: true,
          },
        },
        replyTo: {
          include: {
            profile: {
              include: {
                user: true,
              },
            },
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

    return this.prisma.$transaction(async (tx) => {
      const childReplies = await tx.forumReply.findMany({
        where: {
          replyToId: id,
          deletedAt: null,
        },
        select: {
          id: true,
          profileId: true,
        },
      })

      const childReplyIds = childReplies.map((r) => r.id)
      const totalDeleteCount = childReplyIds.length + 1

      if (childReplyIds.length > 0) {
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

        for (const childReply of childReplies) {
          await this.forumCounterService.updateProfileReplyCount(
            tx,
            childReply.profileId,
            -1,
          )
        }
      }

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
        await this.forumCounterService.updateSectionReplyCount(
          tx,
          topic.sectionId,
          -totalDeleteCount,
        )
      }

      await this.forumCounterService.updateProfileReplyCount(
        tx,
        reply.profileId,
        -1,
      )

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
   * @param ids 回复ID列表
   * @returns 删除结果
   */
  async batchDeleteForumReply(ids: number[]) {
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
          reply.profileId,
          -1,
        )
      }

      const result = await tx.forumReply.deleteMany({
        where: { id: { in: ids } },
      })

      return { count: result.count }
    })
  }

  /**
   * 将第三层及以上的回复扁平化到第二层
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
