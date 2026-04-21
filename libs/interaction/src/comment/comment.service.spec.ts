/// <reference types="jest" />
import 'reflect-metadata'
import { EventEnvelopeGovernanceStatusEnum } from '@libs/growth/event-definition/event-envelope.type'
import { CommentService } from './comment.service'

type CommentServicePrivateApi = {
  compensateVisibleCommentEffects: (...args: unknown[]) => Promise<void>
}

function createCommentServiceHarness() {
  const mentionService = {
    dispatchCommentMentionsInTx: jest.fn().mockResolvedValue(undefined),
  }
  const messageDomainEventPublisher = {
    publishInTx: jest.fn().mockResolvedValue(undefined),
  }
  const messageDomainEventFactoryService = {
    buildCommentRepliedEvent: jest.fn((input: unknown) => input),
  }

  const service = new CommentService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    messageDomainEventPublisher as never,
    messageDomainEventFactoryService as never,
    {} as never,
    {} as never,
    mentionService as never,
    {} as never,
    {} as never,
  )

  return {
    service,
    mentionService,
    messageDomainEventPublisher,
    messageDomainEventFactoryService,
  }
}

describe('CommentService mention notification coordination', () => {
  it('excludes the reply target from comment mention receivers when reply notification will be sent', async () => {
    const harness = createCommentServiceHarness()
    const internalService =
      harness.service as unknown as CommentServicePrivateApi
    const tx = {
      query: {
        userComment: {
          findFirst: jest.fn().mockResolvedValue({
            id: 12,
            userId: 8,
            content: '原评论',
          }),
        },
        appUser: {
          findFirst: jest.fn().mockResolvedValue({
            nickname: '作者',
          }),
        },
      },
    }

    await internalService.compensateVisibleCommentEffects(
      tx,
      {
        id: 33,
        userId: 3,
        targetType: 5,
        targetId: 99,
        replyToId: 12,
        content: '@原评论作者 你好',
      },
      {
        targetDisplayTitle: '测试主题',
      },
      {
        code: 'manual',
        governanceStatus: EventEnvelopeGovernanceStatusEnum.NONE,
      },
    )

    expect(
      harness.mentionService.dispatchCommentMentionsInTx,
    ).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        excludedReceiverUserIds: [8],
      }),
    )
    expect(
      harness.messageDomainEventFactoryService.buildCommentRepliedEvent,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        receiverUserId: 8,
      }),
    )
    expect(
      harness.messageDomainEventPublisher.publishInTx,
    ).toHaveBeenCalledTimes(1)
  })
})
