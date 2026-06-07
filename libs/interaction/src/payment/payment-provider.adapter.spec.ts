/// <reference types="jest" />

import { Buffer } from 'node:buffer'
import {
  createCipheriv,
  createSign,
  generateKeyPairSync,
  randomBytes,
} from 'node:crypto'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Logger } from '@nestjs/common'
import {
  AlipayPaymentProviderAdapter,
  WechatPaymentProviderAdapter,
} from './payment-provider.adapter'
import { PaymentChannelEnum, PaymentSceneEnum } from './payment.constant'

const WECHAT_API_V3_KEY = '0123456789abcdef0123456789abcdef'

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
  status: 1,
  payableAmount: 1000,
  paidAmount: 0,
  targetId: 3,
  providerConfigId: 4,
  providerConfigVersionId: null,
  providerConfigVersion: 1,
  appPrivateCredentialId: null,
  alipayPublicCredentialId: null,
  wechatApiV3CredentialId: null,
  providerCertificateIds: null,
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
  sortOrder: 0,
  isEnabled: true,
  createdAt: new Date('2026-05-06T00:00:00.000Z'),
  updatedAt: new Date('2026-05-06T00:00:00.000Z'),
}

describe('payment provider adapters', () => {
  function buildAlipayNotifyFixture(
    overrides: Partial<Record<string, string>> = {},
  ) {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    })
    const payload: Record<string, string> = {
      app_id: baseConfig.appId,
      notify_id: '202606070000000000000000001',
      notify_time: '2026-06-07 12:00:00',
      notify_type: 'trade_status_sync',
      out_trade_no: baseOrder.orderNo,
      total_amount: '10.00',
      trade_no: '2026060722001400000000000001',
      trade_status: 'TRADE_SUCCESS',
      ...overrides,
    }
    const signContent = Object.keys(payload)
      .sort()
      .map((key) => `${key}=${payload[key]}`)
      .join('&')
    const signer = createSign('RSA-SHA256')
    signer.update(signContent)
    signer.end()
    return {
      credentialMaterial: {
        alipayPublicKeyPem: publicKey.export({
          format: 'pem',
          type: 'spki',
        }),
      },
      payload: {
        ...payload,
        sign: signer.sign(privateKey, 'base64'),
        sign_type: 'RSA2',
      },
    }
  }

  function buildWechatNotifyFixture(
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    })
    const resourcePlaintext = JSON.stringify({
      amount: {
        currency: 'CNY',
        payer_currency: 'CNY',
        payer_total: baseOrder.payableAmount,
        total: baseOrder.payableAmount,
      },
      appid: baseConfig.appId,
      mchid: baseConfig.mchId,
      out_trade_no: baseOrder.orderNo,
      trade_state: 'SUCCESS',
      transaction_id: '4200000000202606070000000001',
      ...overrides,
    })
    const nonce = randomBytes(12).toString('hex')
    const associatedData = 'transaction'
    const cipher = createCipheriv(
      'aes-256-gcm',
      Buffer.from(WECHAT_API_V3_KEY, 'utf8'),
      Buffer.from(nonce, 'utf8'),
    )
    cipher.setAAD(Buffer.from(associatedData, 'utf8'))
    const ciphertext = Buffer.concat([
      cipher.update(resourcePlaintext, 'utf8'),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString('base64')
    const body = {
      create_time: '2026-06-07T12:00:00+08:00',
      event_type: 'TRANSACTION.SUCCESS',
      id: 'EV-2026060700000001',
      resource: {
        algorithm: 'AEAD_AES_256_GCM',
        associated_data: associatedData,
        ciphertext,
        nonce,
        original_type: 'transaction',
      },
      resource_type: 'encrypt-resource',
      summary: '支付成功',
    }
    const rawBody = JSON.stringify(body)
    const timestamp = '1780810000'
    const headerNonce = 'notify-nonce'
    const signer = createSign('RSA-SHA256')
    signer.update(`${timestamp}\n${headerNonce}\n${rawBody}\n`)
    signer.end()
    const serialNo = 'wechat-platform-serial-fixture'
    return {
      credentialMaterial: {
        wechatApiV3Key: WECHAT_API_V3_KEY,
        wechatPlatformPublicKeyPem: publicKey.export({
          format: 'pem',
          type: 'spki',
        }),
        wechatPlatformSerialNo: serialNo,
      },
      payload: {
        ...body,
        headers: {
          'wechatpay-nonce': headerNonce,
          'wechatpay-serial': serialNo,
          'wechatpay-signature': signer.sign(privateKey, 'base64'),
          'wechatpay-timestamp': timestamp,
        },
        rawBody,
      },
    }
  }

  it('builds Alipay SDK launch payloads without leaking internal fields', async () => {
    const adapter = new AlipayPaymentProviderAdapter()
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    })
    const credentialMaterial = {
      appPrivateKeyPem: privateKey.export({
        format: 'pem',
        type: 'pkcs8',
      }),
      alipayKeyType: 'PKCS8' as const,
    }
    const config = {
      ...baseConfig,
      configMetadata: { orderSubject: '测试订单' },
    }

    const appPayload = await adapter.createOrder({
      credentialMaterial,
      order: baseOrder,
      config,
      sceneContext: {
        channel: PaymentChannelEnum.ALIPAY,
        paymentScene: PaymentSceneEnum.APP,
        platform: 1,
        environment: 1,
      },
    })

    expect(appPayload).toMatchObject({
      channel: 'alipay',
      scene: 'app',
    })
    const alipayAppPayload = appPayload as { orderString: string }
    expect(String(alipayAppPayload.orderString)).toContain(
      'method=alipay.trade.app.pay',
    )
    expect(String(alipayAppPayload.orderString)).toContain(
      encodeURIComponent(baseOrder.orderNo),
    )
    expect(JSON.stringify(appPayload)).not.toContain('providerConfigId')
    expect(JSON.stringify(appPayload)).not.toContain('providerConfigVersion')
    expect(JSON.stringify(appPayload)).not.toContain('credentialVersionRef')
    expect(JSON.stringify(appPayload)).not.toContain(
      credentialMaterial.appPrivateKeyPem,
    )

    await expect(
      adapter.createOrder({
        credentialMaterial,
        order: {
          ...baseOrder,
          paymentScene: PaymentSceneEnum.H5,
        },
        config,
        sceneContext: {
          channel: PaymentChannelEnum.ALIPAY,
          paymentScene: PaymentSceneEnum.H5,
          platform: 4,
          environment: 1,
          returnUrl: 'https://client.example.com/return',
        },
      }),
    ).resolves.toMatchObject({
      channel: 'alipay',
      scene: 'h5',
    })
  })

  it('fails closed instead of returning provider placeholders or local query echo', async () => {
    const adapter = new WechatPaymentProviderAdapter()
    const wechatOrder = {
      ...baseOrder,
      channel: PaymentChannelEnum.WECHAT,
      paymentScene: PaymentSceneEnum.MINI_PROGRAM,
    }

    await expect(
      adapter.createOrder({
        order: wechatOrder,
        config: {
          ...baseConfig,
          channel: PaymentChannelEnum.WECHAT,
        },
        sceneContext: {
          channel: PaymentChannelEnum.WECHAT,
          paymentScene: PaymentSceneEnum.MINI_PROGRAM,
          platform: 5,
          environment: 1,
          openId: 'openid',
        },
      }),
    ).rejects.toBeInstanceOf(BusinessException)

    await expect(
      adapter.createOrder({
        order: wechatOrder,
        config: {
          ...baseConfig,
          channel: PaymentChannelEnum.WECHAT,
        },
        sceneContext: {
          channel: PaymentChannelEnum.WECHAT,
          paymentScene: PaymentSceneEnum.MINI_PROGRAM,
          platform: 5,
          environment: 1,
          openId: 'openid',
        },
      }),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
    })
    expect(() => adapter.queryOrder(wechatOrder)).toThrow(BusinessException)
  })

  it('creates WeChat mini-program payloads from API v3 prepay results', async () => {
    const adapter = new WechatPaymentProviderAdapter()
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    })
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({ prepay_id: 'wx-provider-prepay-id' }),
      } as Response)

    const payload = await adapter.createOrder({
      credentialMaterial: {
        appPrivateKeyPem: privateKey.export({
          format: 'pem',
          type: 'pkcs8',
        }),
        wechatApiV3Key: WECHAT_API_V3_KEY,
        wechatMerchantSerialNo: 'MERCHANT-SERIAL',
      },
      order: {
        ...baseOrder,
        channel: PaymentChannelEnum.WECHAT,
        paymentScene: PaymentSceneEnum.MINI_PROGRAM,
      },
      config: {
        ...baseConfig,
        channel: PaymentChannelEnum.WECHAT,
        configMetadata: { wechatEndpoint: 'https://wechat.test' },
      },
      sceneContext: {
        channel: PaymentChannelEnum.WECHAT,
        paymentScene: PaymentSceneEnum.MINI_PROGRAM,
        platform: 5,
        environment: 1,
        openId: 'openid',
      },
    })

    expect(payload).toMatchObject({
      channel: 'wechat',
      scene: 'jsapi',
      prepayId: 'wx-provider-prepay-id',
      packageValue: 'prepay_id=wx-provider-prepay-id',
      signType: 'RSA',
    })
    expect(String((payload as { paySign: string }).paySign)).toBeTruthy()
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://wechat.test/v3/pay/transactions/jsapi',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining(
            'WECHATPAY2-SHA256-RSA2048',
          ),
        }),
        method: 'POST',
      }),
    )
    expect(JSON.stringify(payload)).not.toContain('PROVIDER_SIGN_REQUIRED')
    expect(JSON.stringify(payload)).not.toContain(
      `prepay_id=${baseOrder.orderNo}`,
    )
    expect(JSON.stringify(payload)).not.toContain('providerConfigId')
    expect(JSON.stringify(payload)).not.toContain('providerConfigVersion')
    expect(JSON.stringify(payload)).not.toContain('credentialVersionRef')
    fetchSpy.mockRestore()
  })

  it('verifies and parses Alipay RSA2 notify fixtures without secrets', () => {
    const adapter = new AlipayPaymentProviderAdapter()
    const order = baseOrder
    const { credentialMaterial, payload } = buildAlipayNotifyFixture()

    expect(
      adapter.verifyNotify({
        order,
        config: baseConfig,
        credentialMaterial,
        payload,
      }),
    ).toBe(true)
    expect(
      adapter.parseNotify({
        order,
        config: baseConfig,
        credentialMaterial,
        payload,
      }),
    ).toEqual({
      paidAmount: 1000,
      providerTradeNo: '2026060722001400000000000001',
    })
    expect(
      adapter.verifyNotify({
        order,
        config: baseConfig,
        credentialMaterial,
        payload: {
          ...payload,
          total_amount: '0.01',
        },
      }),
    ).toBe(false)
    expect(
      adapter.verifyNotify({
        order,
        config: baseConfig,
        credentialMaterial,
        payload: {
          ...payload,
          trade_status: 'WAIT_BUYER_PAY',
        },
      }),
    ).toBe(false)
    expect(
      adapter.verifyNotify({
        order,
        config: baseConfig,
        payload,
      }),
    ).toBe(false)
  })

  it('verifies Alipay notify signatures from native body without transport metadata', () => {
    const adapter = new AlipayPaymentProviderAdapter()
    const { credentialMaterial, payload } = buildAlipayNotifyFixture()

    expect(
      adapter.verifyNotify({
        order: baseOrder,
        config: baseConfig,
        credentialMaterial,
        payload: {
          body: payload,
          headers: { 'x-extra': 'ignored' },
          orderNo: 'forged-order-no',
          rawBody: 'synthetic transport payload',
        },
      }),
    ).toBe(true)
    expect(
      adapter.extractNotifyOrderNo({
        credentialMaterial,
        payload: {
          body: payload,
          orderNo: 'forged-order-no',
        },
      }),
    ).toBe(baseOrder.orderNo)
  })

  it('verifies and parses WeChat V3 notify fixtures without secrets', () => {
    const adapter = new WechatPaymentProviderAdapter()
    const order = {
      ...baseOrder,
      channel: PaymentChannelEnum.WECHAT,
    }
    const config = {
      ...baseConfig,
      channel: PaymentChannelEnum.WECHAT,
    }
    const { credentialMaterial, payload } = buildWechatNotifyFixture()

    expect(
      adapter.verifyNotify({
        order,
        config,
        credentialMaterial,
        payload,
      }),
    ).toBe(true)
    expect(
      adapter.parseNotify({
        order,
        config,
        credentialMaterial,
        payload,
      }),
    ).toEqual({
      paidAmount: 1000,
      providerTradeNo: '4200000000202606070000000001',
    })

    expect(
      adapter.verifyNotify({
        order,
        config,
        credentialMaterial,
        payload: {
          ...payload,
          headers: {
            ...(payload.headers as Record<string, unknown>),
            'wechatpay-serial': 'rotated-serial',
          },
        },
      }),
    ).toBe(false)

    const failedFixture = buildWechatNotifyFixture({ trade_state: 'NOTPAY' })
    expect(
      adapter.verifyNotify({
        order,
        config,
        credentialMaterial: failedFixture.credentialMaterial,
        payload: failedFixture.payload,
      }),
    ).toBe(false)
    expect(
      adapter.verifyNotify({
        order,
        config,
        payload,
      }),
    ).toBe(false)
  })

  it('fails closed for provider refund execution', () => {
    const adapter = new AlipayPaymentProviderAdapter()
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined)

    expect(() => adapter.refund(baseOrder)).toThrow(BusinessException)
    expect(() => adapter.refund(baseOrder)).toThrow(
      expect.objectContaining({
        code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      }),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('payment_refund_blocked'),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`orderNo=${baseOrder.orderNo}`),
    )
    warnSpy.mockRestore()
  })
})
