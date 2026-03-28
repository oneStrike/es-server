import { EventEnvelopeGovernanceStatusEnum } from '@libs/growth/event-definition'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'

describe('comment growth service', () => {
  it('skips reward when comment event is still pending moderation', async () => {
    const { CommentGrowthService } = await import('./comment-growth.service')

    const applyByRule = jest.fn().mockResolvedValue(undefined)
    const service = new CommentGrowthService({
      applyByRule,
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

    expect(applyByRule).not.toHaveBeenCalled()
  })

  it('rewards comment creation after governance passes', async () => {
    const { CommentGrowthService } = await import('./comment-growth.service')

    const applyByRule = jest.fn().mockResolvedValue(undefined)
    const service = new CommentGrowthService({
      applyByRule,
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

    expect(applyByRule).toHaveBeenCalledTimes(2)
    expect(applyByRule).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        userId: 9,
        ruleType: GrowthRuleTypeEnum.CREATE_COMMENT,
        bizKey: 'comment:create:18:user:9:POINTS',
      }),
    )
  })
})
