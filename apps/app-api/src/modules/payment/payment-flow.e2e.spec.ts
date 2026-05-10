/// <reference types="jest" />

import {
  PaymentOrderStatusEnum,
  PaymentOrderTypeEnum,
} from '@libs/interaction/payment/payment.constant'
import { PaymentService } from '@libs/interaction/payment/payment.service'
import { UserAssetsService } from '@libs/interaction/user-assets/user-assets.service'
import { WalletService } from '@libs/interaction/wallet/wallet.service'
import { PaymentController } from './payment.controller'

const APP_PAYMENT_RESULT_KEYS = [
  'clientPayPayload',
  'orderNo',
  'orderType',
  'payableAmount',
  'status',
  'subscriptionMode',
].sort()

function createPaidOrder() {
  return {
    id: 1,
    orderNo: 'PAY202605100001',
    orderType: PaymentOrderTypeEnum.CURRENCY_RECHARGE,
    paidAmount: 100,
    payableAmount: 100,
    providerConfigId: 1,
    providerTradeNo: 'provider-trade-no',
    status: PaymentOrderStatusEnum.PAID,
    subscriptionMode: 1,
    targetId: 2,
    userId: 33,
  }
}

describe('App payment flow e2e substitute', () => {
  it('enters through app payment controller, settles wallet recharge, and reads wallet summary owner', async () => {
    const assetState = { currencyBalance: 0 }
    const pendingOrder = {
      ...createPaidOrder(),
      paidAmount: 0,
      providerTradeNo: null,
      status: PaymentOrderStatusEnum.PENDING,
    }
    const paidOrder = createPaidOrder()
    const tx = {
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([paidOrder])),
          })),
        })),
      })),
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
    }
    const drizzle = {
      db: {
        query: {
          paymentOrder: {
            findFirst: jest.fn(() => Promise.resolve(pendingOrder)),
          },
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
    ) as any
    paymentService.getPaymentProviderConfigById = jest.fn(() =>
      Promise.resolve({ id: 1 }),
    )
    paymentService.getPaymentAdapter = jest.fn(() => ({
      parseNotify: jest.fn(() => ({
        paidAmount: 100,
        providerTradeNo: 'provider-trade-no',
      })),
      verifyNotify: jest.fn(() => true),
    }))
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

    const paymentResult = await controller.confirmPaymentOrder(
      {
        notifyPayload: { providerTradeNo: 'provider-trade-no' },
        orderNo: paidOrder.orderNo,
      } as any,
      33,
    )

    expect(Object.keys(paymentResult).sort()).toEqual(APP_PAYMENT_RESULT_KEYS)
    expect(paymentResult).toMatchObject({
      orderNo: paidOrder.orderNo,
      status: PaymentOrderStatusEnum.PAID,
    })
    expect(paymentResult).not.toHaveProperty('id')
    expect(paymentResult).not.toHaveProperty('createdAt')
    expect(paymentResult).not.toHaveProperty('updatedAt')
    expect(paymentResult).not.toHaveProperty('userId')
    expect(paymentResult).not.toHaveProperty('providerConfigId')
    expect(paymentResult).not.toHaveProperty('providerTradeNo')
    expect(growthLedgerService.applyDelta).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ amount: 100, userId: 33 }),
    )
    expect(membershipService.activatePaidOrder).not.toHaveBeenCalled()
    await expect(userAssetsService.getWalletDetail(33)).resolves.toMatchObject({
      currencyBalance: 100,
    })
  })
})
