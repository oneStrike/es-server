import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { CheckInCalendarReadModelService } from './check-in-calendar-read-model.service'

describe('check-in calendar read-model service', () => {
  function createService() {
    const rewardPolicyService = {
      parseRewardDefinition: jest.fn().mockReturnValue({ definition: true }),
      resolveRewardForDate: jest.fn().mockImplementation((_, date) => ({
        resolvedRewardItems:
          date === '2026-04-21'
            ? [{ assetType: 1, assetKey: '', amount: 99 }]
            : null,
      })),
      parseStoredRewardItems: jest
        .fn()
        .mockImplementation((value) => value ?? null),
    }
    const makeupService = {
      buildMakeupWindow: jest.fn().mockReturnValue({
        periodType: 1,
        periodKey: 'week-2026-04-21',
        periodStartDate: '2026-04-21',
        periodEndDate: '2026-04-27',
      }),
    }
    const settlementService = {
      buildSettlementMapById: jest.fn().mockResolvedValue(new Map()),
      buildGrantRewardItemMap: jest.fn().mockResolvedValue(new Map()),
      toRewardSettlementSummary: jest.fn().mockImplementation((value) => value),
    }
    const drizzle = {
      ext: {
        findPagination: jest.fn().mockResolvedValue({
          pageIndex: 1,
          pageSize: 20,
          total: 1,
          list: [
            {
              id: 8,
              userId: 12,
              signDate: '2026-04-23',
              recordType: 1,
              rewardSettlementId: null,
              resolvedRewardSourceType: 1,
              resolvedRewardRuleKey: null,
              resolvedRewardItems: [
                { assetType: 1, assetKey: '', amount: 10 },
              ],
              createdAt: '2026-04-23T11:00:00.000Z',
              updatedAt: '2026-04-23T11:00:00.000Z',
            },
          ],
        }),
      },
      db: {
        select: jest.fn(),
      },
      schema: {
        checkInRecord: {
          signDate: 'signDate',
          createdAt: 'createdAt',
          id: 'id',
        },
        appUser: {
          id: 'id',
          nickname: 'nickname',
          avatarUrl: 'avatarUrl',
        },
      },
    }

    const service = new CheckInCalendarReadModelService(
      drizzle as never,
      {} as never,
      rewardPolicyService as never,
      makeupService as never,
      settlementService as never,
    )

    ;(
      service as unknown as {
        getRequiredConfig: () => Promise<unknown>
        ensureUserExists: (userId: number) => Promise<void>
        listUserCalendarRecordRows: (
          userId: number,
          startDate: string,
          endDate: string,
        ) => Promise<unknown[]>
        listUserCalendarGrantCountRows: (
          userId: number,
          startDate: string,
          endDate: string,
        ) => Promise<unknown[]>
        listGlobalCalendarRecordRows: (
          startDate: string,
          endDate: string,
        ) => Promise<unknown[]>
        listCalendarGrantCountRows: (
          startDate: string,
          endDate: string,
        ) => Promise<unknown[]>
        buildSignedUserMap: (userIds: number[]) => Promise<Map<number, unknown>>
        buildGrantMapForPageRecords: (records: unknown[]) => Promise<Map<string, unknown[]>>
      }
    ).getRequiredConfig = jest.fn().mockResolvedValue({
      id: 1,
      makeupPeriodType: 1,
      periodicAllowance: 2,
      isEnabled: 1,
    })
    ;(
      service as unknown as {
        ensureUserExists: (userId: number) => Promise<void>
      }
    ).ensureUserExists = jest.fn().mockResolvedValue(undefined)
    ;(
      service as unknown as {
        listUserCalendarRecordRows: (
          userId: number,
          startDate: string,
          endDate: string,
        ) => Promise<unknown[]>
      }
    ).listUserCalendarRecordRows = jest.fn().mockResolvedValue([
      {
        id: 5,
        userId: 9,
        signDate: '2026-04-21',
        recordType: 1,
        rewardSettlementId: null,
        resolvedRewardItems: [{ assetType: 1, assetKey: '', amount: 8 }],
      },
    ])
    ;(
      service as unknown as {
        listUserCalendarGrantCountRows: (
          userId: number,
          startDate: string,
          endDate: string,
        ) => Promise<unknown[]>
      }
    ).listUserCalendarGrantCountRows = jest.fn().mockResolvedValue([
      { id: 1, triggerSignDate: '2026-04-21' },
      { id: 2, triggerSignDate: '2026-04-21' },
    ])
    ;(
      service as unknown as {
        listGlobalCalendarRecordRows: (
          startDate: string,
          endDate: string,
        ) => Promise<unknown[]>
      }
    ).listGlobalCalendarRecordRows = jest.fn().mockResolvedValue([
      {
        userId: 9,
        signDate: '2026-04-21',
        recordType: 1,
        resolvedRewardItems: [{ assetType: 1, assetKey: '', amount: 10 }],
      },
      {
        userId: 10,
        signDate: '2026-04-21',
        recordType: 2,
        resolvedRewardItems: [{ assetType: 1, assetKey: '', amount: 5 }],
      },
    ])
    ;(
      service as unknown as {
        listCalendarGrantCountRows: (
          startDate: string,
          endDate: string,
        ) => Promise<unknown[]>
      }
    ).listCalendarGrantCountRows = jest.fn().mockResolvedValue([
      { id: 21, triggerSignDate: '2026-04-21' },
      { id: 22, triggerSignDate: '2026-04-21' },
    ])
    ;(
      service as unknown as {
        buildSignedUserMap: (userIds: number[]) => Promise<Map<number, unknown>>
      }
    ).buildSignedUserMap = jest.fn().mockResolvedValue(
      new Map([[12, { id: 12, nickname: 'alice', avatarUrl: 'avatar.png' }]]),
    )
    ;(
      service as unknown as {
        buildGrantMapForPageRecords: (records: unknown[]) => Promise<Map<string, unknown[]>>
      }
    ).buildGrantMapForPageRecords = jest.fn().mockResolvedValue(new Map())

    return {
      service,
      drizzle,
      rewardPolicyService,
      settlementService,
      makeupService,
    }
  }

  afterEach(() => {
    jest.useRealTimers()
  })

  it('builds a user period calendar from targetDate and preserves current-config projection for unsigned days', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T10:00:00.000Z'))
    const { service, rewardPolicyService } = createService()

    const calendar = await service.getCurrentUserCalendarByTargetDate(
      9,
      '2026-04-23',
    )

    expect(calendar).toMatchObject({
      periodType: 1,
      periodKey: 'week-2026-04-21',
      periodStartDate: '2026-04-21',
      periodEndDate: '2026-04-27',
    })
    expect(calendar.days[0]).toMatchObject({
      signDate: '2026-04-21',
      isSigned: true,
      grantCount: 2,
      rewardItems: [{ assetType: 1, assetKey: '', amount: 8 }],
    })
    expect(calendar.days[1]).toMatchObject({
      signDate: '2026-04-22',
      isSigned: false,
      rewardItems: null,
    })
    expect(rewardPolicyService.resolveRewardForDate).toHaveBeenCalledWith(
      { definition: true },
      '2026-04-22',
      1,
    )
  })

  it('builds admin global calendar with fixed formulas and separates projection from actual overview', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-24T10:00:00.000Z'))
    const { service } = createService()

    const calendar = await service.getAdminCalendarByTargetDate('2026-04-23')

    expect(calendar).toMatchObject({
      periodType: 1,
      periodKey: 'week-2026-04-21',
    })
    expect(calendar.days[0]).toMatchObject({
      signDate: '2026-04-21',
      signedCount: 2,
      normalSignCount: 1,
      makeupSignCount: 1,
      streakRewardTriggerCount: 2,
      baseRewardConfigProjectionOverview: [
        { assetType: 1, assetKey: '', amount: 99 },
      ],
      baseRewardActualOverview: [
        { assetType: 1, assetKey: '', amount: 15 },
      ],
    })
  })

  it('treats targetDate as exact signDate in admin signed-user page and applies the fixed default ordering', async () => {
    const { service, drizzle } = createService()

    const page = await service.getAdminSignedUserPageByTargetDate({
      targetDate: '2026-04-23',
      pageIndex: 1,
      pageSize: 20,
    })

    expect(drizzle.ext.findPagination).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pageIndex: 1,
        pageSize: 20,
        orderBy: JSON.stringify([{ createdAt: 'desc' }, { id: 'desc' }]),
      }),
    )
    expect(page.list[0]).toMatchObject({
      user: {
        id: 12,
        nickname: 'alice',
      },
      signDate: '2026-04-23',
      recordType: 1,
    })
  })

  it('rejects invalid targetDate with protocol-layer bad request semantics', async () => {
    const { service } = createService()

    await expect(
      service.getCurrentUserCalendarByTargetDate(9, ''),
    ).rejects.toThrow('目标日期非法')
  })

  it('bubbles resource-not-found semantics when the specified user does not exist', async () => {
    const { service } = createService()
    ;(
      service as unknown as {
        ensureUserExists: (userId: number) => Promise<void>
      }
    ).ensureUserExists = jest.fn().mockRejectedValue(
      new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, '用户不存在'),
    )

    await expect(
      service.getSpecifiedUserCalendarByTargetDate(404, '2026-04-23'),
    ).rejects.toThrow('用户不存在')
  })
})
