import { PlatformService } from '@libs/platform/database'
import { DragReorderDto, UpdateEnabledStatusDto } from '@libs/platform/dto'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  CreateForumSectionGroupDto,
  QueryForumSectionGroupDto,
  UpdateForumSectionGroupDto,
} from './dto/forum-section-group.dto'

@Injectable()
export class ForumSectionGroupService extends PlatformService {
  get forumSectionGroup() {
    return this.prisma.forumSectionGroup
  }

  get forumSection() {
    return this.prisma.forumSection
  }

  async createSectionGroup(dto: CreateForumSectionGroupDto) {
    try {
      return await this.forumSectionGroup.create({
        data: dto,
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('板块分组名称已存在')
        },
      })
    }
  }

  async getSectionGroupById(id: number) {
    const group = await this.forumSectionGroup.findUnique({
      where: { id },
      omit: {
        deletedAt: true,
      },
    })

    if (!group) {
      throw new NotFoundException('板块分组不存在')
    }
    return group
  }

  async getSectionGroupPage(dto: QueryForumSectionGroupDto) {
    return this.forumSectionGroup.findPagination({
      where: {
        deletedAt: null,
        ...dto,
        isEnabled: dto.isEnabled,
        name: {
          contains: dto.name,
        },
      },
      orderBy: {
        sortOrder: dto.orderBy ? undefined : 'desc',
      },
      omit: {
        deletedAt: true,
      },
    })
  }

  async updateSectionGroup(updateSectionGroupDto: UpdateForumSectionGroupDto) {
    const { id, ...updateData } = updateSectionGroupDto

    try {
      return await this.forumSectionGroup.update({
        where: { id },
        data: updateData,
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('板块分组名称已存在')
        },
        P2025: () => {
          throw new NotFoundException('板块分组不存在')
        },
      })
    }
  }

  async deleteSectionGroup(id: number) {
    const group = await this.forumSectionGroup.findUnique({
      where: { id },
      include: {
        sections: {
          where: {
            deletedAt: null,
          },
        },
      },
    })

    if (!group) {
      throw new NotFoundException('板块分组不存在')
    }

    if (group.sections.length > 0) {
      throw new Error('该分组下还有板块，无法删除')
    }

    return this.forumSectionGroup.delete({
      where: { id },
    })
  }

  async swapSectionGroupSortOrder(dto: DragReorderDto) {
    return this.forumSectionGroup.swapField({
      where: [{ id: dto.dragId }, { id: dto.targetId }],
    })
  }

  async updateSectionGroupEnabled(
    updateSectionGroupEnabledDto: UpdateEnabledStatusDto,
  ) {
    const { id, isEnabled } = updateSectionGroupEnabledDto

    try {
      return await this.forumSectionGroup.update({
        where: { id },
        data: { isEnabled },
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2025: () => {
          throw new NotFoundException('板块分组不存在')
        },
      })
    }
  }

  async getAllEnabledGroups() {
    return this.forumSectionGroup.findMany({
      where: {
        isEnabled: true,
      },
      include: {
        sections: {
          where: {
            isEnabled: true,
            deletedAt: null,
          },
          orderBy: {
            sortOrder: 'asc',
          },
          select: {
            id: true,
            name: true,
            description: true,
            sortOrder: true,
            _count: {
              select: {
                topics: true,
              },
            },
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })
  }
}
