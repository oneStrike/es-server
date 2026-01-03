import type { ForumSectionWhereInput } from '@libs/base/database'
import { RepositoryService } from '@libs/base/database'

import { BadRequestException, Injectable } from '@nestjs/common'
import { QueryForumSectionDto } from './dto/forum-section.dto'

/**
 * 客户端论坛板块服务类
 * 提供客户端论坛板块查询业务逻辑
 */
@Injectable()
export class ForumSectionService extends RepositoryService {
  get forumSection() {
    return this.prisma.forumSection
  }

  /**
   * 分页查询论坛板块列表
   * @param queryForumSectionDto 查询条件
   * @returns 分页的板块列表
   */
  async getForumSectionPage(queryForumSectionDto: QueryForumSectionDto) {
    const { name, ...otherDto } = queryForumSectionDto

    const where: ForumSectionWhereInput = {
      isEnabled: true,
    }

    if (name) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      }
    }

    return this.forumSection.findPagination({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        sortOrder: true,
        topicCount: true,
        replyCount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })
  }

  /**
   * 获取论坛板块详情
   * @param id 板块ID
   * @returns 板块详情信息
   */
  async getForumSectionDetail(id: number) {
    const section = await this.forumSection.findUnique({
      where: { id },
    })

    if (!section) {
      throw new BadRequestException('论坛板块不存在')
    }

    if (!section.isEnabled) {
      throw new BadRequestException('论坛板块已禁用')
    }

    return section
  }
}
