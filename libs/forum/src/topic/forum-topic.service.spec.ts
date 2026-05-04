import type { BodyToken } from '@libs/interaction/body/body-token.type'
import { BrowseLogTargetTypeEnum } from '@libs/interaction/browse-log/browse-log.constant'
import {
  AuditRoleEnum,
  AuditStatusEnum,
  BusinessErrorCode,
} from '@libs/platform/constant'
import { BadRequestException } from '@nestjs/common'
import { ForumTopicService } from './forum-topic.service'

type ForumTopicServicePrivateApi = {
  resolveCreateTopicTitle: (
    title: string | undefined,
    plainText: string,
  ) => string
  resolveUpdateTopicTitle: (currentTitle: string, title?: string) => string
  detectTopicSensitiveWords: (
    title: string,
    content: string,
  ) => { publicHits: unknown[] }
  normalizeTopicMedia: (
    media: {
      images?: string[]
      videos?: unknown
    },
    fallback?: {
      images: string[]
      videos: unknown
    },
  ) => {
    images: string[]
    videos: unknown
  }
  materializeTopicBodyInTx: (
    tx: unknown,
    input: {
      html?: string
    },
    actorUserId: number,
  ) => Promise<{
    body: {
      type: 'doc'
      content: Array<{
        type: 'paragraph'
        content: Array<Record<string, unknown>>
      }>
    }
    contentPreview: {
      plainText: string
      segments: Array<Record<string, unknown>>
    }
  }>
  deleteTopicWithCurrent: (
    topic: {
      id: number
      sectionId: number
      userId: number
      likeCount: number
      favoriteCount: number
      auditStatus: AuditStatusEnum
      isHidden: boolean
      deletedAt: null
    },
    context?: Record<string, unknown>,
  ) => Promise<void>
  moveTopic: (input: { id: number; sectionId: number }) => Promise<boolean>
  getTopicSectionBriefMap: (
    sectionIds: number[],
    options?: {
      requireEnabled?: boolean
    },
  ) => Promise<
    Map<
      number,
      {
        id: number
        name: string
        icon: string | null
        cover: string | null
      }
    >
  >
  getSectionTopicReviewPolicy: (
    sectionId: number,
    options?: {
      requireEnabled?: boolean
      notFoundMessage?: string
    },
  ) => Promise<number>
}

