import type { PublishDomainEventInput } from '@libs/eventing/eventing/domain-event.type'
import type {
  CommentLikeNotificationEventInput,
  CommentMentionNotificationEventInput,
  CommentRepliedNotificationEventInput,
  TopicMentionNotificationEventInput,
  UserFollowedNotificationEventInput,
} from './interaction-notification-event.type'
import { DomainEventConsumerEnum } from '@libs/eventing/eventing/eventing.constant'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { Injectable } from '@nestjs/common'

const INTERACTION_NOTIFICATION_WHITESPACE_REGEX = /\s+/g

/**
 * 交互域通知事实工厂。
 *
 * 只负责将已发生的交互事实格式化为完整 outbox 输入；通知投影由 message consumer 所有。
 */
@Injectable()
export class InteractionNotificationEventFactoryService {
  private static readonly EXCERPT_MAX_LENGTH = 60

  // 归一化触发者昵称，缺失时使用通知文案默认称谓。
  private normalizeActorNickname(value?: string) {
    const normalized = value?.trim()
    return normalized || '有人'
  }

  // 主题标题只去除首尾空白，空值保持为空字符串。
  private normalizeTopicTitle(value?: string) {
    const normalized = value?.trim()
    return normalized || ''
  }

  // 压缩展示文本中的空白，并将空内容排除出事件载荷。
  private normalizeDisplayText(value?: string) {
    const normalized = value
      ?.replace(INTERACTION_NOTIFICATION_WHITESPACE_REGEX, ' ')
      .trim()
    return normalized || undefined
  }

  // 截断过长摘要，保证通知正文和 payload 的展示口径一致。
  private normalizeExcerpt(value?: string) {
    const normalized = this.normalizeDisplayText(value)
    if (!normalized) {
      return undefined
    }
    if (
      normalized.length <=
      InteractionNotificationEventFactoryService.EXCERPT_MAX_LENGTH
    ) {
      return normalized
    }
    return `${normalized
      .slice(0, InteractionNotificationEventFactoryService.EXCERPT_MAX_LENGTH)
      .trimEnd()}...`
  }

  // 构造评论对象快照，供通知投影消费。
  private buildCommentSnapshot(commentId: number, snippet?: string) {
    return {
      kind: 'comment' as const,
      id: commentId,
      snippet,
    }
  }

  // 根据评论挂载目标构造容器快照，保留现有客户端识别的 kind。
  private buildCommentContainerSnapshot(
    targetType: number,
    targetId: number,
    title?: string,
  ) {
    switch (targetType) {
      case CommentTargetTypeEnum.COMIC:
      case CommentTargetTypeEnum.NOVEL:
        return {
          kind: 'work' as const,
          id: targetId,
          title,
        }
      case CommentTargetTypeEnum.COMIC_CHAPTER:
      case CommentTargetTypeEnum.NOVEL_CHAPTER:
        return {
          kind: 'chapter' as const,
          id: targetId,
          title,
        }
      case CommentTargetTypeEnum.FORUM_TOPIC:
        return {
          kind: 'topic' as const,
          id: targetId,
          title,
        }
      default:
        return {
          kind: 'topic' as const,
          id: targetId,
          title,
        }
    }
  }

  // 构造主题对象快照，供主题相关通知投影消费。
  private buildTopicSnapshot(topicId: number, title?: string) {
    return {
      kind: 'topic' as const,
      id: topicId,
      title,
    }
  }

