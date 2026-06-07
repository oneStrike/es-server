/// <reference types="jest" />

import { BaseDto } from '@libs/platform/dto'
import { BusinessException } from '@libs/platform/exceptions'
import { PaymentOrderResultDto } from './dto/payment.dto'
import {
  PaymentChannelEnum,
  PaymentOrderStatusEnum,
  PaymentOrderTypeEnum,
} from './payment.constant'
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
  'channel',
  'clientAppKey',
  'closedAt',
  'createdAt',
  'environment',
  'id',
  'orderNo',
  'orderType',
  'paidAmount',
  'paidAt',
  'payableAmount',
  'paymentScene',
  'platform',
  'providerAccountLabel',
  'providerConfigId',
  'providerConfigVersionLabel',
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
    providerConfigVersionId: 1,
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

function buildPaymentTx(returningRows: unknown[], latestOrder?: unknown) {
  return {
    query: {
      paymentOrder: {
        findFirst: jest.fn(async () => Promise.resolve(latestOrder)),
      },
    },
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: jest.fn(async () => Promise.resolve(returningRows)),
        })),
      })),
    })),
  }
}

function buildConfigVersion(overrides: Record<string, unknown> = {}) {
  return {
    allowedReturnDomains: null,
    appId: 'app-id',
    certMode: 1,
    channel: PaymentChannelEnum.ALIPAY,
    clientAppKey: 'default-app',
    configName: 'default config',
    configSnapshot: {
      credentialVersionRef: 'kms://payment/default/v1',
    },
    configVersion: 1,
    createdAt: new Date('2026-05-10T10:00:00.000Z'),
    environment: 1,
    id: 1,
    isActive: true,
    mchId: '',
    notifyUrl: null,
    paymentScene: 1,
    platform: 1,
    providerConfigId: 1,
    returnUrl: null,
    status: 1,
    updatedAt: new Date('2026-05-10T10:00:00.000Z'),
    ...overrides,
  }
}

function buildNotifyEventMocks() {
  const onConflictDoNothing = jest.fn(async () => Promise.resolve())
  const insertValues = jest.fn(() => ({ onConflictDoNothing }))
  const updateWhere = jest.fn(async () => Promise.resolve())
  const updateSet = jest.fn(() => ({ where: updateWhere }))
  return {
    insert: jest.fn(() => ({ values: insertValues })),
    insertValues,
    onConflictDoNothing,
    paymentNotifyEvent: {
      channel: 'payment_notify_event.channel',
      payloadHash: 'payment_notify_event.payload_hash',
    },
    update: jest.fn(() => ({ set: updateSet })),
    updateSet,
    updateWhere,
  }
}

