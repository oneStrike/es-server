/// <reference types="jest" />

import { BusinessException } from '@libs/platform/exceptions'
import {
  CouponRedemptionTargetTypeEnum,
  CouponTypeEnum,
} from './coupon.constant'
import { CouponService } from './coupon.service'

describe('CouponService domain split contract', () => {
  it('reserves discount coupons and returns purchase pricing in the same transaction', async () => {
    const service = new CouponService({} as any, {} as any) as any
    const tx = {}
    service.getCouponInstanceWithDefinition = jest.fn(() =>
      Promise.resolve({
        couponType: CouponTypeEnum.DISCOUNT,
        discountAmount: 5,
        discountRateBps: 9000,
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
    const service = new CouponService({} as any, {} as any) as any
    service.getCouponInstanceWithDefinition = jest.fn(() =>
      Promise.resolve({
        couponType: CouponTypeEnum.READING,
        discountAmount: 0,
        discountRateBps: 10000,
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
})
