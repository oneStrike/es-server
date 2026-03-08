import {
  InteractionTargetTypeEnum,
  UserStatusEnum,
} from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { BadRequestException, Injectable } from '@nestjs/common'

@Injectable()
export class CommentPermissionService extends BaseService {
  async ensureCanComment(
    userId: number,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    await Promise.all([
      this.ensureTargetCanComment(targetType, targetId),
      this.ensureUserCanComment(userId),
    ])
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

  async ensureTargetCanComment(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    const validators: Partial<Record<
      InteractionTargetTypeEnum,
      (id: number) => Promise<void>
    >> = {
      [InteractionTargetTypeEnum.COMIC]: async (id) => this.validateWork(id, 1),
      [InteractionTargetTypeEnum.NOVEL]: async (id) => this.validateWork(id, 2),
      [InteractionTargetTypeEnum.COMIC_CHAPTER]: async (id) =>
        this.validateChapter(id, 1),
      [InteractionTargetTypeEnum.NOVEL_CHAPTER]: async (id) =>
        this.validateChapter(id, 2),
      [InteractionTargetTypeEnum.FORUM_TOPIC]: async (id) =>
        this.validateForumTopic(id),
    }

    const validator = validators[targetType]
    if (!validator) {
      throw new BadRequestException('不支持的目标类型')
    }

    await validator(targetId)
  }

  private async validateWork(
    workId: number,
    expectedType: number,
  ): Promise<void> {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { type: true, canComment: true, deletedAt: true },
    })

    this.ensureExists(work, '作品不存在')
    this.ensureTypeMatch(work!.type, expectedType, '作品类型不匹配')

    if (!work!.canComment) {
      throw new BadRequestException('该作品不允许评论')
    }
  }

  private async validateChapter(
    chapterId: number,
    expectedWorkType: number,
  ): Promise<void> {
    const chapter = await this.prisma.workChapter.findUnique({
      where: { id: chapterId },
      select: { workType: true, canComment: true, deletedAt: true },
    })

    this.ensureExists(chapter, '章节不存在')
    this.ensureTypeMatch(chapter!.workType, expectedWorkType, '章节类型不匹配')

    if (!chapter!.canComment) {
      throw new BadRequestException('章节不允许评论')
    }
  }

  private async validateForumTopic(topicId: number): Promise<void> {
    const topic = await this.prisma.forumTopic.findUnique({
      where: { id: topicId },
      select: { isLocked: true, deletedAt: true },
    })

    this.ensureExists(topic, '帖子不存在')

    if (topic!.isLocked) {
      throw new BadRequestException('帖子已被锁定，无法评论')
    }
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
