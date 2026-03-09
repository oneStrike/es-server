import {
  InteractionTargetTypeEnum,
  UserStatusEnum,
} from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

@Injectable()
export class ViewPermissionService extends BaseService {
  constructor() {
    super()
  }

  private getTargetModel(client: any, targetType: InteractionTargetTypeEnum) {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
      case InteractionTargetTypeEnum.NOVEL:
        return client.work
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
        return client.workChapter
      case InteractionTargetTypeEnum.FORUM_TOPIC:
        return client.forumTopic
      case InteractionTargetTypeEnum.COMMENT:
        return client.userComment
      default:
        throw new Error(`Unsupported interaction target type: ${targetType}`)
    }
  }

  private getTargetWhere(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
        return { id: targetId, type: 1, deletedAt: null }
      case InteractionTargetTypeEnum.NOVEL:
        return { id: targetId, type: 2, deletedAt: null }
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
        return { id: targetId, workType: 1, deletedAt: null }
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
        return { id: targetId, workType: 2, deletedAt: null }
      case InteractionTargetTypeEnum.FORUM_TOPIC:
      case InteractionTargetTypeEnum.COMMENT:
        return { id: targetId, deletedAt: null }
      default:
        throw new Error(`Unsupported interaction target type: ${targetType}`)
    }
  }

  private async ensureTargetExists(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    const model = this.getTargetModel(this.prisma, targetType)
    const where = this.getTargetWhere(targetType, targetId)
    const target = await model.findFirst({
      where,
      select: { id: true },
    })

    if (!target) {
      throw new NotFoundException('Target not found')
    }
  }

  async ensureUserCanView(userId: number): Promise<void> {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        isEnabled: true,
        status: true,
      },
    })

    if (!user || !user.isEnabled) {
      throw new BadRequestException('User does not exist or is disabled')
    }

    if (
      [
        UserStatusEnum.MUTED,
        UserStatusEnum.PERMANENT_MUTED,
        UserStatusEnum.BANNED,
        UserStatusEnum.PERMANENT_BANNED,
      ].includes(user.status)
    ) {
      throw new BadRequestException('User is muted or banned and cannot view')
    }
  }

  async isTargetValid(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ): Promise<boolean> {
    try {
      await this.ensureTargetExists(targetType, targetId)
      return true
    } catch {
      return false
    }
  }
}
