/// <reference types="jest" />

import { BusinessException } from '@libs/platform/exceptions'
import {
  PaymentOrderTypeEnum,
  PaymentSubscriptionModeEnum,
} from '../payment/payment.constant'
import { MembershipService } from './membership.service'

describe('MembershipService domain split contract', () => {
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

  it('rejects legacy numeric subscription modes when creating a VIP order', async () => {
    const service = new MembershipService(
      {} as any,
      {} as any,
      {} as any,
    ) as any

    await expect(
      service.createVipSubscriptionOrder(3, {
        planId: 1,
        subscriptionMode: 2,
      }),
    ).rejects.toBeInstanceOf(BusinessException)
  })

  it('normalizes duplicate page config plan ids as an owner-side validation error', () => {
    const service = new MembershipService(
      {} as any,
      {} as any,
      {} as any,
    ) as any

    expect(() => service.normalizePlanIds([1, 1])).toThrow(BusinessException)
    expect(service.normalizePlanIds([2, 3])).toEqual([2, 3])
  })
})
