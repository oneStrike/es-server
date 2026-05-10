/// <reference types="jest" />

import { BusinessException } from '@libs/platform/exceptions'
import { BaseDto } from '@libs/platform/dto'
import {
  PaymentOrderStatusEnum,
  PaymentOrderTypeEnum,
} from './payment.constant'
import { PaymentOrderResultDto } from './dto/payment.dto'
import { PaymentService } from './payment.service'

const APP_PAYMENT_RESULT_KEYS = [
  'clientPayPayload',
  'orderNo',
  'orderType',
  'payableAmount',
  'status',
  'subscriptionMode',
].sort()

const ADMIN_PAYMENT_ORDER_PAGE_ITEM_KEYS = [
  'autoRenewAgreementId',
  'channel',
  'clientAppKey',
  'closedAt',
  'createdAt',
  'credentialVersionRef',
  'environment',
  'id',
  'orderNo',
  'orderType',
  'paidAmount',
  'paidAt',
  'payableAmount',
  'paymentScene',
  'platform',
  'providerConfigId',
  'providerConfigVersion',
  'providerTradeNo',
  'refundedAt',
  'status',
  'subscriptionMode',
  'targetId',
  'updatedAt',
  'userId',
].sort()

function buildPaidOrder() {
  return {
    autoRenewAgreementId: null,
    channel: 1,
    clientAppKey: 'default-app',
    clientPayPayload: null,
    clientContext: { ip: '127.0.0.1' },
    configSnapshot: null,
    closedAt: null,
    createdAt: new Date('2026-05-10T10:00:00.000Z'),
    credentialVersionRef: 'kms://payment/default/v1',
    environment: 1,
    id: 1,
    notifyPayload: null,
    orderNo: 'PAY202605060001',
    orderType: PaymentOrderTypeEnum.CURRENCY_RECHARGE,
    paidAmount: 100,
    paidAt: new Date('2026-05-10T10:01:00.000Z'),
    payableAmount: 100,
    paymentScene: 1,
    platform: 1,
    providerConfigId: 1,
    providerConfigVersion: 1,
    providerTradeNo: 'provider-trade-no',
    refundedAt: null,
    status: PaymentOrderStatusEnum.PAID,
    subscriptionMode: 1,
    targetId: 2,
    updatedAt: new Date('2026-05-10T10:02:00.000Z'),
    userId: 3,
  }
}

describe('PaymentService domain split contract', () => {
  it('keeps the app payment result DTO out of BaseDto public fields', () => {
    expect(PaymentOrderResultDto.prototype).not.toBeInstanceOf(BaseDto)
  })

  it('maps admin payment order page rows to an exact public admin view', async () => {
    const rawOrder = buildPaidOrder()
    const rawPage = {
      list: [rawOrder],
      pageIndex: 1,
      pageSize: 15,
      total: 1,
    }
    const drizzle = {
      ext: {
        findPagination: jest.fn(() => Promise.resolve(rawPage)),
      },
      schema: {
        paymentOrder: {},
      },
    }
    const service = new PaymentService(drizzle as any, {} as any, {} as any)

    await expect(
      service.getPaymentOrderPage({ pageIndex: 1, pageSize: 15 } as any),
    ).resolves.toMatchObject({
      pageIndex: 1,
      pageSize: 15,
      total: 1,
    })
    const result = await service.getPaymentOrderPage({
      pageIndex: 1,
      pageSize: 15,
    } as any)
    const item = result.list[0]

    expect(Object.keys(item).sort()).toEqual(ADMIN_PAYMENT_ORDER_PAGE_ITEM_KEYS)
    expect(item).not.toHaveProperty('configSnapshot')
    expect(item).not.toHaveProperty('clientContext')
    expect(item).not.toHaveProperty('clientPayPayload')
    expect(item).not.toHaveProperty('notifyPayload')
    expect(item).not.toBe(rawOrder)
  })

  it('treats a matching paid order notification as an idempotent result without re-settlement', async () => {
    const order = buildPaidOrder()
    const drizzle = {
      db: {
        query: {
          paymentOrder: {
            findFirst: jest.fn(() => Promise.resolve(order)),
          },
        },
      },
      withTransaction: jest.fn(),
    }
    const walletService = { applyRechargeSettlement: jest.fn() }
    const membershipService = { activatePaidOrder: jest.fn() }
    const service = new PaymentService(
      drizzle as any,
      walletService as any,
      membershipService as any,
    ) as any
    service.getPaymentProviderConfigById = jest.fn(() =>
      Promise.resolve({ id: 1 }),
    )
    service.getPaymentAdapter = jest.fn(() => ({
      parseNotify: jest.fn(() => ({
        paidAmount: 100,
        providerTradeNo: 'provider-trade-no',
      })),
      verifyNotify: jest.fn(() => true),
    }))

    const result = await service.confirmPaymentOrder({
      notifyPayload: { providerTradeNo: 'provider-trade-no' },
      orderNo: order.orderNo,
    })

    expect(Object.keys(result).sort()).toEqual(APP_PAYMENT_RESULT_KEYS)
    expect(result).toMatchObject({
      clientPayPayload: {},
      orderNo: order.orderNo,
      status: PaymentOrderStatusEnum.PAID,
    })
    await expect(
      service.confirmPaymentOrder({
        notifyPayload: { providerTradeNo: 'provider-trade-no' },
        orderNo: order.orderNo,
      }),
    ).resolves.toEqual(result)
    expect(drizzle.withTransaction).not.toHaveBeenCalled()
    expect(walletService.applyRechargeSettlement).not.toHaveBeenCalled()
    expect(membershipService.activatePaidOrder).not.toHaveBeenCalled()
  })

  it('rejects app notifications for another user before settlement', async () => {
    const drizzle = {
      db: {
        query: {
          paymentOrder: {
            findFirst: jest.fn(() => Promise.resolve(buildPaidOrder())),
          },
        },
      },
    }
    const service = new PaymentService(drizzle as any, {} as any, {} as any)

    await expect(
      service.confirmPaymentOrder(
        { orderNo: 'PAY202605060001' },
        { userId: 99 },
      ),
    ).rejects.toBeInstanceOf(BusinessException)
  })

  it('settles a manual admin confirmation without provider notify verification', async () => {
    const pendingOrder = {
      ...buildPaidOrder(),
      paidAmount: 0,
      providerTradeNo: null,
      status: PaymentOrderStatusEnum.PENDING,
    }
    const paidOrder = buildPaidOrder()
    const tx = {
      query: { paymentOrder: { findFirst: jest.fn() } },
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([paidOrder])),
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
        paymentOrder: {
          id: 'payment_order.id',
          status: 'payment_order.status',
        },
      },
      withTransaction: jest.fn((callback: (runner: typeof tx) => unknown) =>
        callback(tx),
      ),
    }
    const walletService = { applyRechargeSettlement: jest.fn() }
    const membershipService = { activatePaidOrder: jest.fn() }
    const service = new PaymentService(
      drizzle as any,
      walletService as any,
      membershipService as any,
    )

    await expect(
      service.confirmPaymentOrderManually({
        notifyPayload: undefined,
        orderNo: paidOrder.orderNo,
        paidAmount: 100,
        providerTradeNo: 'provider-trade-no',
      }),
    ).resolves.toMatchObject({
      orderNo: paidOrder.orderNo,
      status: PaymentOrderStatusEnum.PAID,
    })
    expect(walletService.applyRechargeSettlement).toHaveBeenCalledWith(
      tx,
      paidOrder,
    )
    expect(drizzle.withTransaction).toHaveBeenCalledTimes(1)
  })
})
