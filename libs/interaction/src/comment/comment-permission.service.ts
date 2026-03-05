import { UserStatusEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { InteractionTargetType } from '../common.constant'

@Injectable()
export class CommentPermissionService extends BaseService {
  /**
   * 验证用户和目标是否可以评论
   * 组合调用 ensureUserCanComment 和 ensureTargetCanComment
   * @param userId - 用户ID
   * @param targetType - 目标类型
   * @param targetId - 目标ID
   * @throws BadRequestException 用户或目标无评论权限时抛出
   */
  async ensureCanComment(
    userId: number,
    targetType: InteractionTargetType,
    targetId: number,
  ) {
    await Promise.all([
      this.ensureTargetCanComment(targetType, targetId),
      this.ensureUserCanComment(userId),
    ])
  }

  /**
   * 校验用户是否允许发表评论
   * 检查用户是否存在、是否被禁用、是否被禁言或封禁
   * @param userId - 用户ID
   * @throws BadRequestException 用户无评论权限时抛出
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
   * 校验目标是否支持评论，并校验目标类型是否匹配
   * 根据目标类型（作品/章节/论坛主题）进行不同的校验逻辑
   * @param targetType - 目标类型
   * @param targetId - 目标ID
   * @throws BadRequestException 目标不存在、类型不匹配或不允许评论时抛出
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
          throw new BadRequestException('目标不存在')
        }

        // 校验作品类型与传入的 targetType 是否匹配
        // COMIC 对应 type=1，NOVEL 对应 type=2
        const expectedType = targetType === InteractionTargetType.COMIC ? 1 : 2
        if (work.type !== expectedType) {
          throw new BadRequestException('目标类型不匹配')
        }

        if (!work.canComment) {
          throw new BadRequestException('该目标不允许评论')
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
          throw new BadRequestException('目标不存在')
        }

        // 校验章节的作品类型与传入的 targetType 是否匹配
        // COMIC_CHAPTER 对应 workType=1，NOVEL_CHAPTER 对应 workType=2
        const expectedWorkType =
          targetType === InteractionTargetType.COMIC_CHAPTER ? 1 : 2
        if (chapter.workType !== expectedWorkType) {
          throw new BadRequestException('目标类型不匹配')
        }

        if (!chapter.canComment) {
          throw new BadRequestException('该目标不允许评论')
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
          throw new BadRequestException('目标不存在')
        }

        if (topic.isLocked) {
          throw new BadRequestException('该主题已被锁定，无法评论')
        }
        return
      }

      default:
        throw new BadRequestException('不支持的目标类型')
    }
  }
}
