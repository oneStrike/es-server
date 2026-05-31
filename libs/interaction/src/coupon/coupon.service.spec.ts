/// <reference types="jest" />

import { BusinessException } from '@libs/platform/exceptions'
import {
  CouponInstanceStatusEnum,
  CouponRedemptionTargetTypeEnum,
  CouponSourceTypeEnum,
  CouponTargetScopeEnum,
  CouponTypeEnum,
} from './coupon.constant'
import { CouponService } from './coupon.service'

describe('CouponService domain split contract', () => {
  it('reserves discount coupons and returns purchase pricing in the same transaction', async () => {
    const service = buildCouponService()
    const tx = {}
    service.getCouponInstanceWithDefinition = jest.fn(() =>
      Promise.resolve({
        couponType: CouponTypeEnum.DISCOUNT,
        discountAmount: 5,
        discountRateBps: 9000,
        grantSnapshot: {
          couponType: CouponTypeEnum.DISCOUNT,
          discountAmount: 5,
          discountRateBps: 9000,
          targetScope: CouponTargetScopeEnum.CHAPTER,
          usageLimit: 1,
          validDays: 0,
          benefitDays: 0,
          benefitCount: 0,
          name: '折扣券',
          issuedAt: new Date().toISOString(),
        },
      }),
    )
    service.consumeCouponAndWriteRedemption = jest.fn(() =>
      Promise.resolve({ redemption: { id: 55 } }),
    )

    await expect(
      service.reserveDiscountCoupon(tx, {
        couponInstanceId: 44,
        originalPrice: 100,
        targetId: 22,
        targetType: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
        userId: 33,
      }),
    ).resolves.toEqual({
      couponInstanceId: 44,
      discountAmount: 15,
      discountSource: CouponTypeEnum.DISCOUNT,
      paidPrice: 85,
      redemptionRecordId: 55,
    })
    expect(service.consumeCouponAndWriteRedemption).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        bizKey: 'discount:33:1:22:44',
        redemptionSnapshot: expect.objectContaining({
          discountAmount: 15,
          paidPrice: 85,
        }),
      }),
    )
  })

  it('rejects non-discount coupons from chapter purchase reservation', async () => {
    const service = buildCouponService()
    service.getCouponInstanceWithDefinition = jest.fn(() =>
      Promise.resolve({
        couponType: CouponTypeEnum.READING,
        discountAmount: 0,
        discountRateBps: 10000,
        grantSnapshot: {
          couponType: CouponTypeEnum.READING,
          discountAmount: 0,
          discountRateBps: 10000,
          targetScope: CouponTargetScopeEnum.CHAPTER,
          usageLimit: 1,
          validDays: 0,
          benefitDays: 0,
          benefitCount: 0,
          name: '阅读券',
          issuedAt: new Date().toISOString(),
        },
      }),
    )

    await expect(
      service.reserveDiscountCoupon({} as any, {
        couponInstanceId: 44,
        originalPrice: 100,
        targetId: 22,
        targetType: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
        userId: 33,
      }),
    ).rejects.toBeInstanceOf(BusinessException)
  })

  it('normalizes coupon definitions and rejects empty discount ability', () => {
    const service = buildCouponService()

    expect(
      service.normalizeCouponDefinitionWrite({
        couponType: CouponTypeEnum.CHECK_IN_MAKEUP,
        name: '补签卡',
        benefitCount: 2,
        discountAmount: 99,
        discountRateBps: 100,
        usageLimit: 8,
        validDays: 30,
      }),
    ).toEqual(
      expect.objectContaining({
        benefitCount: 2,
        couponType: CouponTypeEnum.CHECK_IN_MAKEUP,
        discountAmount: 0,
        discountRateBps: 10000,
        targetScope: CouponTargetScopeEnum.CHECK_IN,
        usageLimit: 1,
      }),
    )

    expect(() =>
      service.normalizeCouponDefinitionWrite({
        couponType: CouponTypeEnum.DISCOUNT,
        name: '空折扣券',
      }),
    ).toThrow(BusinessException)
  })

  it('does not inherit stale ability fields when changing coupon type', async () => {
    const service = buildCouponService({ schema: buildSchema() })
    const updateSet = jest.fn(() => ({
      where: jest.fn(() => Promise.resolve()),
    }))
    const db = {
      query: {
        couponDefinition: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 7,
              name: '阅读券',
              couponType: CouponTypeEnum.READING,
              targetScope: CouponTargetScopeEnum.CHAPTER,
              discountAmount: 0,
              discountRateBps: 10000,
              usageLimit: 8,
              validDays: 30,
              benefitDays: 0,
              benefitCount: 0,
              isEnabled: true,
            }),
          ),
        },
      },
      update: jest.fn(() => ({ set: updateSet })),
    }
    service.drizzle.db = db
    service.drizzle.withErrorHandling = jest.fn((callback) => callback())

    await service.updateCouponDefinition({
      id: 7,
      couponType: CouponTypeEnum.VIP_TRIAL,
    })

    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        benefitDays: 1,
        couponType: CouponTypeEnum.VIP_TRIAL,
        targetScope: CouponTargetScopeEnum.VIP,
        usageLimit: 1,
      }),
    )
  })

  it('rejects incomplete coupon abilities at definition write time', () => {
    const service = buildCouponService()

    expect(() =>
      service.ensureCouponDefinitionWritable({
        couponType: CouponTypeEnum.VIP_TRIAL,
        targetScope: CouponTargetScopeEnum.VIP,
        usageLimit: 1,
        discountAmount: 0,
        discountRateBps: 10000,
        benefitDays: 0,
        benefitCount: 0,
      }),
    ).toThrow(BusinessException)
  })

  it('grants coupons through grant keys idempotently with closed snapshots', async () => {
    const service = buildCouponService({ schema: buildSchema() })
    const insertReturning = jest
      .fn()
      .mockResolvedValueOnce([{ id: 101 }])
      .mockResolvedValueOnce([])
    const tx = {
      query: {
        couponDefinition: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 7,
              name: 'VIP 试用卡',
              couponType: CouponTypeEnum.VIP_TRIAL,
              targetScope: CouponTargetScopeEnum.VIP,
              discountAmount: 0,
              discountRateBps: 10000,
              usageLimit: 1,
              validDays: 10,
              benefitDays: 3,
              benefitCount: 0,
            }),
          ),
        },
      },
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve([{ id: 33 }])),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          onConflictDoNothing: jest.fn(() => ({
            returning: insertReturning,
          })),
        })),
      })),
    }
    service.findCouponInstanceByGrantKey = jest.fn(() =>
      Promise.resolve({ id: 101 }),
    )

    await expect(
      service.grantCouponsForSource(tx, {
        couponDefinitionId: 7,
        grantKeys: ['membership:order:1:coupon:1', 'membership:order:1:coupon:2'],
        quantity: 2,
        sourceType: CouponSourceTypeEnum.MEMBERSHIP_BENEFIT,
        userId: 33,
        validDays: 5,
      }),
    ).resolves.toEqual({
      createdCount: 1,
      items: [
        { couponInstance: { id: 101 }, created: true, grantKey: 'membership:order:1:coupon:1' },
        { couponInstance: { id: 101 }, created: false, grantKey: 'membership:order:1:coupon:2' },
      ],
    })
    expect(tx.insert).toHaveBeenCalledTimes(2)
    expect(
      tx.insert.mock.results[0].value.values.mock.calls[0][0],
    ).toEqual(
      expect.objectContaining({
        grantKey: 'membership:order:1:coupon:1',
        grantSnapshot: expect.objectContaining({
          benefitDays: 3,
          couponType: CouponTypeEnum.VIP_TRIAL,
          name: 'VIP 试用卡',
          targetScope: CouponTargetScopeEnum.VIP,
          validDays: 5,
        }),
        remainingUses: 1,
      }),
    )
  })

  it('rejects open grant snapshots instead of defaulting missing fields', () => {
    const service = buildCouponService()

    expect(() =>
      service.parseGrantSnapshot({
        couponType: CouponTypeEnum.CHECK_IN_MAKEUP,
        targetScope: CouponTargetScopeEnum.CHECK_IN,
        name: '旧补签卡',
      }),
    ).toThrow(BusinessException)
  })

  it('returns existing redemption without decrementing on duplicate bizKey', async () => {
    const service = buildCouponService({ schema: buildSchema() })
    const tx = {
      query: {
        couponRedemptionRecord: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 77,
              bizKey: 'coupon:retry',
            }),
          ),
        },
      },
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          onConflictDoNothing: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([])),
          })),
        })),
      })),
      update: jest.fn(),
    }

    await expect(
      service.consumeCouponAndWriteRedemption(tx, {
        bizKey: 'coupon:retry',
        coupon: {
          couponType: CouponTypeEnum.READING,
          remainingUses: 1,
        },
        couponInstanceId: 10,
        redemptionSnapshot: {},
        targetId: 22,
        targetType: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
        userId: 33,
      }),
    ).resolves.toEqual({
      created: false,
      redemption: { bizKey: 'coupon:retry', id: 77 },
    })
    expect(tx.update).not.toHaveBeenCalled()
  })

  it('creates redemption first and atomically decrements only active unexpired coupons', async () => {
    const service = buildCouponService({ schema: buildSchema() })
    const updateReturning = jest.fn(() =>
      Promise.resolve([{ remainingUses: 0 }]),
    )
    const updateWhere = jest.fn(() => ({ returning: updateReturning }))
    const updateSet = jest.fn(() => ({ where: updateWhere }))
    const tx = {
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          onConflictDoNothing: jest.fn(() => ({
            returning: jest.fn(() =>
              Promise.resolve([{ id: 88, bizKey: 'coupon:new' }]),
            ),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: updateSet,
      })),
    }

    await expect(
      service.consumeCouponAndWriteRedemption(tx, {
        bizKey: 'coupon:new',
        coupon: {
          couponType: CouponTypeEnum.READING,
          remainingUses: 1,
        },
        couponInstanceId: 10,
        redemptionSnapshot: {},
        targetId: 22,
        targetType: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
        userId: 33,
      }),
    ).resolves.toEqual({
      created: true,
      redemption: { bizKey: 'coupon:new', id: 88 },
    })
    expect(tx.insert.mock.invocationCallOrder[0]).toBeLessThan(
      tx.update.mock.invocationCallOrder[0],
    )
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        remainingUses: expect.anything(),
        status: expect.anything(),
      }),
    )
    expect(updateWhere).toHaveBeenCalled()
  })

  it('grants event makeup allowance only for first check-in makeup redemption', async () => {
    const checkInService = {
      grantEventMakeupAllowance: jest.fn(() => Promise.resolve({ created: true })),
    }
    const service = buildCouponService({}, {}, checkInService)
    const tx = {}
    const coupon = {
      couponDefinitionId: 7,
      couponType: CouponTypeEnum.CHECK_IN_MAKEUP,
      benefitCount: 2,
      grantSnapshot: {
        couponType: CouponTypeEnum.CHECK_IN_MAKEUP,
        discountAmount: 0,
        discountRateBps: 10000,
        targetScope: CouponTargetScopeEnum.CHECK_IN,
        usageLimit: 1,
        validDays: 0,
        benefitDays: 0,
        benefitCount: 2,
        name: '补签卡',
        issuedAt: new Date().toISOString(),
      },
      targetScope: CouponTargetScopeEnum.CHECK_IN,
    }
    service.getCouponInstanceWithDefinition = jest.fn(() =>
      Promise.resolve(coupon),
    )
    service.consumeCouponAndWriteRedemption = jest
      .fn()
      .mockResolvedValueOnce({
        created: true,
        redemption: { id: 90 },
      })
      .mockResolvedValueOnce({
        created: false,
        redemption: { id: 90 },
      })

    await expect(
      service.redeemCouponInTx(tx, {
        bizKey: 'coupon:makeup:retry',
        couponInstanceId: 20,
        targetType: CouponRedemptionTargetTypeEnum.CHECK_IN,
        userId: 33,
      }),
    ).resolves.toEqual({ id: 90 })
    await expect(
      service.redeemCouponInTx(tx, {
        bizKey: 'coupon:makeup:retry',
        couponInstanceId: 20,
        targetType: CouponRedemptionTargetTypeEnum.CHECK_IN,
        userId: 33,
      }),
    ).resolves.toEqual({ id: 90 })

    expect(checkInService.grantEventMakeupAllowance).toHaveBeenCalledTimes(1)
    expect(checkInService.grantEventMakeupAllowance).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        amount: 2,
        bizKey: 'coupon:makeup:retry',
        sourceRef: 'coupon_redemption:90',
        userId: 33,
      }),
    )
  })

  it('grants reading entitlement only for first reading redemption', async () => {
    const contentEntitlementService = {
      grantEntitlement: jest.fn(() => Promise.resolve({ created: true })),
    }
    const service = buildCouponService({}, contentEntitlementService)
    const tx = {}
    const coupon = {
      couponDefinitionId: 7,
      couponType: CouponTypeEnum.READING,
      benefitCount: 0,
      benefitDays: 0,
      discountAmount: 0,
      discountRateBps: 10000,
      expiresAt: null,
      grantSnapshot: {
        couponType: CouponTypeEnum.READING,
        discountAmount: 0,
        discountRateBps: 10000,
        targetScope: CouponTargetScopeEnum.CHAPTER,
        usageLimit: 1,
        validDays: 0,
        benefitDays: 0,
        benefitCount: 0,
        name: '阅读券',
        issuedAt: new Date().toISOString(),
      },
      id: 20,
      targetScope: CouponTargetScopeEnum.CHAPTER,
    }
    service.getCouponInstanceWithDefinition = jest.fn(() =>
      Promise.resolve(coupon),
    )
    service.consumeCouponAndWriteRedemption = jest
      .fn()
      .mockResolvedValueOnce({
        created: true,
        redemption: { id: 91 },
      })
      .mockResolvedValueOnce({
        created: false,
        redemption: { id: 91 },
      })

    await service.redeemCouponInTx(tx, {
      bizKey: 'coupon:reading:retry',
      couponInstanceId: 20,
      targetId: 300,
      targetType: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
      userId: 33,
    })
    await service.redeemCouponInTx(tx, {
      bizKey: 'coupon:reading:retry',
      couponInstanceId: 20,
      targetId: 300,
      targetType: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
      userId: 33,
    })

    expect(contentEntitlementService.grantEntitlement).toHaveBeenCalledTimes(1)
    expect(contentEntitlementService.grantEntitlement).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        sourceId: 91,
        sourceKey: 'coupon:reading:retry',
        targetId: 300,
        userId: 33,
      }),
    )
  })

  it('grants VIP subscription days from coupon benefitDays', async () => {
    const service = buildCouponService({
      schema: {
        userMembershipSubscription: 'user_membership_subscription',
      },
    })
    const insertedSubscriptions: unknown[] = []
    const tx = {
      insert: jest.fn(() => ({
        values: jest.fn((value) => {
          insertedSubscriptions.push(value)
          return Promise.resolve()
        }),
      })),
    }
    const coupon = {
      couponDefinitionId: 7,
      couponType: CouponTypeEnum.VIP_TRIAL,
      benefitCount: 0,
      benefitDays: 5,
      grantSnapshot: {
        couponType: CouponTypeEnum.VIP_TRIAL,
        discountAmount: 0,
        discountRateBps: 10000,
        targetScope: CouponTargetScopeEnum.VIP,
        usageLimit: 1,
        validDays: 30,
        benefitDays: 5,
        benefitCount: 0,
        name: 'VIP 试用卡',
        issuedAt: new Date().toISOString(),
      },
      targetScope: CouponTargetScopeEnum.VIP,
    }
    service.getCouponInstanceWithDefinition = jest.fn(() =>
      Promise.resolve(coupon),
    )
    service.consumeCouponAndWriteRedemption = jest.fn(() =>
      Promise.resolve({
        created: true,
        redemption: { id: 92 },
      }),
    )

    await service.redeemCouponInTx(tx, {
      bizKey: 'coupon:vip:trial',
      couponInstanceId: 20,
      targetType: CouponRedemptionTargetTypeEnum.VIP,
      userId: 33,
    })

    expect(insertedSubscriptions[0]).toMatchObject({
      sourceId: 92,
      userId: 33,
    })
    expect(
      Number(
        (insertedSubscriptions[0] as { endsAt: Date; startsAt: Date }).endsAt,
      ) -
        Number(
          (insertedSubscriptions[0] as { endsAt: Date; startsAt: Date })
            .startsAt,
        ),
    ).toBe(5 * 24 * 60 * 60 * 1000)
  })
})

