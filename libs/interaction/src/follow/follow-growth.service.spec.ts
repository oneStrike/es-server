import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import { FollowTargetTypeEnum } from './follow.constant'

jest.mock('@libs/growth/growth-reward', () => ({
  GrowthEventBridgeService: class {},
}))

describe('follow growth service', () => {
  it('routes follow rewards through the unified growth reward service', async () => {
    const { FollowGrowthService } = await import('./follow-growth.service')

    const dispatchDefinedEvent = jest.fn().mockResolvedValue(undefined)
    const service = new FollowGrowthService(
      { dispatchDefinedEvent } as any,
      { withTransaction: jest.fn(async (callback) => callback({} as any)) } as any,
    )

    await expect(
      service.rewardFollowCreated(FollowTargetTypeEnum.USER, 18, 9),
    ).resolves.toBeUndefined()

    expect(dispatchDefinedEvent).toHaveBeenCalledTimes(2)
    expect(dispatchDefinedEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tx: expect.anything(),
        eventEnvelope: expect.objectContaining({
          code: GrowthRuleTypeEnum.FOLLOW_USER,
          subjectId: 9,
          targetId: 18,
        }),
        bizKey: 'follow:user:18:actor:9',
        source: 'follow',
      }),
    )
    expect(dispatchDefinedEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        tx: expect.anything(),
        eventEnvelope: expect.objectContaining({
          code: GrowthRuleTypeEnum.BE_FOLLOWED,
          subjectId: 18,
          targetId: 9,
          operatorId: 9,
        }),
        bizKey: 'be-followed:user:18:actor:9',
        source: 'follow',
      }),
    )
  })
})
