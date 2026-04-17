import type { DrizzleService } from '@db/core'
import { ForumTopicService } from './forum-topic.service'

function createDrizzleStub(topic: Record<string, unknown> | null) {
  return {
    db: {
      query: {
        forumTopic: {
          findFirst: jest.fn().mockResolvedValue(topic),
        },
      },
    },
  } as unknown as DrizzleService
}

describe('forumTopicService', () => {
  it('hydrates admin topic detail user.points from growth balance snapshot', async () => {
    const growthBalanceQueryService = {
      getUserGrowthSnapshot: jest.fn().mockResolvedValue({
        points: 88,
        experience: 120,
      }),
    }
    const service = new ForumTopicService(
      createDrizzleStub({
        id: 11,
        userId: 7,
        title: '主题标题',
        user: {
          id: 7,
          nickname: '测试用户',
          avatarUrl: null,
          signature: null,
          bio: null,
          isEnabled: true,
          levelId: null,
          status: 1,
          banReason: null,
          banUntil: null,
          counts: null,
          level: null,
        },
      }) as never,
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
    )

    const result = await service.getTopicById(11)

    expect(growthBalanceQueryService.getUserGrowthSnapshot).toHaveBeenCalledWith(7)
    expect(result).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({
          id: 7,
          points: 88,
        }),
      }),
    )
  })
})
