import { EventEnvelopeGovernanceStatusEnum } from '@libs/growth/event-definition'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import { ReportStatusEnum, ReportTargetTypeEnum } from './report.constant'

jest.mock('@libs/growth/growth-reward', () => ({
  GrowthEventBridgeService: class {},
}))

describe('report growth service', () => {
  it('rewards invalid report events after final judgement', async () => {
    const { ReportGrowthService } = await import('./report-growth.service')

    const dispatchDefinedEvent = jest.fn().mockResolvedValue(undefined)
    const service = new ReportGrowthService({
      dispatchDefinedEvent,
    } as any)

    await expect(
      service.rewardReportHandled({
        eventEnvelope: {
          code: GrowthRuleTypeEnum.REPORT_INVALID,
          subjectId: 9,
          targetId: 18,
          governanceStatus: EventEnvelopeGovernanceStatusEnum.REJECTED,
          context: {
            reportStatus: ReportStatusEnum.REJECTED,
            reportedTargetType: ReportTargetTypeEnum.COMMENT,
            reportedTargetId: 66,
          },
        } as any,
      }),
    ).resolves.toBeUndefined()

    expect(dispatchDefinedEvent).toHaveBeenCalledWith({
      eventEnvelope: expect.objectContaining({
        code: GrowthRuleTypeEnum.REPORT_INVALID,
        subjectId: 9,
        targetId: 18,
      }),
      bizKey: 'report:handle:18:status:4',
      source: 'report_handle',
      remark: '举报裁决无效 #18',
      targetType: ReportTargetTypeEnum.COMMENT,
      targetId: 66,
    })
  })

  it('skips non-terminal report events for growth consumer', async () => {
    const { ReportGrowthService } = await import('./report-growth.service')

    const dispatchDefinedEvent = jest.fn().mockResolvedValue(undefined)
    const service = new ReportGrowthService({
      dispatchDefinedEvent,
    } as any)

    await expect(
      service.rewardReportHandled({
        eventEnvelope: {
          code: GrowthRuleTypeEnum.REPORT_VALID,
          subjectId: 9,
          targetId: 18,
          governanceStatus: EventEnvelopeGovernanceStatusEnum.PENDING,
          context: {
            reportStatus: ReportStatusEnum.PENDING,
            reportedTargetType: ReportTargetTypeEnum.COMMENT,
            reportedTargetId: 66,
          },
        } as any,
      }),
    ).resolves.toBeUndefined()

    expect(dispatchDefinedEvent).not.toHaveBeenCalled()
  })
})
