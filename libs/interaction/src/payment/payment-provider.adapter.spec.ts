/// <reference types="jest" />

import { createHmac } from 'node:crypto'
import {
  PaymentChannelEnum,
  PaymentSceneEnum,
  PaymentSubscriptionModeEnum,
} from './payment.constant'
import {
  AlipayPaymentProviderAdapter,
  WechatPaymentProviderAdapter,
} from './payment-provider.adapter'

const PAYMENT_VERIFY_SECRET_ENV = 'PAYMENT_DOMAIN_TEST_SECRET'
const PAYMENT_VERIFY_SECRET = 'payment-provider-test-secret'

const baseOrder = {
  id: 1,
  orderNo: 'PAY202605060001',
  userId: 2,
  orderType: 1,
  channel: PaymentChannelEnum.ALIPAY,
  paymentScene: PaymentSceneEnum.APP,
  platform: 1,
  environment: 1,
  clientAppKey: 'default-app',
  subscriptionMode: 1,
  autoRenewAgreementId: null,
  status: 1,
  payableAmount: 1000,
  paidAmount: 0,
  targetId: 3,
  providerConfigId: 4,
  providerConfigVersion: 1,
  credentialVersionRef: 'seed://payment/alipay/v1',
  configSnapshot: null,
  clientContext: null,
  clientPayPayload: null,
  providerTradeNo: null,
  notifyPayload: null,
  paidAt: null,
  closedAt: null,
  refundedAt: null,
  createdAt: new Date('2026-05-06T00:00:00.000Z'),
  updatedAt: new Date('2026-05-06T00:00:00.000Z'),
}

const baseConfig = {
  id: 4,
  channel: PaymentChannelEnum.ALIPAY,
  paymentScene: PaymentSceneEnum.APP,
  platform: 1,
  environment: 1,
  clientAppKey: 'default-app',
  configName: 'seed config',
  appId: 'app-id',
  mchId: 'mch-id',
  notifyUrl: 'https://example.com/notify',
  returnUrl: 'https://example.com/return',
  agreementNotifyUrl: 'https://example.com/agreement/notify',
  allowedReturnDomains: ['example.com'],
  certMode: 1,
  publicKeyRef: null,
  privateKeyRef: null,
  apiV3KeyRef: null,
  appCertRef: null,
  platformCertRef: null,
  rootCertRef: null,
  configVersion: 1,
  credentialVersionRef: 'seed://payment/alipay/v1',
  configMetadata: null,
  supportsAutoRenew: true,
  sortOrder: 0,
  isEnabled: true,
  createdAt: new Date('2026-05-06T00:00:00.000Z'),
  updatedAt: new Date('2026-05-06T00:00:00.000Z'),
}

describe('Payment provider adapters', () => {
  beforeEach(() => {
    process.env[PAYMENT_VERIFY_SECRET_ENV] = PAYMENT_VERIFY_SECRET
  })

  afterEach(() => {
    delete process.env[PAYMENT_VERIFY_SECRET_ENV]
  })

  function signPaymentFields(fields: Record<string, number | string>) {
    const canonicalPayload = Object.keys(fields)
      .sort()
      .map((key) => `${key}=${fields[key]}`)
      .join('\n')
    return createHmac('sha256', PAYMENT_VERIFY_SECRET)
      .update(canonicalPayload)
      .digest('hex')
  }

  function buildSignedPaymentPayload(
    overrides: Partial<Record<string, number | string>> = {},
  ) {
    const fields = {
      channel: baseOrder.channel,
      credentialVersionRef: baseConfig.credentialVersionRef,
      orderNo: baseOrder.orderNo,
      paidAmount: baseOrder.payableAmount,
      providerConfigId: baseConfig.id,
      providerConfigVersion: baseConfig.configVersion,
      providerTradeNo: 'provider-trade-no',
      tradeStatus: 'SUCCESS',
      ...overrides,
    }
    return {
      ...fields,
      signType: 'HMAC_SHA256',
      signature: signPaymentFields(fields),
    }
  }

  it('builds scene-specific payload without leaking secrets', () => {
    const adapter = new AlipayPaymentProviderAdapter()

    expect(
      adapter.createOrder({
        order: baseOrder,
        config: baseConfig,
        sceneContext: {
          channel: PaymentChannelEnum.ALIPAY,
          paymentScene: PaymentSceneEnum.APP,
          platform: 1,
          environment: 1,
        },
      }),
    ).toMatchObject({
      scene: 'app',
      providerConfigId: baseConfig.id,
      credentialVersionRef: baseConfig.credentialVersionRef,
    })

    expect(
      adapter.createOrder({
        order: {
          ...baseOrder,
          paymentScene: PaymentSceneEnum.H5,
        },
        config: baseConfig,
        sceneContext: {
          channel: PaymentChannelEnum.ALIPAY,
          paymentScene: PaymentSceneEnum.H5,
          platform: 4,
          environment: 1,
          returnUrl: 'https://client.example.com/return',
        },
      }),
    ).toMatchObject({
      scene: 'h5',
      redirectUrl: 'https://client.example.com/return',
    })
  })

  it('parses provider notify payload with idempotent trade fields', () => {
    const adapter = new WechatPaymentProviderAdapter()
    const parsed = adapter.parseNotify({
      order: {
        ...baseOrder,
        channel: PaymentChannelEnum.WECHAT,
      },
      config: {
        ...baseConfig,
        channel: PaymentChannelEnum.WECHAT,
      },
      payload: {
        providerTradeNo: 'wx-trade-no',
        paidAmount: 1000,
      },
    })

    expect(parsed).toEqual({
      paidAmount: 1000,
      providerTradeNo: 'wx-trade-no',
    })
  })

  it('verifies signed payment notify payloads against order, amount, channel, and agreement number', () => {
    const adapter = new AlipayPaymentProviderAdapter()
    const order = {
      ...baseOrder,
      subscriptionMode: PaymentSubscriptionModeEnum.AUTO_RENEW_SIGNING,
    }
    const config = {
      ...baseConfig,
      configMetadata: {
        verifySecretEnvKey: PAYMENT_VERIFY_SECRET_ENV,
      },
    }
    const payload = buildSignedPaymentPayload({
      agreementNo: 'provider-agreement-no',
    })

    expect(adapter.verifyNotify({ order, config, payload })).toBe(true)
    expect(adapter.parseNotify({ order, config, payload })).toMatchObject({
      agreementNo: 'provider-agreement-no',
    })
    expect(
      adapter.verifyNotify({
        order,
        config,
        payload: buildSignedPaymentPayload({ paidAmount: 1 }),
      }),
    ).toBe(false)
    expect(
      adapter.verifyNotify({
        order,
        config,
        payload: {
          ...payload,
          agreementNo: 'tampered-agreement-no',
        },
      }),
    ).toBe(false)
  })
})
