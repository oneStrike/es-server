import type {
  ForumTopicCreateInput,
  ForumTopicUpdateInput,
  ForumTopicWhereInput,
} from '@libs/base/database'
import { RepositoryService } from '@libs/base/database'

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PointService } from '../point/point.service'
import {
  CreateForumTopicDto,
  QueryForumTopicDto,
  UpdateForumTopicDto,
  UpdateTopicAuditStatusDto,
  UpdateTopicFeaturedDto,
  UpdateTopicHiddenDto,
  UpdateTopicLockedDto,
  UpdateTopicPinnedDto,
} from './dto/forum-topic.dto'
import { ForumTopicAuditStatusEnum } from './forum-topic.constant'

@Injectable()
export class ForumTopicService extends RepositoryService {
  constructor(private readonly pointService: PointService) {
    super()
  }

  get forumTopic() {
    return this.prisma.forumTopic
  }

  get forumSection() {
    return this.prisma.forumSection
  }

  get forumProfile() {
    return this.prisma.forumProfile
  }

  async createForumTopic(createForumTopicDto: CreateForumTopicDto) {
    const { sectionId, profileId, ...topicData } = createForumTopicDto

    const section = await this.forumSection.findUnique({
      where: { id: sectionId },
    })

    if (!section) {
      throw new BadRequestException('板块不存在')
    }

    if (!section.isEnabled) {
      throw new BadRequestException('板块已禁用')
    }

    const profile = await this.forumProfile.findFirst({
      where: { id: profileId, status: 1 },
      include: {
        user: true,
      },
    })

    if (!profile) {
      throw new BadRequestException('用户论坛资料不存在或已被封禁')
    }

    const createPayload: ForumTopicCreateInput = {
      ...topicData,
      section: {
        connect: { id: sectionId },
      },
      user: {
        connect: { id: profileId },
      },
      viewCount: 0,
      replyCount: 0,
      likeCount: 0,
      auditStatus: ForumTopicAuditStatusEnum.APPROVED,
    }

    const topic = await this.forumTopic.create({
      data: createPayload,
      include: {
        section: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    })

    await this.pointService.addPoint(profile.userId, 'CREATE_TOPIC', topic.id)

    return topic
  }

  async getForumTopicById(id: number) {
    const topic = await this.forumTopic.findUnique({
      where: { id, deletedAt: null },
      include: {
        section: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            level: true,
          },
        },
        topicTags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            replies: true,
            likes: true,
          },
        },
      },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    return topic
  }

  async getForumTopics(queryForumTopicDto: QueryForumTopicDto) {
    const {
      keyword,
      sectionId,
      profileId,
      isPinned,
      isFeatured,
      isLocked,
      isHidden,
      auditStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      pageIndex = 0,
      pageSize = 15,
    } = queryForumTopicDto

    const where: ForumTopicWhereInput = {
      deletedAt: null,
    }

    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { content: { contains: keyword } },
      ]
    }

    if (sectionId) {
      where.sectionId = sectionId
    }

    if (profileId) {
      where.profileId = profileId
    }

    if (isPinned !== undefined) {
      where.isPinned = isPinned
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured
    }

    if (isLocked !== undefined) {
      where.isLocked = isLocked
    }

    if (isHidden !== undefined) {
      where.isHidden = isHidden
    }

    if (auditStatus !== undefined) {
      where.auditStatus = auditStatus
    }

    const orderBy = {
      [sortBy]: sortOrder,
    }

    return this.forumTopic.findPagination({
      where,
      include: {
        section: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
        topicTags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            replies: true,
            likes: true,
          },
        },
      },
      orderBy,
      pageIndex,
      pageSize,
    })
  }

  async updateForumTopic(updateForumTopicDto: UpdateForumTopicDto) {
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

    const updatePayload: ForumTopicUpdateInput = {
      ...updateData,
    }

    const updatedTopic = await this.forumTopic.update({
      where: { id },
      data: updatePayload,
      include: {
        section: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            nickname: true,
          },
        },
      },
    })

    return updatedTopic
  }

  async deleteForumTopic(id: number) {
    const topic = await this.forumTopic.findUnique({
      where: { id, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    await this.prisma.$transaction([
      this.prisma.forumReply.updateMany({
        where: { topicId: id },
        data: { deletedAt: new Date() },
      }),
      this.prisma.forumTopic.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    ])

    return { success: true }
  }

  async updateTopicPinned(updateTopicPinnedDto: UpdateTopicPinnedDto) {
    const { id, isPinned } = updateTopicPinnedDto

    const topic = await this.forumTopic.findUnique({
      where: { id, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const updatedTopic = await this.forumTopic.update({
      where: { id },
      data: { isPinned },
    })

    return updatedTopic
  }

  async updateTopicFeatured(updateTopicFeaturedDto: UpdateTopicFeaturedDto) {
    const { id, isFeatured } = updateTopicFeaturedDto

    const topic = await this.forumTopic.findUnique({
      where: { id, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const updatedTopic = await this.forumTopic.update({
      where: { id },
      data: { isFeatured },
    })

    return updatedTopic
  }

  async updateTopicLocked(updateTopicLockedDto: UpdateTopicLockedDto) {
    const { id, isLocked } = updateTopicLockedDto

    const topic = await this.forumTopic.findUnique({
      where: { id, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const updatedTopic = await this.forumTopic.update({
      where: { id },
      data: { isLocked },
    })

    return updatedTopic
  }

  async updateTopicHidden(updateTopicHiddenDto: UpdateTopicHiddenDto) {
    const { id, isHidden } = updateTopicHiddenDto

    const topic = await this.forumTopic.findUnique({
      where: { id, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const updatedTopic = await this.forumTopic.update({
      where: { id },
      data: { isHidden },
    })

    return updatedTopic
  }

  async updateTopicAuditStatus(updateTopicAuditStatusDto: UpdateTopicAuditStatusDto) {
    const { id, auditStatus, auditReason } = updateTopicAuditStatusDto

    const topic = await this.forumTopic.findUnique({
      where: { id, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const updatedTopic = await this.forumTopic.update({
      where: { id },
      data: {
        auditStatus,
        auditReason,
      },
    })

    return updatedTopic
  }

  async incrementViewCount(id: number) {
    const topic = await this.forumTopic.findUnique({
      where: { id, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const updatedTopic = await this.forumTopic.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })

    return updatedTopic
  }

  async incrementReplyCount(id: number, replyProfileId: number, replyNickname: string) {
    const topic = await this.forumTopic.findUnique({
      where: { id, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const updatedTopic = await this.forumTopic.update({
      where: { id },
      data: {
        replyCount: {
          increment: 1,
        },
        lastReplyProfileId: replyProfileId,
        lastReplyNickname: replyNickname,
        lastReplyAt: Date.now(),
      },
    })

    return updatedTopic
  }

  async incrementLikeCount(id: number) {
    const topic = await this.forumTopic.findUnique({
      where: { id, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const updatedTopic = await this.forumTopic.update({
      where: { id },
      data: {
        likeCount: {
          increment: 1,
        },
      },
    })

    return updatedTopic
  }

  async decrementLikeCount(id: number) {
    const topic = await this.forumTopic.findUnique({
      where: { id, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const updatedTopic = await this.forumTopic.update({
      where: { id },
      data: {
        likeCount: {
          decrement: 1,
        },
      },
    })

    return updatedTopic
  }
}
