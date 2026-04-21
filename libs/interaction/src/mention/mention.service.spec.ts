/// <reference types="jest" />
import 'reflect-metadata'
import type { DrizzleService } from '@db/core'
import { userMention } from '@db/schema'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { MentionSourceTypeEnum } from './mention.constant'
import { MentionService } from './mention.service'

type MentionServicePrivateApi = {
  getPendingMentionReceiverUserIds: (...args: unknown[]) => Promise<number[]>
  getActorSnapshot: (
    ...args: unknown[]
  ) => Promise<{ id: number; nickname: string } | undefined>
  markMentionReceiversNotifiedInTx: (...args: unknown[]) => Promise<void>
  normalizeMentions: (...args: unknown[]) => Array<{
    userId: number
    nickname: string
    start: number
    end: number
    text: string
  }>
}

function createMentionServiceHarness() {
  const drizzle = {
    schema: {
      userMention,
    },
  } as unknown as DrizzleService
  const emojiParserService = {
    parse: jest.fn(),
  }
  const userService = {
    findAvailableUsersByIds: jest.fn(),
  }
  const messageDomainEventPublisher = {
    publishInTx: jest.fn().mockResolvedValue(undefined),
  }
  const messageDomainEventFactoryService = {
    buildCommentMentionEvent: jest.fn((input: unknown) => input),
    buildTopicMentionEvent: jest.fn((input: unknown) => input),
  }

  const service = new MentionService(
    drizzle,
    emojiParserService as never,
    userService as never,
    messageDomainEventPublisher as never,
    messageDomainEventFactoryService as never,
  )

  return {
    service,
    userService,
    messageDomainEventPublisher,
    messageDomainEventFactoryService,
  }
}

describe('MentionService notification dispatch', () => {
  it('suppresses self topic mentions and still marks pending rows notified', async () => {
    const harness = createMentionServiceHarness()
    const internalService =
      harness.service as unknown as MentionServicePrivateApi
    const getPendingMentionReceiverUserIdsSpy = jest
      .spyOn(internalService, 'getPendingMentionReceiverUserIds')
      .mockResolvedValue([7, 9])
    const getActorSnapshotSpy = jest
      .spyOn(internalService, 'getActorSnapshot')
      .mockResolvedValue({ id: 7, nickname: '作者' })
    const markMentionReceiversNotifiedInTxSpy = jest
      .spyOn(internalService, 'markMentionReceiversNotifiedInTx')
      .mockResolvedValue(undefined)

    await harness.service.dispatchTopicMentionsInTx(
      {} as Parameters<MentionService['dispatchTopicMentionsInTx']>[0],
      {
        topicId: 12,
        actorUserId: 7,
        topicTitle: '测试主题',
      },
    )

    expect(getPendingMentionReceiverUserIdsSpy).toHaveBeenCalled()
    expect(getActorSnapshotSpy).toHaveBeenCalledTimes(1)
    expect(
      harness.messageDomainEventFactoryService.buildTopicMentionEvent,
    ).toHaveBeenCalledTimes(1)
    expect(
      harness.messageDomainEventFactoryService.buildTopicMentionEvent,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        receiverUserId: 9,
      }),
    )
    expect(
      harness.messageDomainEventPublisher.publishInTx,
    ).toHaveBeenCalledTimes(1)
    expect(markMentionReceiversNotifiedInTxSpy).toHaveBeenCalledWith(
      expect.anything(),
      MentionSourceTypeEnum.FORUM_TOPIC,
      12,
      [7, 9],
    )
  })

  it('skips excluded comment mention receivers while sealing pending rows', async () => {
    const harness = createMentionServiceHarness()
    const internalService =
      harness.service as unknown as MentionServicePrivateApi
    const getActorSnapshotSpy = jest
      .spyOn(internalService, 'getActorSnapshot')
      .mockResolvedValue({ id: 3, nickname: '作者' })
    const markMentionReceiversNotifiedInTxSpy = jest
      .spyOn(internalService, 'markMentionReceiversNotifiedInTx')
      .mockResolvedValue(undefined)

    jest
      .spyOn(internalService, 'getPendingMentionReceiverUserIds')
      .mockResolvedValue([3, 8, 13])

    await harness.service.dispatchCommentMentionsInTx(
      {} as Parameters<MentionService['dispatchCommentMentionsInTx']>[0],
      {
        commentId: 24,
        actorUserId: 3,
        targetType: CommentTargetTypeEnum.FORUM_TOPIC,
        targetId: 99,
        content: '@用户 你好',
        excludedReceiverUserIds: [8],
      },
    )

    expect(getActorSnapshotSpy).toHaveBeenCalledTimes(1)
    expect(
      harness.messageDomainEventFactoryService.buildCommentMentionEvent,
    ).toHaveBeenCalledTimes(1)
    expect(
      harness.messageDomainEventFactoryService.buildCommentMentionEvent,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        receiverUserId: 13,
      }),
    )
    expect(markMentionReceiversNotifiedInTxSpy).toHaveBeenCalledWith(
      expect.anything(),
      MentionSourceTypeEnum.COMMENT,
      24,
      [3, 8, 13],
    )
  })

  it('raises BusinessException when mentioned users are unavailable', async () => {
    const harness = createMentionServiceHarness()
    const internalService =
      harness.service as unknown as MentionServicePrivateApi
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn().mockResolvedValue([]),
        })),
      })),
      delete: jest.fn(() => ({
        where: jest.fn().mockResolvedValue(undefined),
      })),
      insert: jest.fn(() => ({
        values: jest.fn().mockResolvedValue(undefined),
      })),
    }

    jest.spyOn(internalService, 'normalizeMentions').mockReturnValue([
      {
        userId: 11,
        nickname: '测试用户',
        start: 0,
        end: 5,
        text: '@测试用户',
      },
    ])
    harness.userService.findAvailableUsersByIds.mockResolvedValue([])

    await expect(
      harness.service.replaceMentionsInTx({
        tx: tx as unknown as Parameters<
          MentionService['replaceMentionsInTx']
        >[0]['tx'],
        sourceType: MentionSourceTypeEnum.COMMENT,
        sourceId: 1,
        content: '@测试用户',
      }),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.RESOURCE_NOT_FOUND,
      message: '被提及用户不存在或不可用',
    })

    expect(tx.insert).not.toHaveBeenCalled()
  })
})
