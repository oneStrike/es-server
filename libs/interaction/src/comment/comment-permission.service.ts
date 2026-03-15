import { UserStatusEnum } from '@libs/platform/constant'
import { PlatformService } from '@libs/platform/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { CommentTargetTypeEnum } from './comment.constant'

@Injectable()
export class CommentPermissionService extends PlatformService {
  async ensureCanComment(
    userId: number,
    _targetType: CommentTargetTypeEnum,
    _targetId: number,
  ) {
    await this.ensureUserCanComment(userId)
  }

  async ensureUserCanComment(userId: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        isEnabled: true,
        status: true,
        level: {
          select: {
            dailyReplyCommentLimit: true,
            postInterval: true,
          },
        },
      },
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

    await this.ensureUserLevelRateLimit(userId, user.level)
  }

  private async ensureUserLevelRateLimit(
    userId: number,
    level: {
      dailyReplyCommentLimit: number
      postInterval: number
    } | null,
  ): Promise<void> {
    if (!level) {
      return
    }

    if (level.dailyReplyCommentLimit > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const usedToday = await this.prisma.userComment.count({
        where: {
          userId,
          createdAt: { gte: today },
        },
      })

      if (usedToday >= level.dailyReplyCommentLimit) {
        throw new BadRequestException(
          `今日评论次数已达上限（${level.dailyReplyCommentLimit}）`,
        )
      }
    }

    if (level.postInterval > 0) {
      const [lastTopic, lastComment] = await Promise.all([
        this.prisma.forumTopic.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        this.prisma.userComment.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ])

      const lastPostAt =
        lastTopic && lastComment
          ? lastTopic.createdAt > lastComment.createdAt
            ? lastTopic.createdAt
            : lastComment.createdAt
          : lastTopic?.createdAt || lastComment?.createdAt || null

      if (lastPostAt) {
        const secondsSinceLastPost = Math.floor(
          (Date.now() - lastPostAt.getTime()) / 1000,
        )
        if (secondsSinceLastPost < level.postInterval) {
          throw new BadRequestException(
            `操作过于频繁，请 ${
              level.postInterval - secondsSinceLastPost
            } 秒后再试`,
          )
        }
      }
    }
  }

  private ensureExists<T extends { deletedAt: Date | null }>(
    target: T | null,
    message: string,
  ): void {
    if (!target || target.deletedAt !== null) {
      throw new BadRequestException(message)
    }
  }

  private ensureTypeMatch(
    actualType: number,
    expectedType: number,
    message: string,
  ): void {
    if (actualType !== expectedType) {
      throw new BadRequestException(message)
    }
  }
}