describe('forumTopicService helpers', () => {
  function createService() {
    return new ForumTopicService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )
  }

  function createAdminPageServiceHarness() {
    const listRows = [
      {
        id: 101,
        sectionId: 21,
        userId: 11,
        title: '有摘要主题',
      },
      {
        id: 102,
        sectionId: 22,
        userId: 12,
        title: '缺失关联主题',
      },
    ]
    const offset = jest.fn().mockReturnValue(Promise.resolve(listRows))
    const limit = jest.fn(() => ({ offset }))
    const where = jest.fn(() => ({ limit }))
    const from = jest.fn(() => ({ where }))
    const select = jest.fn(() => ({ from }))
    const appUserFindMany = jest.fn().mockResolvedValue([
      {
        id: 11,
        nickname: '发帖用户',
        avatarUrl: 'https://cdn.example.com/app/avatar.png',
        status: 1,
        isEnabled: true,
        level: {
          name: 'Lv2',
          deletedAt: null,
        },
      },
    ])
    const forumSectionFindMany = jest.fn().mockResolvedValue([
      {
        id: 21,
        name: '需求反馈',
        isEnabled: false,
        topicReviewPolicy: 2,
        group: {
          name: '已停用分组',
          isEnabled: false,
          deletedAt: null,
        },
      },
    ])
    const drizzle = {
      db: {
        select,
        $count: jest.fn().mockResolvedValue(2),
        query: {
          appUser: {
            findMany: appUserFindMany,
          },
          forumSection: {
            findMany: forumSectionFindMany,
          },
        },
      },
      schema: {
        forumTopic: {
          id: 'forumTopic.id',
          sectionId: 'forumTopic.sectionId',
          userId: 'forumTopic.userId',
          title: 'forumTopic.title',
          content: 'forumTopic.content',
          contentPreview: 'forumTopic.contentPreview',
          geoCountry: 'forumTopic.geoCountry',
          geoProvince: 'forumTopic.geoProvince',
          geoCity: 'forumTopic.geoCity',
          geoIsp: 'forumTopic.geoIsp',
          images: 'forumTopic.images',
          videos: 'forumTopic.videos',
          isPinned: 'forumTopic.isPinned',
          isFeatured: 'forumTopic.isFeatured',
          isLocked: 'forumTopic.isLocked',
          isHidden: 'forumTopic.isHidden',
          auditStatus: 'forumTopic.auditStatus',
          auditReason: 'forumTopic.auditReason',
          auditAt: 'forumTopic.auditAt',
          viewCount: 'forumTopic.viewCount',
          likeCount: 'forumTopic.likeCount',
          commentCount: 'forumTopic.commentCount',
          favoriteCount: 'forumTopic.favoriteCount',
          lastCommentAt: 'forumTopic.lastCommentAt',
          lastCommentUserId: 'forumTopic.lastCommentUserId',
          createdAt: 'forumTopic.createdAt',
          updatedAt: 'forumTopic.updatedAt',
          deletedAt: 'forumTopic.deletedAt',
        },
      },
      buildPage: jest.fn().mockReturnValue({
        limit: 10,
        offset: 0,
        pageIndex: 1,
        pageSize: 10,
      }),
      buildOrderBy: jest.fn().mockReturnValue({
        orderBySql: [],
      }),
    }
    const service = new ForumTopicService(
      drizzle as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )

    return {
      appUserFindMany,
      forumSectionFindMany,
      service,
    }
  }

  function createAdminDetailServiceHarness(topic: Record<string, unknown>) {
    const auditorSummary = {
      id: 7,
      username: 'audit-admin',
      nickname: '审核员',
      roleName: '超级管理员',
      avatar: 'https://cdn.example.com/admin/avatar.png',
    }
    const interactionSummaryReadService = {
      buildAuditorSummaryKey: jest.fn().mockReturnValue('admin:7'),
      getAuditorSummaryMap: jest
        .fn()
        .mockResolvedValue(new Map([['admin:7', auditorSummary]])),
    }
    const growthBalanceQueryService = {
      getUserGrowthSnapshot: jest.fn().mockResolvedValue({ points: 88 }),
    }
    const drizzle = {
      db: {
        query: {
          forumTopic: {
            findFirst: jest.fn().mockResolvedValue(topic),
          },
        },
      },
      schema: {
        forumTopic: {},
      },
    }
    const service = new ForumTopicService(
      drizzle as never,
      {} as never,
      growthBalanceQueryService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      interactionSummaryReadService as never,
    )
    jest
      .spyOn(
        service as unknown as {
          getTopicHashtags: (topicId: number) => Promise<unknown[]>
        },
        'getTopicHashtags',
      )
      .mockResolvedValue([])

    return {
      auditorSummary,
      growthBalanceQueryService,
      interactionSummaryReadService,
      service,
    }
  }

  function createPublicDetailServiceHarness(
    topic: Record<string, unknown> | null,
  ) {
    const forumTopicFindFirst = jest.fn().mockResolvedValue(topic)
    const drizzle = {
      db: {
        query: {
          forumTopic: {
            findFirst: forumTopicFindFirst,
          },
        },
      },
      schema: {
        forumHashtag: {
          id: 'forumHashtag.id',
        },
        forumHashtagReference: {},
      },
    }
    const browseLogService = {
      recordBrowseLogSafely: jest.fn().mockResolvedValue(undefined),
    }
    const forumPermissionService = {
      ensureUserCanAccessSection: jest.fn().mockResolvedValue(undefined),
    }
    const likeService = {
      checkLikeStatus: jest.fn().mockResolvedValue(true),
    }
    const favoriteService = {
      checkFavoriteStatus: jest.fn().mockResolvedValue(false),
    }
    const followService = {
      checkFollowStatus: jest.fn().mockResolvedValue({ isFollowing: true }),
    }
    const service = new ForumTopicService(
      drizzle as never,
      {} as never,
      {} as never,
      {} as never,
      browseLogService as never,
      {} as never,
      {} as never,
      {} as never,
      forumPermissionService as never,
      likeService as never,
      favoriteService as never,
      followService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )
    jest
      .spyOn(
        service as unknown as {
          getTopicHashtags: (topicId: number) => Promise<unknown[]>
        },
        'getTopicHashtags',
      )
      .mockResolvedValue([])

    return {
      browseLogService,
      favoriteService,
      followService,
      forumPermissionService,
      forumTopicFindFirst,
      likeService,
      service,
    }
  }

  function createPublicDetailTopic() {
    return {
      id: 51,
      sectionId: 7,
      userId: 12,
      title: '公开主题',
      html: '<p>公开主题正文</p>',
      geoCountry: null,
      geoProvince: null,
      geoCity: null,
      geoIsp: null,
      images: [],
      videos: [],
      isPinned: false,
      isFeatured: false,
      isLocked: false,
      viewCount: 20,
      commentCount: 3,
      likeCount: 4,
      favoriteCount: 5,
      lastCommentAt: null,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-02T00:00:00.000Z'),
      user: {
        id: 12,
        nickname: '主题作者',
        avatarUrl: 'https://cdn.example.com/avatar.png',
      },
      section: {
        id: 7,
        name: '技术交流',
        cover: 'https://cdn.example.com/forum/section-cover.png',
        topicCount: 42,
        followersCount: 88,
      },
    }
  }

  function createDeleteTopicServiceHarness() {
    const updateWhere = jest.fn().mockResolvedValue([{ id: 1 }])
    const tx = {
      query: {
        userComment: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: updateWhere,
        })),
      })),
    }
    const drizzle = {
      db: {
        transaction: jest.fn(
          async (callback: (client: typeof tx) => Promise<void>) =>
            callback(tx),
        ),
      },
      schema: {
        forumTopic: {},
        userComment: {},
      },
      withErrorHandling: jest.fn(async (callback: () => Promise<void>) =>
        callback(),
      ),
      assertAffectedRows: jest.fn(),
    }
    const forumCounterService = {
      updateUserForumTopicCount: jest.fn().mockResolvedValue(undefined),
      updateUserForumTopicReceivedLikeCount: jest
        .fn()
        .mockResolvedValue(undefined),
      updateUserForumTopicReceivedFavoriteCount: jest
        .fn()
        .mockResolvedValue(undefined),
      updateSectionTopicCount: jest.fn().mockResolvedValue(undefined),
      syncSectionVisibleState: jest.fn().mockResolvedValue(undefined),
    }
    const appUserCountService = {
      updateCommentCount: jest.fn().mockResolvedValue(undefined),
      updateCommentReceivedLikeCount: jest.fn().mockResolvedValue(undefined),
    }
    const actionLogService = {
      createActionLog: jest.fn().mockResolvedValue(true),
    }
    const mentionService = {
      deleteMentionsInTx: jest.fn().mockResolvedValue(undefined),
    }
    const forumHashtagReferenceService = {
      deleteReferencesInTx: jest.fn().mockResolvedValue(undefined),
    }

    const service = new ForumTopicService(
      drizzle as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      forumCounterService as never,
      appUserCountService as never,
      actionLogService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      mentionService as never,
      {} as never,
      {} as never,
      {} as never,
      forumHashtagReferenceService as never,
      {} as never,
    )

    return {
      service,
      tx,
      forumCounterService,
    }
  }

  function createMoveTopicServiceHarness() {
    const updateWhere = jest.fn().mockResolvedValue([{ id: 9 }])
    const tx = {
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: updateWhere,
        })),
      })),
    }
    const drizzle = {
      db: {
        query: {
          forumTopic: {
            findFirst: jest.fn().mockResolvedValue({
              id: 9,
              sectionId: 3,
            }),
          },
        },
        transaction: jest.fn(
          async (callback: (client: typeof tx) => Promise<void>) =>
            callback(tx),
        ),
      },
      schema: {
        forumTopic: {},
      },
      withErrorHandling: jest.fn(async (callback: () => Promise<void>) =>
        callback(),
      ),
      assertAffectedRows: jest.fn(),
    }
    const forumCounterService = {
      syncSectionVisibleState: jest.fn().mockResolvedValue(undefined),
    }
    const forumHashtagReferenceService = {
      syncSectionIdsByTopicInTx: jest.fn().mockResolvedValue(undefined),
    }

    const service = new ForumTopicService(
      drizzle as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      forumCounterService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      forumHashtagReferenceService as never,
      {} as never,
    )
    jest
      .spyOn(
        service as unknown as {
          getSectionTopicReviewPolicy: (
            sectionId: number,
            options?: Record<string, unknown>,
          ) => Promise<number>
        },
        'getSectionTopicReviewPolicy',
      )
      .mockResolvedValue(0)

    return {
      drizzle,
      forumCounterService,
      forumHashtagReferenceService,
      service,
      tx,
    }
  }

  function createCreateTopicServiceHarness() {
    const execute = jest.fn().mockResolvedValue({ rows: [] })
    const forumSectionFindFirst = jest.fn().mockResolvedValue({
      id: 3,
      groupId: null,
      deletedAt: null,
      isEnabled: true,
      topicReviewPolicy: 1,
      group: null,
    })
    const returning = jest.fn().mockResolvedValue([
      {
        id: 33,
        title: '测试主题',
        userId: 12,
        sectionId: 3,
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
        deletedAt: null,
        createdAt: new Date('2026-04-28T00:00:00.000Z'),
      },
    ])
    const tx = {
      execute,
      query: {
        forumSection: {
          findFirst: forumSectionFindFirst,
        },
      },
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning,
        })),
      })),
    }
    const drizzle = {
      db: {
        transaction: jest.fn(
          async (callback: (client: typeof tx) => Promise<unknown>) =>
            callback(tx),
        ),
      },
      schema: {
        forumTopic: {},
      },
      withErrorHandling: jest.fn(async (callback: () => Promise<unknown>) =>
        callback(),
      ),
    }
    const forumPermissionService = {
      ensureUserCanCreateTopic: jest.fn().mockResolvedValue({
        id: 3,
        topicReviewPolicy: 1,
      }),
      isSectionPubliclyAvailable: jest.fn().mockReturnValue(true),
    }
    const forumCounterService = {
      updateUserForumTopicCount: jest.fn().mockResolvedValue(undefined),
      syncSectionVisibleState: jest.fn().mockResolvedValue(undefined),
    }
    const actionLogService = {
      createActionLog: jest.fn().mockResolvedValue(true),
    }
    const mentionService = {
      replaceMentionsInTx: jest.fn().mockResolvedValue(undefined),
      dispatchTopicMentionsInTx: jest.fn().mockResolvedValue(undefined),
    }
    const emojiCatalogService = {
      recordRecentUsageInTx: jest.fn().mockResolvedValue(undefined),
    }
    const sensitiveWordStatisticsService = {
      recordEntityHitsInTx: jest.fn().mockResolvedValue(undefined),
    }
    const forumHashtagReferenceService = {
      replaceReferencesInTx: jest.fn().mockResolvedValue(undefined),
    }
    const growthEventBridgeService = {
      dispatchDefinedEvent: jest.fn().mockResolvedValue(undefined),
    }

    const service = new ForumTopicService(
      drizzle as never,
      growthEventBridgeService as never,
      {} as never,
      {} as never,
      {} as never,
      forumCounterService as never,
      {} as never,
      actionLogService as never,
      forumPermissionService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      mentionService as never,
      emojiCatalogService as never,
      sensitiveWordStatisticsService as never,
      {} as never,
      forumHashtagReferenceService as never,
      {} as never,
    )
    jest
      .spyOn(
        service as unknown as ForumTopicServicePrivateApi,
        'materializeTopicBodyInTx',
      )
      .mockResolvedValue({
        plainText: '测试正文',
        html: '<p>测试正文</p>',
        body: {
          type: 'doc',
          content: [],
        },
        contentPreview: {
          plainText: '测试正文',
          segments: [{ type: 'text', text: '测试正文' }],
        },
        bodyTokens: [] as BodyToken[],
        mentionFacts: [],
        emojiRecentUsageItems: [],
        hashtagFacts: [],
      } as never)
    jest
      .spyOn(
        service as unknown as ForumTopicServicePrivateApi,
        'detectTopicSensitiveWords',
      )
      .mockReturnValue({
        hits: [],
        publicHits: [],
        highestLevel: undefined,
      } as never)

    return {
      forumPermissionService,
      forumSectionFindFirst,
      service,
      tx,
    }
  }

  function createMaterializeTopicBodyHarness() {
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
        bodyTokens: [] as BodyToken[],
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

    const service = new ForumTopicService(
      {} as never,
      {} as never,
      {} as never,
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
      bodyCompilerService,
      forumHashtagBodyService,
    }
  }

  function createSectionBriefMapHarness() {
    const forumPermissionService = {
      isSectionPubliclyAvailable: jest.fn(
        (section: {
          groupId?: number | null
          isEnabled: boolean
          group?: {
            isEnabled: boolean
            deletedAt: Date | null
          } | null
        }) =>
          !section.groupId ||
          Boolean(
            section.group &&
            section.group.isEnabled &&
            !section.group.deletedAt,
          ),
      ),
    }
    const service = new ForumTopicService(
      {
        db: {
          query: {
            forumSection: {
              findMany: jest.fn().mockResolvedValue([
                {
                  id: 3,
                  groupId: 10,
                  deletedAt: null,
                  isEnabled: true,
                  name: '公开板块',
                  icon: 'https://cdn.example.com/forum/section-3-icon.png',
                  cover: 'https://cdn.example.com/forum/section-3-cover.png',
                  group: {
                    isEnabled: true,
                    deletedAt: null,
                  },
                },
                {
                  id: 4,
                  groupId: 11,
                  deletedAt: null,
                  isEnabled: true,
                  name: '隐藏板块',
                  icon: 'https://cdn.example.com/forum/section-4-icon.png',
                  cover: 'https://cdn.example.com/forum/section-4-cover.png',
                  group: {
                    isEnabled: false,
                    deletedAt: null,
                  },
                },
              ]),
            },
          },
        },
        schema: {
          forumSection: {},
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      forumPermissionService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )

    return {
      forumPermissionService,
      service,
    }
  }

  function createSectionReviewPolicyHarness() {
    const forumPermissionService = {
      isSectionPubliclyAvailable: jest.fn(
        (section: {
          groupId?: number | null
          deletedAt?: Date | null
          isEnabled: boolean
          group?: {
            isEnabled: boolean
            deletedAt: Date | null
          } | null
        }) =>
          !section.deletedAt &&
          section.isEnabled &&
          (!section.groupId ||
            Boolean(
              section.group &&
              section.group.isEnabled &&
              !section.group.deletedAt,
            )),
      ),
    }

    const service = new ForumTopicService(
      {
        db: {
          query: {
            forumSection: {
              findFirst: jest.fn().mockResolvedValue({
                groupId: 11,
                deletedAt: null,
                topicReviewPolicy: 1,
                isEnabled: true,
                group: {
                  isEnabled: false,
                  deletedAt: null,
                },
              }),
            },
          },
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      forumPermissionService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )

    return {
      forumPermissionService,
      service,
    }
  }

  it('hydrates admin topic page user and section summaries without dropping orphaned rows', async () => {
    const { appUserFindMany, forumSectionFindMany, service } =
      createAdminPageServiceHarness()

    await expect(
      service.getTopics({
        pageIndex: 1,
        pageSize: 10,
      }),
    ).resolves.toEqual({
      list: [
        {
          id: 101,
          sectionId: 21,
          userId: 11,
          title: '有摘要主题',
          userSummary: {
            id: 11,
            nickname: '发帖用户',
            avatarUrl: 'https://cdn.example.com/app/avatar.png',
            status: 1,
            isEnabled: true,
            levelName: 'Lv2',
          },
          sectionSummary: {
            id: 21,
            name: '需求反馈',
            isEnabled: false,
            topicReviewPolicy: 2,
            groupName: '已停用分组',
          },
        },
        {
          id: 102,
          sectionId: 22,
          userId: 12,
          title: '缺失关联主题',
          userSummary: null,
          sectionSummary: null,
        },
      ],
      total: 2,
      pageIndex: 1,
      pageSize: 10,
    })
    expect(appUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        with: expect.objectContaining({
          level: expect.any(Object),
        }),
      }),
    )
    expect(forumSectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        with: expect.objectContaining({
          group: expect.any(Object),
        }),
      }),
    )
  })

  it('returns auditor summary for admin topic details even when the app user row is missing', async () => {
    const { auditorSummary, growthBalanceQueryService, service } =
      createAdminDetailServiceHarness({
        id: 301,
        userId: 99,
        auditById: 7,
        auditRole: AuditRoleEnum.ADMIN,
        user: null,
      })

    await expect(service.getTopicById(301)).resolves.toMatchObject({
      id: 301,
      user: null,
      hashtags: [],
      auditorSummary,
    })
    expect(
      growthBalanceQueryService.getUserGrowthSnapshot,
    ).not.toHaveBeenCalled()
  })

  it('returns auditor summary with avatar instead of avatarUrl when topic user exists', async () => {
    const { auditorSummary, growthBalanceQueryService, service } =
      createAdminDetailServiceHarness({
        id: 302,
        userId: 18,
        auditById: 7,
        auditRole: AuditRoleEnum.ADMIN,
        user: {
          id: 18,
          nickname: '发帖用户',
          counts: null,
          level: null,
        },
      })

    const result = await service.getTopicById(302)

    expect(result).toMatchObject({
      id: 302,
      auditorSummary,
      user: {
        id: 18,
        points: 88,
      },
    })
    expect(
      (result as unknown as { auditorSummary?: Record<string, unknown> })
        .auditorSummary,
    ).not.toHaveProperty('avatarUrl')
    expect(
      growthBalanceQueryService.getUserGrowthSnapshot,
    ).toHaveBeenCalledWith(18)
  })

  it('returns section statistics in anonymous public topic details', async () => {
    const {
      favoriteService,
      followService,
      forumPermissionService,
      forumTopicFindFirst,
      likeService,
      service,
    } = createPublicDetailServiceHarness(createPublicDetailTopic())

    await expect(service.getPublicTopicById(51)).resolves.toMatchObject({
      id: 51,
      liked: false,
      favorited: false,
      user: {
        id: 12,
        isFollowed: false,
      },
      section: {
        id: 7,
        name: '技术交流',
        cover: 'https://cdn.example.com/forum/section-cover.png',
        topicCount: 42,
        followersCount: 88,
      },
    })
    expect(forumTopicFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        with: expect.objectContaining({
          section: expect.objectContaining({
            columns: expect.objectContaining({
              cover: true,
              followersCount: true,
              topicCount: true,
            }),
          }),
        }),
      }),
    )
    expect(
      forumPermissionService.ensureUserCanAccessSection,
    ).toHaveBeenCalledWith(7, undefined, {
      requireEnabled: true,
      notFoundMessage: '主题不存在',
    })
    expect(likeService.checkLikeStatus).not.toHaveBeenCalled()
    expect(favoriteService.checkFavoriteStatus).not.toHaveBeenCalled()
    expect(followService.checkFollowStatus).not.toHaveBeenCalled()
  })

  it('keeps logged-in public topic detail interaction semantics with section statistics', async () => {
    const { browseLogService, service } = createPublicDetailServiceHarness(
      createPublicDetailTopic(),
    )

    await expect(
      service.getPublicTopicById(51, {
        userId: 99,
        ipAddress: '127.0.0.1',
        device: 'ios',
      }),
    ).resolves.toMatchObject({
      id: 51,
      viewCount: 21,
      liked: true,
      favorited: false,
      user: {
        id: 12,
        isFollowed: true,
      },
      section: {
        id: 7,
        name: '技术交流',
        cover: 'https://cdn.example.com/forum/section-cover.png',
        topicCount: 42,
        followersCount: 88,
      },
    })
    expect(browseLogService.recordBrowseLogSafely).toHaveBeenCalledWith(
      BrowseLogTargetTypeEnum.FORUM_TOPIC,
      51,
      99,
      '127.0.0.1',
      'ios',
      undefined,
      {
        skipTargetValidation: true,
        deferPostProcess: true,
      },
    )
  })

  it('rejects public topic details when the visible section relation is missing', async () => {
    const topic = {
      ...createPublicDetailTopic(),
      section: null,
    }
    const { service } = createPublicDetailServiceHarness(topic)

    await expect(service.getPublicTopicById(51)).rejects.toMatchObject({
      code: BusinessErrorCode.RESOURCE_NOT_FOUND,
      message: '主题不存在',
    })
  })

  it('uses the explicit title when deriving the create title', () => {
    const service = createService()

    const title = (
      service as unknown as ForumTopicServicePrivateApi
    ).resolveCreateTopicTitle('  自定义标题  ', '这里是正文')

    expect(title).toBe('自定义标题')
  })

  it('falls back to the first 30 characters of content when title is missing', () => {
    const service = createService()

    const content =
      '  这是一个没有单独标题时用于自动生成标题的正文内容示例，用来验证只截取前三十个字符  '
    const title = (
      service as unknown as ForumTopicServicePrivateApi
    ).resolveCreateTopicTitle(undefined, content)

    expect(title).toBe(content.trim().slice(0, 30))
  })

  it('derives the title from canonical plain text instead of runtime rich-text detection', () => {
    const service = createService()
    const plainText = '欢迎来到论坛 一起交流 TypeScript 经验'

    const title = (
      service as unknown as ForumTopicServicePrivateApi
    ).resolveCreateTopicTitle(undefined, plainText)

    expect(title).toBe(plainText.slice(0, 30))
  })

  it('keeps the current title when update payload omits title', () => {
    const service = createService()

    const title = (
      service as unknown as ForumTopicServicePrivateApi
    ).resolveUpdateTopicTitle('原有标题', undefined)

    expect(title).toBe('原有标题')
  })

  it('uses the explicit title when updating a topic title', () => {
    const service = createService()

    const title = (
      service as unknown as ForumTopicServicePrivateApi
    ).resolveUpdateTopicTitle('原有标题', '  新标题  ')

    expect(title).toBe('新标题')
  })

  it('splits title and content detection instead of concatenating them', () => {
    const sensitiveWordDetectService = {
      getMatchedWordsWithMetadataBySegments: jest.fn().mockReturnValue({
        hits: [],
        publicHits: [],
      }),
    }
    const service = new ForumTopicService(
      {} as never,
      {} as never,
      {} as never,
      sensitiveWordDetectService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )

    ;(
      service as unknown as ForumTopicServicePrivateApi
    ).detectTopicSensitiveWords('标题', '正文')

    expect(
      sensitiveWordDetectService.getMatchedWordsWithMetadataBySegments,
    ).toHaveBeenCalledWith([
      { field: 'title', content: '标题' },
      { field: 'content', content: '正文' },
    ])
  })

  it('overwrites videos with the provided json value when normalizing topic media', () => {
    const service = createService()
    const videos = {
      list: [
        {
          url: 'https://cdn.example.com/forum/topic-2.mp4',
          poster: 'https://cdn.example.com/forum/topic-2.jpg',
          duration: 12,
        },
      ],
      layout: 'grid',
    }

    const media = (
      service as unknown as ForumTopicServicePrivateApi
    ).normalizeTopicMedia(
      { videos },
      {
        images: ['/files/forum/topic-image.png'],
        videos: ['https://cdn.example.com/forum/legacy-topic.mp4'],
      },
    )

    expect(media.images).toEqual(['/files/forum/topic-image.png'])
    expect(media.videos).toEqual(videos)
  })

  it('reports invalid topic video payloads through business codes', () => {
    const service = createService()
    const circularVideos: { self?: unknown[] }[] = []
    circularVideos.push({ self: circularVideos })

    expect(() =>
      (service as unknown as ForumTopicServicePrivateApi).normalizeTopicMedia({
        videos: circularVideos,
      }),
    ).toThrow(
      expect.objectContaining({
        code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
        message: 'videos 必须是合法 JSON',
      }),
    )
  })

  it('rejects blank topic html through protocol-layer bad request', async () => {
    const { service } = createMaterializeTopicBodyHarness()

    await expect(
      (
        service as unknown as ForumTopicServicePrivateApi
      ).materializeTopicBodyInTx(
        {} as never,
        {
          html: '   ',
        },
        9,
      ),
    ).rejects.toThrow(BadRequestException)
  })

  it('materializes topic html into canonical body before hashtag processing', async () => {
    const { bodyHtmlCodecService, forumHashtagBodyService, service } =
      createMaterializeTopicBodyHarness()

    await (
      service as unknown as ForumTopicServicePrivateApi
    ).materializeTopicBodyInTx(
      {} as never,
      {
        html: '<p>欢迎来到论坛</p>',
      },
      9,
    )

    expect(bodyHtmlCodecService.parseHtmlOrThrow).toHaveBeenCalledWith(
      '<p>欢迎来到论坛</p>',
      'topic',
    )
    expect(forumHashtagBodyService.materializeBodyInTx).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: '<p>欢迎来到论坛</p>' }],
            },
          ],
        },
      }),
    )
  })

  it('derives content preview from compiled body tokens', async () => {
    const { bodyCompilerService, forumHashtagBodyService, service } =
      createMaterializeTopicBodyHarness()
    const materializedBody = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '欢迎 ' },
            { type: 'mentionUser', userId: 9, nickname: '测试用户' },
            { type: 'text', text: ' 使用 ' },
            { type: 'emojiCustom', shortcode: 'smile' },
            { type: 'text', text: ' 关注 ' },
            {
              type: 'forumHashtag',
              hashtagId: 77,
              slug: 'typescript',
              displayName: 'TypeScript',
            },
            { type: 'text', text: ' ' },
            { type: 'emojiUnicode', unicodeSequence: '😀' },
          ],
        },
      ],
    } as const
    forumHashtagBodyService.materializeBodyInTx.mockResolvedValueOnce({
      body: materializedBody,
      hashtagFacts: [],
    })
    bodyCompilerService.compile.mockResolvedValueOnce({
      body: materializedBody,
      plainText: '欢迎 @测试用户 使用 :smile: 关注 #TypeScript 😀',
      bodyTokens: [
        { type: 'text', text: '欢迎 ' },
        {
          type: 'mentionUser',
          text: '@测试用户',
          userId: 9,
          nickname: '测试用户',
        },
        { type: 'text', text: ' 使用 ' },
        {
          type: 'emojiCustom',
          emojiAssetId: 1001,
          shortcode: 'smile',
          packCode: 'default',
          imageUrl: 'https://cdn.example.com/emoji/smile.gif',
          staticUrl: 'https://cdn.example.com/emoji/smile.png',
          isAnimated: true,
        },
        { type: 'text', text: ' 关注 ' },
        {
          type: 'forumHashtag',
          text: '#TypeScript',
          hashtagId: 77,
          slug: 'typescript',
          displayName: 'TypeScript',
        },
        { type: 'text', text: ' ' },
        { type: 'emojiUnicode', unicodeSequence: '😀', emojiAssetId: 1002 },
      ],
      mentionFacts: [],
      emojiRecentUsageItems: [],
    })

    const result = await (
      service as unknown as ForumTopicServicePrivateApi
    ).materializeTopicBodyInTx(
      {} as never,
      {
        html: '<p>欢迎 <span>@测试用户</span></p>',
      },
      9,
    )

    expect(result.contentPreview).toEqual({
      plainText: '欢迎 @测试用户 使用 :smile: 关注 #TypeScript 😀',
      segments: [
        { type: 'text', text: '欢迎 ' },
        { type: 'mention', text: '@测试用户', userId: 9, nickname: '测试用户' },
        { type: 'text', text: ' 使用 ' },
        {
          type: 'emoji',
          text: ':smile:',
          kind: 2,
          shortcode: 'smile',
          emojiAssetId: 1001,
        },
        { type: 'text', text: ' 关注 ' },
        {
          type: 'hashtag',
          text: '#TypeScript',
          hashtagId: 77,
          slug: 'typescript',
          displayName: 'TypeScript',
        },
        { type: 'text', text: ' ' },
        {
          type: 'emoji',
          text: '😀',
          kind: 1,
          unicodeSequence: '😀',
          emojiAssetId: 1002,
        },
      ],
    })
  })

  it('deletes hidden topics without decrementing visible section topic count', async () => {
    const { forumCounterService, service, tx } =
      createDeleteTopicServiceHarness()

    await (
      service as unknown as ForumTopicServicePrivateApi
    ).deleteTopicWithCurrent({
      id: 9,
      sectionId: 3,
      userId: 12,
      likeCount: 0,
      favoriteCount: 0,
      auditStatus: AuditStatusEnum.APPROVED,
      isHidden: true,
      deletedAt: null,
    })

    expect(forumCounterService.updateUserForumTopicCount).toHaveBeenCalledWith(
      tx,
      12,
      -1,
    )
    expect(forumCounterService.updateSectionTopicCount).not.toHaveBeenCalled()
    expect(forumCounterService.syncSectionVisibleState).toHaveBeenCalledWith(
      tx,
      3,
    )
  })

  it('syncs hashtag reference section ids when moving a topic', async () => {
    const { forumCounterService, forumHashtagReferenceService, service, tx } =
      createMoveTopicServiceHarness()

    await expect(
      (service as unknown as ForumTopicServicePrivateApi).moveTopic({
        id: 9,
        sectionId: 5,
      }),
    ).resolves.toBe(true)

    expect(
      forumHashtagReferenceService.syncSectionIdsByTopicInTx,
    ).toHaveBeenCalledWith(tx, 9, 5)
    expect(forumCounterService.syncSectionVisibleState).toHaveBeenCalledTimes(2)
    expect(forumCounterService.syncSectionVisibleState).toHaveBeenNthCalledWith(
      1,
      tx,
      3,
    )
    expect(forumCounterService.syncSectionVisibleState).toHaveBeenNthCalledWith(
      2,
      tx,
      5,
    )
  })

  it('filters disabled section groups out of public section brief maps', async () => {
    const { forumPermissionService, service } = createSectionBriefMapHarness()

    await expect(
      (
        service as unknown as ForumTopicServicePrivateApi
      ).getTopicSectionBriefMap([3, 4], { requireEnabled: true }),
    ).resolves.toEqual(
      new Map([
        [
          3,
          {
            id: 3,
            name: '公开板块',
            icon: 'https://cdn.example.com/forum/section-3-icon.png',
            cover: 'https://cdn.example.com/forum/section-3-cover.png',
          },
        ],
      ]),
    )

    expect(
      forumPermissionService.isSectionPubliclyAvailable,
    ).toHaveBeenCalledTimes(2)
  })

  it('treats disabled section groups as unavailable when resolving a required topic review policy', async () => {
    const { forumPermissionService, service } =
      createSectionReviewPolicyHarness()

    await expect(
      (
        service as unknown as ForumTopicServicePrivateApi
      ).getSectionTopicReviewPolicy(5, {
        requireEnabled: true,
      }),
    ).rejects.toThrow('板块不存在或已禁用')

    expect(
      forumPermissionService.isSectionPubliclyAvailable,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 11,
        isEnabled: true,
        group: {
          isEnabled: false,
          deletedAt: null,
        },
      }),
    )
  })

  it('locks and rechecks section availability before inserting a new topic', async () => {
    const { forumPermissionService, forumSectionFindFirst, service, tx } =
      createCreateTopicServiceHarness()
    const lockSpy = jest.spyOn(
      service as unknown as {
        lockSectionForMutation: (...args: unknown[]) => Promise<void>
      },
      'lockSectionForMutation',
    )

    await expect(
      service.createForumTopic({
        sectionId: 3,
        userId: 12,
        html: '<p>测试正文</p>',
      }),
    ).resolves.toEqual({ id: 33 })

    expect(
      forumPermissionService.ensureUserCanCreateTopic,
    ).toHaveBeenCalledWith(12, 3)
    expect(lockSpy).toHaveBeenCalledWith(tx, 3)
    expect(forumSectionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 3,
          isEnabled: true,
        }),
      }),
    )
  })

  it('rejects topic creation when the section disappears after the pre-check', async () => {
    const { forumSectionFindFirst, service } = createCreateTopicServiceHarness()
    forumSectionFindFirst.mockResolvedValue(null)

    await expect(
      service.createForumTopic({
        sectionId: 3,
        userId: 12,
        html: '<p>测试正文</p>',
      }),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.RESOURCE_NOT_FOUND,
      message: '板块不存在或已禁用',
    })
  })
})
