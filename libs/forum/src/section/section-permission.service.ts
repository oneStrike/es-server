import { RepositoryService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { ModeratorPermissionService } from '../moderator/moderator-permission.service'
import { ModeratorPermissionEnum } from '../moderator/moderator.constant'

export type Permission = ModeratorPermissionEnum

@Injectable()
export class SectionPermissionService extends RepositoryService {
  constructor(private readonly permissionService: ModeratorPermissionService) {
    super()
  }

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

  async getModeratorSectionsWithPermission(
    moderatorId: number,
    sectionId: number,
  ): Promise<ModeratorPermissionEnum[]> {
    return this.calculateFinalPermissions(moderatorId, sectionId)
  }
}
