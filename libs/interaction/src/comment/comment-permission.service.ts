import { DrizzleService } from '@db/core'
import { UserStatusEnum } from '@libs/platform/constant'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, desc, eq, gte } from 'drizzle-orm'
import { CommentTargetTypeEnum } from './comment.constant'

@Injectable()
export class CommentPermissionService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  async ensureCanComment(
    userId: number,
    _targetType: CommentTargetTypeEnum,
    _targetId: number,
  ) {
    await this.ensureUserCanComment(userId)
  }

  async ensureUserCanComment(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
      columns: {
        isEnabled: true,
        status: true,
      },
      with: {
        level: {
          columns: {
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

      const usedToday = await this.db.$count(
        this.drizzle.schema.userComment,
        and(
          eq(this.drizzle.schema.userComment.userId, userId),
          gte(this.drizzle.schema.userComment.createdAt, today),
        ),
      )

      if (usedToday >= level.dailyReplyCommentLimit) {
        throw new BadRequestException(
          `今日评论次数已达上限（${level.dailyReplyCommentLimit}）`,
        )
      }
    }

    if (level.postInterval > 0) {
      const [lastTopic, lastComment] = await Promise.all([
        this.db
          .select({ createdAt: this.drizzle.schema.forumTopic.createdAt })
          .from(this.drizzle.schema.forumTopic)
          .where(eq(this.drizzle.schema.forumTopic.userId, userId))
          .orderBy(desc(this.drizzle.schema.forumTopic.createdAt))
          .limit(1),
        this.db
          .select({ createdAt: this.drizzle.schema.userComment.createdAt })
          .from(this.drizzle.schema.userComment)
          .where(eq(this.drizzle.schema.userComment.userId, userId))
          .orderBy(desc(this.drizzle.schema.userComment.createdAt))
          .limit(1),
      ])

      const latestTopic = lastTopic[0]
      const latestComment = lastComment[0]

      const lastPostAt =
        latestTopic && latestComment
          ? latestTopic.createdAt > latestComment.createdAt
            ? latestTopic.createdAt
            : latestComment.createdAt
          : latestTopic?.createdAt || latestComment?.createdAt || null

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
