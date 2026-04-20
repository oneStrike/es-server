import type { PublishMessageDomainEventInput } from './message-event.type'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { Injectable } from '@nestjs/common'

const MESSAGE_NOTIFICATION_WHITESPACE_REGEX = /\s+/g

@Injectable()
export class MessageDomainEventFactoryService {
  private static readonly EXCERPT_MAX_LENGTH = 60

  private normalizeActorNickname(value?: string) {
    const normalized = value?.trim()
    return normalized || '有人'
  }

  private normalizeTopicTitle(value?: string) {
    const normalized = value?.trim()
    return normalized || '你的主题'
  }

  private normalizeDisplayText(value?: string) {
    const normalized = value
      ?.replace(MESSAGE_NOTIFICATION_WHITESPACE_REGEX, ' ')
      .trim()
    return normalized || undefined
  }

  private normalizeExcerpt(value?: string) {
    const normalized = this.normalizeDisplayText(value)
    if (!normalized) {
      return undefined
    }
    if (
      normalized.length <= MessageDomainEventFactoryService.EXCERPT_MAX_LENGTH
    ) {
      return normalized
    }
    return `${normalized
      .slice(0, MessageDomainEventFactoryService.EXCERPT_MAX_LENGTH)
      .trimEnd()}...`
  }

  private buildCommentSnapshot(commentId: number, snippet?: string) {
    return {
      kind: 'comment' as const,
      id: commentId,
      snippet,
    }
  }

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

  private buildTopicSnapshot(topicId: number, title?: string) {
    return {
      kind: 'topic' as const,
      id: topicId,
      title,
    }
  }

  buildCommentMentionEvent(input: {
    receiverUserId: number
    actorUserId: number
    commentId: number
    targetType: number
    targetId: number
    actorNickname?: string
    commentExcerpt?: string
    targetDisplayTitle?: string
  }) {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    const targetDisplayTitle = this.normalizeDisplayText(
      input.targetDisplayTitle,
    )
    const commentExcerpt =
      this.normalizeExcerpt(input.commentExcerpt) ?? targetDisplayTitle

    return {
      eventKey: 'comment.mentioned',
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'comment',
      targetId: input.commentId,
      operatorId: input.actorUserId,
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey: `notify:comment-mention:${input.commentId}:receiver:${input.receiverUserId}`,
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
    } satisfies PublishMessageDomainEventInput
  }

