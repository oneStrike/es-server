import { ReportStatusEnum, ReportTargetTypeEnum } from './report.constant'
import { ReportService } from './report.service'

describe('reportService handleReport idempotency', () => {
  it('重复裁决为同一终态时应视为幂等成功且不重复发奖励', async () => {
    const rewardReportHandled = jest.fn()
    const currentReport = {
      id: 15,
      reporterId: 9,
      targetType: ReportTargetTypeEnum.COMMENT,
      targetId: 101,
      status: ReportStatusEnum.RESOLVED,
      handlingNote: '已处理',
    }
    const drizzle = {
      db: {
        query: {
          userReport: {
            findFirst: jest.fn().mockResolvedValue(currentReport),
          },
        },
        transaction: jest.fn(),
      },
      schema: {
        userReport: {
          id: Symbol('id'),
        },
      },
      withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    }
    const service = new ReportService(
      {
        rewardReportHandled,
      } as never,
      drizzle as never,
    )

    const tx = {
      query: {
        userReport: {
          findFirst: jest.fn().mockResolvedValue(currentReport),
        },
      },
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([]),
          })),
        })),
      })),
    }
    drizzle.db.transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    )

    await expect(
      service.handleReport({
        id: 15,
        status: ReportStatusEnum.RESOLVED,
        handlerId: 100,
        handlingNote: '再次点击裁决',
      }),
    ).resolves.toBe(true)

    expect(rewardReportHandled).not.toHaveBeenCalled()
  })
})