function buildCouponService(
  drizzle: Record<string, unknown> = {},
  contentEntitlementService: Record<string, unknown> = {},
  checkInService: Record<string, unknown> = {},
) {
  return new CouponService(
    drizzle as any,
    contentEntitlementService as any,
    checkInService as any,
  ) as any
}

function buildSchema() {
  return {
    appUser: {
      id: 'app_user.id',
    },
    couponDefinition: {
      createdAt: 'coupon_definition.created_at',
      id: 'coupon_definition.id',
      isEnabled: 'coupon_definition.is_enabled',
    },
    couponRedemptionRecord: {
      bizKey: 'coupon_redemption_record.biz_key',
      userId: 'coupon_redemption_record.user_id',
    },
    userCouponInstance: {
      createdAt: 'user_coupon_instance.created_at',
      couponDefinitionId: 'user_coupon_instance.coupon_definition_id',
      couponType: 'user_coupon_instance.coupon_type',
      expiresAt: 'user_coupon_instance.expires_at',
      grantKey: 'user_coupon_instance.grant_key',
      grantSnapshot: 'user_coupon_instance.grant_snapshot',
      id: 'user_coupon_instance.id',
      remainingUses: 'user_coupon_instance.remaining_uses',
      status: 'user_coupon_instance.status',
      updatedAt: 'user_coupon_instance.updated_at',
      userId: 'user_coupon_instance.user_id',
    },
  }
}
