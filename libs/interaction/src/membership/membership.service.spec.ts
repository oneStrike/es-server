/// <reference types="jest" />

import { BusinessException } from '@libs/platform/exceptions'
import { PaymentSubscriptionModeEnum } from '../payment/payment.constant'
import { MembershipService } from './membership.service'

describe('MembershipService domain split contract', () => {
  it('requires provider verified agreement number for auto-renew signing activation', async () => {
    const service = new MembershipService(
      {} as any,
      {} as any,
      {} as any,
    ) as any
    const tx = {
      query: {
        membershipPlan: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 1,
              durationDays: 30,
            }),
          ),
        },
      },
    }

    await expect(
      service.activatePaidOrder(
        tx,
        {
          subscriptionMode: PaymentSubscriptionModeEnum.AUTO_RENEW_SIGNING,
          targetId: 1,
        },
        undefined,
      ),
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