describe('paymentService domain split contract', () => {
  it('keeps the app payment result DTO out of BaseDto public fields', () => {
    expect(PaymentOrderResultDto.prototype).not.toBeInstanceOf(BaseDto)
  })

  it('maps admin payment order page rows to an exact public admin view', async () => {
    const rawOrder = buildPaidOrder()
    const paymentOrder = {
      id: 'payment_order.id',
      createdAt: 'payment_order.created_at',
    }
    const query = {
      from: jest.fn(() => query),
      where: jest.fn(() => query),
      orderBy: jest.fn(() => query),
      limit: jest.fn(() => query),
      offset: jest.fn(async () => Promise.resolve([rawOrder])),
    }
    const drizzle = {
      db: {
        select: jest.fn(() => query),
        $count: jest.fn(async () => Promise.resolve(1)),
      },
      schema: {
        paymentOrder,
      },
      buildPage: jest.fn(() => ({
        limit: 15,
        offset: 0,
        pageIndex: 1,
        pageSize: 15,
      })),
      buildOrderBy: jest.fn(() => ({ orderBySql: ['order-sql'] })),
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
    expect(item).not.toHaveProperty('autoRenewAgreementId')
    expect(item).not.toBe(rawOrder)
    expect(drizzle.buildPage).toHaveBeenCalledWith({
      pageIndex: 1,
      pageSize: 15,
    })
    expect(drizzle.buildOrderBy).toHaveBeenCalledWith(
      JSON.stringify({ createdAt: 'desc', id: 'desc' }),
      { table: paymentOrder },
    )
    expect(query.orderBy).toHaveBeenCalledWith('order-sql')
    expect(drizzle.db.$count).toHaveBeenCalledWith(paymentOrder, undefined)
  })

  it('resolves payment provider selector ids to internal refs on create', async () => {
    const insertedConfigValues: any[] = []
    const insertedVersionValues: any[] = []
    const credentials = new Map([
      [
        10,
        {
          id: 10,
          channel: PaymentChannelEnum.WECHAT,
          credentialType: 1,
          credentialRef: 'kms://payment/wechat/app-private/v4',
          displayName: '微信应用私钥',
          fingerprint: 'sha256:private',
          maskedIdentifier: '****1000',
          status: 1,
          versionLabel: 'v4',
        },
      ],
      [
        11,
        {
          id: 11,
          channel: PaymentChannelEnum.WECHAT,
          credentialType: 3,
          credentialRef: 'kms://payment/wechat/api-v3/v4',
          displayName: '微信 APIv3 key',
          fingerprint: 'sha256:apiv3',
          maskedIdentifier: '****3000',
          status: 1,
          versionLabel: 'v4',
        },
      ],
    ])
    const certificates = new Map([
      [
        20,
        {
          id: 20,
          channel: PaymentChannelEnum.WECHAT,
          certificateRef: 'kms://payment/wechat/platform-cert/v4',
          certificateType: 2,
          displayName: '微信平台证书',
          fingerprint: 'sha256:cert',
          serialNo: 'SERIALNO1234',
          status: 1,
          versionLabel: 'v4',
        },
      ],
    ])
    const drizzle = {
      db: {
        insert: jest.fn((table) => ({
          values: jest.fn((values) => {
            if (table === 'paymentProviderConfigVersion') {
              insertedVersionValues.push(values)
              return undefined
            }
            insertedConfigValues.push(values)
            return {
              returning: jest.fn(async () => [
                {
                  createdAt: new Date('2026-06-07T00:00:00.000Z'),
                  id: 30,
                  updatedAt: new Date('2026-06-07T00:00:00.000Z'),
                  ...values,
                },
              ]),
            }
          }),
        })),
        query: {
          paymentProviderConfigVersion: {
            findFirst: jest.fn(async () => Promise.resolve(null)),
          },
          paymentProviderCertificate: {
            findFirst: jest.fn(async ({ where }) =>
              Promise.resolve(certificates.get(where.id)),
            ),
          },
          paymentProviderCredential: {
            findFirst: jest.fn(async ({ where }) =>
              Promise.resolve(credentials.get(where.id)),
            ),
          },
        },
      },
      schema: {
        paymentProviderConfig: {},
        paymentProviderConfigVersion: 'paymentProviderConfigVersion',
      },
      withErrorHandling: jest.fn((callback: () => unknown) => callback()),
    }
    const service = new PaymentService(drizzle as any, {} as any, {} as any)

    await expect(
      service.createPaymentProviderConfig({
        apiV3KeyCredentialId: 11,
        appId: ' wx-app-id ',
        channel: PaymentChannelEnum.WECHAT,
        clientAppKey: ' default-app ',
        credentialOptionId: 10,
        environment: 1,
        isEnabled: true,
        mchId: ' mch-id ',
        paymentScene: 1,
        platform: 1,
        platformCertificateId: 20,
      }),
    ).resolves.toBe(true)

    expect(insertedConfigValues).toHaveLength(1)
    expect(insertedConfigValues[0]).toMatchObject({
      apiV3KeyRef: 'kms://payment/wechat/api-v3/v4',
      appId: 'wx-app-id',
      clientAppKey: 'default-app',
      configVersion: 1,
      credentialVersionRef: 'kms://payment/wechat/app-private/v4',
      mchId: 'mch-id',
      platformCertRef: 'kms://payment/wechat/platform-cert/v4',
    })
    expect(insertedConfigValues[0]).not.toHaveProperty('apiV3KeyCredentialId')
    expect(insertedConfigValues[0]).not.toHaveProperty('credentialOptionId')
    expect(insertedConfigValues[0]).not.toHaveProperty(
      'platformCertificateId',
    )
    expect(insertedConfigValues[0].configMetadata).toMatchObject({
      certificateOptions: {
        platformCertificateId: {
          fingerprint: 'sha256:cert',
          id: 20,
          maskedSerialNo: '****1234',
        },
      },
      credentialOptions: {
        apiV3KeyCredentialId: {
          fingerprint: 'sha256:apiv3',
          id: 11,
          maskedIdentifier: '****3000',
        },
        credentialOptionId: {
          fingerprint: 'sha256:private',
          id: 10,
          maskedIdentifier: '****1000',
        },
      },
      wechatPlatformSerialNo: 'SERIALNO1234',
    })
    expect(insertedVersionValues).toHaveLength(1)
    expect(insertedVersionValues[0]).toMatchObject({
      appPrivateCredentialId: 10,
      configVersion: 1,
      platformCertificateId: 20,
      providerConfigId: 30,
      status: 1,
      wechatApiV3CredentialId: 11,
    })
  })

  it('appends a new provider config version when toggling status', async () => {
    const insertedVersionValues: unknown[] = []
    const updateCalls: Array<{ setValues: unknown, table: unknown }> = []
    const updatedConfig = {
      ...buildConfigVersion({
        configSnapshot: {
          credentialVersionRef: 'kms://payment/wechat/app-private/v2',
        },
        configVersion: 2,
      }),
      id: 30,
      isEnabled: false,
    }
    const updateWhere = jest.fn((table, setValues) => {
      updateCalls.push({ setValues, table })
      if (table === 'paymentProviderConfig') {
        return { returning: jest.fn(async () => [updatedConfig]) }
      }
      return undefined
    })
    const drizzle = {
      db: {
        insert: jest.fn(() => ({
          values: jest.fn((values) => {
            insertedVersionValues.push(values)
          }),
        })),
        query: {
          paymentProviderConfigVersion: {
            findFirst: jest.fn(async () => Promise.resolve(null)),
          },
        },
        update: jest.fn((table) => ({
          set: jest.fn((setValues) => ({
            where: jest.fn(() => updateWhere(table, setValues)),
          })),
        })),
      },
      schema: {
        paymentProviderConfig: 'paymentProviderConfig',
        paymentProviderConfigVersion: 'paymentProviderConfigVersion',
      },
      withErrorHandling: jest.fn((callback: () => unknown) => callback()),
    }
    const service = new PaymentService(drizzle as any, {} as any, {} as any)

    await expect(service.updatePaymentProviderStatus(30, false)).resolves.toBe(
      true,
    )

    expect(updateCalls[0]).toMatchObject({
      setValues: {
        isEnabled: false,
      },
      table: 'paymentProviderConfig',
    })
    expect((updateCalls[0].setValues as any).configVersion).toBeDefined()
    expect(insertedVersionValues).toHaveLength(1)
    expect(insertedVersionValues[0]).toMatchObject({
      configVersion: 2,
      isActive: false,
      providerConfigId: 30,
    })
  })

  it('rejects payment provider selector ids with a wrong channel or usage', async () => {
    const drizzle = {
      db: {
        query: {
          paymentProviderCertificate: {
            findFirst: jest.fn(),
          },
          paymentProviderCredential: {
            findFirst: jest.fn(async () =>
              Promise.resolve({
                id: 11,
                channel: PaymentChannelEnum.ALIPAY,
                credentialType: 3,
                credentialRef: 'kms://payment/alipay/api-v3/wrong',
                displayName: '错渠道凭据',
                fingerprint: 'sha256:wrong',
                maskedIdentifier: '****9999',
                status: 1,
                versionLabel: 'v1',
              }),
            ),
          },
        },
      },
      schema: {
        paymentProviderConfig: {},
      },
      withErrorHandling: jest.fn((callback: () => unknown) => callback()),
    }
    const service = new PaymentService(drizzle as any, {} as any, {} as any)

    await expect(
      service.createPaymentProviderConfig({
        apiV3KeyCredentialId: 11,
        channel: PaymentChannelEnum.WECHAT,
        credentialOptionId: 11,
        environment: 1,
        paymentScene: 1,
        platform: 1,
      }),
    ).rejects.toMatchObject({
      message: '主凭据与支付渠道不匹配',
    })
    expect(drizzle.db.query.paymentProviderCertificate.findFirst).not.toHaveBeenCalled()
  })

  it('treats a matching paid order notification as an idempotent result without re-settlement', async () => {
    const order = buildPaidOrder()
    const drizzle = {
      db: {
        query: {
          paymentProviderConfigVersion: {
            findFirst: jest.fn(async () =>
              Promise.resolve(buildConfigVersion()),
            ),
          },
          paymentOrder: {
            findFirst: jest.fn(async () => Promise.resolve(order)),
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
    service.getPaymentProviderConfigById = jest.fn(async () =>
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

  it('settles duplicate concurrent provider notifications only once', async () => {
    const notifyMocks = buildNotifyEventMocks()
    const pendingOrder = {
      ...buildPaidOrder(),
      paidAmount: 0,
      providerTradeNo: null,
      status: PaymentOrderStatusEnum.PENDING,
    }
    const paidOrder = buildPaidOrder()
    const winnerTx = buildPaymentTx([paidOrder])
    const loserTx = buildPaymentTx([], paidOrder)
    const drizzle = {
      db: {
        insert: notifyMocks.insert,
        query: {
          paymentProviderCertificate: {
            findFirst: jest.fn(async () => Promise.resolve(null)),
          },
          paymentProviderCredential: {
            findFirst: jest.fn(async () => Promise.resolve(null)),
          },
          paymentProviderConfigVersion: {
            findFirst: jest.fn(async () =>
              Promise.resolve(buildConfigVersion()),
            ),
          },
          paymentOrder: {
            findFirst: jest
              .fn()
              .mockResolvedValueOnce(pendingOrder)
              .mockResolvedValueOnce(pendingOrder),
          },
        },
        update: notifyMocks.update,
      },
      schema: {
        paymentOrder: {
          id: 'payment_order.id',
          status: 'payment_order.status',
        },
        paymentNotifyEvent: notifyMocks.paymentNotifyEvent,
      },
      withTransaction: jest
        .fn()
        .mockImplementationOnce((callback: (runner: typeof winnerTx) => unknown) =>
          callback(winnerTx),
        )
        .mockImplementationOnce((callback: (runner: typeof loserTx) => unknown) =>
          callback(loserTx),
        ),
    }
    const walletService = { applyRechargeSettlement: jest.fn() }
    const membershipService = { activatePaidOrder: jest.fn() }
    const service = new PaymentService(
      drizzle as any,
      walletService as any,
      membershipService as any,
    ) as any
    const adapter = {
      extractNotifyOrderNo: jest.fn(() => pendingOrder.orderNo),
      parseNotify: jest.fn(() => ({
        paidAmount: 100,
        providerTradeNo: 'provider-trade-no',
      })),
      verifyNotify: jest.fn(() => true),
    }
    service.getPaymentProviderConfigById = jest.fn(async () =>
      Promise.resolve({ id: 1 }),
    )
    service.getPaymentAdapter = jest.fn(() => adapter)

    await expect(
      Promise.all([
        service.handleProviderPaymentNotify({
          body: { orderNo: pendingOrder.orderNo },
          channel: PaymentChannelEnum.ALIPAY,
          headers: {},
          query: {},
        }),
        service.handleProviderPaymentNotify({
          body: { orderNo: pendingOrder.orderNo },
          channel: PaymentChannelEnum.ALIPAY,
          headers: {},
          query: {},
        }),
      ]),
    ).resolves.toEqual(['success', 'success'])

    expect(drizzle.withTransaction).toHaveBeenCalledTimes(2)
    expect(walletService.applyRechargeSettlement).toHaveBeenCalledTimes(1)
    expect(walletService.applyRechargeSettlement).toHaveBeenCalledWith(
      winnerTx,
      paidOrder,
    )
    expect(membershipService.activatePaidOrder).not.toHaveBeenCalled()
    expect(loserTx.query.paymentOrder.findFirst).toHaveBeenCalledWith({
      where: { id: pendingOrder.id },
    })
    expect(notifyMocks.insert).toHaveBeenCalledTimes(2)
    expect(notifyMocks.update).toHaveBeenCalled()
  })

  it('accepts duplicate paid provider notifications without opening settlement transaction', async () => {
    const notifyMocks = buildNotifyEventMocks()
    const paidOrder = buildPaidOrder()
    const drizzle = {
      db: {
        insert: notifyMocks.insert,
        query: {
          paymentProviderCertificate: {
            findFirst: jest.fn(async () => Promise.resolve(null)),
          },
          paymentProviderCredential: {
            findFirst: jest.fn(async () => Promise.resolve(null)),
          },
          paymentProviderConfigVersion: {
            findFirst: jest.fn(async () =>
              Promise.resolve(buildConfigVersion()),
            ),
          },
          paymentOrder: {
            findFirst: jest.fn(async () => Promise.resolve(paidOrder)),
          },
        },
        update: notifyMocks.update,
      },
      schema: {
        paymentNotifyEvent: notifyMocks.paymentNotifyEvent,
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
    service.getPaymentProviderConfigById = jest.fn(async () =>
      Promise.resolve({ id: 1 }),
    )
    service.getPaymentAdapter = jest.fn(() => ({
      extractNotifyOrderNo: jest.fn(() => paidOrder.orderNo),
      parseNotify: jest.fn(() => ({
        paidAmount: 100,
        providerTradeNo: 'provider-trade-no',
      })),
      verifyNotify: jest.fn(() => true),
    }))

    await expect(
      service.handleProviderPaymentNotify({
        body: { orderNo: paidOrder.orderNo },
        channel: PaymentChannelEnum.ALIPAY,
        headers: {},
        query: {},
      }),
    ).resolves.toBe('success')

    expect(drizzle.withTransaction).not.toHaveBeenCalled()
    expect(walletService.applyRechargeSettlement).not.toHaveBeenCalled()
    expect(membershipService.activatePaidOrder).not.toHaveBeenCalled()
    expect(notifyMocks.insert).toHaveBeenCalledTimes(1)
  })

  it('verifies provider notifications with immutable order config after rotation', async () => {
    const notifyMocks = buildNotifyEventMocks()
    const pendingOrder = {
      ...buildPaidOrder(),
      channel: PaymentChannelEnum.WECHAT,
      configSnapshot: {
        apiV3KeyRef: 'kms://payment/wechat/api-v3/old',
        appId: 'old-app-id',
        certMode: 2,
        clientAppKey: 'default-app',
        configMetadata: {
          wechatPlatformSerialNo: 'old-platform-serial',
        },
        configName: 'old provider config',
        environment: 1,
        mchId: 'old-mch-id',
        notifyUrl: 'https://old.example.com/app/payment/provider/wechat/notify',
        paymentScene: 1,
        platform: 1,
      },
      credentialVersionRef: 'kms://payment/wechat/credential/old',
      paidAmount: 0,
      providerConfigVersion: 3,
      providerTradeNo: null,
      status: PaymentOrderStatusEnum.PENDING,
    }
    const paidOrder = {
      ...pendingOrder,
      paidAmount: 100,
      providerTradeNo: 'provider-trade-no',
      status: PaymentOrderStatusEnum.PAID,
    }
    const tx = buildPaymentTx([paidOrder])
    const rotatedCurrentConfig = {
      id: pendingOrder.providerConfigId,
      channel: PaymentChannelEnum.WECHAT,
      paymentScene: 1,
      platform: 1,
      environment: 1,
      clientAppKey: 'default-app',
      configName: 'rotated provider config',
      appId: 'new-app-id',
      mchId: 'new-mch-id',
      notifyUrl: 'https://new.example.com/app/payment/provider/wechat/notify',
      returnUrl: null,
      allowedReturnDomains: [],
      certMode: 2,
      publicKeyRef: null,
      privateKeyRef: null,
      apiV3KeyRef: 'kms://payment/wechat/api-v3/new',
      appCertRef: null,
      platformCertRef: 'kms://payment/wechat/platform-cert/new',
      rootCertRef: null,
      configVersion: 9,
      credentialVersionRef: 'kms://payment/wechat/credential/new',
      configMetadata: {
        wechatPlatformSerialNo: 'new-platform-serial',
      },
      sortOrder: 1,
      isEnabled: true,
      createdAt: new Date('2026-05-10T00:00:00.000Z'),
      updatedAt: new Date('2026-06-07T00:00:00.000Z'),
    }
    const drizzle = {
      db: {
        insert: notifyMocks.insert,
        query: {
          paymentProviderCertificate: {
            findFirst: jest.fn(async () => Promise.resolve(null)),
          },
          paymentProviderCredential: {
            findFirst: jest.fn(async () => Promise.resolve(null)),
          },
          paymentProviderConfigVersion: {
            findFirst: jest.fn(async () =>
              Promise.resolve(
                buildConfigVersion({
                  channel: PaymentChannelEnum.WECHAT,
                  certMode: 2,
                  configName: 'old provider config',
                  configSnapshot: {
                    apiV3KeyRef: 'kms://payment/wechat/api-v3/old',
                    appId: 'old-app-id',
                    configMetadata: {
                      wechatPlatformSerialNo: 'old-platform-serial',
                    },
                    credentialVersionRef: 'kms://payment/wechat/credential/old',
                    platformCertRef: 'kms://payment/wechat/platform-cert/old',
                  },
                  configVersion: 3,
                  credentialVersionRef: 'kms://payment/wechat/credential/old',
                  appId: 'old-app-id',
                  mchId: 'old-mch-id',
                  notifyUrl: 'https://old.example.com/app/payment/provider/wechat/notify',
                  platformCertificateId: 20,
                }),
              ),
            ),
          },
          paymentOrder: {
            findFirst: jest.fn(async () => Promise.resolve(pendingOrder)),
          },
        },
        update: notifyMocks.update,
      },
      schema: {
        paymentOrder: {
          id: 'payment_order.id',
          status: 'payment_order.status',
        },
        paymentNotifyEvent: notifyMocks.paymentNotifyEvent,
      },
      withTransaction: jest.fn((callback: (runner: typeof tx) => unknown) =>
        callback(tx),
      ),
    }
    const adapter = {
      extractNotifyOrderNo: jest.fn(() => pendingOrder.orderNo),
      parseNotify: jest.fn(() => ({
        paidAmount: 100,
        providerTradeNo: 'provider-trade-no',
      })),
      verifyNotify: jest.fn(() => true),
    }
    const walletService = { applyRechargeSettlement: jest.fn() }
    const membershipService = { activatePaidOrder: jest.fn() }
    const service = new PaymentService(
      drizzle as any,
      walletService as any,
      membershipService as any,
    ) as any
    service.getPaymentProviderConfigById = jest.fn(async () =>
      Promise.resolve(rotatedCurrentConfig),
    )
    service.getPaymentAdapter = jest.fn(() => adapter)

    await expect(
      service.handleProviderPaymentNotify({
        body: { orderNo: pendingOrder.orderNo },
        channel: PaymentChannelEnum.WECHAT,
        headers: {},
        query: {},
      }),
    ).resolves.toEqual({ code: 'SUCCESS', message: '成功' })

    expect(adapter.verifyNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        credentialMaterial: {
          wechatPlatformSerialNo: 'old-platform-serial',
        },
        config: expect.objectContaining({
          apiV3KeyRef: 'kms://payment/wechat/api-v3/old',
          appId: 'old-app-id',
          configName: 'old provider config',
          configVersion: 3,
          credentialVersionRef: 'kms://payment/wechat/credential/old',
          mchId: 'old-mch-id',
        }),
      }),
    )
    expect(adapter.verifyNotify).not.toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          appId: 'new-app-id',
          credentialVersionRef: 'kms://payment/wechat/credential/new',
          mchId: 'new-mch-id',
        }),
      }),
    )
    expect(walletService.applyRechargeSettlement).toHaveBeenCalledTimes(1)
  })

  it('rejects app notifications for another user before settlement', async () => {
    const drizzle = {
      db: {
        query: {
          paymentOrder: {
            findFirst: jest.fn(async () => Promise.resolve(buildPaidOrder())),
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
            returning: jest.fn(async () => Promise.resolve([paidOrder])),
          })),
        })),
      })),
    }
    const drizzle = {
      db: {
        query: {
          paymentOrder: {
            findFirst: jest.fn(async () => Promise.resolve(pendingOrder)),
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
