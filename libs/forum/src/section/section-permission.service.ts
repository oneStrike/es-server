import { RepositoryService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { ModeratorPermissionEnum } from '../moderator/moderator.constant'

export type Permission = ModeratorPermissionEnum

/**
 * 板块权限服务类
 * 提供版主板块权限的计算、分配、移除、检查等核心业务逻辑
 */
@Injectable()
export class SectionPermissionService extends RepositoryService {
  constructor() {
    super()
  }

  /**
   * 计算版主在指定板块的最终权限
   * @param moderatorId - 版主ID
   * @param sectionId - 板块ID
   * @returns 版主在该板块的权限列表
   */
  async calculateFinalPermissions(
    moderatorId: number,
    sectionId: number,
  ): Promise<ModeratorPermissionEnum[]> {
    const moderatorSection = await this.prisma.forumModeratorSection.findUnique(
      {
        where: {
          moderatorId_sectionId: {
            moderatorId,
            sectionId,
          },
        },
      },
    )

    if (!moderatorSection) {
      return []
    }

    return moderatorSection.finalPermissions as ModeratorPermissionEnum[]
  }

  /**
   * 分配版主到指定板块并设置权限
   * @param moderatorId - 版主ID
   * @param sectionId - 板块ID
   * @param customPermissions - 自定义权限列表，默认为空数组
   */
  async assignModeratorToSection(
    moderatorId: number,
    sectionId: number,
    customPermissions: ModeratorPermissionEnum[] = [],
  ): Promise<void> {
    const finalPermissions = customPermissions

    await this.prisma.forumModeratorSection.upsert({
      where: {
        moderatorId_sectionId: {
          moderatorId,
          sectionId,
        },
      },
      update: {
        customPermissions,
        finalPermissions,
      },
      create: {
        moderatorId,
        sectionId,
        customPermissions,
        finalPermissions,
      },
    })
  }

  /**
   * 移除版主在指定板块的权限
   * @param moderatorId - 版主ID
   * @param sectionId - 板块ID
   */
  async removeModeratorFromSection(
    moderatorId: number,
    sectionId: number,
  ): Promise<void> {
    await this.prisma.forumModeratorSection.delete({
      where: {
        moderatorId_sectionId: {
          moderatorId,
          sectionId,
        },
      },
    })
  }

  /**
   * 检查版主在指定板块是否拥有特定权限
   * @param moderatorId - 版主ID
   * @param sectionId - 板块ID
   * @param permission - 要检查的权限
   * @returns 是否拥有该权限
   */
  async checkPermission(
    moderatorId: number,
    sectionId: number,
    permission: Permission,
  ): Promise<boolean> {
    const finalPermissions = await this.calculateFinalPermissions(
      moderatorId,
      sectionId,
    )
    return this.permissionService.hasPermission(finalPermissions, permission)
  }

  /**
   * 获取版主在指定板块的权限列表
   * @param moderatorId - 版主ID
   * @param sectionId - 板块ID
   * @returns 权限列表
   */
  async getModeratorSectionsWithPermission(
    moderatorId: number,
    sectionId: number,
  ): Promise<ModeratorPermissionEnum[]> {
    return this.calculateFinalPermissions(moderatorId, sectionId)
  }
}
