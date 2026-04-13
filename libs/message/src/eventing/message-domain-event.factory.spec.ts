import { MessageDomainEventFactoryService } from './message-domain-event.factory'

describe('messageDomainEventFactoryService', () => {
  let service: MessageDomainEventFactoryService

  beforeEach(() => {
    service = new MessageDomainEventFactoryService()
  })

  it('buildCommentLikeEvent 会把触发者昵称写入标题、正文和 payload', () => {
    const event = service.buildCommentLikeEvent({
      receiverUserId: 7,
      actorUserId: 9,
      commentId: 101,
      targetType: 5,
      targetId: 77,
      actorNickname: '阿澈',
    })

    expect(event.context).toEqual(
      expect.objectContaining({
        title: '阿澈 点赞了你的评论',
        content: '阿澈 点赞了你的评论',
        payload: expect.objectContaining({
          actorNickname: '阿澈',
        }),
      }),
    )
  })

  it('buildUserFollowedEvent 会把触发者昵称写入标题、正文和 payload', () => {
    const event = service.buildUserFollowedEvent({
      receiverUserId: 7,
      actorUserId: 9,
      targetType: 1,
      targetId: 7,
      actorNickname: '小光',
    })

    expect(event.context).toEqual(
      expect.objectContaining({
        title: '小光 关注了你',
        content: '小光 关注了你',
        payload: expect.objectContaining({
          actorNickname: '小光',
        }),
      }),
    )
  })
})
