/// <reference types="jest" />
import 'reflect-metadata'
import { appUser, userComment } from '@db/schema'
import { EventEnvelopeGovernanceStatusEnum } from '@libs/growth/event-definition/event-envelope.type'
import { AuditRoleEnum, AuditStatusEnum } from '@libs/platform/constant'
import { CommentService } from './comment.service'
import { CommentTargetTypeEnum } from './comment.constant'

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
    renderHtml: jest.fn(
      (body: { content?: Array<{ content?: Array<{ text?: string }> }> }) =>
        `<p>${body.content?.[0]?.content?.[0]?.text ?? ''}</p>`,
    ),
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
    materializeBodyInTx: jest.fn(async ({ body }: { body: unknown }) => ({
      body,
      hashtagFacts: [],
    })),
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
    {} as never,
  )

  return {
    service,
    bodyHtmlCodecService,
    forumHashtagBodyService,
  }
}

function createCommentReadSummaryServiceMock() {
  return {
    buildTargetSummaryKey: jest.fn(
      (target: { targetType: number; targetId: number }) =>
        `${target.targetType}:${target.targetId}`,
    ),
    buildAuditorSummaryKey: jest.fn((auditor: { auditById?: number | null }) =>
      auditor.auditById ? `admin:${auditor.auditById}` : undefined,
    ),
    getCommentTargetSummaryMap: jest.fn(),
    getReplyCommentSummaryMap: jest.fn(),
    getAuditorSummaryMap: jest.fn(),
  }
}

