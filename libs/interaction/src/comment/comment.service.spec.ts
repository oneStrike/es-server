/// <reference types="jest" />
import 'reflect-metadata'
import { EventEnvelopeGovernanceStatusEnum } from '@libs/growth/event-definition/event-envelope.type'
import { CommentService } from './comment.service'

type CommentServicePrivateApi = {
  compensateVisibleCommentEffects: (...args: unknown[]) => Promise<void>
  materializeCommentBodyInTx: (
    tx: unknown,
    content: string,
    actorUserId: number,
    targetType: number,
    mentions?: Array<{
      userId: number
      nickname: string
      start: number
      end: number
    }>,
  ) => Promise<{
    body: {
      type: 'doc'
      content: Array<{
        type: 'paragraph'
        content: Array<Record<string, unknown>>
      }>
    }
  }>
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
    {} as never,
    {} as never,
    mentionService as never,
    {} as never,
    {} as never,
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

function createMaterializeCommentBodyHarness() {
  const bodyValidatorService = {
    validateBodyOrThrow: jest.fn((body: unknown) => body),
  }
  const bodyCompilerService = {
    compile: jest.fn(async (body: unknown) => ({
      body,
      plainText: '欢迎 @测试用户 使用 :smile:',
      bodyTokens: [],
      mentionFacts: [],
      emojiRecentUsageItems: [],
    })),
  }
  const forumHashtagBodyService = {
    materializeBodyInTx: jest.fn(
      async ({ body }: { body: unknown }) => ({
        body,
        hashtagFacts: [],
      }),
    ),
  }

  const service = new CommentService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    bodyValidatorService as never,
    bodyCompilerService as never,
    {} as never,
    {} as never,
    {} as never,
    forumHashtagBodyService as never,
    {} as never,
  )

  return {
    service,
    forumHashtagBodyService,
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

  it('requires explicit mention metadata when materializing plain comment body', async () => {
    const harness = createMaterializeCommentBodyHarness()

    await expect(
      (
        harness.service as unknown as CommentServicePrivateApi
      ).materializeCommentBodyInTx(
        {} as never,
        '欢迎 @测试用户',
        9,
        5,
      ),
    ).rejects.toThrow('mentions')
  })

  it('materializes plain comment body into structured mention and emoji nodes before compilation', async () => {
    const harness = createMaterializeCommentBodyHarness()

    await (
      harness.service as unknown as CommentServicePrivateApi
    ).materializeCommentBodyInTx(
      {} as never,
      '欢迎 @测试用户 使用 :smile:\n第二行😀',
      9,
      5,
      [
        {
          userId: 9,
          nickname: '测试用户',
          start: 3,
          end: 8,
        },
      ],
    )

    expect(harness.forumHashtagBodyService.materializeBodyInTx).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: '欢迎 ' },
                { type: 'mentionUser', userId: 9, nickname: '测试用户' },
                { type: 'text', text: ' 使用 ' },
                { type: 'emojiCustom', shortcode: 'smile' },
                { type: 'hardBreak' },
                { type: 'text', text: '第二行' },
                { type: 'emojiUnicode', unicodeSequence: '😀' },
              ],
            },
          ],
        },
      }),
    )
  })
})
