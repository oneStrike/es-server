/// <reference types="jest" />

import {
  PaymentOrderStatusEnum,
  PaymentOrderTypeEnum,
} from '@libs/interaction/payment/payment.constant'
import { PaymentService } from '@libs/interaction/payment/payment.service'
import { UserAssetsService } from '@libs/interaction/user-assets/user-assets.service'
import { WalletService } from '@libs/interaction/wallet/wallet.service'
import { PATH_METADATA } from '@nestjs/common/constants'
import { PaymentController } from './payment.controller'
import 'reflect-metadata'

type PaymentServiceArgs = ConstructorParameters<typeof PaymentService>
type UserAssetsServiceArgs = ConstructorParameters<typeof UserAssetsService>
type WalletServiceArgs = ConstructorParameters<typeof WalletService>

function createCurrencyPaidOrder(status: PaymentOrderStatusEnum) {
  return {
    clientContext: {
      targetSnapshot: {
        bonusAmount: 20,
        currencyAmount: 80,
        packageKey: 'coin-80',
        price: 100,
      },
    },
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

describe('admin payment exception repair settlement e2e substitute', () => {
  it('uses the audited repair route and shared payment settlement core idempotently', async () => {
    const assetState = { currencyBalance: 0 }
    const pendingOrder = createCurrencyPaidOrder(PaymentOrderStatusEnum.PENDING)
    const paidOrder = createCurrencyPaidOrder(PaymentOrderStatusEnum.PAID)
    const reconciliationRecord = {
      channel: 1,
      id: 1,
      localStatus: PaymentOrderStatusEnum.PENDING,
      mismatchType: 2,
      orderNo: pendingOrder.orderNo,
      providerAmount: 100,
      providerStatus: 'SUCCESS',
      providerTradeNo: 'manual-trade-no',
      status: 1,
    }
    const tx = {
      query: {
        paymentOrder: {
          findFirst: jest.fn(),
        },
      },
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(async () => Promise.resolve([paidOrder])),
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
          paymentReconciliationRecord: {
            findFirst: jest.fn(async () =>
              Promise.resolve(reconciliationRecord),
            ),
          },
        },
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(async () => Promise.resolve()),
          })),
        })),
      },
      schema: {
        paymentOrder: {
          id: 'payment_order.id',
          status: 'payment_order.status',
        },
        paymentReconciliationRecord: {
          id: 'payment_reconciliation_record.id',
        },
      },
      withTransaction: jest.fn((callback: (runner: typeof tx) => unknown) =>
        callback(tx),
      ),
    }
    const growthLedgerService = {
      applyDelta: jest.fn(async (_runner: unknown, input: { amount: number }) => {
        assetState.currencyBalance += input.amount
        return Promise.resolve({ success: true })
      }),
    }
    const walletService = new WalletService(
      drizzle as unknown as WalletServiceArgs[0],
      growthLedgerService as unknown as WalletServiceArgs[1],
      {} as unknown as WalletServiceArgs[2],
    )
    const membershipService = { activatePaidOrder: jest.fn() }
    const paymentService = new PaymentService(
      drizzle as unknown as PaymentServiceArgs[0],
      walletService,
      membershipService as unknown as PaymentServiceArgs[2],
    )
    const userAssetsService = new (class extends UserAssetsService {
      constructor() {
        super({} as unknown as UserAssetsServiceArgs[0])
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
        Reflect.get(PaymentController.prototype, 'repairPaidOrder'),
      ),
    ).toMatchObject({ content: '异常修复支付订单为已支付' })
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        Reflect.get(PaymentController.prototype, 'repairPaidOrder'),
      ),
    ).toBe('order/repair-paid')
    expect(
        Reflect.get(PaymentController.prototype, 'confirmPaymentOrder'),
    ).toBeUndefined()

    const repairPayload: Parameters<PaymentController['repairPaidOrder']>[0] = {
      evidence: { source: 'manual-settlement-spec' },
      orderNo: paidOrder.orderNo,
      paidAmount: 100,
      providerTradeNo: 'manual-trade-no',
      reason: '线下对账确认已收款',
      reconciliationRecordId: 1,
    }

    await controller.repairPaidOrder(repairPayload, 7)
    await controller.repairPaidOrder(repairPayload, 7)

    expect(growthLedgerService.applyDelta).toHaveBeenCalledTimes(1)
    expect(membershipService.activatePaidOrder).not.toHaveBeenCalled()
    expect(drizzle.withTransaction).toHaveBeenCalledTimes(1)
    await expect(userAssetsService.getWalletDetail(33)).resolves.toMatchObject({
      currencyBalance: 100,
    })
  })
})