function createCommentReadServiceHarness(options: {
  page?: unknown
  users?: unknown[]
  detail?: unknown
}) {
  const summaryService = createCommentReadSummaryServiceMock()
  const findPagination = jest.fn().mockResolvedValue(options.page)
  const select = jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn().mockResolvedValue(options.users ?? []),
    })),
  }))
  const drizzle = {
    db: {
      select,
      query: {
        userComment: {
          findFirst: jest.fn().mockResolvedValue(options.detail),
        },
      },
    },
    schema: {
      appUser,
      userComment,
    },
    ext: {
      findPagination,
    },
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
    drizzle as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    summaryService as never,
  )

  return {
    service,
    summaryService,
    findPagination,
    select,
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
      ).materializeCommentBodyInTx({} as never, '   ', 9, 5),
    ).rejects.toThrow('html 不能为空')
  })

  it('materializes comment html into canonical body before hashtag processing', async () => {
    const harness = createMaterializeCommentBodyHarness()

    await (
      harness.service as unknown as CommentServicePrivateApi
    ).materializeCommentBodyInTx({} as never, '<p>评论正文</p>', 9, 5)

    expect(harness.bodyHtmlCodecService.parseHtmlOrThrow).toHaveBeenCalledWith(
      '<p>评论正文</p>',
      'comment',
    )
    expect(
      harness.forumHashtagBodyService.materializeBodyInTx,
    ).toHaveBeenCalledWith(
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

describe('CommentService summary decoration', () => {
  it('adds target summaries to my comment pages', async () => {
    const comment = {
      id: 21,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: 99,
      userId: 7,
      html: '<p>评论</p>',
      floor: 1,
      replyToId: null,
      actualReplyToId: null,
      isHidden: false,
      auditStatus: AuditStatusEnum.APPROVED,
      auditById: null,
      auditRole: null,
      auditReason: null,
      auditAt: null,
      likeCount: 0,
      sensitiveWordHits: null,
      geoCountry: null,
      geoProvince: null,
      geoCity: null,
      geoIsp: null,
      deletedAt: null,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    }
    const page = {
      list: [comment],
      pageIndex: 1,
      pageSize: 20,
      total: 1,
    }
    const targetSummary = {
      targetId: 99,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetTypeName: '论坛主题',
      title: '主题标题',
    }
    const { service, summaryService } = createCommentReadServiceHarness({
      page,
    })
    summaryService.getCommentTargetSummaryMap.mockResolvedValue(
      new Map([['5:99', targetSummary]]),
    )

    const result = await service.getUserComments(
      {
        pageIndex: 1,
        pageSize: 20,
      } as never,
      7,
    )

    expect(result.list[0]).toMatchObject({
      targetSummary,
    })
    expect(summaryService.getCommentTargetSummaryMap).toHaveBeenCalledWith(
      page.list,
    )
  })

  it('adds target and reply summaries to admin comment pages', async () => {
    const comment = {
      id: 21,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: 99,
      userId: 7,
      html: '<p>评论</p>',
      floor: 1,
      replyToId: 12,
      actualReplyToId: 12,
      isHidden: false,
      auditStatus: AuditStatusEnum.APPROVED,
      auditById: null,
      auditRole: null,
      auditReason: null,
      auditAt: null,
      likeCount: 0,
      sensitiveWordHits: null,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    }
    const page = {
      list: [comment],
      pageIndex: 1,
      pageSize: 20,
      total: 1,
    }
    const targetSummary = {
      targetId: 99,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetTypeName: '论坛主题',
      title: '主题标题',
    }
    const replyToSummary = {
      commentId: 12,
      contentExcerpt: '父评论',
      userNickname: '父评论作者',
      userAvatarUrl: 'https://example.com/avatar.png',
      userStatus: 1,
      userIsEnabled: true,
      auditStatus: AuditStatusEnum.APPROVED,
      isHidden: false,
    }
    const { service, summaryService } = createCommentReadServiceHarness({
      page,
      users: [
        {
          id: 7,
          nickname: '评论作者',
          avatarUrl: 'https://example.com/user.png',
          status: 1,
          isEnabled: true,
        },
      ],
    })
    summaryService.getCommentTargetSummaryMap.mockResolvedValue(
      new Map([['5:99', targetSummary]]),
    )
    summaryService.getReplyCommentSummaryMap.mockResolvedValue(
      new Map([[12, replyToSummary]]),
    )

    const result = await service.getAdminCommentPage({
      pageIndex: 1,
      pageSize: 20,
    } as never)

    expect(result.list[0]).toMatchObject({
      user: {
        id: 7,
        nickname: '评论作者',
      },
      targetSummary,
      replyToSummary,
    })
    expect(summaryService.getReplyCommentSummaryMap).toHaveBeenCalledWith([12])
  })

  it('adds target and auditor summaries to admin comment detail', async () => {
    const comment = {
      id: 21,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: 99,
      userId: 7,
      html: '<p>评论</p>',
      floor: 1,
      replyToId: null,
      actualReplyToId: null,
      isHidden: false,
      auditStatus: AuditStatusEnum.APPROVED,
      auditById: 2,
      auditRole: AuditRoleEnum.ADMIN,
      auditReason: null,
      auditAt: new Date('2026-05-01T00:00:00.000Z'),
      likeCount: 0,
      sensitiveWordHits: null,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      deletedAt: null,
      user: {
        id: 7,
        nickname: '评论作者',
        avatarUrl: 'https://example.com/user.png',
        status: 1,
        isEnabled: true,
      },
      replyTo: null,
    }
    const targetSummary = {
      targetId: 99,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetTypeName: '论坛主题',
      title: '主题标题',
    }
    const auditorSummary = {
      id: 2,
      username: 'admin',
      nickname: 'admin',
      avatar: undefined,
      roleName: '普通管理员',
    }
    const { service, summaryService } = createCommentReadServiceHarness({
      detail: comment,
    })
    summaryService.getCommentTargetSummaryMap.mockResolvedValue(
      new Map([['5:99', targetSummary]]),
    )
    summaryService.getAuditorSummaryMap.mockResolvedValue(
      new Map([['admin:2', auditorSummary]]),
    )

    const result = await service.getAdminCommentDetail(21)

    expect(result).toMatchObject({
      targetSummary,
      auditorSummary,
    })
    expect(summaryService.getCommentTargetSummaryMap).toHaveBeenCalledWith(
      [comment],
      { detail: true },
    )
    expect(summaryService.getAuditorSummaryMap).toHaveBeenCalledWith([
      {
        auditById: 2,
        auditRole: AuditRoleEnum.ADMIN,
      },
    ])
  })
})
