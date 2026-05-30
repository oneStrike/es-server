/// <reference types="jest" />

import { BusinessException } from '@libs/platform/exceptions'
import {
  ClientPlatformEnum,
  PaymentChannelEnum,
  PaymentOrderTypeEnum,
  PaymentSceneEnum,
  PaymentSubscriptionModeEnum,
  ProviderEnvironmentEnum,
} from './payment.constant'
import { PaymentOrderService } from './payment-order.service'

describe('PaymentOrderService subscription mode boundary', () => {
  it('rejects legacy subscription modes before resolving provider config', async () => {
    const drizzle = {
      db: {
        select: jest.fn(),
      },
      schema: {
        paymentProviderConfig: {},
      },
    }
    const service = new PaymentOrderService(drizzle as any)

    await expect(
      service.createPaymentOrder(3, {
        channel: PaymentChannelEnum.ALIPAY,
        environment: ProviderEnvironmentEnum.PRODUCTION,
        orderType: PaymentOrderTypeEnum.VIP_SUBSCRIPTION,
        payableAmount: 1800,
        paymentScene: PaymentSceneEnum.APP,
        platform: ClientPlatformEnum.ANDROID,
        subscriptionMode: 2 as PaymentSubscriptionModeEnum,
        targetId: 1,
        targetSnapshot: { planId: 1 },
      }),
    ).rejects.toBeInstanceOf(BusinessException)
    expect(drizzle.db.select).not.toHaveBeenCalled()
  })
})
