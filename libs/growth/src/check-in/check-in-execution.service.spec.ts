import { CheckInRepairTargetTypeEnum } from './check-in.constant'
import { CheckInExecutionService } from './check-in-execution.service'

describe('check-in execution service orchestration', () => {
  function createService() {
    const settlementService = {
      settleRecordReward: jest.fn(),
      settleGrantReward: jest.fn(),
    }

    const service = new CheckInExecutionService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      settlementService as never,
    )

    return {
      service,
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
})
