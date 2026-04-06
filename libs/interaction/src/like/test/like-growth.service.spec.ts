import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant';
import { LikeTargetTypeEnum } from '../like.constant'

jest.mock('@libs/growth/growth-reward/growth-event-bridge.service', () => ({
  GrowthEventBridgeService: class {}
}))

describe('like growth service', () => {
  it('routes like rewards through the unified growth reward service', async () => {
    const { LikeGrowthService } = await import('../like-growth.service')

    const dispatchDefinedEvent = jest.fn().mockResolvedValue(undefined)
    const service = new LikeGrowthService(
      { dispatchDefinedEvent } as any,
      {
        withTransaction: jest.fn(async (callback) => callback({} as any)),
        db: {},
      } as any,
    )

    await expect(
      service.rewardLikeCreated(LikeTargetTypeEnum.FORUM_TOPIC, 77, 9),
    ).resolves.toBeUndefined()

    expect(dispatchDefinedEvent).toHaveBeenCalledTimes(1)
    expect(dispatchDefinedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: expect.anything(),
        eventEnvelope: expect.objectContaining({
          code: GrowthRuleTypeEnum.TOPIC_LIKED,
          subjectId: 9,
          targetId: 77,
        }),
        bizKey: `like:${LikeTargetTypeEnum.FORUM_TOPIC}:77:user:9`,
        source: 'like',
      }),
    )
  })
})
