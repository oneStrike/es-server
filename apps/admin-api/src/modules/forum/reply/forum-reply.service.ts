import type { ForumReplyWhereInput } from '@libs/base/database'
import { RepositoryService } from '@libs/base/database'

import { isNotNil } from '@libs/base/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateForumReplyDto,
  QueryForumReplyDto,
  UpdateForumReplyDto,
} from './dto/forum-reply.dto'

/**
 * 论坛回复服务类
 * 提供论坛回复的增删改查等核心业务逻辑
 */
@Injectable()
export class ForumReplyService extends RepositoryService {
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
      where: { userId: replyData.userId, isBanned: false },
    })

    if (!profile) {
      throw new BadRequestException('用户论坛资料不存在或已被封禁')
    }

    let replyToFloor = 0
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

      replyToFloor = replyTo.floor
    }

    const maxFloor = await this.forumReply.findFirst({
      where: { topicId },
      orderBy: { floor: 'desc' },
      select: { floor: true },
    })

    const newFloor = (maxFloor?.floor ?? 0) + 1

    return this.prisma.$transaction(async (tx) => {
      const reply = await tx.forumReply.create({
        data: {
          ...replyData,
          topicId,
          userId: profile.id,
          floor: newFloor,
          replyToId,
        },
      })

      await tx.forumTopic.update({
        where: { id: topicId },
        data: {
          replyCount: {
            increment: 1,
          },
        },
      })

      await tx.forumSection.update({
        where: { id: topic.sectionId },
        data: {
          replyCount: {
            increment: 1,
          },
        },
      })

      await tx.forumProfile.update({
        where: { id: profile.id },
        data: {
          replyCount: {
            increment: 1,
          },
        },
      })

      return reply
    })
  }

  /**
   * 分页查询论坛回复列表
   * @param queryForumReplyDto 查询条件
   * @returns 分页的回复列表
   */
  async getForumReplyPage(queryForumReplyDto: QueryForumReplyDto) {
    const { content, topicId, replyToId, ...otherDto } = queryForumReplyDto

    const where: ForumReplyWhereInput = {}

    if (isNotNil(content)) {
      where.content = {
        contains: content,
        mode: 'insensitive',
      }
    }

    if (isNotNil(topicId)) {
      where.topicId = topicId
    }

    if (isNotNil(replyToId)) {
      where.replyToId = replyToId
    }

    return this.forumReply.findPagination({
      where,
      select: {
        id: true,
        content: true,
        topicId: true,
        userId: true,
        floor: true,
        replyToId: true,
        isHidden: true,
        auditStatus: true,
        likeCount: true,
        createdAt: true,
        updatedAt: true,
        topic: {
          select: {
            id: true,
            title: true,
          },
        },
        profile: {
          select: {
            id: true,
            userId: true,
            points: true,
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                avatar: true,
              },
            },
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            floor: true,
            profile: {
              select: {
                user: {
                  select: {
                    username: true,
                    nickname: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        floor: 'asc',
      },
    })
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
   * 更新论坛回复
   * @param updateForumReplyDto 更新回复的数据
   * @returns 更新后的回复信息
   */
  async updateForumReply(updateForumReplyDto: UpdateForumReplyDto) {
    const { id, topicId, replyToId, ...updateData } = updateForumReplyDto

    const existingReply = await this.forumReply.findUnique({
      where: { id },
    })

    if (!existingReply) {
      throw new BadRequestException('论坛回复不存在')
    }

    if (isNotNil(topicId)) {
      const topic = await this.forumTopic.findUnique({
        where: { id: topicId },
      })

      if (!topic) {
        throw new BadRequestException('主题不存在')
      }
    }

    if (isNotNil(replyToId)) {
      const replyTo = await this.forumReply.findUnique({
        where: { id: replyToId },
      })

      if (!replyTo) {
        throw new BadRequestException('被回复的回复不存在')
      }
    }

    return this.forumReply.update({
      where: { id },
      data: updateData,
    })
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

    const childReplyCount = await this.forumReply.count({
      where: {
        replyToId: id,
        deletedAt: null,
      },
    })

    if (childReplyCount > 0) {
      throw new BadRequestException(
        `该回复还有 ${childReplyCount} 个子回复，无法删除`,
      )
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.forumTopic.update({
        where: { id: reply.topicId },
        data: {
          replyCount: {
            decrement: 1,
          },
        },
      })

      const topic = await tx.forumTopic.findUnique({
        where: { id: reply.topicId },
        select: { sectionId: true },
      })

      if (topic) {
        await tx.forumSection.update({
          where: { id: topic.sectionId },
          data: {
            replyCount: {
              decrement: 1,
            },
          },
        })
      }

      await tx.forumProfile.update({
        where: { id: reply.userId },
        data: {
          replyCount: {
            decrement: 1,
          },
        },
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
        await tx.forumTopic.update({
          where: { id: reply.topicId },
          data: {
            replyCount: {
              decrement: 1,
            },
          },
        })

        const topic = await tx.forumTopic.findUnique({
          where: { id: reply.topicId },
          select: { sectionId: true },
        })

        if (topic) {
          await tx.forumSection.update({
            where: { id: topic.sectionId },
            data: {
              replyCount: {
                decrement: 1,
              },
            },
          })
        }

        await tx.forumProfile.update({
          where: { id: reply.userId },
          data: {
            replyCount: {
              decrement: 1,
            },
          },
        })
      }

      const result = await tx.forumReply.deleteMany({
        where: { id: { in: ids } },
      })

      return { count: result.count }
    })
  }
}
