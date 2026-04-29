import {
  CheckInMakeupPeriodTypeEnum,
  CheckInRecordTypeEnum,
  CheckInRepairTargetTypeEnum,
  CheckInRewardSourceTypeEnum,
} from './check-in.constant'
import { CheckInExecutionService } from './check-in-execution.service'

describe('check-in execution service orchestration', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-26T08:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  function createService() {
    const tx = {
      query: {
        checkInRecord: {
          findFirst: jest.fn(),
        },
      },
      insert: jest.fn(),
    }

    const insertReturning = jest.fn()
    const insertOnConflictDoNothing = jest
      .fn()
      .mockReturnValue({ returning: insertReturning })
    const insertValues = jest
      .fn()
      .mockReturnValue({ onConflictDoNothing: insertOnConflictDoNothing })
    tx.insert.mockReturnValue({ values: insertValues })

    const drizzle = {
      db: {},
      schema: {
        checkInRecord: {
          userId: 'userId',
          signDate: 'signDate',
        },
      },
      withTransaction: jest.fn().mockImplementation(async (callback) => callback(tx)),
    }

    const rewardPolicyService = {
      parseRewardDefinition: jest.fn(),
      resolveRewardForDate: jest.fn(),
      parseStoredRewardItems: jest.fn(),
    }

    const makeupService = {
      ensureCurrentMakeupAccount: jest.fn(),
      buildMakeupWindow: jest.fn(),
      buildMakeupConsumePlan: jest.fn(),
      consumeMakeupAllowance: jest.fn(),
      isDateWithinMakeupWindow: jest.fn(),
      buildCurrentMakeupAccountView: jest.fn(),
    }

    const streakService = {}

    const settlementService = {
      settleRecordReward: jest.fn(),
      settleGrantReward: jest.fn(),
      toRewardSettlementSummary: jest.fn(),
    }

    const service = new CheckInExecutionService(
      drizzle as never,
      {} as never,
      rewardPolicyService as never,
      makeupService as never,
      streakService as never,
      settlementService as never,
    )

    return {
      service,
      drizzle,
      tx,
      insertValues,
      insertReturning,
      rewardPolicyService,
      makeupService,
      streakService,
      settlementService,
    }
  }

  it('routes record reward repair requests to settlement service', async () => {
    const { service, settlementService } = createService()
    settlementService.settleRecordReward.mockResolvedValue(true)

    await expect(
      service.repairReward(
        {
          targetType: CheckInRepairTargetTypeEnum.RECORD_REWARD,
          recordId: 11,
        } as never,
        7,
      ),
    ).resolves.toEqual({
      targetType: CheckInRepairTargetTypeEnum.RECORD_REWARD,
      recordId: 11,
      success: true,
    })

    expect(settlementService.settleRecordReward).toHaveBeenCalledWith(11, {
      actorUserId: 7,
      isRetry: true,
    })
  })

  it('routes streak grant repair requests to settlement service', async () => {
    const { service, settlementService } = createService()
    settlementService.settleGrantReward.mockResolvedValue(false)

    await expect(
      service.repairReward(
        {
          targetType: CheckInRepairTargetTypeEnum.STREAK_GRANT,
          grantId: 21,
        } as never,
        8,
      ),
    ).resolves.toEqual({
      targetType: CheckInRepairTargetTypeEnum.STREAK_GRANT,
      grantId: 21,
      success: false,
    })

    expect(settlementService.settleGrantReward).toHaveBeenCalledWith(21, {
      actorUserId: 8,
      isRetry: true,
    })
  })

  it('writes reward overview icon snapshot for normal sign records', async () => {
    const {
      service,
      tx,
      insertValues,
      insertReturning,
      rewardPolicyService,
      makeupService,
      settlementService,
    } = createService()
    const serviceHarness = service as any
    serviceHarness.getEnabledConfig = jest.fn().mockResolvedValue({
      isEnabled: 1,
      makeupPeriodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
    })
    serviceHarness.ensureUserExists = jest.fn().mockResolvedValue(undefined)
    serviceHarness.processStreakGrants = jest.fn().mockResolvedValue([66, 67])
    serviceHarness.buildActionResponse = jest
      .fn()
      .mockResolvedValue({ recordId: 11, ok: true })

    tx.query.checkInRecord.findFirst.mockResolvedValue(null)
    insertReturning.mockResolvedValue([{ id: 11 }])
    rewardPolicyService.parseRewardDefinition.mockReturnValue({
      makeupIconUrl: 'https://cdn.example.com/makeup.png',
    })
    rewardPolicyService.resolveRewardForDate.mockReturnValue({
      resolvedRewardSourceType: CheckInRewardSourceTypeEnum.BASE_REWARD,
      resolvedRewardRuleKey: null,
      resolvedRewardItems: [
        {
          assetType: 1,
          assetKey: '',
          amount: 8,
          iconUrl: 'https://cdn.example.com/reward-item.png',
        },
      ],
      resolvedRewardOverviewIconUrl:
        'https://cdn.example.com/reward-overview.png',
      resolvedMakeupIconUrl: null,
    })
    makeupService.ensureCurrentMakeupAccount.mockResolvedValue({ id: 1 })
    makeupService.buildMakeupWindow.mockReturnValue({})
    settlementService.settleRecordReward.mockResolvedValue(true)
    settlementService.settleGrantReward.mockResolvedValue(true)

    await expect(service.signToday(9)).resolves.toEqual({
      recordId: 11,
      ok: true,
    })

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 9,
        signDate: '2026-04-26',
        recordType: CheckInRecordTypeEnum.NORMAL,
        resolvedRewardSourceType: CheckInRewardSourceTypeEnum.BASE_REWARD,
        resolvedRewardOverviewIconUrl:
          'https://cdn.example.com/reward-overview.png',
        resolvedMakeupIconUrl: null,
      }),
    )
  })

  it('writes makeup icon snapshot for makeup sign records', async () => {
    const {
      service,
      tx,
      insertValues,
      insertReturning,
      rewardPolicyService,
      makeupService,
      settlementService,
    } = createService()
    const serviceHarness = service as any
    serviceHarness.getEnabledConfig = jest.fn().mockResolvedValue({
      isEnabled: 1,
      makeupPeriodType: CheckInMakeupPeriodTypeEnum.WEEKLY,
    })
    serviceHarness.ensureUserExists = jest.fn().mockResolvedValue(undefined)
    serviceHarness.processStreakGrants = jest.fn().mockResolvedValue([])
    serviceHarness.buildActionResponse = jest
      .fn()
      .mockResolvedValue({ recordId: 12, ok: true })

    tx.query.checkInRecord.findFirst.mockResolvedValue(null)
    insertReturning.mockResolvedValue([{ id: 12 }])
    rewardPolicyService.parseRewardDefinition.mockReturnValue({
      makeupIconUrl: 'https://cdn.example.com/makeup.png',
    })
    rewardPolicyService.resolveRewardForDate.mockReturnValue({
      resolvedRewardSourceType: CheckInRewardSourceTypeEnum.DATE_RULE,
      resolvedRewardRuleKey: 'DATE:2026-04-25',
      resolvedRewardItems: [
        {
          assetType: 1,
          assetKey: '',
          amount: 5,
          iconUrl: 'https://cdn.example.com/date-item.png',
        },
      ],
      resolvedRewardOverviewIconUrl:
        'https://cdn.example.com/date-overview.png',
      resolvedMakeupIconUrl: null,
    })
    makeupService.ensureCurrentMakeupAccount.mockResolvedValue({ id: 1 })
    makeupService.buildMakeupWindow.mockReturnValue({
      periodStartDate: '2026-04-21',
      periodEndDate: '2026-04-27',
    })
    makeupService.isDateWithinMakeupWindow.mockReturnValue(true)
    makeupService.buildMakeupConsumePlan.mockReturnValue({ sourceType: 1 })
    makeupService.consumeMakeupAllowance.mockResolvedValue({ id: 1 })
    settlementService.settleRecordReward.mockResolvedValue(true)

    await expect(
      service.makeup({ signDate: '2026-04-25' } as never, 9),
    ).resolves.toEqual({
      recordId: 12,
      ok: true,
    })

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 9,
        signDate: '2026-04-25',
        recordType: CheckInRecordTypeEnum.MAKEUP,
        resolvedRewardSourceType: CheckInRewardSourceTypeEnum.DATE_RULE,
        resolvedRewardRuleKey: 'DATE:2026-04-25',
        resolvedRewardOverviewIconUrl:
          'https://cdn.example.com/date-overview.png',
        resolvedMakeupIconUrl: 'https://cdn.example.com/makeup.png',
      }),
    )
  })
})