  buildTopicMentionEvent(input: {
    receiverUserId: number
    actorUserId: number
    topicId: number
    actorNickname?: string
    topicTitle?: string
  }) {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    const topicTitle = this.normalizeTopicTitle(input.topicTitle)

    return {
      eventKey: 'topic.mentioned',
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'forum_topic',
      targetId: input.topicId,
      operatorId: input.actorUserId,
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey: `notify:topic-mention:${input.topicId}:receiver:${input.receiverUserId}`,
        title: `${actorNickname} 在主题中提到了你`,
        content: topicTitle,
        payload: {
          object: this.buildTopicSnapshot(input.topicId, topicTitle),
        },
      },
    } satisfies PublishMessageDomainEventInput
  }

  buildCommentLikeEvent(input: {
    receiverUserId: number
    actorUserId: number
    commentId: number
    targetType: number
    targetId: number
    actorNickname?: string
    commentExcerpt?: string
  }) {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    const commentExcerpt = this.normalizeExcerpt(input.commentExcerpt)

    return {
      eventKey: 'comment.liked',
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'comment',
      targetId: input.commentId,
      operatorId: input.actorUserId,
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey: `notify:comment:like:${input.commentId}:actor:${input.actorUserId}:receiver:${input.receiverUserId}`,
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
    } satisfies PublishMessageDomainEventInput
  }

  buildUserFollowedEvent(input: {
    receiverUserId: number
    actorUserId: number
    targetType: number
    targetId: number
    actorNickname?: string
  }) {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    return {
      eventKey: 'user.followed',
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'user',
      targetId: input.targetId,
      operatorId: input.actorUserId,
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey: `notify:follow:${input.targetType}:${input.targetId}:actor:${input.actorUserId}:receiver:${input.receiverUserId}`,
        title: `${actorNickname} 关注了你`,
        content: `${actorNickname} 关注了你`,
        payload: null,
      },
    } satisfies PublishMessageDomainEventInput
  }

  buildTopicLikedEvent(input: {
    receiverUserId: number
    actorUserId: number
    targetType: number
    targetId: number
    actorNickname?: string
    topicTitle?: string
  }) {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    const topicTitle = this.normalizeTopicTitle(input.topicTitle)
    return {
      eventKey: 'topic.liked',
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'forum_topic',
      targetId: input.targetId,
      operatorId: input.actorUserId,
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey: `notify:like:${input.targetType}:${input.targetId}:actor:${input.actorUserId}:receiver:${input.receiverUserId}`,
        title: `${actorNickname} 点赞了你的主题`,
        content: topicTitle,
        payload: {
          object: this.buildTopicSnapshot(input.targetId, topicTitle),
        },
      },
    } satisfies PublishMessageDomainEventInput
  }

  buildTopicFavoritedEvent(input: {
    receiverUserId: number
    actorUserId: number
    targetType: number
    targetId: number
    actorNickname?: string
    topicTitle?: string
  }) {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    const topicTitle = this.normalizeTopicTitle(input.topicTitle)
    return {
      eventKey: 'topic.favorited',
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'forum_topic',
      targetId: input.targetId,
      operatorId: input.actorUserId,
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey: `notify:favorite:${input.targetType}:${input.targetId}:actor:${input.actorUserId}:receiver:${input.receiverUserId}`,
        title: `${actorNickname} 收藏了你的主题`,
        content: topicTitle,
        payload: {
          object: this.buildTopicSnapshot(input.targetId, topicTitle),
        },
      },
    } satisfies PublishMessageDomainEventInput
  }

  buildTopicCommentedEvent(input: {
    receiverUserId: number
    actorUserId: number
    commentId: number
    targetType: number
    targetId: number
    actorNickname?: string
    topicTitle?: string
    commentExcerpt?: string
  }) {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    const topicTitle = this.normalizeTopicTitle(input.topicTitle)
    const commentExcerpt =
      this.normalizeExcerpt(input.commentExcerpt) ?? topicTitle
    return {
      eventKey: 'topic.commented',
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'forum_topic',
      targetId: input.targetId,
      operatorId: input.actorUserId,
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey: `notify:topic-comment:${input.targetType}:${input.targetId}:comment:${input.commentId}:receiver:${input.receiverUserId}`,
        title: `${actorNickname} 评论了你的主题`,
        content: commentExcerpt,
        payload: {
          object: this.buildCommentSnapshot(input.commentId, commentExcerpt),
          container: this.buildTopicSnapshot(input.targetId, topicTitle),
        },
      },
    } satisfies PublishMessageDomainEventInput
  }

  buildCommentRepliedEvent(input: {
    receiverUserId: number
    actorUserId: number
    commentId: number
    targetType: number
    targetId: number
    actorNickname?: string
    replyExcerpt?: string
    targetDisplayTitle?: string
  }) {
    const actorNickname = this.normalizeActorNickname(input.actorNickname)
    const targetDisplayTitle = this.normalizeDisplayText(
      input.targetDisplayTitle,
    )
    const replyExcerpt =
      this.normalizeExcerpt(input.replyExcerpt) ?? targetDisplayTitle
    return {
      eventKey: 'comment.replied',
      subjectType: 'user',
      subjectId: input.actorUserId,
      targetType: 'comment',
      targetId: input.commentId,
      operatorId: input.actorUserId,
      context: {
        receiverUserId: input.receiverUserId,
        projectionKey: `comment:reply:${input.commentId}:to:${input.receiverUserId}`,
        title: `${actorNickname} 回复了你的评论`,
        content: replyExcerpt ?? '你收到了一条新的评论回复',
        payload: {
          object: this.buildCommentSnapshot(input.commentId, replyExcerpt),
          container: this.buildCommentContainerSnapshot(
            input.targetType,
            input.targetId,
            targetDisplayTitle,
          ),
        },
      },
    } satisfies PublishMessageDomainEventInput
  }
}
