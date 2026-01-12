import { BaseService } from '@libs/base/database'

import { DragReorderDto, UpdateEnabledStatusDto } from '@libs/base/dto'
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

/**
 * 论坛板块分组服务类
 * 提供对论坛板块分组的增删改查等操作
 */
@Injectable()
export class ForumSectionGroupService extends BaseService {
  /**
   * 获取板块分组的 Prisma 模型
   */
  get forumSectionGroup() {
    return this.prisma.forumSectionGroup
  }

  /**
   * 获取板块的 Prisma 模型
   */
  get forumSection() {
    return this.prisma.forumSection
  }

  /**
   * 创建新的论坛板块分组
   * @param dto 创建板块分组的数据传输对象
   * @returns 创建成功的板块分组
   */
  async createForumSectionGroup(dto: CreateForumSectionGroupDto) {
    if (await this.forumSectionGroup.exists({ name: dto.name })) {
      throw new BadRequestException('板块分组名称已存在')
    }
    return this.forumSectionGroup.create({
      data: dto,
    })
  }

  /**
   * 根据ID获取论坛板块分组详情
   * @param id 板块分组ID
   * @returns 板块分组详情，包含其下的板块信息
   * @throws NotFoundException 如果板块分组不存在
   */
  async getForumSectionGroupById(id: number) {
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

  /**
   * 查询论坛板块分组列表（支持分页）
   * @param dto 查询条件的数据传输对象
   * @returns 分页后的板块分组列表
   */
  async getForumSectionGroupPage(dto: QueryForumSectionGroupDto) {
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

  /**
   * 更新论坛板块分组信息
   * @param updateForumSectionGroupDto 更新板块分组的数据传输对象
   * @returns 更新后的板块分组
   * @throws NotFoundException 如果板块分组不存在
   */
  async updateForumSectionGroup(
    updateForumSectionGroupDto: UpdateForumSectionGroupDto,
  ) {
    const { id, ...updateData } = updateForumSectionGroupDto

    if (!(await this.forumSectionGroup.exists({ id }))) {
      throw new NotFoundException('板块分组不存在')
    }

    return this.forumSectionGroup.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 删除论坛板块分组
   * @param id 板块分组ID
   * @returns 删除操作结果
   * @throws NotFoundException 如果板块分组不存在
   * @throws Error 如果板块分组下还有板块，则无法删除
   */
  async deleteForumSectionGroup(id: number) {
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

  /**
   * 交换板块分组的排序顺序
   * @param dto 拖拽重新排序的数据传输对象
   * @returns 更新后的板块分组
   * @throws NotFoundException 如果板块分组不存在
   */
  async swapSectionGroupSortOrder(dto: DragReorderDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.forumSectionGroup.swapField(
        { id: dto.dragId },
        { id: dto.targetId },
        'sortOrder',
      )
    })
  }

  /**
   * 更新论坛板块分组的启用状态
   * @param updateSectionGroupEnabledDto 更新启用状态的数据传输对象
   * @returns 更新后的板块分组
   * @throws NotFoundException 如果板块分组不存在
   */
  async updateSectionGroupEnabled(
    updateSectionGroupEnabledDto: UpdateEnabledStatusDto,
  ) {
    const { id, isEnabled } = updateSectionGroupEnabledDto

    if (!(await this.forumSectionGroup.exists({ id }))) {
      throw new NotFoundException('板块分组不存在')
    }

    return this.forumSectionGroup.update({
      where: { id },
      data: { isEnabled },
    })
  }

  /**
   * 获取所有启用状态的板块分组及其下的板块
   * @returns 启用状态的板块分组列表
   */
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
