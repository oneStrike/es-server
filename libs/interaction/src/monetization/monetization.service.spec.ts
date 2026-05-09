/// <reference types="jest" />

import * as schema from '@db/schema'
import { BusinessException } from '@libs/platform/exceptions'
import {
  AdProviderEnum,
  AdRewardStatusEnum,
  CouponRedemptionTargetTypeEnum,
  CouponTypeEnum,
  MembershipAutoRenewAgreementStatusEnum,
  MembershipBenefitGrantPolicyEnum,
  MembershipBenefitTypeEnum,
  MembershipPlanTierEnum,
  MonetizationPlatformEnum,
  PaymentChannelEnum,
  PaymentOrderStatusEnum,
  PaymentOrderTypeEnum,
  PaymentSceneEnum,
  PaymentSubscriptionModeEnum,
  ProviderEnvironmentEnum,
} from './monetization.constant'
import { WorkViewPermissionEnum } from '@libs/platform/constant'
import { MonetizationService } from './monetization.service'

function createSelectBuilder<TResult>(result: TResult[]) {
  const promise = Promise.resolve(result)
  const builder = {
    from: jest.fn(() => builder),
    innerJoin: jest.fn(() => builder),
    where: jest.fn(() => builder),
    orderBy: jest.fn(() => builder),
    limit: jest.fn(() => promise),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }
  return builder
}

function createMutationBuilder() {
  const builder = {
    set: jest.fn(() => builder),
    values: jest.fn(() => Promise.resolve([])),
    where: jest.fn(() => Promise.resolve([])),
    returning: jest.fn(() => Promise.resolve([])),
  }
  return builder
}

function createUpdateReturningBuilder<TResult>(result: TResult[]) {
  const builder = {
    set: jest.fn(() => builder),
    where: jest.fn(() => builder),
    returning: jest.fn(() => Promise.resolve(result)),
  }
  return builder
}

function createInsertReturningBuilder<TResult>(result: TResult[]) {
  const builder = {
    values: jest.fn(() => builder),
    onConflictDoNothing: jest.fn(() => builder),
    returning: jest.fn(() => Promise.resolve(result)),
  }
  return builder
}

function expectPaymentOrderResultContract(result: Record<string, unknown>) {
  expect(Object.keys(result).sort()).toEqual(
    [
      'clientPayPayload',
      'orderNo',
      'orderType',
      'payableAmount',
      'status',
      'subscriptionMode',
    ].sort(),
  )
  expect(result).not.toHaveProperty('configSnapshot')
  expect(result).not.toHaveProperty('clientContext')
  expect(result).not.toHaveProperty('notifyPayload')
  expect(result).not.toHaveProperty('providerConfigId')
  expect(result).not.toHaveProperty('providerConfigVersion')
  expect(result).not.toHaveProperty('credentialVersionRef')
}

function createService(db: Record<string, unknown>) {
  const drizzle = {
    schema,
    db,
    ext: {
      findPagination: jest.fn(),
    },
    withErrorHandling: jest.fn((callback: () => unknown) => callback()),
    withTransaction: jest.fn((callback: (runner: typeof db) => unknown) =>
      callback(db),
    ),
    assertAffectedRows: jest.fn((result: unknown[]) => {
      if (Array.isArray(result) && result.length === 0) {
        throw new BusinessException(20001 as never, '记录不存在')
      }
    }),
  }
  return new (MonetizationService as any)(
    drizzle,
    {},
    {},
    {},
  ) as MonetizationService
}

const enabledVipPlan = {
  id: 1,
  name: '月度 VIP',
  planKey: 'vip_monthly',
  tier: MembershipPlanTierEnum.VIP,
  priceAmount: 1800,
  originalPriceAmount: 3000,
  durationDays: 30,
  displayTag: '体验价',
  bonusPointAmount: 100,
  autoRenewEnabled: true,
  sortOrder: 1,
  isEnabled: true,
  createdAt: new Date('2026-05-06T00:00:00.000Z'),
  updatedAt: new Date('2026-05-06T00:00:00.000Z'),
}

const enabledVipPageConfig = {
  id: 1,
  pageKey: 'vip_subscription',
  title: 'VIP会员',
  memberNoticeItems: ['自动续费可随时取消'],
  autoRenewNotice: '自动续费可随时取消',
  checkoutAgreementText: '开通即同意协议',
  submitButtonTemplate: '¥{price} 确认协议并开通',
  sortOrder: 1,
  isEnabled: true,
  createdAt: new Date('2026-05-06T00:00:00.000Z'),
  updatedAt: new Date('2026-05-06T00:00:00.000Z'),
}

const publishedMembershipAgreement = {
  pageConfigId: enabledVipPageConfig.id,
  id: 30,
  title: '会员服务协议',
  version: '2026.05',
  isForce: true,
  showInAuth: false,
  isPublished: true,
  publishedAt: new Date('2026-05-06T00:00:00.000Z'),
  createdAt: new Date('2026-05-06T00:00:00.000Z'),
  updatedAt: new Date('2026-05-06T00:00:00.000Z'),
}

const autoRenewProviderConfig = {
  id: 1,
  channel: PaymentChannelEnum.ALIPAY,
  paymentScene: PaymentSceneEnum.APP,
  platform: 1,
  environment: 1,
  clientAppKey: '',
  configName: '',
  appId: '',
  mchId: '',
  notifyUrl: null,
  returnUrl: null,
  agreementNotifyUrl: null,
  allowedReturnDomains: null,
  certMode: 1,
  publicKeyRef: null,
  privateKeyRef: null,
  apiV3KeyRef: null,
  appCertRef: null,
  platformCertRef: null,
  rootCertRef: null,
  configVersion: 1,
  credentialVersionRef: 'kms://payment/alipay/v1',
  configMetadata: null,
  supportsAutoRenew: true,
  sortOrder: 0,
  isEnabled: true,
  createdAt: new Date('2026-05-06T00:00:00.000Z'),
  updatedAt: new Date('2026-05-06T00:00:00.000Z'),
}

