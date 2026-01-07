import { RepositoryService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import {
  ModeratorPermissionEnum,
  ModeratorPermissionNames,
  ModeratorRoleTypeEnum,
} from './moderator.constant'

/**
 * 版主权限服务
 * 负责管理论坛版主的权限，包括权限的添加、删除、合并和验证
 */
@Injectable()
export class ModeratorPermissionService extends RepositoryService {
  constructor() {
    super()
  }

  /** 获取版主数据库模型 */
  get forumModerator() {
    return this.prisma.forumModerator
  }

  /** 获取版主板块关联数据库模型 */
  get forumModeratorSection() {
    return this.prisma.forumModeratorSection
  }

  /** 获取板块数据库模型 */
  get forumSection() {
    return this.prisma.forumSection
  }

  /** 获取板块分组数据库模型 */
  get forumSectionGroup() {
    return this.prisma.forumSectionGroup
  }

  /**
   * 检查版主是否拥有指定权限
   * @param id 版主ID
   * @param permission 权限枚举
   * @param sectionId 板块ID（可选）
   * @returns 是否拥有该权限
   */
  async hasPermission(
    id: number,
    permission: ModeratorPermissionEnum,
    sectionId?: number,
  ) {
    const moderator = await this.forumModerator.findUnique({
      where: {
        id,
      },
      include: {
        sections: true,
      },
    })
    if (!moderator) {
      return false
    }

    const permissions = await this.calculatePermissions(moderator, sectionId)
    return permissions.includes(permission)
  }

  /**
   * 为版主添加权限
   * @param id 版主ID
   * @param permission 权限枚举
   * @param sectionId 板块ID（可选），如果指定则添加到板块权限
   * @returns 更新后的权限数组
   */
  async addPermission(
    id: number,
    permission: ModeratorPermissionEnum,
    sectionId?: number,
  ) {
    const moderator = await this.forumModerator.findUnique({
      where: {
        id,
      },
      include: {
        sections: true,
      },
    })
    if (!moderator) {
      throw new Error('版主不存在')
    }

    if (sectionId) {
      const sectionRelation = moderator.sections.find(
        (s) => s.sectionId === sectionId,
      )
      if (!sectionRelation) {
        throw new Error('版主未管理该板块')
      }
      if (sectionRelation.permissions.includes(permission)) {
        return sectionRelation.permissions
      }
      const updated = await this.forumModeratorSection.update({
        where: {
          id: sectionRelation.id,
        },
        data: {
          permissions: [...sectionRelation.permissions, permission],
        },
      })
      return updated.permissions
    }

    if (moderator.permissions.includes(permission)) {
      return moderator.permissions
    }
    const updated = await this.forumModerator.update({
      where: {
        id,
      },
      data: {
        permissions: [...moderator.permissions, permission],
      },
    })
    await this.updateAllFinalPermissions(moderator.id)
    return updated.permissions
  }

  /**
   * 移除版主的权限
   * @param id 版主ID
   * @param permission 权限枚举
   * @param sectionId 板块ID（可选），如果指定则从板块权限中移除
   * @returns 更新后的权限数组
   */
  async removePermission(
    id: number,
    permission: ModeratorPermissionEnum,
    sectionId?: number,
  ) {
    const moderator = await this.forumModerator.findUnique({
      where: {
        id,
      },
      include: {
        sections: true,
      },
    })
    if (!moderator) {
      throw new Error('版主不存在')
    }

    if (sectionId) {
      const sectionRelation = moderator.sections.find(
        (s) => s.sectionId === sectionId,
      )
      if (!sectionRelation) {
        throw new Error('版主未管理该板块')
      }
      const updated = await this.forumModeratorSection.update({
        where: {
          id: sectionRelation.id,
        },
        data: {
          permissions: sectionRelation.permissions.filter(
            (p) => p !== permission,
          ),
        },
      })
      return updated.permissions
    }

    const updated = await this.forumModerator.update({
      where: {
        id,
      },
      data: {
        permissions: moderator.permissions.filter((p) => p !== permission),
      },
    })
    await this.updateAllFinalPermissions(moderator.id)
    return updated.permissions
  }

  /**
   * 合并权限到版主
   * @param id 版主ID
   * @param permissions 权限枚举数组
   * @param sectionId 板块ID（可选），如果指定则合并到板块权限
   * @returns 更新后的权限数组
   */
  async mergePermissions(
    id: number,
    permissions: ModeratorPermissionEnum[],
    sectionId?: number,
  ) {
    const moderator = await this.forumModerator.findUnique({
      where: {
        id,
      },
      include: {
        sections: true,
      },
    })
    if (!moderator) {
      throw new Error('版主不存在')
    }

    if (sectionId) {
      const sectionRelation = moderator.sections.find(
        (s) => s.sectionId === sectionId,
      )
      if (!sectionRelation) {
        throw new Error('版主未管理该板块')
      }
      const merged = [...sectionRelation.permissions, ...permissions]
      const uniquePermissions = Array.from(new Set(merged))
      const updated = await this.forumModeratorSection.update({
        where: {
          id: sectionRelation.id,
        },
        data: {
          permissions: uniquePermissions,
        },
      })
      return updated.permissions
    }

    const merged = [...moderator.permissions, ...permissions]
    const uniquePermissions = Array.from(new Set(merged))
    const updated = await this.forumModerator.update({
      where: {
        id,
      },
      data: {
        permissions: uniquePermissions,
      },
    })
    await this.updateAllFinalPermissions(moderator.id)
    return updated.permissions
  }

  /**
   * 计算版主的最终权限
   * 根据版主角色类型和板块ID计算实际拥有的权限
   * @param moderator 版主对象
   * @param sectionId 板块ID（可选）
   * @returns 权限数组
   */
  async calculatePermissions(
    moderator: any,
    sectionId?: number,
  ): Promise<number[]> {
    if (moderator.roleType === ModeratorRoleTypeEnum.SUPER) {
      return moderator.permissions
    }

    if (moderator.roleType === ModeratorRoleTypeEnum.GROUP) {
      return moderator.permissions
    }

    if (moderator.roleType === ModeratorRoleTypeEnum.SECTION) {
      if (!sectionId) {
        return moderator.permissions
      }
      const sectionRelation = moderator.sections.find(
        (s) => s.sectionId === sectionId,
      )
      if (!sectionRelation) {
        return []
      }
      return sectionRelation.finalPermissions
    }

    return []
  }

  /**
   * 检查版主是否可以管理指定板块
   * @param moderatorId 版主ID
   * @param sectionId 板块ID
   * @returns 是否可以管理该板块
   */
  async canManageSection(
    moderatorId: number,
    sectionId: number,
  ): Promise<boolean> {
    const moderator = await this.forumModerator.findUnique({
      where: {
        id: moderatorId,
      },
      include: {
        sections: true,
      },
    })
    if (!moderator) {
      return false
    }

    if (moderator.roleType === ModeratorRoleTypeEnum.SUPER) {
      return true
    }

    if (moderator.roleType === ModeratorRoleTypeEnum.GROUP) {
      const section = await this.forumSection.findUnique({
        where: {
          id: sectionId,
        },
      })
      return section?.groupId === moderator.groupId
    }

    if (moderator.roleType === ModeratorRoleTypeEnum.SECTION) {
      return moderator.sections.some((s) => s.sectionId === sectionId)
    }

    return false
  }

  /**
   * 获取版主权限的名称数组
   * @param id 版主ID
   * @param sectionId 板块ID（可选）
   * @returns 权限名称数组
   */
  async getPermissionNames(id: number, sectionId?: number): Promise<string[]> {
    const moderator = await this.forumModerator.findUnique({
      where: {
        id,
      },
      include: {
        sections: true,
      },
    })
    if (!moderator) {
      throw new Error('版主不存在')
    }
    const permissions = await this.calculatePermissions(moderator, sectionId)
    return permissions.map((permission) => ModeratorPermissionNames[permission])
  }

  /**
   * 验证权限数组，过滤掉无效的权限
   * @param permissions 权限数组
   * @returns 有效的权限枚举数组
   */
  validatePermissions(permissions: number[]): ModeratorPermissionEnum[] {
    return permissions.filter((permission) =>
      Object.values(ModeratorPermissionEnum).includes(
        permission as ModeratorPermissionEnum,
      ),
    ) as ModeratorPermissionEnum[]
  }

  /**
   * 合并两个权限数组并去重
   * @param basePermissions 基础权限数组
   * @param permissions 要合并的权限数组
   * @returns 合并后的唯一权限数组
   */
  private mergePermissionsArrays(
    basePermissions: number[],
    permissions: number[],
  ): number[] {
    const merged = [...basePermissions, ...permissions]
    return Array.from(new Set(merged))
  }

  /**
   * 更新版主所有板块的最终权限
   * 当版主的基础权限发生变化时，需要重新计算所有板块的finalPermissions
   * @param moderatorId 版主ID
   */
  private async updateAllFinalPermissions(moderatorId: number) {
    const moderator = await this.forumModerator.findUnique({
      where: {
        id: moderatorId,
      },
      include: {
        sections: true,
      },
    })
    if (!moderator) {
      return
    }

    for (const sectionRelation of moderator.sections) {
      await this.forumModeratorSection.update({
        where: {
          id: sectionRelation.id,
        },
        data: {
          finalPermissions: this.mergePermissionsArrays(
            moderator.permissions,
            sectionRelation.permissions,
          ),
        },
      })
    }
  }
}
