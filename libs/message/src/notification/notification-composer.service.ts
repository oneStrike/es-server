import type {
  BuildCommentReplyNotificationEventInput,
  BuildMessageNotificationEventInput,
  BuildTopicCommentNotificationEventInput,
  BuildTopicFavoriteNotificationEventInput,
  BuildTopicLikeNotificationEventInput,
  MessageNotificationComposedEvent,
} from './notification.type'
import { Injectable } from '@nestjs/common'
import {
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
} from './notification.constant'

const MESSAGE_NOTIFICATION_WHITESPACE_REGEX = /\s+/g

/**
 * 通知事件 composer
 * 统一收口通知 payload 快照字段与 fallback 文案，避免业务模块各自拼装事件
 */
@Injectable()
export class MessageNotificationComposerService {
  private static readonly NOTIFICATION_EXCERPT_MAX_LENGTH = 60

  /**
   * 规范化触发者昵称
   * 保持 fallback 文案在缺少昵称时也具备可读性
   */
  private normalizeActorNickname(value?: string) {
    const normalized = value?.trim()
    return normalized || '有人'
  }

  /**
   * 规范化主题标题
   * 主题标题缺失时回退为稳定兜底文本，避免正文变成空字符串
   */
  private normalizeTopicTitle(value?: string) {
    const normalized = value?.trim()
    return normalized || '你的主题'
  }

  /**
   * 规范化展示文本
   * 合并换行与连续空白，避免通知正文出现不可读的碎片化格式
   */
  private normalizeDisplayText(value?: string) {
    const normalized = value?.replace(MESSAGE_NOTIFICATION_WHITESPACE_REGEX, ' ').trim()
    return normalized || undefined
  }

  /**
   * 规范化摘要
   * 使用轻量截断，避免把整段回复正文直接塞进通知正文
   */
  private normalizeExcerpt(value?: string) {
    const normalized = this.normalizeDisplayText(value)
    if (!normalized) {
      return undefined
    }
    if (
      normalized.length
      <= MessageNotificationComposerService.NOTIFICATION_EXCERPT_MAX_LENGTH
    ) {
      return normalized
    }
    return `${normalized.slice(
      0,
      MessageNotificationComposerService.NOTIFICATION_EXCERPT_MAX_LENGTH,
    ).trimEnd()}...`
  }

  /**
   * 构造通用通知事件
   * 保持输出与 outbox 入参结构兼容，业务侧可直接入队
   */
  buildEvent<TPayload = unknown>(
    input: BuildMessageNotificationEventInput<TPayload>,
  ): MessageNotificationComposedEvent<TPayload> {
    return {
      bizKey: input.bizKey,
      payload: {
        receiverUserId: input.receiverUserId,
        actorUserId: input.actorUserId,
        type: input.type,
        targetType: input.targetType,
        targetId: input.targetId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        title: input.title,
        content: input.content,
        payload: input.payload,
        aggregateKey: input.aggregateKey,
        aggregateCount: input.aggregateCount,
        expiredAt: input.expiredAt,
      },
    }
  }

  /**
   * 构造主题点赞通知事件
   * 使用展示快照构造主题点赞动态 fallback 文案
   */
  buildTopicLikeEvent(
    input: BuildTopicLikeNotificationEventInput,
  ) {
    const actorNickname = this.normalizeActorNickname(input.payload.actorNickname)
    const topicTitle = this.normalizeTopicTitle(input.payload.topicTitle)

    return this.buildEvent({
      ...input,
      type: MessageNotificationTypeEnum.TOPIC_LIKE,
      title: `${actorNickname} 点赞了你的主题`,
      content: topicTitle,
      payload: {
        ...input.payload,
        actorNickname,
        topicTitle,
      },
    })
  }

  /**
   * 构造主题收藏通知事件
   * 使用展示快照构造主题收藏动态 fallback 文案
   */
  buildTopicFavoriteEvent(
    input: BuildTopicFavoriteNotificationEventInput,
  ) {
    const actorNickname = this.normalizeActorNickname(input.payload.actorNickname)
    const topicTitle = this.normalizeTopicTitle(input.payload.topicTitle)

    return this.buildEvent({
      ...input,
      type: MessageNotificationTypeEnum.TOPIC_FAVORITE,
      title: `${actorNickname} 收藏了你的主题`,
      content: topicTitle,
      payload: {
        ...input.payload,
        actorNickname,
        topicTitle,
      },
    })
  }

  /**
   * 构造主题评论通知事件
   * subject 固定为评论，后续主题被评论通知链路可直接复用
   */
  buildTopicCommentEvent(
    input: BuildTopicCommentNotificationEventInput,
  ) {
    const actorNickname = this.normalizeActorNickname(input.payload.actorNickname)
    const topicTitle = this.normalizeTopicTitle(input.payload.topicTitle)
    const commentExcerpt = this.normalizeExcerpt(input.payload.commentExcerpt)
      ?? topicTitle

    return this.buildEvent({
      ...input,
      type: MessageNotificationTypeEnum.TOPIC_COMMENT,
      subjectType: MessageNotificationSubjectTypeEnum.COMMENT,
      title: `${actorNickname} 评论了你的主题`,
      content: commentExcerpt,
      payload: {
        ...input.payload,
        actorNickname,
        topicTitle,
        commentExcerpt,
      },
    })
  }

  /**
   * 构造评论回复通知事件
   * 统一处理回复摘要、目标标题兜底与动态标题
   */
  buildCommentReplyEvent(
    input: BuildCommentReplyNotificationEventInput,
  ) {
    const actorNickname = this.normalizeActorNickname(input.payload.actorNickname)
    const targetDisplayTitle = this.normalizeDisplayText(
      input.payload.targetDisplayTitle,
    )
    const replyExcerpt = this.normalizeExcerpt(input.payload.replyExcerpt)
      ?? targetDisplayTitle

    return this.buildEvent({
      ...input,
      type: MessageNotificationTypeEnum.COMMENT_REPLY,
      subjectType: MessageNotificationSubjectTypeEnum.COMMENT,
      title: `${actorNickname} 回复了你的评论`,
      content: replyExcerpt ?? '你收到了一条新的评论回复',
      payload: {
        ...input.payload,
        actorNickname,
        replyExcerpt,
        targetDisplayTitle,
      },
    })
  }
}
