import { MessageDomainEventFactoryService } from './message-domain-event.factory'

describe('message domain event factory service', () => {
  const service = new MessageDomainEventFactoryService()

  it('builds comment like event with new object/container payload', () => {
    const event = service.buildCommentLikeEvent({
      receiverUserId: 1,
      actorUserId: 2,
      commentId: 7,
      targetType: 5,
      targetId: 8,
      actorNickname: '张三',
      commentExcerpt: '很关键的一条评论',
    })

    expect(event.context?.payload).toEqual({
      object: {
        kind: 'comment',
        id: 7,
        snippet: '很关键的一条评论',
      },
      container: {
        kind: 'topic',
        id: 8,
        title: undefined,
      },
    })
  })

  it('builds user followed event with null payload', () => {
    const event = service.buildUserFollowedEvent({
      receiverUserId: 1,
      actorUserId: 2,
      targetType: 1,
      targetId: 1,
      actorNickname: '张三',
    })

    expect(event.context?.payload).toBeNull()
  })
})
