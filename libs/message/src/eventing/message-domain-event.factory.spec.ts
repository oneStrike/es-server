import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { MessageDomainEventFactoryService } from './message-domain-event.factory'

describe('message-domain-event.factory', () => {
  it('builds comment reply payload with parentComment when provided', () => {
    const service = new MessageDomainEventFactoryService()

    const event = service.buildCommentRepliedEvent({
      receiverUserId: 2,
      actorUserId: 3,
      commentId: 101,
      parentCommentId: 88,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: 7,
      actorNickname: '小光',
      replyExcerpt: '这是新的回复内容',
      parentCommentExcerpt: '这是被回复的父评论',
      targetDisplayTitle: '主题标题',
    })

    expect(event.context.payload).toEqual({
      object: {
        kind: 'comment',
        id: 101,
        snippet: '这是新的回复内容',
      },
      parentComment: {
        kind: 'comment',
        id: 88,
        snippet: '这是被回复的父评论',
      },
      container: {
        kind: 'topic',
        id: 7,
        title: '主题标题',
      },
    })
  })

  it('omits parentComment when no parent comment data is provided', () => {
    const service = new MessageDomainEventFactoryService()

    const event = service.buildCommentRepliedEvent({
      receiverUserId: 2,
      actorUserId: 3,
      commentId: 101,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: 7,
      actorNickname: '小光',
      replyExcerpt: '这是新的回复内容',
      targetDisplayTitle: '主题标题',
    })

    expect(event.context.payload).toEqual({
      object: {
        kind: 'comment',
        id: 101,
        snippet: '这是新的回复内容',
      },
      container: {
        kind: 'topic',
        id: 7,
        title: '主题标题',
      },
    })
  })
})