  /** 将评论提及事实转换为通知 outbox 输入。 */
  buildCommentMentionEvent(input: CommentMentionNotificationEventInput) {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    const targetDisplayTitle = this.normalizeDisplayText(
      input.targetDisplayTitle,
    )
    const commentExcerpt =
      this.normalizeExcerpt(input.commentExcerpt) ?? targetDisplayTitle
    const projectionKey = `notify:comment-mention:${input.commentId}:receiver:${input.receiverUserId}`

    return {
      eventKey: 'comment.mentioned',
      domain: 'interaction',
      idempotencyKey: projectionKey,
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'comment',
      targetId: input.commentId,
      operatorId: input.actorUserId,
      consumers: [DomainEventConsumerEnum.NOTIFICATION],
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey,
        title: `${actorNickname} 在评论中提到了你`,
        content: commentExcerpt ?? '你在评论中被提及了',
        payload: {
          object: this.buildCommentSnapshot(input.commentId, commentExcerpt),
          container: this.buildCommentContainerSnapshot(
            input.targetType,
            input.targetId,
            targetDisplayTitle,
          ),
        },
      },
    } satisfies PublishDomainEventInput
  }

  /** 将主题提及事实转换为通知 outbox 输入。 */
  buildTopicMentionEvent(input: TopicMentionNotificationEventInput) {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    const topicTitle = this.normalizeTopicTitle(input.topicTitle)
    const projectionKey = `notify:topic-mention:${input.topicId}:receiver:${input.receiverUserId}`

    return {
      eventKey: 'topic.mentioned',
      domain: 'interaction',
      idempotencyKey: projectionKey,
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'forum_topic',
      targetId: input.topicId,
      operatorId: input.actorUserId,
      consumers: [DomainEventConsumerEnum.NOTIFICATION],
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey,
        title: `${actorNickname} 在主题中提到了你`,
        content: topicTitle,
        payload: {
          object: this.buildTopicSnapshot(input.topicId, topicTitle),
        },
      },
    } satisfies PublishDomainEventInput
  }

  /** 将评论点赞事实转换为通知 outbox 输入。 */
  buildCommentLikeEvent(input: CommentLikeNotificationEventInput) {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    const commentExcerpt = this.normalizeExcerpt(input.commentExcerpt)
    const projectionKey = `notify:comment:like:${input.commentId}:actor:${input.actorUserId}:receiver:${input.receiverUserId}`

    return {
      eventKey: 'comment.liked',
      domain: 'interaction',
      idempotencyKey: projectionKey,
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'comment',
      targetId: input.commentId,
      operatorId: input.actorUserId,
      consumers: [DomainEventConsumerEnum.NOTIFICATION],
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey,
        title: `${actorNickname} 点赞了你的评论`,
        content: commentExcerpt ?? `${actorNickname} 点赞了你的评论`,
        payload: {
          object: this.buildCommentSnapshot(input.commentId, commentExcerpt),
          container: this.buildCommentContainerSnapshot(
            input.targetType,
            input.targetId,
          ),
        },
      },
    } satisfies PublishDomainEventInput
  }

  /** 将用户关注事实转换为通知 outbox 输入。 */
  buildUserFollowedEvent(input: UserFollowedNotificationEventInput) {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    const projectionKey = `notify:follow:${input.targetType}:${input.targetId}:actor:${input.actorUserId}:receiver:${input.receiverUserId}`

    return {
      eventKey: 'user.followed',
      domain: 'interaction',
      idempotencyKey: projectionKey,
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'user',
      targetId: input.targetId,
      operatorId: input.actorUserId,
      consumers: [DomainEventConsumerEnum.NOTIFICATION],
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey,
        title: `${actorNickname} 关注了你`,
        content: `${actorNickname} 关注了你`,
        payload: null,
      },
    } satisfies PublishDomainEventInput
  }

  /** 将评论回复事实转换为通知 outbox 输入。 */
  buildCommentRepliedEvent(input: CommentRepliedNotificationEventInput) {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    const targetDisplayTitle = this.normalizeDisplayText(
      input.targetDisplayTitle,
    )
    const replyExcerpt =
      this.normalizeExcerpt(input.replyExcerpt) ?? targetDisplayTitle
    const parentCommentExcerpt = this.normalizeExcerpt(
      input.parentCommentExcerpt,
    )
    const projectionKey = `comment:reply:${input.commentId}:to:${input.receiverUserId}`

    return {
      eventKey: 'comment.replied',
      domain: 'interaction',
      idempotencyKey: projectionKey,
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'comment',
      targetId: input.commentId,
      operatorId: input.actorUserId,
      consumers: [DomainEventConsumerEnum.NOTIFICATION],
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey,
        title: `${actorNickname} 回复了你的评论`,
        content: replyExcerpt ?? '你收到了一条新的评论回复',
        payload: {
          object: this.buildCommentSnapshot(input.commentId, replyExcerpt),
          ...(typeof input.parentCommentId === 'number'
            ? {
                parentComment: this.buildCommentSnapshot(
                  input.parentCommentId,
                  parentCommentExcerpt,
                ),
              }
            : {}),
          container: this.buildCommentContainerSnapshot(
            input.targetType,
            input.targetId,
            targetDisplayTitle,
          ),
        },
      },
    } satisfies PublishDomainEventInput
  }
}
