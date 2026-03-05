import { UserStatusEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InteractionTargetType } from '../common.constant'

@Injectable()
export class CommentPermissionService extends BaseService {
  /**
   * 校验用户是否允许发表评论�?
   */
  async ensureUserCanComment(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: { isEnabled: true, status: true },
    })

    if (!user || !user.isEnabled) {
      throw new BadRequestException('用户不存在或已被禁用')
    }

    if (
      [
        UserStatusEnum.MUTED,
        UserStatusEnum.PERMANENT_MUTED,
        UserStatusEnum.BANNED,
        UserStatusEnum.PERMANENT_BANNED,
      ].includes(user.status)
    ) {
      throw new BadRequestException('用户已被禁言或封禁，无法评论')
    }
  }

  /**
   * 校验目标是否支持评论，并校验目标类型是否匹配�?
   */
  async ensureTargetCanComment(
    targetType: InteractionTargetType,
    targetId: number,
  ) {
    switch (targetType) {
      case InteractionTargetType.COMIC:
      case InteractionTargetType.NOVEL: {
        const work = await this.prisma.work.findUnique({
          where: { id: targetId },
          select: {
            type: true,
            canComment: true,
            deletedAt: true,
          },
        })

        if (!work || work.deletedAt !== null) {
          throw new BadRequestException('Target not found')
        }

        const expectedType = targetType === InteractionTargetType.COMIC ? 1 : 2
        if (work.type !== expectedType) {
          throw new BadRequestException('Target type mismatch')
        }

        if (!work.canComment) {
          throw new BadRequestException('Target does not allow comments')
        }
        return
      }

      case InteractionTargetType.COMIC_CHAPTER:
      case InteractionTargetType.NOVEL_CHAPTER: {
        const chapter = await this.prisma.workChapter.findUnique({
          where: { id: targetId },
          select: {
            workType: true,
            canComment: true,
            deletedAt: true,
          },
        })

        if (!chapter || chapter.deletedAt !== null) {
          throw new BadRequestException('Target not found')
        }

        const expectedWorkType =
          targetType === InteractionTargetType.COMIC_CHAPTER ? 1 : 2
        if (chapter.workType !== expectedWorkType) {
          throw new BadRequestException('Target type mismatch')
        }

        if (!chapter.canComment) {
          throw new BadRequestException('Target does not allow comments')
        }
        return
      }

      case InteractionTargetType.FORUM_TOPIC: {
        const topic = await this.prisma.forumTopic.findUnique({
          where: { id: targetId },
          select: {
            isLocked: true,
            deletedAt: true,
          },
        })

        if (!topic || topic.deletedAt !== null) {
          throw new BadRequestException('Target not found')
        }

        if (topic.isLocked) {
          throw new BadRequestException('Topic is locked')
        }
        return
      }

      default:
        throw new BadRequestException('Unsupported target type')
    }
  }
}
