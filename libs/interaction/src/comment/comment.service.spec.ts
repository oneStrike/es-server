/// <reference types="jest" />
import 'reflect-metadata'
import { EventEnvelopeGovernanceStatusEnum } from '@libs/growth/event-definition/event-envelope.type'
import { CommentService } from './comment.service'

type CommentServicePrivateApi = {
  compensateVisibleCommentEffects: (...args: unknown[]) => Promise<void>
  materializeCommentBodyInTx: (
    tx: unknown,
    html: string,
    actorUserId: number,
    targetType: number,
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
  const bodyHtmlCodecService = {
    parseHtmlOrThrow: jest.fn((html: string) => ({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: html }],
        },
      ],
    })),
    renderHtml: jest.fn((body: { content?: Array<{ content?: Array<{ text?: string }> }> }) =>
      `<p>${body.content?.[0]?.content?.[0]?.text ?? ''}</p>`),
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
    bodyHtmlCodecService as never,
    bodyCompilerService as never,
    {} as never,
    {} as never,
    {} as never,
    forumHashtagBodyService as never,
    {} as never,
  )

  return {
    service,
    bodyHtmlCodecService,
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

  it('rejects blank comment html before materialization', async () => {
    const harness = createMaterializeCommentBodyHarness()

    await expect(
      (
        harness.service as unknown as CommentServicePrivateApi
      ).materializeCommentBodyInTx(
        {} as never,
        '   ',
        9,
        5,
      ),
    ).rejects.toThrow('html 不能为空')
  })

  it('materializes comment html into canonical body before hashtag processing', async () => {
    const harness = createMaterializeCommentBodyHarness()

    await (
      harness.service as unknown as CommentServicePrivateApi
    ).materializeCommentBodyInTx(
      {} as never,
      '<p>评论正文</p>',
      9,
      5,
    )

    expect(harness.bodyHtmlCodecService.parseHtmlOrThrow).toHaveBeenCalledWith(
      '<p>评论正文</p>',
      'comment',
    )
    expect(harness.forumHashtagBodyService.materializeBodyInTx).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: '<p>评论正文</p>' }],
            },
          ],
        },
      }),
    )
  })
})
