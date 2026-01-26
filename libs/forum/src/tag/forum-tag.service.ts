import { BaseService } from '@libs/base/database'

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  AssignForumTagToTopicDto,
  CreateForumTagDto,
  QueryForumTagDto,
  RemoveForumTagFromTopicDto,
  UpdateForumTagDto,
} from './dto/forum-tag.dto'

/**
 * 论坛标签服务类
 * 提供对论坛标签的增删改查、标签与主题的关联管理等操作
 */
@Injectable()
export class ForumTagService extends BaseService {
  /**
   * 获取标签的 Prisma 模型
   */
  get forumTag() {
    return this.prisma.forumTag
  }

  /**
   * 获取主题的 Prisma 模型
   */
  get forumTopic() {
    return this.prisma.forumTopic
  }

  /**
   * 获取主题标签关联的 Prisma 模型
   */
  get forumTopicTag() {
    return this.prisma.forumTopicTag
  }

  /**
   * 创建新的论坛标签
   * @param createForumTagDto 创建标签的数据传输对象
   * @returns 创建成功的标签
   * @throws BadRequestException 如果标签名称已存在
   */
  async createTag(createForumTagDto: CreateForumTagDto) {
    const { name, ...tagData } = createForumTagDto

    const existingTag = await this.forumTag.findFirst({
      where: {
        name,
      },
    })

    if (existingTag) {
      throw new BadRequestException('该标签名称已存在')
    }

    const tag = await this.forumTag.create({
      data: {
        ...tagData,
        name,
      },
    })

    return tag
  }

  /**
   * 查询论坛标签列表（支持分页）
   * @param queryForumTagDto 查询条件的数据传输对象
   * @returns 分页后的标签列表
   */
  async getTags(queryForumTagDto: QueryForumTagDto) {
    const { name, isEnabled } = queryForumTagDto

    const where: any = {}

    if (name) {
      where.name = {
        contains: name,
      }
    }

    if (isEnabled !== undefined) {
      where.isEnabled = isEnabled
    }

    return this.forumTag.findPagination({
      where,
      include: {
        _count: {
          select: {
            topicTags: true,
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })
  }

  /**
   * 根据ID获取论坛标签详情
   * @param id 标签ID
   * @returns 标签详情，包含最近使用该标签的主题
   * @throws NotFoundException 如果标签不存在
   */
  async getTagById(id: number) {
    const tag = await this.forumTag.findUnique({
      where: { id },
      include: {
        topicTags: {
          where: {
            topic: {
              deletedAt: null,
            },
          },
          include: {
            topic: {
              select: {
                id: true,
                title: true,
                createdAt: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
      },
    })

    if (!tag) {
      throw new NotFoundException('标签不存在')
    }

    return {
      ...tag,
      topics: tag.topicTags.map((item) => item.topic),
    }
  }

  /**
   * 更新论坛标签信息
   * @param updateForumTagDto 更新标签的数据传输对象
   * @returns 更新后的标签
   * @throws NotFoundException 如果标签不存在
   * @throws BadRequestException 如果标签名称已存在
   */
  async updateTag(updateForumTagDto: UpdateForumTagDto) {
    const { id, name, ...updateData } = updateForumTagDto

    const tag = await this.forumTag.findUnique({
      where: { id },
    })

    if (!tag) {
      throw new NotFoundException('标签不存在')
    }

    if (name) {
      const existingTag = await this.forumTag.findFirst({
        where: {
          name,
          id: {
            not: id,
          },
        },
      })

      if (existingTag) {
        throw new BadRequestException('该标签名称已存在')
      }
    }

    const updatedTag = await this.forumTag.update({
      where: { id },
      data: updateData,
    })

    return updatedTag
  }

  /**
   * 删除论坛标签
   * @param id 标签ID
   * @returns 删除操作结果
   * @throws NotFoundException 如果标签不存在
   * @throws BadRequestException 如果标签已被使用
   */
  async deleteTag(id: number) {
    const tag = await this.forumTag.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            topicTags: true,
          },
        },
      },
    })

    if (!tag) {
      throw new NotFoundException('标签不存在')
    }

    if (tag._count.topicTags > 0) {
      throw new BadRequestException('该标签已被使用，无法删除')
    }

    await this.forumTag.delete({
      where: { id },
    })

    return { success: true }
  }

  /**
   * 为主题分配标签
   * @param assignTagToTopicDto 分配标签的数据传输对象
   * @returns 创建的主题标签关联
   * @throws NotFoundException 如果主题或标签不存在
   * @throws BadRequestException 如果标签未启用或已关联
   */
  async assignTagToTopic(assignTagToTopicDto: AssignForumTagToTopicDto) {
    const { topicId, tagId } = assignTagToTopicDto

    const topic = await this.forumTopic.findUnique({
      where: { id: topicId, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const tag = await this.forumTag.findUnique({
      where: { id: tagId },
    })

    if (!tag) {
      throw new NotFoundException('标签不存在')
    }

    if (!tag.isEnabled) {
      throw new BadRequestException('该标签未启用')
    }

    const existingRelation = await this.forumTopicTag.findUnique({
      where: {
        topicId_tagId: {
          topicId,
          tagId,
        },
      },
    })

    if (existingRelation) {
      throw new BadRequestException('该主题已关联此标签')
    }

    return this.prisma.$transaction(async (tx) => {
      const topicTag = await tx.forumTopicTag.create({
        data: {
          topicId,
          tagId,
        },
      })

      await tx.forumTag.update({
        where: { id: tagId },
        data: {
          useCount: {
            increment: 1,
          },
        },
      })

      return topicTag
    })
  }

  /**
   * 从主题移除标签
   * @param removeTagFromTopicDto 移除标签的数据传输对象
   * @returns 移除操作结果
   * @throws NotFoundException 如果主题未关联该标签
   */
  async removeTagFromTopic(removeTagFromTopicDto: RemoveForumTagFromTopicDto) {
    const { topicId, tagId } = removeTagFromTopicDto

    const topicTag = await this.forumTopicTag.findUnique({
      where: {
        topicId_tagId: {
          topicId,
          tagId,
        },
      },
    })

    if (!topicTag) {
      throw new NotFoundException('该主题未关联此标签')
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.forumTopicTag.delete({
        where: {
          topicId_tagId: {
            topicId,
            tagId,
          },
        },
      })

      await tx.forumTag.update({
        where: { id: tagId },
        data: {
          useCount: {
            decrement: 1,
          },
        },
      })

      return { success: true }
    })
  }

  /**
   * 获取主题的所有标签
   * @param topicId 主题ID
   * @returns 主题关联的标签列表
   * @throws NotFoundException 如果主题不存在
   */
  async getTopicTags(topicId: number) {
    const topic = await this.forumTopic.findUnique({
      where: { id: topicId, deletedAt: null },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    const topicTags = await this.forumTopicTag.findMany({
      where: {
        topicId,
      },
      include: {
        tag: true,
      },
      orderBy: {
        tag: {
          sortOrder: 'asc',
        },
      },
    })

    return topicTags.map((item) => item.tag)
  }

  /**
   * 获取热门标签
   * @param limit 返回的标签数量，默认为10
   * @returns 热门标签列表，按使用次数降序排列
   */
  async getPopularTags(limit = 10) {
    return this.forumTag.findMany({
      where: {
        isEnabled: true,
      },
      orderBy: {
        useCount: 'desc',
      },
      take: limit,
    })
  }

  /**
   * 获取启用的标签列表
   * @returns 启用的标签列表，按排序值升序排列
   */
  async getEnabledTags() {
    return this.forumTag.findMany({
      where: {
        isEnabled: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })
  }
}
