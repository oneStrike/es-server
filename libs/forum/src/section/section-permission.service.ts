import type { Permission } from './section-permission.types'
import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { ForumModeratorPermissionEnum } from '../moderator/moderator.constant'

/**
 * 板块权限服务类
 * 提供版主板块权限的计算、分配、移除、检查等核心业务逻辑
 */
@Injectable()
export class ForumSectionPermissionService extends BaseService {
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
  ): Promise<ForumModeratorPermissionEnum[]> {
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

    return moderatorSection.permissions as ForumModeratorPermissionEnum[]
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
    customPermissions: ForumModeratorPermissionEnum[] = [],
  ): Promise<void> {
    await this.prisma.forumModeratorSection.upsert({
      where: {
        moderatorId_sectionId: {
          moderatorId,
          sectionId,
        },
      },
      update: {
        permissions: customPermissions,
      },
      create: {
        moderatorId,
        sectionId,
        permissions: customPermissions,
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
    return finalPermissions.includes(permission)
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
  ): Promise<ForumModeratorPermissionEnum[]> {
    return this.calculateFinalPermissions(moderatorId, sectionId)
  }
}
