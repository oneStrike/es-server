/// <reference types="jest" />

import { BusinessException } from '@libs/platform/exceptions'
import { BusinessErrorCode } from '@libs/platform/constant'
import {
  PaymentOrderTypeEnum,
  PaymentSubscriptionModeEnum,
} from '../payment/payment.constant'
import { CouponSourceTypeEnum } from '../coupon/coupon.constant'
import { MembershipService } from './membership.service'

describe('MembershipService domain split contract', () => {
  function createService(overrides: Record<string, unknown> = {}) {
    return Object.assign(
      new MembershipService({} as any, {} as any, {} as any, {} as any) as any,
      overrides,
    )
  }

  function createActivationTx(plan: Record<string, unknown> = {}) {
    return {
      query: {
        membershipPlan: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              bonusPointAmount: 0,
              id: 1,
              planKey: 'vip_monthly',
              tier: 1,
              durationDays: 30,
              ...plan,
            }),
          ),
        },
        userMembershipSubscription: {
          findFirst: jest.fn(() => Promise.resolve(null)),
        },
      },
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([{ id: 100 }])),
        })),
      })),
    }
  }

  it('activates a paid one-time VIP order without an agreement number', async () => {
    const insertedSubscriptions: unknown[] = []
    const service = new MembershipService(
      {
        schema: {
          userMembershipSubscription: 'user_membership_subscription',
        },
      } as any,
      {
        applyDelta: jest.fn(() => Promise.resolve({ success: true })),
      } as any,
      {} as any,
      {
        grantCouponsForSource: jest.fn(),
      } as any,
    ) as any
    const tx = {
      query: {
        membershipPlan: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              bonusPointAmount: 0,
              id: 1,
              planKey: 'vip_monthly',
              tier: 1,
              durationDays: 30,
            }),
          ),
        },
        userMembershipSubscription: {
          findFirst: jest.fn(() => Promise.resolve(null)),
        },
      },
      insert: jest.fn(() => ({
        values: jest.fn((value) => {
          insertedSubscriptions.push(value)
          return {
            returning: jest.fn(() =>
              Promise.resolve([{ id: 100, ...value }]),
            ),
          }
        }),
      })),
    }
    service.getEnabledPlanBenefitItems = jest.fn(() => Promise.resolve([]))

    await service.activatePaidOrder(tx, {
      id: 10,
      orderNo: 'PAY202605060001',
      orderType: PaymentOrderTypeEnum.VIP_SUBSCRIPTION,
      paidAmount: 1800,
      subscriptionMode: PaymentSubscriptionModeEnum.ONE_TIME,
      targetId: 1,
      userId: 3,
    })

    expect(tx.insert).toHaveBeenCalledTimes(1)
    expect(insertedSubscriptions[0]).toMatchObject({
      planId: 1,
      sourceId: 10,
      userId: 3,
    })
  })

  it('grants auto coupon benefits idempotently when activating a paid order', async () => {
    const couponService = {
      grantCouponsForSource: jest.fn(() =>
        Promise.resolve({ createdCount: 2, items: [] }),
      ),
    }
    const service = new MembershipService(
      {
        schema: {
          userMembershipSubscription: 'user_membership_subscription',
        },
      } as any,
      {
        applyDelta: jest.fn(() => Promise.resolve({ success: true })),
      } as any,
      {} as any,
      couponService as any,
    ) as any
    const tx = {
      query: {
        membershipPlan: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              bonusPointAmount: 0,
              id: 1,
              planKey: 'vip_monthly',
              tier: 1,
              durationDays: 30,
            }),
          ),
        },
        userMembershipSubscription: {
          findFirst: jest.fn(() => Promise.resolve(null)),
        },
      },
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([{ id: 100 }])),
        })),
      })),
    }
    service.getEnabledPlanBenefitItems = jest.fn(() =>
      Promise.resolve([
        {
          id: 21,
          grantPolicy: 2,
          benefitValue: { couponDefinitionId: 7, grantCount: 2 },
          benefit: { benefitType: 2 },
        },
      ]),
    )

    await service.activatePaidOrder(tx, {
      id: 10,
      orderNo: 'PAY202605060001',
      orderType: PaymentOrderTypeEnum.VIP_SUBSCRIPTION,
      paidAmount: 1800,
      subscriptionMode: PaymentSubscriptionModeEnum.ONE_TIME,
      targetId: 1,
      userId: 3,
    })

    expect(couponService.grantCouponsForSource).toHaveBeenCalledWith(tx, {
      userId: 3,
      couponDefinitionId: 7,
      sourceType: CouponSourceTypeEnum.MEMBERSHIP_BENEFIT,
      sourceId: 10,
      quantity: 2,
      grantKeys: [
        'membership:order:10:benefit:21:coupon:7:index:0',
        'membership:order:10:benefit:21:coupon:7:index:1',
      ],
    })
  })

  it('accepts coupon benefits without validDays but rejects zero override days', () => {
    const service = createService()

    expect(() =>
      service.assertMembershipBenefitContract(2, 2, {
        couponDefinitionId: 7,
        grantCount: 1,
      }),
    ).not.toThrow()
    expect(() =>
      service.assertMembershipBenefitContract(2, 2, {
        couponDefinitionId: 7,
        grantCount: 1,
        validDays: 0,
      }),
    ).toThrow(BusinessException)
  })

  it('accepts only the v1 membership benefit contract matrix', () => {
    const service = createService()

    expect(() =>
      service.assertMembershipBenefitContract(1, 1, null),
    ).not.toThrow()
    expect(() =>
      service.assertMembershipBenefitContract(1, 1, { displayText: '专属标识' }),
    ).not.toThrow()
    expect(() =>
      service.assertMembershipBenefitContract(1, 1, {
        adScope: 'reading',
        durationPolicy: 'subscription_period',
      }),
    ).toThrow(BusinessException)
    expect(() =>
      service.assertMembershipBenefitContract(2, 2, {
        couponDefinitionId: 7,
        grantCount: 1,
        validDays: 30,
      }),
    ).not.toThrow()

    expect(() =>
      service.assertMembershipBenefitContract(1, 2, null),
    ).toThrow(BusinessException)
    expect(() =>
      service.assertMembershipBenefitContract(2, 1, {
        couponDefinitionId: 7,
        grantCount: 1,
      }),
    ).toThrow(BusinessException)
    expect(() =>
      service.assertMembershipBenefitContract(2, 2, { grantCount: 1 }),
    ).toThrow(BusinessException)
    expect(() =>
      service.assertMembershipBenefitContract(2, 2, {
        couponDefinitionId: 7,
        grantCount: 0,
      }),
    ).toThrow(BusinessException)
    expect(() =>
      service.assertMembershipBenefitContract(3, 2, {
        assetType: 1,
        assetKey: 'avatar_frame',
        grantCount: 1,
      }),
    ).toThrow(BusinessException)
  })

  it('raises state conflict instead of skipping invalid persisted plan benefits during activation', async () => {
    const service = new MembershipService(
      {
        schema: {
          userMembershipSubscription: 'user_membership_subscription',
        },
      } as any,
      {
        applyDelta: jest.fn(() => Promise.resolve({ success: true })),
      } as any,
      {} as any,
      {
        grantCouponsForSource: jest.fn(),
      } as any,
    ) as any
    service.getEnabledPlanBenefitItems = jest.fn(() =>
      Promise.resolve([
        {
          id: 21,
          grantPolicy: 1,
          benefitValue: { couponDefinitionId: 7, grantCount: 1 },
          benefit: { benefitType: 2 },
        },
      ]),
    )

    await expect(
      service.activatePaidOrder(createActivationTx(), {
        id: 10,
        orderNo: 'PAY202605060001',
        orderType: PaymentOrderTypeEnum.VIP_SUBSCRIPTION,
        paidAmount: 1800,
        subscriptionMode: PaymentSubscriptionModeEnum.ONE_TIME,
        targetId: 1,
        userId: 3,
      }),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.STATE_CONFLICT,
    })
  })

  it('preserves existing plan benefits when update payload omits benefits', async () => {
    const updateWhere = jest.fn(() => Promise.resolve())
    const updateSet = jest.fn(() => ({ where: updateWhere }))
    const tx = {
      update: jest.fn(() => ({ set: updateSet })),
    }
    const service = new MembershipService(
      {
        db: {
          query: {
            membershipPlan: {
              findFirst: jest.fn(() =>
                Promise.resolve({
                  id: 1,
                  name: '月度 VIP',
                  priceAmount: 1800,
                  originalPriceAmount: 3000,
                }),
              ),
            },
          },
        },
        schema: {
          membershipPlan: { id: 'membership_plan.id' },
        },
        withErrorHandling: jest.fn((callback) => callback()),
        withTransaction: jest.fn((callback) => callback(tx)),
      } as any,
      {} as any,
      {} as any,
      {} as any,
    ) as any
    service.replaceMembershipPlanBenefits = jest.fn()

    await service.updateMembershipPlan({
      id: 1,
      name: '月度 VIP Plus',
    })

    expect(service.replaceMembershipPlanBenefits).not.toHaveBeenCalled()
    expect(tx.update).toHaveBeenCalledTimes(1)
  })

  it('replaces plan benefits only when update payload explicitly includes benefits', async () => {
    const updateWhere = jest.fn(() => Promise.resolve())
    const updateSet = jest.fn(() => ({ where: updateWhere }))
    const tx = {
      update: jest.fn(() => ({ set: updateSet })),
    }
    const service = new MembershipService(
      {
        db: {
          query: {
            membershipPlan: {
              findFirst: jest.fn(() =>
                Promise.resolve({
                  id: 1,
                  name: '月度 VIP',
                  priceAmount: 1800,
                  originalPriceAmount: 3000,
                }),
              ),
            },
          },
        },
        schema: {
          membershipPlan: { id: 'membership_plan.id' },
        },
        withErrorHandling: jest.fn((callback) => callback()),
        withTransaction: jest.fn((callback) => callback(tx)),
      } as any,
      {} as any,
      {} as any,
      {} as any,
    ) as any
    service.replaceMembershipPlanBenefits = jest.fn(() => Promise.resolve())

    await service.updateMembershipPlan({
      benefits: [],
      id: 1,
      name: '月度 VIP Plus',
    })

    expect(service.replaceMembershipPlanBenefits).toHaveBeenCalledWith(
      tx,
      1,
      [],
    )
  })

  it('rejects benefit type changes that would invalidate existing plan links', async () => {
    const updateWhere = jest.fn(() => Promise.resolve())
    const updateSet = jest.fn(() => ({ where: updateWhere }))
    const selectWhere = jest.fn(() =>
      Promise.resolve([
        {
          grantPolicy: 1,
          benefitValue: null,
        },
      ]),
    )
    const tx = {
      query: {
        membershipBenefitDefinition: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 7,
              benefitType: 1,
            }),
          ),
        },
      },
      select: jest.fn(() => ({
        from: jest.fn(() => ({ where: selectWhere })),
      })),
      update: jest.fn(() => ({ set: updateSet })),
    }
    const service = new MembershipService(
      {
        schema: {
          membershipBenefitDefinition: { id: 'membership_benefit_definition.id' },
          membershipPlanBenefit: {
            benefitId: 'membership_plan_benefit.benefit_id',
            grantPolicy: 'membership_plan_benefit.grant_policy',
            benefitValue: 'membership_plan_benefit.benefit_value',
          },
        },
        withErrorHandling: jest.fn((callback) => callback()),
        withTransaction: jest.fn((callback) => callback(tx)),
      } as any,
      {} as any,
      {} as any,
      {} as any,
    ) as any

    await expect(
      service.updateMembershipBenefitDefinition({
        id: 7,
        benefitType: 2,
      }),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
    })
    expect(tx.update).not.toHaveBeenCalled()
  })

  it('rejects legacy numeric subscription modes when creating a VIP order', async () => {
    const service = createService()

    await expect(
      service.createVipSubscriptionOrder(3, {
        planId: 1,
        subscriptionMode: 2,
      }),
    ).rejects.toBeInstanceOf(BusinessException)
  })

  it('normalizes duplicate page config plan ids as an owner-side validation error', () => {
    const service = createService()

    expect(() => service.normalizePlanIds([1, 1])).toThrow(BusinessException)
    expect(service.normalizePlanIds([2, 3])).toEqual([2, 3])
  })
})
