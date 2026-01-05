import { RepositoryService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ModeratorPermissionEnum } from '../moderator.constant'
import {
  addPermission,
  AssignModeratorSectionDto,
  CreateModeratorDto,
  QueryModeratorActionLogDto,
  QueryModeratorDto,
  RemoveModeratorDto,
  UpdateModeratorDto,
} from './dto/moderator.dto'
import { SectionPermissionService } from '../../forum/section/section-permission.service'

@Injectable()
export class ModeratorService extends RepositoryService {
  private readonly sectionPermissionService: SectionPermissionService

  constructor(sectionPermissionService: SectionPermissionService) {
    super()
    this.sectionPermissionService = sectionPermissionService
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
   * @param createDto 创建参数
   * @returns 创建结果
   */
  async createModerator(createDto: CreateModeratorDto) {
    const { userId, permissions, isEnabled = true, remark } = createDto

    const profile = await this.forumProfile.findUnique({
      where: { userId },
    })

    if (!profile) {
      throw new BadRequestException('用户不存在')
    }

    const existing = await this.forumModerator.findUnique({
      where: { userId },
    })

    if (existing) {
      throw new BadRequestException('该用户已是版主')
    }

    let permissionMask = 0
    permissions.forEach((permission) => {
      permissionMask = addPermission(permissionMask, permission)
    })

    return this.forumModerator.create({
      data: {
        userId,
        permissionMask,
        isEnabled,
        remark,
      },
    })
  }

  /**
   * 移除版主
   * @param removeDto 移除参数
   * @returns 移除结果
   */
  async removeModerator(removeDto: RemoveModeratorDto) {
    const { id } = removeDto

    const moderator = await this.forumModerator.findUnique({
      where: { id },
    })

    if (!moderator) {
      throw new BadRequestException('版主不存在')
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.forumModeratorSection.deleteMany({
        where: { moderatorId: id },
      })

      await tx.forumModerator.softDelete({ id })
    })
  }

  /**
   * 分配版主管理的板块
   * @param assignDto 分配参数
   * @returns 分配结果
   */
  async assignModeratorSection(assignDto: AssignModeratorSectionDto) {
    const { moderatorId, sectionIds, inheritFromParent = true, customPermissionMask = 0 } = assignDto

    const moderator = await this.forumModerator.findUnique({
      where: { id: moderatorId },
    })

    if (!moderator) {
      throw new BadRequestException('版主不存在')
    }

    for (const sectionId of sectionIds) {
      const section = await this.forumSection.findUnique({
        where: { id: sectionId },
      })

      if (!section) {
        throw new BadRequestException(`板块ID ${sectionId} 不存在`)
      }
    }

    for (const sectionId of sectionIds) {
      await this.sectionPermissionService.assignModeratorToSection(
        moderatorId,
        sectionId,
        inheritFromParent,
        customPermissionMask,
      )
    }
  }

  /**
   * 查看版主列表
   * @param queryDto 查询参数
   * @returns 版主列表
   */
  async getModeratorPage(queryDto: QueryModeratorDto) {
    const {
      userId,
      username,
      isEnabled,
      sectionId,
      page = 1,
      pageSize = 20,
    } = queryDto

    const where: any = {
      deletedAt: null,
    }

    if (userId) {
      where.userId = userId
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

    if (typeof isEnabled === 'boolean') {
      where.isEnabled = isEnabled
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
        profile: {
          include: {
            user: true,
          },
        },
        sections: {
          include: {
            section: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      page,
      pageSize,
    })

    const list = result.list.map((moderator) => {
      const permissions: ModeratorPermissionEnum[] = []
      const permissionNames: string[] = []

      Object.values(ModeratorPermissionEnum).forEach((value) => {
        if (typeof value === 'number') {
          if ((moderator.permissionMask & value) === value) {
            permissions.push(value)
          }
        }
      })

      permissions.forEach((permission) => {
        const permissionName = Object.entries(ModeratorPermissionEnum).find(
          ([key, val]) => val === permission,
        )?.[0]
        if (permissionName) {
          permissionNames.push(permissionName)
        }
      })

      return {
        id: moderator.id,
        userId: moderator.userId,
        username: moderator.profile.user.username,
        nickname: moderator.profile.nickname,
        avatar: moderator.profile.avatar,
        permissions,
        permissionNames,
        isEnabled: moderator.isEnabled,
        remark: moderator.remark,
        sections: moderator.sections.map((ms) => ({
          id: ms.section.id,
          name: ms.section.name,
          inheritFromParent: ms.inheritFromParent,
          customPermissionMask: ms.customPermissionMask,
          finalPermissionMask: ms.finalPermissionMask,
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
      let permissionMask = 0
      permissions.forEach((permission) => {
        permissionMask = addPermission(permissionMask, permission)
      })
      updateData.permissionMask = permissionMask
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
