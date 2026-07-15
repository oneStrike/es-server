import type { PublishDomainEventInput } from '@libs/eventing/eventing/domain-event.type'
import type {
  ForumTopicCommentedEventInput,
  ForumTopicReactionEventInput,
} from './forum-topic.type'
import { DomainEventConsumerEnum } from '@libs/eventing/eventing/eventing.constant'
import { Injectable } from '@nestjs/common'

const FORUM_TOPIC_NOTIFICATION_WHITESPACE_REGEX = /\s+/g

/**
 * 论坛主题通知事件组装器。
 * 仅负责主题点赞、收藏和一级评论的通知格式与幂等键，事件投递仍由通用发布器处理。
 */
@Injectable()
export class ForumTopicEventFactoryService {
  private static readonly EXCERPT_MAX_LENGTH = 60

  // 规范化通知中展示的操作者昵称，避免空昵称导致标题缺失。
  private normalizeActorNickname(value?: string) {
    const normalized = value?.trim()
    return normalized || '有人'
  }

  // 规范化主题标题，保持历史通知对空标题使用空字符串的语义。
  private normalizeTopicTitle(value?: string) {
    const normalized = value?.trim()
    return normalized || ''
  }

  // 折叠正文空白字符，避免通知内容出现不可读的连续换行或空格。
  private normalizeDisplayText(value?: string) {
    const normalized = value
      ?.replace(FORUM_TOPIC_NOTIFICATION_WHITESPACE_REGEX, ' ')
      .trim()
    return normalized || undefined
  }

  // 截断评论摘录，保持通知 payload 的既有长度边界。
  private normalizeExcerpt(value?: string) {
    const normalized = this.normalizeDisplayText(value)
    if (!normalized) {
      return undefined
    }
    if (
      normalized.length <= ForumTopicEventFactoryService.EXCERPT_MAX_LENGTH
    ) {
      return normalized
    }
    return `${normalized
      .slice(0, ForumTopicEventFactoryService.EXCERPT_MAX_LENGTH)
      .trimEnd()}...`
  }

  // 构建主题 payload 快照，供通知投影按稳定对象形状消费。
  private buildTopicSnapshot(topicId: number, title?: string) {
    return {
      kind: 'topic' as const,
      id: topicId,
      title,
    }
  }

  // 构建评论 payload 快照，供主题评论通知展示评论摘录。
  private buildCommentSnapshot(commentId: number, snippet?: string) {
    return {
      kind: 'comment' as const,
      id: commentId,
      snippet,
    }
  }

  // 组装主题点赞通知的完整领域事件事实。
  buildTopicLikedEvent(
    input: ForumTopicReactionEventInput,
  ): PublishDomainEventInput {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    const topicTitle = this.normalizeTopicTitle(input.topicTitle)
    const projectionKey = `notify:like:${input.targetType}:${input.targetId}:actor:${input.actorUserId}:receiver:${input.receiverUserId}`

    return {
      eventKey: 'topic.liked',
      domain: 'forum',
      idempotencyKey: projectionKey,
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'forum_topic',
      targetId: input.targetId,
      operatorId: input.actorUserId,
      consumers: [DomainEventConsumerEnum.NOTIFICATION],
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey,
        title: `${actorNickname} 点赞了你的主题`,
        content: topicTitle,
        payload: {
          object: this.buildTopicSnapshot(input.targetId, topicTitle),
        },
      },
    }
  }

  // 组装主题收藏通知的完整领域事件事实。
  buildTopicFavoritedEvent(
    input: ForumTopicReactionEventInput,
  ): PublishDomainEventInput {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    const topicTitle = this.normalizeTopicTitle(input.topicTitle)
    const projectionKey = `notify:favorite:${input.targetType}:${input.targetId}:actor:${input.actorUserId}:receiver:${input.receiverUserId}`

    return {
      eventKey: 'topic.favorited',
      domain: 'forum',
      idempotencyKey: projectionKey,
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'forum_topic',
      targetId: input.targetId,
      operatorId: input.actorUserId,
      consumers: [DomainEventConsumerEnum.NOTIFICATION],
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey,
        title: `${actorNickname} 收藏了你的主题`,
        content: topicTitle,
        payload: {
          object: this.buildTopicSnapshot(input.targetId, topicTitle),
        },
      },
    }
  }

  // 组装一级评论通知的完整领域事件事实。
  buildTopicCommentedEvent(
    input: ForumTopicCommentedEventInput,
  ): PublishDomainEventInput {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    const topicTitle = this.normalizeTopicTitle(input.topicTitle)
    const commentExcerpt =
      this.normalizeExcerpt(input.commentExcerpt) ?? topicTitle
    const projectionKey = `notify:topic-comment:${input.targetType}:${input.targetId}:comment:${input.commentId}:receiver:${input.receiverUserId}`

    return {
      eventKey: 'topic.commented',
      domain: 'forum',
      idempotencyKey: projectionKey,
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'forum_topic',
      targetId: input.targetId,
      operatorId: input.actorUserId,
      consumers: [DomainEventConsumerEnum.NOTIFICATION],
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey,
        title: `${actorNickname} 评论了你的主题`,
        content: commentExcerpt,
        payload: {
          object: this.buildCommentSnapshot(input.commentId, commentExcerpt),
          container: this.buildTopicSnapshot(input.targetId, topicTitle),
        },
      },
    }
  }
}
