import { BaseService, ForumModeratorWhereInput } from '@libs/base/database'
import { IdDto } from '@libs/base/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  AssignForumModeratorSectionDto,
  CreateForumModeratorDto,
  QueryForumModeratorDto,
  UpdateForumModeratorDto,
} from './dto/moderator.dto'
import {
  ForumModeratorPermissionEnum,
  ForumModeratorRoleTypeEnum,
} from './moderator.constant'

/**
 * 论坛版主服务类
 * 提供论坛版主的增删改查、板块分配、权限管理等核心业务逻辑
 */
@Injectable()
export class ForumModeratorService extends BaseService {
  constructor() {
    super()
  }

  get forumModerator() {
    return this.prisma.forumModerator
  }

  get forumModeratorSection() {
    return this.prisma.forumModeratorSection
  }

  get forumModeratorActionLog() {
    return this.prisma.forumModeratorActionLog
  }

  // get forumProfile() {
  //   return this.prisma.forumProfile
  // }

  get forumSection() {
    return this.prisma.forumSection
  }

  get appUser() {
    return this.prisma.appUser
  }

  /**
   * 添加版主
   * @param dto 创建参数
   * @returns 创建结果
   */
  async createModerator(dto: CreateForumModeratorDto) {
    if (!(await this.appUser.exists({ id: dto.userId }))) {
      throw new BadRequestException(`ID【${dto.userId}】数据不存在`)
    }

    const existing = await this.forumModerator.findUnique({
      where: { userId: dto.userId },
    })

    if (existing) {
      throw new BadRequestException('该用户已是版主')
    }

    if (dto.roleType === ForumModeratorRoleTypeEnum.SUPER) {
      // 超级版主拥有所有的权限
      dto.permissions = [
        ...Object.values(ForumModeratorPermissionEnum),
      ] as ForumModeratorPermissionEnum[]
    }

    const { sectionIds, ...moderatorData } = dto

    return this.forumModerator.create({
      data: moderatorData as any,
      select: {
        id: true,
      },
    })
  }

  /**
   * 移除版主
   * @param dto 移除参数
   * @returns 移除结果
   */
  async removeModerator(dto: IdDto) {
    if (!(await this.forumModerator.exists({ id: dto.id }))) {
      throw new BadRequestException(`ID【${dto.id}】数据不存在`)
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.forumModeratorSection.deleteMany({
        where: { moderatorId: dto.id },
      })

      await tx.forumModerator.softDelete({ id: dto.id })
    })

    return { id: dto.id }
  }

  /**
   * 分配版主管理的板块
   * @param assignDto 分配参数
   * @returns 分配结果
   */
  async assignModeratorSection(assignDto: AssignForumModeratorSectionDto) {
    const { moderatorId, sectionIds, permissions = [] } = assignDto

    const uniqueSectionIds = [...new Set(sectionIds)]

    if (!(await this.forumModerator.exists({ id: moderatorId }))) {
      throw new BadRequestException('版主不存在')
    }

    const sections = await this.forumSection.findMany({
      where: { id: { in: uniqueSectionIds } },
      select: { id: true },
    })

    const existingSectionIds = sections.map((s) => s.id)
    const missingSectionIds = uniqueSectionIds.filter(
      (id) => !existingSectionIds.includes(id),
    )

    if (missingSectionIds.length > 0) {
      throw new BadRequestException(
        `板块ID不存在: ${missingSectionIds.join(', ')}`,
      )
    }

    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        uniqueSectionIds.map(async (sectionId) =>
          tx.forumModeratorSection.upsert({
            where: {
              moderatorId_sectionId: {
                moderatorId,
                sectionId,
              },
            },
            update: {
              permissions,
            },
            create: {
              moderatorId,
              sectionId,
              permissions,
            },
          }),
        ),
      )
    })

    return { moderatorId }
  }

  /**
   * 查看版主列表
   * @param queryDto 查询参数
   * @returns 版主列表
   */
  async getModeratorPage(queryDto: QueryForumModeratorDto) {
    const { nickname, sectionId } = queryDto

    const where: ForumModeratorWhereInput = {
      deletedAt: null,
    }

    if (nickname) {
      where.user = {
        nickname: {
          contains: nickname,
          mode: 'insensitive',
        },
      }
    }

    if (sectionId) {
      where.sections = {
        some: {
          sectionId,
        },
      }
    }

    return this.forumModerator.findPagination({
      where,
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    })
  }

  /**
   * 更新版主信息
   * @param updateDto 更新参数
   * @returns 更新结果
   */
  async updateModerator(updateDto: UpdateForumModeratorDto) {
    const { id, ...updateData } = updateDto

    const moderator = await this.forumModerator.findUnique({
      where: { id },
    })

    if (!moderator) {
      throw new BadRequestException('版主不存在')
    }

    return this.forumModerator.update({
      where: { id },
      data: updateData,
    })
  }
}
