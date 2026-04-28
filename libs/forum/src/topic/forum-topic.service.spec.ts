import { AuditStatusEnum } from '@libs/platform/constant'
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
      bodyMode: 'plain' | 'rich'
      plainText?: string
      body?: unknown
      mentions?: Array<{
        userId: number
        nickname: string
        start: number
        end: number
      }>
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
  moveTopic: (input: { id: number, sectionId: number }) => Promise<boolean>
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
    )
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

  function createMaterializeTopicBodyHarness() {
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
      {} as never,
      bodyCompilerService as never,
      {} as never,
      {} as never,
      {} as never,
      forumHashtagBodyService as never,
      {} as never,
    )

    return {
      service,
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
          Boolean(section.group && section.group.isEnabled && !section.group.deletedAt),
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
              section.group && section.group.isEnabled && !section.group.deletedAt,
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
    )

    return {
      forumPermissionService,
      service,
    }
  }

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

  it('requires explicit mention metadata when materializing plain topic body', async () => {
    const { service } = createMaterializeTopicBodyHarness()

    await expect(
      (service as unknown as ForumTopicServicePrivateApi).materializeTopicBodyInTx(
        {} as never,
        {
          bodyMode: 'plain',
          plainText: '欢迎 @测试用户',
        },
        9,
      ),
    ).rejects.toThrow('mentions')
  })

  it('materializes plain topic body into structured mention and emoji nodes before compilation', async () => {
    const { forumHashtagBodyService, service } = createMaterializeTopicBodyHarness()

    await (
      service as unknown as ForumTopicServicePrivateApi
    ).materializeTopicBodyInTx(
      {} as never,
      {
        bodyMode: 'plain',
        plainText: '欢迎 @测试用户 使用 :smile:\n第二行😀',
        mentions: [
          {
            userId: 9,
            nickname: '测试用户',
            start: 3,
            end: 8,
          },
        ],
      },
      9,
    )

    expect(forumHashtagBodyService.materializeBodyInTx).toHaveBeenCalledWith(
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
    const {
      forumCounterService,
      forumHashtagReferenceService,
      service,
      tx,
    } = createMoveTopicServiceHarness()

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
      (service as unknown as ForumTopicServicePrivateApi).getTopicSectionBriefMap(
        [3, 4],
        { requireEnabled: true },
      ),
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
    const { forumPermissionService, service } = createSectionReviewPolicyHarness()

    await expect(
      (
        service as unknown as ForumTopicServicePrivateApi
      ).getSectionTopicReviewPolicy(5, {
        requireEnabled: true,
      }),
    ).rejects.toThrow('板块不存在或已禁用')

    expect(forumPermissionService.isSectionPubliclyAvailable).toHaveBeenCalledWith(
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
})
