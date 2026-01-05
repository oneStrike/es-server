import { RepositoryService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'

export const PERMISSION_MASK = {
  PIN: 1 << 0,
  FEATURE: 1 << 1,
  LOCK: 1 << 2,
  DELETE: 1 << 3,
  AUDIT: 1 << 4,
  MOVE: 1 << 5,
} as const

export type PermissionMask =
  (typeof PERMISSION_MASK)[keyof typeof PERMISSION_MASK]

@Injectable()
export class SectionPermissionService extends RepositoryService {
  constructor() {
    super()
  }

  /**
   * 计算版主在板块的最终权限掩码
   * @param moderatorId 版主ID
   * @param sectionId 板块ID
   * @returns 最终权限掩码
   */
  async calculateFinalPermissionMask(
    moderatorId: number,
    sectionId: number,
  ): Promise<number> {
    const moderatorSection = await this.prisma.forumModeratorSection.findUnique(
      {
        where: {
          moderatorId_sectionId: {
            moderatorId,
            sectionId,
          },
        },
        include: {
          section: true,
        },
      },
    )

    if (!moderatorSection) {
      return 0
    }

    if (!moderatorSection.inheritFromParent) {
      return moderatorSection.customPermissionMask
    }

    const parentPermissionMask = await this.getParentPermissionMask(
      moderatorId,
      moderatorSection.sectionId,
    )

    return parentPermissionMask | moderatorSection.customPermissionMask
  }

  /**
   * 获取版主在父板块的权限掩码
   * @param moderatorId 版主ID
   * @param sectionId 板块ID
   * @returns 父板块的权限掩码
   */
  private async getParentPermissionMask(
    moderatorId: number,
    sectionId: number,
  ): Promise<number> {
    const section = await this.prisma.forumSection.findUnique({
      where: { id: sectionId },
      select: { parentId: true },
    })

    if (!section?.parentId) {
      return 0
    }

    const parentModeratorSection =
      await this.prisma.forumModeratorSection.findUnique({
        where: {
          moderatorId_sectionId: {
            moderatorId,
            sectionId: section.parentId,
          },
        },
      })

    if (!parentModeratorSection) {
      return this.getParentPermissionMask(moderatorId, section.parentId)
    }

    return parentModeratorSection.finalPermissionMask
  }

  /**
   * 递归重新计算所有子板块的权限
   * @param moderatorId 版主ID
   * @param sectionId 板块ID
   */
  async recalculateAllDescendantPermissions(
    moderatorId: number,
    sectionId: number,
  ): Promise<void> {
    const childSections = await this.prisma.forumSection.findMany({
      where: {
        parentId: sectionId,
      },
      select: { id: true },
    })

    const parentPermissionMask = await this.calculateFinalPermissionMask(
      moderatorId,
      sectionId,
    )

    for (const child of childSections) {
      const childModeratorSection =
        await this.prisma.forumModeratorSection.findUnique({
          where: {
            moderatorId_sectionId: {
              moderatorId,
              sectionId: child.id,
            },
          },
        })

      if (childModeratorSection?.inheritFromParent) {
        const newFinalPermission =
          parentPermissionMask | childModeratorSection.customPermissionMask

        await this.prisma.forumModeratorSection.update({
          where: {
            moderatorId_sectionId: {
              moderatorId,
              sectionId: child.id,
            },
          },
          data: {
            finalPermissionMask: newFinalPermission,
          },
        })

        await this.recalculateAllDescendantPermissions(moderatorId, child.id)
      }
    }
  }

  /**
   * 分配版主到板块
   * @param moderatorId 版主ID
   * @param sectionId 板块ID
   * @param inheritFromParent 是否继承父板块权限
   * @param customPermissionMask 自定义权限掩码
   */
  async assignModeratorToSection(
    moderatorId: number,
    sectionId: number,
    inheritFromParent: boolean = true,
    customPermissionMask: number = 0,
  ): Promise<void> {
    const parentSection = await this.prisma.forumSection.findUnique({
      where: { id: sectionId },
      select: { parentId: true, inheritPermission: true },
    })

    let finalPermissionMask = customPermissionMask

    if (inheritFromParent && parentSection?.parentId) {
      const parentPermissionMask = await this.calculateFinalPermissionMask(
        moderatorId,
        parentSection.parentId,
      )
      finalPermissionMask = parentPermissionMask | customPermissionMask
    }

    await this.prisma.forumModeratorSection.upsert({
      where: {
        moderatorId_sectionId: {
          moderatorId,
          sectionId,
        },
      },
      update: {
        inheritFromParent,
        customPermissionMask,
        finalPermissionMask,
      },
      create: {
        moderatorId,
        sectionId,
        inheritFromParent,
        customPermissionMask,
        finalPermissionMask,
      },
    })

    await this.recalculateAllDescendantPermissions(moderatorId, sectionId)
  }

  /**
   * 从板块移除版主
   * @param moderatorId 版主ID
   * @param sectionId 板块ID
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

    const childSections = await this.prisma.forumSection.findMany({
      where: {
        parentId: sectionId,
      },
      select: { id: true },
    })

    for (const child of childSections) {
      const childModeratorSection =
        await this.prisma.forumModeratorSection.findUnique({
          where: {
            moderatorId_sectionId: {
              moderatorId,
              sectionId: child.id,
            },
          },
        })

      if (childModeratorSection?.inheritFromParent) {
        const parentPermissionMask = await this.calculateFinalPermissionMask(
          moderatorId,
          sectionId,
        )
        const newFinalPermission =
          parentPermissionMask | childModeratorSection.customPermissionMask

        await this.prisma.forumModeratorSection.update({
          where: {
            moderatorId_sectionId: {
              moderatorId,
              sectionId: child.id,
            },
          },
          data: {
            finalPermissionMask: newFinalPermission,
          },
        })

        await this.recalculateAllDescendantPermissions(moderatorId, child.id)
      }
    }
  }

  /**
   * 检查版主是否具有指定权限
   * @param moderatorId 版主ID
   * @param sectionId 板块ID
   * @param permission 权限掩码
   * @returns 是否具有该权限
   */
  async checkPermission(
    moderatorId: number,
    sectionId: number,
    permission: PermissionMask,
  ): Promise<boolean> {
    const finalPermissionMask = await this.calculateFinalPermissionMask(
      moderatorId,
      sectionId,
    )
    return (finalPermissionMask & permission) === permission
  }

  /**
   * 获取版主在板块的权限掩码
   * @param moderatorId 版主ID
   * @param sectionId 板块ID
   * @returns 权限掩码
   */
  async getModeratorSectionsWithPermission(
    moderatorId: number,
    sectionId: number,
  ): Promise<number> {
    return this.calculateFinalPermissionMask(moderatorId, sectionId)
  }
}