describe('MonetizationService membership contract', () => {
  it('returns the VIP subscription page from backend-owned contracts', async () => {
    const benefit = {
      id: 10,
      planId: enabledVipPlan.id,
      benefitId: 20,
      grantPolicy: MembershipBenefitGrantPolicyEnum.DAILY_CLAIMABLE,
      benefitValue: { dailyLimit: 1 },
      sortOrder: 1,
      isEnabled: true,
      createdAt: new Date('2026-05-06T00:00:00.000Z'),
      updatedAt: new Date('2026-05-06T00:00:00.000Z'),
      benefit: {
        id: 20,
        code: 'daily_gift',
        name: '每日礼包',
        icon: 'calendar',
        benefitType: MembershipBenefitTypeEnum.DISPLAY,
        description: '每日礼包',
        sortOrder: 1,
        isEnabled: true,
        createdAt: new Date('2026-05-06T00:00:00.000Z'),
        updatedAt: new Date('2026-05-06T00:00:00.000Z'),
      },
    }
    const activeSubscription = {
      tier: MembershipPlanTierEnum.VIP,
      expiresAt: new Date('2026-06-06T00:00:00.000Z'),
    }
    const activeAgreement = { id: 30 }
    const selectResults: Array<Record<string, unknown>[]> = [
      [enabledVipPageConfig],
      [publishedMembershipAgreement],
      [enabledVipPlan],
      [benefit],
      [activeSubscription],
      [activeAgreement],
    ]
    const db = {
      select: jest.fn(() =>
        createSelectBuilder<Record<string, unknown>>(
          selectResults.shift() ?? [],
        ),
      ),
    }
    const service = createService(db)

    await expect(service.getVipSubscriptionPage(1)).resolves.toMatchObject({
      pageConfig: {
        pageKey: 'vip_subscription',
        agreements: [{ id: 30, title: '会员服务协议' }],
      },
      plans: [{ tier: MembershipPlanTierEnum.VIP, priceAmount: 1800 }],
      benefits: [{ benefit: { code: 'daily_gift' } }],
      currentSubscription: {
        isActive: true,
        tier: MembershipPlanTierEnum.VIP,
        autoRenewActive: true,
      },
    })
  })

  it('generates VIP plan business keys on create', async () => {
    const insertBuilder = createInsertReturningBuilder([{ id: 1 }])
    const db = {
      insert: jest.fn(() => insertBuilder),
    }
    const service = createService(db)

    await expect(
      service.createMembershipPlan({
        name: 'VIP Monthly',
        tier: MembershipPlanTierEnum.VIP,
        priceAmount: 1800,
        originalPriceAmount: 3000,
        durationDays: 30,
        displayTag: '热门',
        bonusPointAmount: 100,
        autoRenewEnabled: true,
      }),
    ).resolves.toBe(true)

    const values = insertBuilder.values.mock.calls[0][0]
    expect(values.planKey).toMatch(/^vip_plan_vip_monthly_[0-9a-f]{8}$/)
    expect(values).not.toHaveProperty('benefitGroupKey')
  })

  it('creates membership plan benefits from the aggregate plan payload', async () => {
    const planInsertBuilder = createInsertReturningBuilder([{ id: 1 }])
    const benefitInsertBuilder = createMutationBuilder()
    const db = {
      query: {
        membershipPlan: {
          findFirst: jest.fn(() => Promise.resolve(enabledVipPlan)),
        },
        membershipBenefitDefinition: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 20,
              benefitType: MembershipBenefitTypeEnum.DISPLAY,
            }),
          ),
        },
      },
      insert: jest.fn((table: unknown) =>
        table === schema.membershipPlan
          ? planInsertBuilder
          : benefitInsertBuilder,
      ),
    }
    const service = createService(db)

    await expect(
      service.createMembershipPlan({
        name: 'VIP Monthly',
        tier: MembershipPlanTierEnum.VIP,
        priceAmount: 1800,
        durationDays: 30,
        benefits: [
          {
            benefitId: 20,
            grantPolicy: MembershipBenefitGrantPolicyEnum.DISPLAY_ONLY,
            sortOrder: 1,
            isEnabled: true,
          },
        ],
      }),
    ).resolves.toBe(true)

    expect(benefitInsertBuilder.values).toHaveBeenCalledWith([
      expect.objectContaining({
        planId: 1,
        benefitId: 20,
        grantPolicy: MembershipBenefitGrantPolicyEnum.DISPLAY_ONLY,
        benefitValue: null,
        sortOrder: 1,
        isEnabled: true,
      }),
    ])
  })

  it('replaces membership plan benefits from the aggregate update payload', async () => {
    const updateBuilder = createMutationBuilder()
    const deleteBuilder = createMutationBuilder()
    const benefitInsertBuilder = createMutationBuilder()
    const db = {
      query: {
        membershipPlan: {
          findFirst: jest.fn(() => Promise.resolve(enabledVipPlan)),
        },
        membershipBenefitDefinition: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 20,
              benefitType: MembershipBenefitTypeEnum.DISPLAY,
            }),
          ),
        },
      },
      update: jest.fn(() => updateBuilder),
      delete: jest.fn(() => deleteBuilder),
      insert: jest.fn(() => benefitInsertBuilder),
    }
    const service = createService(db)

    await expect(
      service.updateMembershipPlan({
        id: 1,
        name: 'VIP Monthly',
        benefits: [
          {
            benefitId: 20,
            grantPolicy: MembershipBenefitGrantPolicyEnum.DISPLAY_ONLY,
            sortOrder: 2,
            isEnabled: false,
          },
        ],
      }),
    ).resolves.toBe(true)

    expect(deleteBuilder.where).toHaveBeenCalled()
    expect(benefitInsertBuilder.values).toHaveBeenCalledWith([
      expect.objectContaining({
        planId: 1,
        benefitId: 20,
        sortOrder: 2,
        isEnabled: false,
      }),
    ])
  })

  it('rejects duplicate membership benefits in the aggregate plan payload', async () => {
    const insertBuilder = createInsertReturningBuilder([{ id: 1 }])
    const db = {
      insert: jest.fn(() => insertBuilder),
    }
    const service = createService(db)

    await expect(
      service.createMembershipPlan({
        name: 'VIP Monthly',
        tier: MembershipPlanTierEnum.VIP,
        priceAmount: 1800,
        durationDays: 30,
        benefits: [
          {
            benefitId: 20,
            grantPolicy: MembershipBenefitGrantPolicyEnum.DISPLAY_ONLY,
          },
          {
            benefitId: 20,
            grantPolicy: MembershipBenefitGrantPolicyEnum.DISPLAY_ONLY,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BusinessException)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('generates membership benefit codes on create', async () => {
    const insertBuilder = createMutationBuilder()
    const db = {
      insert: jest.fn(() => insertBuilder),
    }
    const service = createService(db)

    await expect(
      service.createMembershipBenefitDefinition({
        name: 'Daily Gift',
        benefitType: MembershipBenefitTypeEnum.DISPLAY,
        icon: 'calendar',
        description: '每日礼包',
      }),
    ).resolves.toBe(true)

    const values = insertBuilder.values.mock.calls[0][0]
    expect(values.code).toMatch(/^vip_benefit_daily_gift_[0-9a-f]{8}$/)
  })

  it('generates membership page keys on create', async () => {
    const pageInsertBuilder = createInsertReturningBuilder([{ id: 11 }])
    const deleteBuilder = createMutationBuilder()
    const tx = {
      delete: jest.fn(() => deleteBuilder),
      insert: jest.fn(() => pageInsertBuilder),
    }
    const drizzle = {
      schema,
      db: {},
      ext: { findPagination: jest.fn() },
      withErrorHandling: jest.fn((callback: () => unknown) => callback()),
      withTransaction: jest.fn((callback: (runner: typeof tx) => unknown) =>
        callback(tx),
      ),
    }
    const service = new (MonetizationService as any)(
      drizzle,
      {},
      {},
      {},
    ) as MonetizationService

    await expect(
      service.createMembershipPageConfig({
        title: 'VIP Subscription',
        isEnabled: false,
      }),
    ).resolves.toBe(true)

    const values = pageInsertBuilder.values.mock.calls[0][0]
    expect(values.pageKey).toMatch(/^vip_page_vip_subscription_[0-9a-f]{8}$/)
  })

  it('rejects auto-renew signing when the selected plan disables it', async () => {
    const db = {
      query: {
        membershipPlan: {
          findFirst: jest.fn(() =>
            Promise.resolve({ ...enabledVipPlan, autoRenewEnabled: false }),
          ),
        },
      },
    }
    const service = createService(db)

    await expect(
      service.createVipSubscriptionOrder(1, {
        planId: 1,
        channel: PaymentChannelEnum.ALIPAY,
        paymentScene: PaymentSceneEnum.APP,
        platform: 1,
        environment: 1,
        subscriptionMode: PaymentSubscriptionModeEnum.AUTO_RENEW_SIGNING,
      }),
    ).rejects.toBeInstanceOf(BusinessException)
  })

  it('rejects VIP orders when no published agreement is configured', async () => {
    const selectResults: Array<Record<string, unknown>[]> = [
      [enabledVipPageConfig],
      [],
    ]
    const db = {
      query: {
        membershipPlan: {
          findFirst: jest.fn(() => Promise.resolve(enabledVipPlan)),
        },
      },
      select: jest.fn(() =>
        createSelectBuilder<Record<string, unknown>>(
          selectResults.shift() ?? [],
        ),
      ),
    }
    const service = createService(db)

    await expect(
      service.createVipSubscriptionOrder(1, {
        planId: 1,
        channel: PaymentChannelEnum.ALIPAY,
        paymentScene: PaymentSceneEnum.APP,
        platform: 1,
        environment: 1,
        subscriptionMode: PaymentSubscriptionModeEnum.ONE_TIME,
      }),
    ).rejects.toBeInstanceOf(BusinessException)
  })

  it('rejects auto-renew signing when the provider config disables it', async () => {
    const selectResults: Array<Record<string, unknown>[]> = [
      [enabledVipPageConfig],
      [publishedMembershipAgreement],
      [{ ...autoRenewProviderConfig, supportsAutoRenew: false }],
    ]
    const db = {
      query: {
        membershipPlan: {
          findFirst: jest.fn(() => Promise.resolve(enabledVipPlan)),
        },
      },
      select: jest.fn(() =>
        createSelectBuilder<Record<string, unknown>>(
          selectResults.shift() ?? [],
        ),
      ),
    }
    const service = createService(db)

    await expect(
      service.createVipSubscriptionOrder(1, {
        planId: 1,
        channel: PaymentChannelEnum.ALIPAY,
        paymentScene: PaymentSceneEnum.APP,
        platform: 1,
        environment: 1,
        subscriptionMode: PaymentSubscriptionModeEnum.AUTO_RENEW_SIGNING,
      }),
    ).rejects.toBeInstanceOf(BusinessException)
  })

  it('freezes published agreement snapshots into VIP payment orders', async () => {
    const createdOrder = {
      id: 100,
      orderNo: 'PAY202605080001',
      userId: 1,
      orderType: PaymentOrderTypeEnum.VIP_SUBSCRIPTION,
      channel: PaymentChannelEnum.ALIPAY,
      paymentScene: PaymentSceneEnum.APP,
      platform: 1,
      environment: 1,
      clientAppKey: '',
      subscriptionMode: PaymentSubscriptionModeEnum.ONE_TIME,
      autoRenewAgreementId: null,
      status: PaymentOrderStatusEnum.PENDING,
      payableAmount: enabledVipPlan.priceAmount,
      paidAmount: 0,
      targetId: enabledVipPlan.id,
      providerConfigId: autoRenewProviderConfig.id,
      providerConfigVersion: autoRenewProviderConfig.configVersion,
      credentialVersionRef: autoRenewProviderConfig.credentialVersionRef,
      configSnapshot: null,
      clientContext: null,
      clientPayPayload: null,
      providerTradeNo: null,
      notifyPayload: null,
      paidAt: null,
      closedAt: null,
      refundedAt: null,
      createdAt: new Date('2026-05-08T00:00:00.000Z'),
      updatedAt: new Date('2026-05-08T00:00:00.000Z'),
    }
    const selectResults: Array<Record<string, unknown>[]> = [
      [enabledVipPageConfig],
      [publishedMembershipAgreement],
      [autoRenewProviderConfig],
    ]
    const insertBuilder = createInsertReturningBuilder([createdOrder])
    const updateBuilder = createUpdateReturningBuilder([
      { id: createdOrder.id },
    ])
    const db = {
      query: {
        membershipPlan: {
          findFirst: jest.fn(() => Promise.resolve(enabledVipPlan)),
        },
      },
      select: jest.fn(() =>
        createSelectBuilder<Record<string, unknown>>(
          selectResults.shift() ?? [],
        ),
      ),
      insert: jest.fn(() => insertBuilder),
      update: jest.fn(() => updateBuilder),
    }
    const service = createService(db)
    ;(service as any).getPaymentAdapter = jest.fn(() => ({
      createOrder: jest.fn(() => ({ providerOrderNo: 'provider-order-no' })),
    }))

    const result = (await service.createVipSubscriptionOrder(1, {
      planId: enabledVipPlan.id,
      channel: PaymentChannelEnum.ALIPAY,
      paymentScene: PaymentSceneEnum.APP,
      platform: 1,
      environment: 1,
      subscriptionMode: PaymentSubscriptionModeEnum.ONE_TIME,
    })) as unknown as Record<string, unknown>

    expectPaymentOrderResultContract(result)
    expect(result).toMatchObject({
      orderNo: createdOrder.orderNo,
      orderType: PaymentOrderTypeEnum.VIP_SUBSCRIPTION,
      status: PaymentOrderStatusEnum.PENDING,
      subscriptionMode: PaymentSubscriptionModeEnum.ONE_TIME,
      payableAmount: enabledVipPlan.priceAmount,
      clientPayPayload: { providerOrderNo: 'provider-order-no' },
    })

    const insertValues = insertBuilder.values.mock.calls[0][0]
    expect(insertValues).toMatchObject({
      clientContext: {
        targetSnapshot: {
          agreements: [
            {
              id: publishedMembershipAgreement.id,
              title: publishedMembershipAgreement.title,
              version: publishedMembershipAgreement.version,
              isForce: publishedMembershipAgreement.isForce,
              publishedAt: publishedMembershipAgreement.publishedAt,
            },
          ],
        },
      },
    })
  })

  it('rolls back payment order creation when provider payload creation fails', async () => {
    const createdOrder = {
      id: 100,
      orderNo: 'PAY202605080002',
      userId: 1,
      orderType: PaymentOrderTypeEnum.CURRENCY_RECHARGE,
      channel: PaymentChannelEnum.ALIPAY,
      paymentScene: PaymentSceneEnum.APP,
      platform: 1,
      environment: 1,
      clientAppKey: '',
      subscriptionMode: PaymentSubscriptionModeEnum.ONE_TIME,
      autoRenewAgreementId: null,
      status: PaymentOrderStatusEnum.PENDING,
      payableAmount: 1000,
      paidAmount: 0,
      targetId: 1,
      providerConfigId: autoRenewProviderConfig.id,
      providerConfigVersion: autoRenewProviderConfig.configVersion,
      credentialVersionRef: autoRenewProviderConfig.credentialVersionRef,
      configSnapshot: null,
      clientContext: null,
      clientPayPayload: null,
      providerTradeNo: null,
      notifyPayload: null,
      paidAt: null,
      closedAt: null,
      refundedAt: null,
      createdAt: new Date('2026-05-08T00:00:00.000Z'),
      updatedAt: new Date('2026-05-08T00:00:00.000Z'),
    }
    const insertBuilder = createInsertReturningBuilder([createdOrder])
    const updateBuilder = createUpdateReturningBuilder([
      { id: createdOrder.id },
    ])
    const tx = {
      insert: jest.fn(() => insertBuilder),
      update: jest.fn(() => updateBuilder),
    }
    const drizzle = {
      schema,
      db: {},
      ext: { findPagination: jest.fn() },
      withErrorHandling: jest.fn((callback: () => unknown) => callback()),
      withTransaction: jest.fn((callback: (runner: typeof tx) => unknown) =>
        callback(tx),
      ),
      assertAffectedRows: jest.fn(),
    }
    const service = new (MonetizationService as any)(
      drizzle,
      {},
      {},
      {},
    ) as MonetizationService
    ;(service as any).resolvePaymentProviderConfig = jest.fn(() =>
      Promise.resolve(autoRenewProviderConfig),
    )
    ;(service as any).getPaymentAdapter = jest.fn(() => ({
      createOrder: jest.fn(() => {
        throw new Error('provider payload failed')
      }),
    }))

    await expect(
      (service as any).createPaymentOrder(1, {
        channel: PaymentChannelEnum.ALIPAY,
        paymentScene: PaymentSceneEnum.APP,
        platform: 1,
        environment: 1,
        orderType: PaymentOrderTypeEnum.CURRENCY_RECHARGE,
        targetId: 1,
        payableAmount: 1000,
        targetSnapshot: { packageKey: 'reading_coin_1000' },
      }),
    ).rejects.toThrow('provider payload failed')
    expect(drizzle.withTransaction).toHaveBeenCalled()
    expect(tx.update).not.toHaveBeenCalled()
  })

  it('rejects non-display benefits that miss required benefitValue fields', async () => {
    const db = {
      query: {
        membershipPlan: {
          findFirst: jest.fn(() => Promise.resolve(enabledVipPlan)),
        },
        membershipBenefitDefinition: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 2,
              benefitType: MembershipBenefitTypeEnum.NO_AD_POLICY,
            }),
          ),
        },
      },
      update: jest.fn(() => createMutationBuilder()),
    }
    const service = createService(db)

    await expect(
      service.updateMembershipPlan({
        id: 1,
        benefits: [
          {
            benefitId: 2,
            grantPolicy:
              MembershipBenefitGrantPolicyEnum.ACTIVE_DURING_SUBSCRIPTION,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BusinessException)
  })

  it.each([
    [
      MembershipBenefitTypeEnum.COUPON_GRANT,
      { couponDefinitionId: 1, grantCount: 2, validDays: 30 },
    ],
    [
      MembershipBenefitTypeEnum.ITEM_GRANT,
      {
        assetType: 1,
        assetKey: 'avatar_frame_vip',
        grantCount: 1,
        validDays: 30,
      },
    ],
    [
      MembershipBenefitTypeEnum.NO_AD_POLICY,
      { adScope: 'reading', durationPolicy: 'subscription_period' },
    ],
    [
      MembershipBenefitTypeEnum.EARLY_ACCESS_POLICY,
      { contentScope: 'comic_chapter', advanceHours: 24 },
    ],
  ])(
    'accepts complete benefitValue structure for benefit type %s',
    async (benefitType, benefitValue) => {
      const db = {
        query: {
          membershipPlan: {
            findFirst: jest.fn(() => Promise.resolve(enabledVipPlan)),
          },
          membershipBenefitDefinition: {
            findFirst: jest.fn(() =>
              Promise.resolve({
                id: 2,
                benefitType,
              }),
            ),
          },
        },
        insert: jest.fn(() => createMutationBuilder()),
        update: jest.fn(() => createMutationBuilder()),
        delete: jest.fn(() => createMutationBuilder()),
      }
      const service = createService(db)

      await expect(
        service.updateMembershipPlan({
          id: 1,
          benefits: [
            {
              benefitId: 2,
              grantPolicy:
                MembershipBenefitGrantPolicyEnum.ACTIVE_DURING_SUBSCRIPTION,
              benefitValue,
            },
          ],
        }),
      ).resolves.toBe(true)
    },
  )

  it('rejects display benefits that contain actual entitlement fields', async () => {
    const db = {
      query: {
        membershipPlan: {
          findFirst: jest.fn(() => Promise.resolve(enabledVipPlan)),
        },
        membershipBenefitDefinition: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 2,
              benefitType: MembershipBenefitTypeEnum.DISPLAY,
            }),
          ),
        },
      },
      insert: jest.fn(() => createMutationBuilder()),
      update: jest.fn(() => createMutationBuilder()),
    }
    const service = createService(db)

    await expect(
      service.updateMembershipPlan({
        id: 1,
        benefits: [
          {
            benefitId: 2,
            grantPolicy: MembershipBenefitGrantPolicyEnum.DISPLAY_ONLY,
            benefitValue: { couponDefinitionId: 1 },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BusinessException)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('cancels active auto-renew agreements without touching subscriptions', async () => {
    const updateBuilder = createMutationBuilder()
    const db = {
      query: {
        membershipAutoRenewAgreement: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              id: 1,
              status: MembershipAutoRenewAgreementStatusEnum.ACTIVE,
            }),
          ),
        },
      },
      update: jest.fn(() => updateBuilder),
    }
    const service = createService(db)

    await expect(service.cancelMembershipAutoRenewAgreement(1)).resolves.toBe(
      true,
    )
    expect(db.update).toHaveBeenCalledWith(schema.membershipAutoRenewAgreement)
    expect(db.update).not.toHaveBeenCalledWith(
      schema.userMembershipSubscription,
    )
    expect(updateBuilder.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MembershipAutoRenewAgreementStatusEnum.CANCELLED,
      }),
    )
  })

  it('rejects payment confirmation when verified provider amount mismatches the order', async () => {
    const pendingOrder = {
      id: 10,
      orderNo: 'PAY202605060001',
      userId: 20,
      orderType: PaymentOrderTypeEnum.CURRENCY_RECHARGE,
      channel: PaymentChannelEnum.ALIPAY,
      paymentScene: PaymentSceneEnum.APP,
      platform: MonetizationPlatformEnum.ANDROID,
      environment: ProviderEnvironmentEnum.SANDBOX,
      clientAppKey: 'default-app',
      subscriptionMode: PaymentSubscriptionModeEnum.ONE_TIME,
      autoRenewAgreementId: null,
      status: PaymentOrderStatusEnum.PENDING,
      payableAmount: 1000,
      paidAmount: 0,
      targetId: 30,
      providerConfigId: 40,
      providerConfigVersion: 1,
      credentialVersionRef: 'kms://payment/alipay/v1',
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
    const tx = {
      update: jest.fn(() => createUpdateReturningBuilder([pendingOrder])),
    }
    const db = {
      query: {
        paymentOrder: {
          findFirst: jest.fn(() => Promise.resolve(pendingOrder)),
        },
      },
    }
    const drizzle = {
      schema,
      db,
      ext: { findPagination: jest.fn() },
      withErrorHandling: jest.fn((callback: () => unknown) => callback()),
      withTransaction: jest.fn((callback: (runner: typeof tx) => unknown) =>
        callback(tx),
      ),
    }
    const service = new (MonetizationService as any)(
      drizzle,
      {},
      {},
      {},
    ) as MonetizationService
    ;(service as any).getPaymentProviderConfigById = jest.fn(() =>
      Promise.resolve({ id: 40 }),
    )
    ;(service as any).getPaymentAdapter = jest.fn(() => ({
      verifyNotify: jest.fn(() => true),
      parseNotify: jest.fn(() => ({
        providerTradeNo: 'provider-trade-no',
        paidAmount: 999,
      })),
    }))
    ;(service as any).settlePaidOrder = jest.fn()

    await expect(
      service.confirmPaymentOrder({
        orderNo: pendingOrder.orderNo,
        notifyPayload: {},
      }),
    ).rejects.toBeInstanceOf(BusinessException)
    expect(tx.update).not.toHaveBeenCalled()
  })

  it('requires provider verification before returning an already paid order', async () => {
    const paidOrder = {
      id: 10,
      orderNo: 'PAY202605060001',
      userId: 20,
      orderType: PaymentOrderTypeEnum.CURRENCY_RECHARGE,
      channel: PaymentChannelEnum.ALIPAY,
      paymentScene: PaymentSceneEnum.APP,
      platform: MonetizationPlatformEnum.ANDROID,
      environment: ProviderEnvironmentEnum.SANDBOX,
      clientAppKey: 'default-app',
      subscriptionMode: PaymentSubscriptionModeEnum.ONE_TIME,
      autoRenewAgreementId: null,
      status: PaymentOrderStatusEnum.PAID,
      payableAmount: 1000,
      paidAmount: 1000,
      targetId: 30,
      providerConfigId: 40,
      providerConfigVersion: 1,
      credentialVersionRef: 'kms://payment/alipay/v1',
      configSnapshot: null,
      clientContext: null,
      clientPayPayload: null,
      providerTradeNo: 'provider-trade-no',
      notifyPayload: null,
      paidAt: new Date('2026-05-06T00:01:00.000Z'),
      closedAt: null,
      refundedAt: null,
      createdAt: new Date('2026-05-06T00:00:00.000Z'),
      updatedAt: new Date('2026-05-06T00:00:00.000Z'),
    }
    const db = {
      query: {
        paymentOrder: {
          findFirst: jest.fn(() => Promise.resolve(paidOrder)),
        },
      },
    }
    const drizzle = {
      schema,
      db,
      ext: { findPagination: jest.fn() },
      withErrorHandling: jest.fn((callback: () => unknown) => callback()),
    }
    const service = new (MonetizationService as any)(
      drizzle,
      {},
      {},
      {},
    ) as MonetizationService
    const verifyNotify = jest.fn(() => false)
    ;(service as any).getPaymentProviderConfigById = jest.fn(() =>
      Promise.resolve({ id: 40 }),
    )
    ;(service as any).getPaymentAdapter = jest.fn(() => ({
      verifyNotify,
      parseNotify: jest.fn(),
    }))

    await expect(
      service.confirmPaymentOrder({
        orderNo: paidOrder.orderNo,
        notifyPayload: {},
      }),
    ).rejects.toBeInstanceOf(BusinessException)
    expect(verifyNotify).toHaveBeenCalled()
  })

  it('rejects app payment confirmation for another user order', async () => {
    const paidOrder = {
      id: 10,
      orderNo: 'PAY202605060001',
      userId: 20,
      orderType: PaymentOrderTypeEnum.CURRENCY_RECHARGE,
      channel: PaymentChannelEnum.ALIPAY,
      paymentScene: PaymentSceneEnum.APP,
      platform: MonetizationPlatformEnum.ANDROID,
      environment: ProviderEnvironmentEnum.SANDBOX,
      clientAppKey: 'default-app',
      subscriptionMode: PaymentSubscriptionModeEnum.ONE_TIME,
      autoRenewAgreementId: null,
      status: PaymentOrderStatusEnum.PAID,
      payableAmount: 1000,
      paidAmount: 1000,
      targetId: 30,
      providerConfigId: 40,
      providerConfigVersion: 1,
      credentialVersionRef: 'kms://payment/alipay/v1',
      configSnapshot: null,
      clientContext: null,
      clientPayPayload: null,
      providerTradeNo: 'provider-trade-no',
      notifyPayload: null,
      paidAt: new Date('2026-05-06T00:01:00.000Z'),
      closedAt: null,
      refundedAt: null,
      createdAt: new Date('2026-05-06T00:00:00.000Z'),
      updatedAt: new Date('2026-05-06T00:00:00.000Z'),
    }
    const db = {
      query: {
        paymentOrder: {
          findFirst: jest.fn(() => Promise.resolve(paidOrder)),
        },
      },
    }
    const service = createService(db)
    ;(service as any).getPaymentProviderConfigById = jest.fn()

    await expect(
      (service as any).confirmPaymentOrder(
        {
          orderNo: paidOrder.orderNo,
          notifyPayload: {},
        },
        { userId: 21 },
      ),
    ).rejects.toBeInstanceOf(BusinessException)
    expect((service as any).getPaymentProviderConfigById).not.toHaveBeenCalled()
  })

  it('persists auto-renew agreements with the verified provider agreement number', async () => {
    const paidOrder = {
      id: 10,
      orderNo: 'PAY202605060001',
      userId: 20,
      orderType: PaymentOrderTypeEnum.VIP_SUBSCRIPTION,
      channel: PaymentChannelEnum.ALIPAY,
      paymentScene: PaymentSceneEnum.APP,
      platform: MonetizationPlatformEnum.ANDROID,
      environment: ProviderEnvironmentEnum.SANDBOX,
      clientAppKey: 'default-app',
      subscriptionMode: PaymentSubscriptionModeEnum.AUTO_RENEW_SIGNING,
      autoRenewAgreementId: null,
      status: PaymentOrderStatusEnum.PAID,
      payableAmount: 1000,
      paidAmount: 1000,
      targetId: enabledVipPlan.id,
      providerConfigId: 40,
      providerConfigVersion: 1,
      credentialVersionRef: 'kms://payment/alipay/v1',
      configSnapshot: null,
      clientContext: null,
      clientPayPayload: null,
      providerTradeNo: 'provider-trade-no',
      notifyPayload: { agreementNo: 'raw-payload-agreement-no' },
      paidAt: new Date('2026-05-06T00:01:00.000Z'),
      closedAt: null,
      refundedAt: null,
      createdAt: new Date('2026-05-06T00:00:00.000Z'),
      updatedAt: new Date('2026-05-06T00:00:00.000Z'),
    }
    const subscription = {
      id: 99,
      endsAt: new Date('2026-06-06T00:00:00.000Z'),
    }
    const subscriptionBuilder = createInsertReturningBuilder([subscription])
    const agreementValues = jest.fn(() => Promise.resolve([]))
    const agreementBuilder = {
      values: agreementValues,
    }
    const tx = {
      query: {
        membershipPlan: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              ...enabledVipPlan,
              bonusPointAmount: 0,
            }),
          ),
        },
        userMembershipSubscription: {
          findFirst: jest.fn(() => Promise.resolve(null)),
        },
      },
      insert: jest.fn((table: unknown) =>
        table === schema.userMembershipSubscription
          ? subscriptionBuilder
          : agreementBuilder,
      ),
    }
    const service = createService({})

    await expect(
      (service as any).settlePaidOrder(tx, paidOrder, 'provider-agreement-no'),
    ).resolves.toBeUndefined()
    expect(agreementValues).toHaveBeenCalledWith(
      expect.objectContaining({
        agreementNo: 'provider-agreement-no',
      }),
    )
  })

  it('rejects auto-renew agreement settlement without a verified provider agreement number', async () => {
    const paidOrder = {
      id: 10,
      orderNo: 'PAY202605060001',
      userId: 20,
      orderType: PaymentOrderTypeEnum.VIP_SUBSCRIPTION,
      channel: PaymentChannelEnum.ALIPAY,
      paymentScene: PaymentSceneEnum.APP,
      platform: MonetizationPlatformEnum.ANDROID,
      environment: ProviderEnvironmentEnum.SANDBOX,
      clientAppKey: 'default-app',
      subscriptionMode: PaymentSubscriptionModeEnum.AUTO_RENEW_SIGNING,
      autoRenewAgreementId: null,
      status: PaymentOrderStatusEnum.PAID,
      payableAmount: 1000,
      paidAmount: 1000,
      targetId: enabledVipPlan.id,
      providerConfigId: 40,
      providerConfigVersion: 1,
      credentialVersionRef: 'kms://payment/alipay/v1',
      configSnapshot: null,
      clientContext: null,
      clientPayPayload: null,
      providerTradeNo: 'provider-trade-no',
      notifyPayload: {},
      paidAt: new Date('2026-05-06T00:01:00.000Z'),
      closedAt: null,
      refundedAt: null,
      createdAt: new Date('2026-05-06T00:00:00.000Z'),
      updatedAt: new Date('2026-05-06T00:00:00.000Z'),
    }
    const subscription = {
      id: 99,
      endsAt: new Date('2026-06-06T00:00:00.000Z'),
    }
    const subscriptionBuilder = createInsertReturningBuilder([subscription])
    const agreementBuilder = {
      values: jest.fn(() => Promise.resolve([])),
    }
    const tx = {
      query: {
        membershipPlan: {
          findFirst: jest.fn(() =>
            Promise.resolve({
              ...enabledVipPlan,
              bonusPointAmount: 0,
            }),
          ),
        },
        userMembershipSubscription: {
          findFirst: jest.fn(() => Promise.resolve(null)),
        },
      },
      insert: jest.fn((table: unknown) =>
        table === schema.userMembershipSubscription
          ? subscriptionBuilder
          : agreementBuilder,
      ),
    }
    const service = createService({})

    await expect(
      (service as any).settlePaidOrder(tx, paidOrder),
    ).rejects.toBeInstanceOf(BusinessException)
  })

  it('returns the existing paid order when a duplicate callback loses the pending-state update race', async () => {
    const pendingOrder = {
      id: 10,
      orderNo: 'PAY202605060001',
      userId: 20,
      orderType: PaymentOrderTypeEnum.CURRENCY_RECHARGE,
      channel: PaymentChannelEnum.ALIPAY,
      paymentScene: PaymentSceneEnum.APP,
      platform: MonetizationPlatformEnum.ANDROID,
      environment: ProviderEnvironmentEnum.SANDBOX,
      clientAppKey: 'default-app',
      subscriptionMode: PaymentSubscriptionModeEnum.ONE_TIME,
      autoRenewAgreementId: null,
      status: PaymentOrderStatusEnum.PENDING,
      payableAmount: 1000,
      paidAmount: 0,
      targetId: 30,
      providerConfigId: 40,
      providerConfigVersion: 1,
      credentialVersionRef: 'kms://payment/alipay/v1',
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
    const paidOrder = {
      ...pendingOrder,
      status: PaymentOrderStatusEnum.PAID,
      paidAmount: 1000,
      providerTradeNo: 'provider-trade-no',
      paidAt: new Date('2026-05-06T00:01:00.000Z'),
    }
    const updateBuilder = createUpdateReturningBuilder([])
    const tx = {
      update: jest.fn(() => updateBuilder),
      query: {
        paymentOrder: {
          findFirst: jest.fn(() => Promise.resolve(paidOrder)),
        },
      },
    }
    const db = {
      query: {
        paymentOrder: {
          findFirst: jest.fn(() => Promise.resolve(pendingOrder)),
        },
      },
    }
    const drizzle = {
      schema,
      db,
      ext: { findPagination: jest.fn() },
      withErrorHandling: jest.fn((callback: () => unknown) => callback()),
      withTransaction: jest.fn((callback: (runner: typeof tx) => unknown) =>
        callback(tx),
      ),
    }
    const service = new (MonetizationService as any)(
      drizzle,
      {},
      {},
      {},
    ) as MonetizationService
    ;(service as any).getPaymentProviderConfigById = jest.fn(() =>
      Promise.resolve({ id: 40 }),
    )
    ;(service as any).getPaymentAdapter = jest.fn(() => ({
      verifyNotify: jest.fn(() => true),
      parseNotify: jest.fn(() => ({
        providerTradeNo: 'provider-trade-no',
        paidAmount: 1000,
      })),
    }))
    ;(service as any).settlePaidOrder = jest.fn()

    const result = (await service.confirmPaymentOrder({
      orderNo: pendingOrder.orderNo,
      notifyPayload: {},
    })) as unknown as Record<string, unknown>

    expectPaymentOrderResultContract(result)
    expect(result).toMatchObject({
      orderNo: paidOrder.orderNo,
      status: PaymentOrderStatusEnum.PAID,
      payableAmount: paidOrder.payableAmount,
      clientPayPayload: {},
    })
    expect(result).not.toHaveProperty('providerTradeNo')
    expect(updateBuilder.where).toHaveBeenCalled()
    expect((service as any).settlePaidOrder).not.toHaveBeenCalled()
  })

  it('returns a strict public payment result for already paid idempotent callbacks', async () => {
    const paidOrder = {
      id: 10,
      orderNo: 'PAY202605060001',
      userId: 20,
      orderType: PaymentOrderTypeEnum.CURRENCY_RECHARGE,
      channel: PaymentChannelEnum.ALIPAY,
      paymentScene: PaymentSceneEnum.APP,
      platform: MonetizationPlatformEnum.ANDROID,
      environment: ProviderEnvironmentEnum.SANDBOX,
      clientAppKey: 'default-app',
      subscriptionMode: PaymentSubscriptionModeEnum.ONE_TIME,
      autoRenewAgreementId: null,
      status: PaymentOrderStatusEnum.PAID,
      payableAmount: 1000,
      paidAmount: 1000,
      targetId: 30,
      providerConfigId: 40,
      providerConfigVersion: 1,
      credentialVersionRef: 'kms://payment/alipay/v1',
      configSnapshot: { channel: PaymentChannelEnum.ALIPAY },
      clientContext: { terminalIp: '127.0.0.1' },
      clientPayPayload: { providerOrderNo: 'provider-order-no' },
      providerTradeNo: 'provider-trade-no',
      notifyPayload: { sign: 'provider-signature' },
      paidAt: new Date('2026-05-06T00:01:00.000Z'),
      closedAt: null,
      refundedAt: null,
      createdAt: new Date('2026-05-06T00:00:00.000Z'),
      updatedAt: new Date('2026-05-06T00:00:00.000Z'),
    }
    const db = {
      query: {
        paymentOrder: {
          findFirst: jest.fn(() => Promise.resolve(paidOrder)),
        },
      },
    }
    const service = createService(db)
    ;(service as any).getPaymentProviderConfigById = jest.fn(() =>
      Promise.resolve({ id: 40 }),
    )
    ;(service as any).getPaymentAdapter = jest.fn(() => ({
      verifyNotify: jest.fn(() => true),
      parseNotify: jest.fn(() => ({
        providerTradeNo: 'provider-trade-no',
        paidAmount: 1000,
      })),
    }))

    const result = (await service.confirmPaymentOrder({
      orderNo: paidOrder.orderNo,
      notifyPayload: {},
    })) as unknown as Record<string, unknown>

    expectPaymentOrderResultContract(result)
    expect(result).toMatchObject({
      orderNo: paidOrder.orderNo,
      status: PaymentOrderStatusEnum.PAID,
      clientPayPayload: {},
    })
  })

  it('does not replay reading coupon side effects for an existing redemption', async () => {
    const redemption = {
      id: 66,
      userId: 1,
      couponInstanceId: 10,
      couponType: CouponTypeEnum.READING,
      targetType: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
      targetId: 20,
      status: 1,
      bizKey: 'coupon:1:1:20:10',
      redemptionSnapshot: {},
    }
    const tx = {
      insert: jest.fn(),
    }
    const contentEntitlementService = {
      grantEntitlement: jest.fn(),
    }
    const service = new (MonetizationService as any)(
      { schema, db: {}, ext: {}, withTransaction: jest.fn() },
      {},
      {},
      contentEntitlementService,
    ) as MonetizationService
    ;(service as any).getCouponInstanceWithDefinition = jest.fn(() =>
      Promise.resolve({
        id: 10,
        userId: 1,
        couponDefinitionId: 100,
        couponType: CouponTypeEnum.READING,
        status: 1,
        remainingUses: 1,
        expiresAt: null,
        name: '阅读券',
        targetScope: 1,
        discountAmount: 0,
        discountRateBps: 10000,
        validDays: 30,
      }),
    )
    ;(service as any).consumeCouponAndWriteRedemption = jest.fn(() =>
      Promise.resolve({ redemption, created: false }),
    )

    await expect(
      (service as any).redeemCouponInTx(tx, {
        userId: 1,
        couponInstanceId: 10,
        targetType: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
        targetId: 20,
      }),
    ).resolves.toBe(redemption)
    expect(contentEntitlementService.grantEntitlement).not.toHaveBeenCalled()
    expect(tx.insert).not.toHaveBeenCalled()
  })

  it('does not replay VIP trial subscription side effects for an existing redemption', async () => {
    const redemption = {
      id: 77,
      userId: 1,
      couponInstanceId: 11,
      couponType: CouponTypeEnum.VIP_TRIAL,
      targetType: CouponRedemptionTargetTypeEnum.VIP,
      targetId: 0,
      status: 1,
      bizKey: 'coupon:1:3:0:11',
      redemptionSnapshot: {},
    }
    const tx = {
      insert: jest.fn(),
    }
    const service = new (MonetizationService as any)(
      { schema, db: {}, ext: {}, withTransaction: jest.fn() },
      {},
      {},
      { grantEntitlement: jest.fn() },
    ) as MonetizationService
    ;(service as any).getCouponInstanceWithDefinition = jest.fn(() =>
      Promise.resolve({
        id: 11,
        userId: 1,
        couponDefinitionId: 101,
        couponType: CouponTypeEnum.VIP_TRIAL,
        status: 1,
        remainingUses: 1,
        expiresAt: null,
        name: 'VIP 试用卡',
        targetScope: 3,
        discountAmount: 0,
        discountRateBps: 10000,
        validDays: 7,
      }),
    )
    ;(service as any).consumeCouponAndWriteRedemption = jest.fn(() =>
      Promise.resolve({ redemption, created: false }),
    )

    await expect(
      (service as any).redeemCouponInTx(tx, {
        userId: 1,
        couponInstanceId: 11,
        targetType: CouponRedemptionTargetTypeEnum.VIP,
        targetId: 0,
      }),
    ).resolves.toBe(redemption)
    expect(tx.insert).not.toHaveBeenCalled()
  })

  it('returns created=false with the existing redemption for duplicate biz keys', async () => {
    const existing = {
      id: 88,
      userId: 1,
      couponInstanceId: 12,
      couponType: CouponTypeEnum.READING,
      targetType: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
      targetId: 20,
      status: 1,
      bizKey: 'coupon:1:1:20:12',
      redemptionSnapshot: {},
    }
    const tx = {
      query: {
        couponRedemptionRecord: {
          findFirst: jest.fn(() => Promise.resolve(existing)),
        },
      },
      update: jest.fn(),
      insert: jest.fn(),
    }
    const service = createService({})

    await expect(
      (service as any).consumeCouponAndWriteRedemption(tx, {
        userId: 1,
        couponInstanceId: 12,
        targetType: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
        targetId: 20,
        coupon: {
          id: 12,
          userId: 1,
          couponDefinitionId: 102,
          couponType: CouponTypeEnum.READING,
          status: 1,
          remainingUses: 1,
          expiresAt: null,
          name: '阅读券',
          targetScope: 1,
          discountAmount: 0,
          discountRateBps: 10000,
          validDays: 30,
        },
        bizKey: existing.bizKey,
        redemptionSnapshot: {},
      }),
    ).resolves.toEqual({ redemption: existing, created: false })
    expect(tx.update).not.toHaveBeenCalled()
    expect(tx.insert).not.toHaveBeenCalled()
  })

  it('declares source uniqueness for coupon entitlements and VIP trial subscriptions', () => {
    const extraConfigSymbol = Symbol.for('drizzle:ExtraConfigBuilder')
    const contentEntitlementExtraConfig = (
      schema.userContentEntitlement as unknown as Record<PropertyKey, unknown>
    )[extraConfigSymbol]
    const subscriptionExtraConfig = (
      schema.userMembershipSubscription as unknown as Record<
        PropertyKey,
        unknown
      >
    )[extraConfigSymbol]

    expect(String(contentEntitlementExtraConfig)).toContain(
      'user_content_entitlement_coupon_source_unique_idx',
    )
    expect(String(subscriptionExtraConfig)).toContain(
      'user_membership_subscription_vip_trial_coupon_source_key',
    )
  })

  it('documents migration reconcile stop conditions for legacy agreement codes', async () => {
    const { readFile } = await import('node:fs/promises')
    const reconcile = await readFile(
      'db/migration/20260508020000_vip_agreement_app_agreement_breaking/reconcile.sql',
      'utf8',
    )

    expect(reconcile).toContain('unmigrated_plan_agreement_codes')
    expect(reconcile).toContain('missing_ref_count')
    expect(reconcile).toContain('duplicate_ref_count')
    expect(reconcile).toContain('status')
  })

  it('keeps legacy agreement code fields out of the breaking migration after backfill gates', async () => {
    const { readFile } = await import('node:fs/promises')
    const migration = await readFile(
      'db/migration/20260508020000_vip_agreement_app_agreement_breaking/migration.sql',
      'utf8',
    )

    expect(migration).toContain('membership_plan_agreement_codes')
    expect(migration).toContain('membership_page_config.service_agreement_code')
    expect(migration).toContain('DROP COLUMN IF EXISTS "agreement_codes"')
  })

  it('does not return provider trade fields from duplicate paid callbacks', async () => {
    const paidOrder = {
      id: 10,
      orderNo: 'PAY202605060003',
      userId: 20,
      orderType: PaymentOrderTypeEnum.CURRENCY_RECHARGE,
      channel: PaymentChannelEnum.ALIPAY,
      paymentScene: PaymentSceneEnum.APP,
      platform: MonetizationPlatformEnum.ANDROID,
      environment: ProviderEnvironmentEnum.SANDBOX,
      clientAppKey: 'default-app',
      subscriptionMode: PaymentSubscriptionModeEnum.ONE_TIME,
      autoRenewAgreementId: null,
      status: PaymentOrderStatusEnum.PAID,
      payableAmount: 1000,
      paidAmount: 1000,
      targetId: 30,
      providerConfigId: 40,
      providerConfigVersion: 1,
      credentialVersionRef: 'kms://payment/alipay/v1',
      configSnapshot: { channel: PaymentChannelEnum.ALIPAY },
      clientContext: { terminalIp: '127.0.0.1' },
      clientPayPayload: { providerOrderNo: 'provider-order-no' },
      providerTradeNo: 'provider-trade-no',
      notifyPayload: { sign: 'provider-signature' },
      paidAt: new Date('2026-05-06T00:01:00.000Z'),
      closedAt: null,
      refundedAt: null,
      createdAt: new Date('2026-05-06T00:00:00.000Z'),
      updatedAt: new Date('2026-05-06T00:00:00.000Z'),
    }
    const service = createService({
      query: {
        paymentOrder: {
          findFirst: jest.fn(() => Promise.resolve(paidOrder)),
        },
      },
    })
    ;(service as any).getPaymentProviderConfigById = jest.fn(() =>
      Promise.resolve({ id: 40 }),
    )
    ;(service as any).getPaymentAdapter = jest.fn(() => ({
      verifyNotify: jest.fn(() => true),
      parseNotify: jest.fn(() => ({
        providerTradeNo: 'provider-trade-no',
        paidAmount: 1000,
      })),
    }))

    const result = (await service.confirmPaymentOrder({
      orderNo: paidOrder.orderNo,
      notifyPayload: {},
    })) as unknown as Record<string, unknown>

    expectPaymentOrderResultContract(result)
    expect(result).toMatchObject({ status: PaymentOrderStatusEnum.PAID })
  })

  it('returns existing ad reward when unique insert loses a duplicate callback race', async () => {
    const config = {
      id: 1,
      provider: AdProviderEnum.PANGLE,
      platform: MonetizationPlatformEnum.ANDROID,
      environment: ProviderEnvironmentEnum.SANDBOX,
      clientAppKey: 'default-app',
      appId: 'pangle-app',
      placementKey: 'reward-low-price',
      targetScope: 1,
      dailyLimit: 0,
      configVersion: 1,
      credentialVersionRef: 'kms://ad/pangle/v1',
      callbackUrl: null,
      configMetadata: null,
      sortOrder: 0,
      isEnabled: true,
      createdAt: new Date('2026-05-06T00:00:00.000Z'),
      updatedAt: new Date('2026-05-06T00:00:00.000Z'),
    }
    const existingRecord = {
      id: 9,
      userId: 1,
      adProviderConfigId: config.id,
      providerRewardId: 'reward-id',
      status: AdRewardStatusEnum.SUCCESS,
    }
    const insertBuilder = createInsertReturningBuilder([])
    const tx = {
      insert: jest.fn(() => insertBuilder),
      query: {
        adRewardRecord: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(existingRecord),
        },
      },
    }
    const db = {
      select: jest.fn(() => createSelectBuilder([config])),
    }
    const drizzle = {
      schema,
      db,
      ext: { findPagination: jest.fn() },
      withErrorHandling: jest.fn((callback: () => unknown) => callback()),
      withTransaction: jest.fn((callback: (runner: typeof tx) => unknown) =>
        callback(tx),
      ),
    }
    const contentPermissionService = {
      resolveChapterPermission: jest.fn(() =>
        Promise.resolve({
          viewRule: WorkViewPermissionEnum.PURCHASE,
          purchasePricing: { originalPrice: 30 },
        }),
      ),
    }
    const contentEntitlementService = {
      grantEntitlement: jest.fn(),
    }
    const service = new (MonetizationService as any)(
      drizzle,
      {},
      contentPermissionService,
      contentEntitlementService,
    ) as MonetizationService
    ;(service as any).getAdRewardAdapter = jest.fn(() => ({
      verifyRewardCallback: jest.fn(() => true),
      parseRewardPayload: jest.fn(() => ({
        providerRewardId: 'reward-id',
        placementKey: 'reward-low-price',
      })),
    }))

    await expect(
      service.verifyAdReward(1, {
        provider: AdProviderEnum.PANGLE,
        platform: MonetizationPlatformEnum.ANDROID,
        environment: ProviderEnvironmentEnum.SANDBOX,
        clientAppKey: 'default-app',
        appId: 'pangle-app',
        placementKey: 'reward-low-price',
        targetType: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
        targetId: 2,
        providerRewardId: 'reward-id',
      }),
    ).resolves.toBe(existingRecord)
    expect(contentEntitlementService.grantEntitlement).not.toHaveBeenCalled()
  })
})
