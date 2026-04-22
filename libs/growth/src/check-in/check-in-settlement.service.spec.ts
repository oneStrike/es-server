import { CheckInRewardResultTypeEnum } from './check-in.constant'
import { CheckInSettlementService } from './check-in-settlement.service'

describe('check-in settlement service', () => {
  function createService() {
    return new CheckInSettlementService(
      {} as never,
      {} as never,
      {} as never,
    )
  }

  it('normalizes empty ledgerRecordIds in settlement summary', () => {
    const service = createService()

    expect(
      service.toRewardSettlementSummary({
        id: 1,
        settlementStatus: 2,
        settlementResultType: 1,
        ledgerRecordIds: null as never,
        retryCount: 0,
        lastRetryAt: null,
        settledAt: null,
        lastError: null,
      }),
    ).toMatchObject({
      id: 1,
      ledgerRecordIds: [],
    })
  })

  it('treats any non-duplicated ledger apply result as applied', () => {
    const service = createService()

    const resultType = (
      service as unknown as {
        resolveRewardResultType: (
          results: Array<{ duplicated?: boolean }>,
        ) => CheckInRewardResultTypeEnum
      }
    ).resolveRewardResultType([
      { duplicated: true },
      { duplicated: false },
    ])

    expect(resultType).toBe(CheckInRewardResultTypeEnum.APPLIED)
  })

  it('treats all duplicated ledger apply results as idempotent', () => {
    const service = createService()

    const resultType = (
      service as unknown as {
        resolveRewardResultType: (
          results: Array<{ duplicated?: boolean }>,
        ) => CheckInRewardResultTypeEnum
      }
    ).resolveRewardResultType([{ duplicated: true }, { duplicated: true }])

    expect(resultType).toBe(CheckInRewardResultTypeEnum.IDEMPOTENT)
  })
})
