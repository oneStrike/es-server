import { RepositoryService } from '@libs/base/database'
import { IdDto } from '@libs/base/dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { SectionPermissionService } from '../section/section-permission.service'
import {
  AssignModeratorSectionDto,
  CreateModeratorDto,
  QueryModeratorActionLogDto,
  QueryModeratorDto,
  UpdateModeratorDto,
} from './dto/moderator.dto'
import { ModeratorPermissionService } from './moderator-permission.service'
import {
  ModeratorPermissionEnum,
  ModeratorRoleTypeEnum,
} from './moderator.constant'

@Injectable()
export class ModeratorService extends RepositoryService {
  constructor(
    private readonly sectionPermissionService: SectionPermissionService,
    private readonly permissionService: ModeratorPermissionService,
  ) {
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

  get forumProfile() {
    return this.prisma.forumProfile
  }

  get forumSection() {
    return this.prisma.forumSection
  }

  get clientUser() {
    return this.prisma.clientUser
  }

  /**
   * 添加版主
   * @param dto 创建参数
   * @returns 创建结果
   */
  async createModerator(dto: CreateModeratorDto) {
    const profile = await this.forumProfile.findUnique({
      where: { userId: dto.userId },
    })

    if (!profile) {
      throw new BadRequestException('用户不存在')
    }

    const existing = await this.forumModerator.findUnique({
      where: { userId: dto.userId },
    })

    if (existing) {
      throw new BadRequestException('该用户已是版主')
    }

    if (dto.roleType === ModeratorRoleTypeEnum.SUPER) {
      // 超级版主拥有所有的权限
      dto.permissions = [
        ...Object.values(ModeratorPermissionEnum),
      ] as ModeratorPermissionEnum[]
    }

    return this.forumModerator.create({
      data: dto,
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
    const moderator = await this.forumModerator.findUnique({
      where: { id: dto.id },
    })

    if (!moderator) {
      throw new BadRequestException('版主不存在')
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
  async assignModeratorSection(assignDto: AssignModeratorSectionDto) {
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
  async getModeratorPage(queryDto: QueryModeratorDto) {
    const { username, isEnabled, sectionId } = queryDto

    const where: any = {
      deletedAt: null,
    }

    if (username) {
      where.profile = {
        user: {
          username: {
            contains: username,
            mode: 'insensitive',
          },
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

    const result = await this.forumModerator.findPagination({
      where: {
        ...where,
      },
      include: {
        profile: true,
      },
    })

    const list = result.list.map((moderator) => {
      const permissions = moderator.permissions as ModeratorPermissionEnum[]

      const permissionNames =
        this.permissionService.getPermissionNames(permissions)

      return {
        id: moderator.id,
        userId: moderator.userId,
        username: moderator.profile.user.username,
        nickname: moderator.profile.nickname,
        avatar: moderator.profile.user.avatar,
        permissions,
        permissionNames,
        isEnabled: moderator.isEnabled,
        remark: moderator.remark,
        sections: moderator.sections.map((ms) => ({
          id: ms.section.id,
          name: ms.section.name,
          customPermissions: ms.customPermissions as ModeratorPermissionEnum[],
          finalPermissions: ms.finalPermissions as ModeratorPermissionEnum[],
        })),
        createdAt: moderator.createdAt,
      }
    })

    return {
      ...result,
      list,
    }
  }

  /**
   * 更新版主信息
   * @param updateDto 更新参数
   * @returns 更新结果
   */
  async updateModerator(updateDto: UpdateModeratorDto) {
    const { id, permissions, isEnabled, remark } = updateDto

    const moderator = await this.forumModerator.findUnique({
      where: { id },
    })

    if (!moderator) {
      throw new BadRequestException('版主不存在')
    }

    const updateData: any = {}

    if (permissions) {
      updateData.permissions = permissions
    }

    if (typeof isEnabled === 'boolean') {
      updateData.isEnabled = isEnabled
    }

    if (remark !== undefined) {
      updateData.remark = remark
    }

    return this.forumModerator.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 查看版主操作日志
   * @param queryDto 查询参数
   * @returns 操作日志列表
   */
  async getModeratorActionLogPage(queryDto: QueryModeratorActionLogDto) {
    const {
      moderatorId,
      actionType,
      startTime,
      endTime,
      page = 1,
      pageSize = 20,
    } = queryDto

    const where: any = {}

    if (moderatorId) {
      where.moderatorId = moderatorId
    }

    if (actionType) {
      where.actionType = actionType
    }

    if (startTime || endTime) {
      where.createdAt = {}
      if (startTime) {
        where.createdAt.gte = new Date(startTime)
      }
      if (endTime) {
        where.createdAt.lte = new Date(endTime)
      }
    }

    const result = await this.forumAuditLog.findPagination({
      where,
      include: {
        moderator: {
          include: {
            profile: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      page,
      pageSize,
    })

    const list = result.list.map((log) => ({
      id: log.id,
      moderatorId: log.moderatorId,
      moderatorUsername: log.moderator.profile.user.username,
      actionType: log.actionType,
      actionDescription: log.actionDescription,
      targetType: log.targetType,
      targetId: log.targetId,
      beforeData: log.beforeData,
      afterData: log.afterData,
      createdAt: log.createdAt,
    }))

    return {
      ...result,
      list,
    }
  }
}
