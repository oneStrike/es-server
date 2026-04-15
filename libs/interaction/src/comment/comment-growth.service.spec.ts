import {
  createDefinedEventEnvelope,
  EventEnvelopeGovernanceStatusEnum,
} from '@libs/growth/event-definition/event-envelope.type'
import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant'
import { CommentGrowthService } from './comment-growth.service'

describe('CommentGrowthService', () => {
  let growthEventBridgeService: { dispatchDefinedEvent: jest.Mock }
  let service: CommentGrowthService

  beforeEach(() => {
    growthEventBridgeService = {
      dispatchDefinedEvent: jest.fn(),
    }

    service = new CommentGrowthService(growthEventBridgeService as never)
  })

  it('发表评论奖励不会再向 bridge 透传伪事务对象', async () => {
    await service.rewardCommentCreated({
      userId: 11,
      id: 22,
      targetType: 3,
      targetId: 44,
      occurredAt: new Date('2026-04-15T08:00:00.000Z'),
    })

    expect(growthEventBridgeService.dispatchDefinedEvent).toHaveBeenCalledTimes(
      1,
    )
    expect(growthEventBridgeService.dispatchDefinedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        bizKey: 'comment:create:22:user:11',
        source: 'comment',
        targetType: 3,
        targetId: 44,
      }),
    )
    expect(
      growthEventBridgeService.dispatchDefinedEvent.mock.calls[0][0],
    ).not.toHaveProperty('tx')
  })

  it('治理阻断时不会派发评论创建奖励', async () => {
    const pendingEventEnvelope = createDefinedEventEnvelope({
      code: GrowthRuleTypeEnum.CREATE_COMMENT,
      subjectId: 11,
      targetId: 22,
      governanceStatus: EventEnvelopeGovernanceStatusEnum.PENDING,
    })

    await service.rewardCommentCreated({
      userId: 11,
      id: 22,
      targetType: 3,
      targetId: 44,
      eventEnvelope: pendingEventEnvelope,
    })

    expect(growthEventBridgeService.dispatchDefinedEvent).not.toHaveBeenCalled()
  })
})
