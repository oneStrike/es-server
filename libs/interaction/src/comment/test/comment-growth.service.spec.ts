import { EventEnvelopeGovernanceStatusEnum } from '@libs/growth/event-definition/event-envelope.type';
import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant';

jest.mock('@libs/growth/growth-reward/growth-event-bridge.service', () => ({
  GrowthEventBridgeService: class {}
}))

describe('comment growth service', () => {
  it('skips reward when comment event is still pending moderation', async () => {
    const { CommentGrowthService } = await import('../comment-growth.service')

    const dispatchDefinedEvent = jest.fn().mockResolvedValue(undefined)
    const service = new CommentGrowthService({
      dispatchDefinedEvent,
    } as any)

    await expect(
      service.rewardCommentCreated(
        {} as any,
        {
          userId: 9,
          id: 18,
          targetType: 3,
          targetId: 88,
          eventEnvelope: {
            code: GrowthRuleTypeEnum.CREATE_COMMENT,
            governanceStatus: EventEnvelopeGovernanceStatusEnum.PENDING,
          },
        } as any,
      ),
    ).resolves.toBeUndefined()

    expect(dispatchDefinedEvent).not.toHaveBeenCalled()
  })

  it('rewards comment creation after governance passes', async () => {
    const { CommentGrowthService } = await import('../comment-growth.service')

    const dispatchDefinedEvent = jest.fn().mockResolvedValue(undefined)
    const service = new CommentGrowthService({
      dispatchDefinedEvent,
    } as any)

    await expect(
      service.rewardCommentCreated(
        {} as any,
        {
          userId: 9,
          id: 18,
          targetType: 3,
          targetId: 88,
          occurredAt: new Date('2026-03-29T10:00:00.000Z'),
          eventEnvelope: {
            code: GrowthRuleTypeEnum.CREATE_COMMENT,
            governanceStatus: EventEnvelopeGovernanceStatusEnum.PASSED,
          },
        } as any,
      ),
    ).resolves.toBeUndefined()

    expect(dispatchDefinedEvent).toHaveBeenCalledTimes(1)
    expect(dispatchDefinedEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tx: expect.anything(),
        eventEnvelope: expect.objectContaining({
          code: GrowthRuleTypeEnum.CREATE_COMMENT,
          governanceStatus: EventEnvelopeGovernanceStatusEnum.PASSED,
        }),
        bizKey: 'comment:create:18:user:9',
        source: 'comment',
      }),
    )
  })
})
