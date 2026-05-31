/// <reference types="jest" />

import { BusinessException } from '@libs/platform/exceptions'
import {
  CheckInMakeupFactTypeEnum,
  CheckInMakeupPeriodTypeEnum,
  CheckInMakeupSourceTypeEnum,
} from './check-in.constant'
import { CheckInMakeupService } from './check-in-makeup.service'

describe('CheckInMakeupService event allowance grant', () => {
  it('writes an EVENT_CARD grant fact and increments the current account with optimistic version', async () => {
    const service = buildService()
    const tx = buildGrantTx({
      factRows: [{ id: 91 }],
      accountRows: [{ id: 10, eventAvailable: 5, version: 4 }],
    })

    await expect(
      service.grantEventMakeupAllowance(tx, {
        amount: 2,
        bizKey: 'coupon:makeup:90',
        context: { source: 'coupon_check_in_makeup' },
        sourceRef: 'coupon_redemption:90',
        userId: 33,
      }),
    ).resolves.toEqual({
      account: { id: 10, eventAvailable: 5, version: 4 },
      created: true,
      factId: 91,
    })

    expect(tx.insert).toHaveBeenCalledTimes(1)
    expect(tx.factValues).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2,
        bizKey: 'coupon:makeup:90',
        consumedAmount: 0,
        factType: CheckInMakeupFactTypeEnum.GRANT,
        periodKey: 'month-2026-05-01',
        periodType: CheckInMakeupPeriodTypeEnum.MONTHLY,
        sourceRef: 'coupon_redemption:90',
        sourceType: CheckInMakeupSourceTypeEnum.EVENT_CARD,
        userId: 33,
      }),
    )
    expect(tx.update).toHaveBeenCalledTimes(1)
    expect(tx.accountSet).toHaveBeenCalledWith(
      expect.objectContaining({
        eventAvailable: 5,
        lastSyncedFactId: 91,
        version: 4,
      }),
    )
  })

  it('returns idempotent result without updating account when the fact already exists', async () => {
    const service = buildService()
    const tx = buildGrantTx({
      factRows: [],
      accountRows: [],
    })

    await expect(
      service.grantEventMakeupAllowance(tx, {
        amount: 1,
        bizKey: 'coupon:makeup:retry',
        userId: 33,
      }),
    ).resolves.toEqual({
      account: {
        id: 10,
        eventAvailable: 3,
        version: 3,
      },
      created: false,
      factId: null,
    })
    expect(tx.update).not.toHaveBeenCalled()
  })

  it('rejects invalid amount before writing makeup facts', async () => {
    const service = buildService()
    const tx = buildGrantTx({
      factRows: [],
      accountRows: [],
    })

    await expect(
      service.grantEventMakeupAllowance(tx, {
        amount: 0,
        bizKey: 'coupon:makeup:invalid',
        userId: 33,
      }),
    ).rejects.toBeInstanceOf(BusinessException)
    expect(tx.insert).not.toHaveBeenCalled()
  })
})

function buildService() {
  const service = new CheckInMakeupService(
    {
      schema: {
        checkInMakeupAccount: {
          id: 'check_in_makeup_account',
          version: 'check_in_makeup_account.version',
        },
        checkInMakeupFact: {
          id: 'check_in_makeup_fact.id',
          bizKey: 'check_in_makeup_fact.biz_key',
          userId: 'check_in_makeup_fact.user_id',
        },
      },
    } as any,
    {} as any,
  ) as any
  service.ensureUserExists = jest.fn(() => Promise.resolve())
  service.getEnabledConfig = jest.fn(() =>
    Promise.resolve({
      makeupPeriodType: CheckInMakeupPeriodTypeEnum.MONTHLY,
    }),
  )
  service.ensureCurrentMakeupAccount = jest.fn(() =>
    Promise.resolve({
      id: 10,
      eventAvailable: 3,
      version: 3,
    }),
  )
  service.buildMakeupWindow = jest.fn(() => ({
    periodType: CheckInMakeupPeriodTypeEnum.MONTHLY,
    periodKey: 'month-2026-05-01',
    periodStartDate: '2026-05-01',
    periodEndDate: '2026-05-31',
  }))
  return service
}

function buildGrantTx(input: {
  factRows: Array<Record<string, unknown>>
  accountRows: Array<Record<string, unknown>>
}) {
  const tx: any = {
    factValues: jest.fn(() => ({
      onConflictDoNothing: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve(input.factRows)),
      })),
    })),
    accountSet: jest.fn(() => ({
      where: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve(input.accountRows)),
      })),
    })),
  }
  tx.insert = jest.fn(() => ({
    values: tx.factValues,
  }))
  tx.update = jest.fn(() => ({
    set: tx.accountSet,
  }))
  return tx
}
