import type { UserLevelRuleSelect } from '@db/schema'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { AuditStatusEnum } from '@libs/platform/constant/audit.constant'
import { BusinessException } from '@libs/platform/exceptions'
import { startOfTodayInAppTimeZone } from '@libs/platform/utils/time'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在或已被禁用',
      )
    }

    if (
      [
        UserStatusEnum.MUTED,
        UserStatusEnum.PERMANENT_MUTED,
        UserStatusEnum.BANNED,
        UserStatusEnum.PERMANENT_BANNED,
      ].includes(user.status)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '用户已被禁言或封禁，无法评论',
      )
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
            userLevelRule: {
              columns: {
                requiredExperience: true,
              },
            },
          },
        },
      },
    })

    if (
      !topic ||
      !topic.section ||
      topic.section.deletedAt ||
      !topic.section.isEnabled
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '帖子不存在',
      )
    }

    const requiredExperience = topic.section.userLevelRule?.requiredExperience
    if (
      topic.section.userLevelRuleId &&
      requiredExperience !== undefined &&
      requiredExperience !== null &&
      user.experience < requiredExperience
    ) {
      throw new BusinessException(
        BusinessErrorCode.QUOTA_NOT_ENOUGH,
        '当前板块需要更高等级',
      )
    }
  }

  private async ensureUserLevelRateLimit(
    userId: number,
    level: Pick<
      UserLevelRuleSelect,
      'dailyReplyCommentLimit' | 'postInterval'
    > | null,
  ): Promise<void> {
    if (!level) {
      return
    }

    if (level.dailyReplyCommentLimit > 0) {
      const today = startOfTodayInAppTimeZone()

      const usedToday = await this.db.$count(
        this.drizzle.schema.userComment,
        and(
          eq(this.drizzle.schema.userComment.userId, userId),
          gte(this.drizzle.schema.userComment.createdAt, today),
        ),
      )

      if (usedToday >= level.dailyReplyCommentLimit) {
        throw new BusinessException(
          BusinessErrorCode.QUOTA_NOT_ENOUGH,
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
          throw new HttpException(
            `操作过于频繁，请 ${
              level.postInterval - secondsSinceLastPost
            } 秒后再试`,
            HttpStatus.TOO_MANY_REQUESTS,
          )
        }
      }
    }
  }
}
