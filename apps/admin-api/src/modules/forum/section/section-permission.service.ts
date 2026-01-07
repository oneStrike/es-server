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
export class SectionPermissionService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getModeratorSectionsWithPermission(
    moderatorId: number,
    sectionId: number,
  ): Promise<number> {
    return this.calculateFinalPermissionMask(moderatorId, sectionId)
  }
}
