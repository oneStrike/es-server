import { DrizzleService } from '@db/core'
import { AppUserLevelRuleSelect } from '@db/schema'
import { AuditStatusEnum } from '@libs/platform/constant/audit.constant';
import { UserStatusEnum } from '@libs/platform/constant/user.constant';
import { startOfTodayInAppTimeZone } from '@libs/platform/utils/time';
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
    targetType: CommentTargetTypeEnum,
    targetId: number,
  ) {
    await this.ensureUserCanComment(userId, targetType, targetId)
  }

  async ensureUserCanComment(
    userId: number,
    targetType?: CommentTargetTypeEnum,
    targetId?: number,
  ) {
    const user = await this.db.query.appUser.findFirst({
      where: { id: userId },
      columns: {
        isEnabled: true,
        status: true,
        experience: true,
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

    if (
      targetType === CommentTargetTypeEnum.FORUM_TOPIC &&
      typeof targetId === 'number'
    ) {
      await this.ensureForumTopicSectionAccess(targetId, user)
    }

    await this.ensureUserLevelRateLimit(userId, user.level)
  }

  private async ensureForumTopicSectionAccess(
    topicId: number,
    user: { experience: number },
  ) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id: topicId,
        deletedAt: { isNull: true },
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
      },
      columns: { id: true },
      with: {
        section: {
          columns: {
            id: true,
            isEnabled: true,
            deletedAt: true,
            userLevelRuleId: true,
          },
          with: {
            appUserLevelRule: {
              columns: {
                requiredExperience: true,
              },
            },
          },
        },
      },
    })

    if (!topic || !topic.section || topic.section.deletedAt || !topic.section.isEnabled) {
      throw new BadRequestException('帖子不存在')
    }

    const requiredExperience = topic.section.appUserLevelRule?.requiredExperience
    if (
      topic.section.userLevelRuleId &&
      requiredExperience !== undefined &&
      requiredExperience !== null &&
      user.experience < requiredExperience
    ) {
      throw new BadRequestException('当前板块需要更高等级')
    }
  }

  private async ensureUserLevelRateLimit(
    userId: number,
    level: Pick<AppUserLevelRuleSelect, 'dailyReplyCommentLimit' | 'postInterval'> | null,
  ): Promise<void> {
    if (!level) {
      return
    }

    if (level.dailyReplyCommentLimit > 0) {
      const today = startOfTodayInAppTimeZone()

      const usedToday = await this.db.$count(
        this.drizzle.schema.appUserComment,
        and(
          eq(this.drizzle.schema.appUserComment.userId, userId),
          gte(this.drizzle.schema.appUserComment.createdAt, today),
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
          .select({ createdAt: this.drizzle.schema.appUserComment.createdAt })
          .from(this.drizzle.schema.appUserComment)
          .where(eq(this.drizzle.schema.appUserComment.userId, userId))
          .orderBy(desc(this.drizzle.schema.appUserComment.createdAt))
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
