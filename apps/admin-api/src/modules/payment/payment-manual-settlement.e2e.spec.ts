/// <reference types="jest" />

import 'reflect-metadata'
import { PATH_METADATA } from '@nestjs/common/constants'
import {
  PaymentOrderStatusEnum,
  PaymentOrderTypeEnum,
} from '@libs/interaction/payment/payment.constant'
import { PaymentService } from '@libs/interaction/payment/payment.service'
import { UserAssetsService } from '@libs/interaction/user-assets/user-assets.service'
import { WalletService } from '@libs/interaction/wallet/wallet.service'
import { PaymentController } from './payment.controller'

function createCurrencyPaidOrder(status: PaymentOrderStatusEnum) {
  return {
    id: 10,
    orderNo: 'PAY202605100002',
    orderType: PaymentOrderTypeEnum.CURRENCY_RECHARGE,
    paidAmount: status === PaymentOrderStatusEnum.PAID ? 100 : 0,
    payableAmount: 100,
    providerConfigId: 1,
    providerTradeNo:
      status === PaymentOrderStatusEnum.PAID ? 'manual-trade-no' : null,
    status,
    subscriptionMode: 1,
    targetId: 2,
    userId: 33,
  }
}

describe('Admin payment manual settlement e2e substitute', () => {
  it('uses the audited admin route and shared payment settlement core idempotently', async () => {
    const assetState = { currencyBalance: 0 }
    const pendingOrder = createCurrencyPaidOrder(PaymentOrderStatusEnum.PENDING)
    const paidOrder = createCurrencyPaidOrder(PaymentOrderStatusEnum.PAID)
    const tx = {
      query: {
        paymentOrder: {
          findFirst: jest.fn(),
        },
      },
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() =>
              Promise.resolve([
                {
                  bonusAmount: 20,
                  currencyAmount: 80,
                  id: paidOrder.targetId,
                },
              ]),
            ),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([paidOrder])),
          })),
        })),
      })),
    }
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(pendingOrder)
      .mockResolvedValueOnce(paidOrder)
    const drizzle = {
      db: {
        query: {
          paymentOrder: { findFirst },
        },
      },
      schema: {
        currencyPackage: {
          id: 'currency_package.id',
        },
        paymentOrder: {
          id: 'payment_order.id',
          status: 'payment_order.status',
        },
      },
      withTransaction: jest.fn((callback: (runner: typeof tx) => unknown) =>
        callback(tx),
      ),
    }
    const growthLedgerService = {
      applyDelta: jest.fn((_runner: unknown, input: { amount: number }) => {
        assetState.currencyBalance += input.amount
        return Promise.resolve({ success: true })
      }),
    }
    const walletService = new WalletService(
      drizzle as any,
      growthLedgerService as any,
      {} as any,
    )
    const membershipService = { activatePaidOrder: jest.fn() }
    const paymentService = new PaymentService(
      drizzle as any,
      walletService,
      membershipService as any,
    )
    const userAssetsService = new (class extends UserAssetsService {
      constructor() {
        super({} as any)
      }

      override async getUserAssetsSummary(userId: number) {
        expect(userId).toBe(33)
        return {
          availableCouponCount: 0,
          commentCount: 0,
          currencyBalance: assetState.currencyBalance,
          downloadedChapterCount: 0,
          downloadedWorkCount: 0,
          favoriteCount: 0,
          likeCount: 0,
          purchasedChapterCount: 0,
          purchasedWorkCount: 0,
          viewCount: 0,
          vipExpiresAt: null,
        }
      }
    })()
    const controller = new PaymentController(paymentService)

    expect(Reflect.getMetadata(PATH_METADATA, PaymentController)).toBe(
      'admin/payment',
    )
    expect(
      Reflect.getMetadata(
        'audit',
        PaymentController.prototype.confirmPaymentOrder,
      ),
    ).toMatchObject({ content: '手工确认支付订单状态' })

    await controller.confirmPaymentOrder({
      notifyPayload: null,
      orderNo: paidOrder.orderNo,
      paidAmount: 100,
      providerTradeNo: 'manual-trade-no',
    } as any)
    await controller.confirmPaymentOrder({
      notifyPayload: null,
      orderNo: paidOrder.orderNo,
      paidAmount: 100,
      providerTradeNo: 'manual-trade-no',
    } as any)

    expect(growthLedgerService.applyDelta).toHaveBeenCalledTimes(1)
    expect(membershipService.activatePaidOrder).not.toHaveBeenCalled()
    expect(drizzle.withTransaction).toHaveBeenCalledTimes(1)
    await expect(userAssetsService.getWalletDetail(33)).resolves.toMatchObject({
      currencyBalance: 100,
    })
  })
})
