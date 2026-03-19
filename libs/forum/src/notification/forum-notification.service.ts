import type {
  CreateForumNotificationInput,
  QueryForumNotificationInput,
  QueryUserForumNotificationInput,
} from './notification.type'
import { DrizzleService } from '@db/core'
import { CommentTargetTypeEnum } from '@libs/interaction'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, gte, isNull, or } from 'drizzle-orm'
import { ForumNotificationPriorityEnum } from './forum-notification.constant'

/**
 * 论坛通知服务。
 * 提供通知查询、创建和已读管理。
 */
@Injectable()
export class ForumNotificationService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get forumNotification() {
    return this.drizzle.schema.forumNotification
  }

  private get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  private get userComment() {
    return this.drizzle.schema.userComment
  }

  private buildActiveWhere() {
    return or(
      isNull(this.forumNotification.expiredAt),
      gte(this.forumNotification.expiredAt, new Date()),
    )!
  }

  private async ensureUserExists(userId: number) {
    const user = await this.db.query.appUser.findFirst({
      where: {
        id: userId,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!user) {
      throw new BadRequestException('通知接收用户不存在')
    }
  }

  private async normalizeTopicReference(input: CreateForumNotificationInput) {
    let topicId = input.topicId ?? null
    let replyId = input.replyId ?? null

    if (replyId) {
      const reply = await this.db.query.userComment.findFirst({
        where: {
          id: replyId,
          deletedAt: { isNull: true },
        },
        columns: {
          id: true,
          targetType: true,
          targetId: true,
        },
      })

      if (!reply || reply.targetType !== CommentTargetTypeEnum.FORUM_TOPIC) {
        throw new BadRequestException('关联回复不存在或不属于论坛主题')
      }

      if (topicId && topicId !== reply.targetId) {
        throw new BadRequestException('replyId 与 topicId 不匹配')
      }

      topicId = reply.targetId
      replyId = reply.id
    }

    if (topicId) {
      const topic = await this.db.query.forumTopic.findFirst({
        where: {
          id: topicId,
          deletedAt: { isNull: true },
        },
        columns: { id: true },
      })

      if (!topic) {
        throw new BadRequestException('关联主题不存在')
      }
    }

    return {
      topicId,
      replyId,
    }
  }

  async getNotificationPage(query: QueryForumNotificationInput) {
    const { userId, topicId, type, isRead, ...pagination } = query
    const where = this.drizzle.buildWhere(this.forumNotification, {
      and: {
        ...(userId !== undefined ? { userId } : {}),
        ...(topicId !== undefined ? { topicId } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(isRead !== undefined ? { isRead } : {}),
      },
    })

    return this.drizzle.ext.findPagination(this.forumNotification, {
      where,
      ...pagination,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    })
  }

  async getNotificationDetail(id: number, userId?: number) {
    const notification = await this.db.query.forumNotification.findFirst({
      where: userId === undefined
        ? { id }
        : {
            id,
            userId,
          },
    })

    if (!notification) {
      throw new NotFoundException('论坛通知不存在')
    }

    return notification
  }

  async getUserNotificationPage(
    userId: number,
    query: QueryUserForumNotificationInput,
  ) {
    const { type, isRead, ...pagination } = query
    const where = and(
      eq(this.forumNotification.userId, userId),
      type !== undefined ? eq(this.forumNotification.type, type) : undefined,
      isRead !== undefined
        ? eq(this.forumNotification.isRead, isRead)
        : undefined,
      this.buildActiveWhere(),
    )

    return this.drizzle.ext.findPagination(this.forumNotification, {
      where,
      ...pagination,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    })
  }

  async getUnreadCount(userId: number) {
    return {
      count: await this.db.$count(
        this.forumNotification,
        and(
          eq(this.forumNotification.userId, userId),
          eq(this.forumNotification.isRead, false),
          this.buildActiveWhere(),
        ),
      ),
    }
  }

  async markRead(userId: number, id: number) {
    const [notification] = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.forumNotification)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(
          and(
            eq(this.forumNotification.id, id),
            eq(this.forumNotification.userId, userId),
          ),
        )
        .returning({ id: this.forumNotification.id }),
    )

    if (!notification) {
      throw new NotFoundException('论坛通知不存在')
    }

    return { id }
  }

  async markAllRead(userId: number) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.forumNotification)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(
          and(
            eq(this.forumNotification.userId, userId),
            eq(this.forumNotification.isRead, false),
          ),
        )
        .returning({ id: this.forumNotification.id }),
    )

    return { count: result.length }
  }

  async createNotification(input: CreateForumNotificationInput) {
    await this.ensureUserExists(input.userId)
    const reference = await this.normalizeTopicReference(input)

    const [notification] = await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.forumNotification)
        .values({
          userId: input.userId,
          topicId: reference.topicId,
          replyId: reference.replyId,
          type: input.type,
          priority: input.priority ?? ForumNotificationPriorityEnum.LOW,
          title: input.title,
          content: input.content,
          expiredAt: input.expiredAt,
        })
        .returning(),
    )

    return notification
  }

  async deleteNotification(id: number) {
    const [notification] = await this.drizzle.withErrorHandling(() =>
      this.db
        .delete(this.forumNotification)
        .where(eq(this.forumNotification.id, id))
        .returning({ id: this.forumNotification.id }),
    )

    if (!notification) {
      throw new NotFoundException('论坛通知不存在')
    }

    return { id }
  }
}
