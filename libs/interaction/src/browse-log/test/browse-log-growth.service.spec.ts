import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant';
import { BrowseLogTargetTypeEnum } from '../browse-log.constant'

jest.mock('@libs/growth/growth-reward/growth-event-bridge.service', () => ({
  GrowthEventBridgeService: class {}
}))

describe('browse log growth service', () => {
  it('routes browse rewards through the unified growth reward service', async () => {
    const { BrowseLogGrowthService } = await import('../browse-log-growth.service')

    const dispatchDefinedEvent = jest.fn().mockResolvedValue(undefined)
    const service = new BrowseLogGrowthService(
      { dispatchDefinedEvent } as any,
      { withTransaction: jest.fn(async (callback) => callback({} as any)) } as any,
    )

    await expect(
      service.rewardBrowseLogRecorded(BrowseLogTargetTypeEnum.FORUM_TOPIC, 66, 9),
    ).resolves.toBeUndefined()

    expect(dispatchDefinedEvent).toHaveBeenCalledTimes(1)
    expect(dispatchDefinedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: expect.anything(),
        eventEnvelope: expect.objectContaining({
          code: GrowthRuleTypeEnum.TOPIC_VIEW,
          subjectId: 9,
          targetId: 66,
        }),
        bizKey: `view:${BrowseLogTargetTypeEnum.FORUM_TOPIC}:66:user:9`,
        source: 'browse_log',
      }),
    )
  })
})
