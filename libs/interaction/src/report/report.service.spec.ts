import { ReportStatusEnum, ReportTargetTypeEnum } from './report.constant'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

describe('report service handling flow', () => {
  it('triggers reward after resolving a pending report', async () => {
    const { ReportService } = await import('./report.service')

    const rewardReportHandled = jest.fn().mockResolvedValue(undefined)
    const currentReport = {
      id: 1,
      reporterId: 9,
      targetType: ReportTargetTypeEnum.FORUM_TOPIC,
      targetId: 33,
      status: ReportStatusEnum.PENDING,
      handlingNote: null,
    }
    const updatedReport = {
      ...currentReport,
      status: ReportStatusEnum.RESOLVED,
      handlerId: 7,
      handledAt: new Date('2026-03-28T12:00:00.000Z'),
      handlingNote: '证据充分，裁决为有效举报',
    }

    const returning = jest.fn().mockResolvedValue([updatedReport])
    const whereUpdate = jest.fn(() => ({ returning }))
    const set = jest.fn(() => ({ where: whereUpdate }))
    const update = jest.fn(() => ({ set }))
    const findFirst = jest.fn().mockResolvedValue(currentReport)
    const transaction = jest.fn(async (callback) =>
      callback({
        query: {
          userReport: { findFirst },
        },
        update,
      } as any),
    )
    const withErrorHandling = jest.fn(async (callback) => callback())

    const service = new ReportService(
      { rewardReportHandled } as any,
      {
        db: { transaction },
        schema: { userReport: { id: 'id' } },
        withErrorHandling,
      } as any,
    )

    await expect(
      service.handleReport({
        id: 1,
        handlerId: 7,
        status: ReportStatusEnum.RESOLVED,
        handlingNote: '证据充分，裁决为有效举报',
      }),
    ).resolves.toBe(true)

    expect(rewardReportHandled).toHaveBeenCalledWith({
      eventEnvelope: expect.objectContaining({
        code: 800,
        key: 'REPORT_VALID',
        subjectId: 9,
        targetId: 1,
        operatorId: 7,
        governanceStatus: 'passed',
        context: {
          reportStatus: ReportStatusEnum.RESOLVED,
          reportedTargetType: ReportTargetTypeEnum.FORUM_TOPIC,
          reportedTargetId: 33,
        },
      }),
    })
  })

  it('rejects handling a report that is already finalized', async () => {
    const { ReportService } = await import('./report.service')

    const rewardReportHandled = jest.fn().mockResolvedValue(undefined)
    const findFirst = jest.fn().mockResolvedValue({
      id: 2,
      reporterId: 9,
      targetType: ReportTargetTypeEnum.COMMENT,
      targetId: 88,
      status: ReportStatusEnum.REJECTED,
      handlingNote: '已驳回',
    })
    const transaction = jest.fn(async (callback) =>
      callback({
        query: {
          userReport: { findFirst },
        },
        update: jest.fn(),
      } as any),
    )
    const withErrorHandling = jest.fn(async (callback) => callback())

    const service = new ReportService(
      { rewardReportHandled } as any,
      {
        db: { transaction },
        schema: { userReport: { id: 'id' } },
        withErrorHandling,
      } as any,
    )

    await expect(
      service.handleReport({
        id: 2,
        handlerId: 7,
        status: ReportStatusEnum.RESOLVED,
      }),
    ).rejects.toThrow('已处理举报不能重复裁决')

    expect(rewardReportHandled).not.toHaveBeenCalled()
  })
})
