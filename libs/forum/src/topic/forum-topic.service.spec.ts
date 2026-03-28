import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import { AuditStatusEnum } from '@libs/platform/constant'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('@libs/interaction/browse-log', () => ({
  BrowseLogService: class {},
  BrowseLogTargetTypeEnum: {
    FORUM_TOPIC: 3,
  },
}))

jest.mock('@libs/interaction/comment', () => ({
  CommentTargetTypeEnum: {
    FORUM_TOPIC: 3,
  },
}))

jest.mock('@libs/interaction/emoji', () => ({
  EmojiParserService: class {},
  EmojiSceneEnum: {
    FORUM: 'FORUM',
  },
}))

jest.mock('@libs/interaction/favorite', () => ({
  FavoriteService: class {},
  FavoriteTargetTypeEnum: {
    FORUM_TOPIC: 3,
  },
}))

jest.mock('@libs/interaction/like', () => ({
  LikeService: class {},
  LikeTargetTypeEnum: {
    FORUM_TOPIC: 3,
  },
}))

jest.mock('@libs/sensitive-word', () => ({
  SensitiveWordDetectService: class {},
  SensitiveWordLevelEnum: {
    GENERAL: 2,
    SEVERE: 3,
  },
}))

jest.mock('@libs/user/core', () => ({
  AppUserCountService: class {},
}))

describe('forum topic audit reward backfill', () => {
  it('rewards create-topic once when audit changes from pending to approved', async () => {
    const { ForumTopicService } = await import('./forum-topic.service')

    const tryRewardByRule = jest.fn().mockResolvedValue(undefined)
    const syncSectionVisibleState = jest.fn().mockResolvedValue(undefined)
    const assertAffectedRows = jest.fn()
    const currentTopic = {
      id: 11,
      sectionId: 5,
      userId: 9,
      auditStatus: AuditStatusEnum.PENDING,
    }

    const whereUpdate = jest.fn().mockResolvedValue({ rowCount: 1 })
    const set = jest.fn(() => ({ where: whereUpdate }))
    const update = jest.fn(() => ({ set }))
    const transaction = jest.fn(async (callback) =>
      callback({ update } as any),
    )
    const withErrorHandling = jest.fn(async (callback) => callback())

    const service = new ForumTopicService(
      {
        db: {
          query: {
            forumTopic: {
              findFirst: jest.fn().mockResolvedValue(currentTopic),
            },
          },
          transaction,
        },
        schema: {
          forumTopic: {
            id: 'id',
            deletedAt: 'deletedAt',
          },
        },
        withErrorHandling,
        assertAffectedRows,
      } as any,
      { tryRewardByRule } as any,
      {} as any,
      {} as any,
      { syncSectionVisibleState } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )

    await expect(
      service.updateTopicAuditStatus({
        id: 11,
        auditStatus: AuditStatusEnum.APPROVED,
        auditReason: '审核通过',
      } as any),
    ).resolves.toBe(true)

    expect(tryRewardByRule).toHaveBeenCalledWith({
      userId: 9,
      ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
      bizKey: 'forum:topic:create:11:user:9',
      source: 'forum_topic',
      remark: 'approve forum topic #11',
      targetId: 11,
    })
  })

  it('does not reward when the topic was already approved before update', async () => {
    const { ForumTopicService } = await import('./forum-topic.service')

    const tryRewardByRule = jest.fn().mockResolvedValue(undefined)
    const syncSectionVisibleState = jest.fn().mockResolvedValue(undefined)
    const assertAffectedRows = jest.fn()
    const currentTopic = {
      id: 12,
      sectionId: 6,
      userId: 10,
      auditStatus: AuditStatusEnum.APPROVED,
    }

    const whereUpdate = jest.fn().mockResolvedValue({ rowCount: 1 })
    const set = jest.fn(() => ({ where: whereUpdate }))
    const update = jest.fn(() => ({ set }))
    const transaction = jest.fn(async (callback) =>
      callback({ update } as any),
    )
    const withErrorHandling = jest.fn(async (callback) => callback())

    const service = new ForumTopicService(
      {
        db: {
          query: {
            forumTopic: {
              findFirst: jest.fn().mockResolvedValue(currentTopic),
            },
          },
          transaction,
        },
        schema: {
          forumTopic: {
            id: 'id',
            deletedAt: 'deletedAt',
          },
        },
        withErrorHandling,
        assertAffectedRows,
      } as any,
      { tryRewardByRule } as any,
      {} as any,
      {} as any,
      { syncSectionVisibleState } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )

    await expect(
      service.updateTopicAuditStatus({
        id: 12,
        auditStatus: AuditStatusEnum.APPROVED,
        auditReason: '重复提交',
      } as any),
    ).resolves.toBe(true)

    expect(tryRewardByRule).not.toHaveBeenCalled()
  })
})
