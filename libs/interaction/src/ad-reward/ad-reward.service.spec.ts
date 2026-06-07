/// <reference types="jest" />

import * as schema from '@db/schema'
import {
  ContentEntitlementGrantSourceEnum,
  ContentEntitlementStatusEnum,
} from '@libs/content/permission/content-entitlement.constant'
import { WorkViewPermissionEnum } from '@libs/platform/constant'
import { AdRewardStatusEnum } from './ad-reward.constant'
import { AdRewardService } from './ad-reward.service'

describe('adRewardService domain split contract', () => {
  it('returns existing reward records for duplicate provider rewards without granting twice', async () => {
    const existingRecord = {
      id: 7,
      providerRewardId: 'reward-id',
      targetId: 2,
      targetScope: 1,
      targetType: 1,
      userId: 3,
    }
    const drizzle = {
      withTransaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback({
          query: {
            adRewardRecord: {
              findFirst: jest.fn(async () => Promise.resolve(existingRecord)),
            },
          },
        }),
      ),
    }
    const contentEntitlementService = { grantEntitlement: jest.fn() }
    const service = new AdRewardService(
      drizzle as any,
      {} as any,
      contentEntitlementService as any,
    ) as any
    service.resolveAdProviderConfig = jest.fn(async () =>
      Promise.resolve({
        configVersion: 1,
        dailyLimit: 0,
        id: 1,
      }),
    )
    service.getAdRewardAdapter = jest.fn(() => ({
      parseRewardPayload: jest.fn(() => ({
        placementKey: 'reward-low-price',
        providerRewardId: 'reward-id',
      })),
      verifyRewardCallback: jest.fn(() => true),
    }))
    service.assertAdTargetAllowed = jest.fn(async () => 1)

    await expect(
      service.verifyAdReward(3, {
        appId: 'app-id',
        clientAppKey: 'default-app',
        environment: 1,
        placementKey: 'reward-low-price',
        platform: 1,
        provider: 1,
        providerRewardId: 'reward-id',
        targetScope: 1,
        targetId: 2,
        targetType: 1,
      }),
    ).resolves.toEqual(existingRecord)
    expect(contentEntitlementService.grantEntitlement).not.toHaveBeenCalled()
  })

  it('rejects duplicate provider rewards when the idempotency key points to a different target', async () => {
    const existingRecord = {
      id: 7,
      providerRewardId: 'reward-id',
      targetId: 9,
      targetScope: 1,
      targetType: 1,
      userId: 3,
    }
    const drizzle = {
      withTransaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback({
          query: {
            adRewardRecord: {
              findFirst: jest.fn(async () => Promise.resolve(existingRecord)),
            },
          },
        }),
      ),
    }
    const contentEntitlementService = { grantEntitlement: jest.fn() }
    const service = new AdRewardService(
      drizzle as any,
      {} as any,
      contentEntitlementService as any,
    ) as any
    service.resolveAdProviderConfig = jest.fn(async () =>
      Promise.resolve({
        configVersion: 1,
        dailyLimit: 0,
        id: 1,
      }),
    )
    service.getAdRewardAdapter = jest.fn(() => ({
      parseRewardPayload: jest.fn(() => ({
        placementKey: 'reward-low-price',
        providerRewardId: 'reward-id',
      })),
      verifyRewardCallback: jest.fn(() => true),
    }))
    service.assertAdTargetAllowed = jest.fn(async () => 1)

    await expect(
      service.verifyAdReward(3, {
        appId: 'app-id',
        clientAppKey: 'default-app',
        environment: 1,
        placementKey: 'reward-low-price',
        platform: 1,
        provider: 1,
        providerRewardId: 'reward-id',
        targetId: 2,
        targetScope: 1,
        targetType: 1,
      }),
    ).rejects.toMatchObject({
      code: 20003,
      message: '广告奖励幂等键与业务目标不一致',
    })
    expect(contentEntitlementService.grantEntitlement).not.toHaveBeenCalled()
  })

  it('rejects ad rewards when requested target type does not match the chapter work type', async () => {
    const contentPermissionService = {
      resolveChapterEntitlementTargetType: jest.fn(() => 1),
      resolveChapterPermission: jest.fn(async () => ({
        purchasePricing: { originalPrice: 10 },
        viewRule: WorkViewPermissionEnum.PURCHASE,
        workType: 1,
      })),
    }
    const service = new AdRewardService(
      {} as any,
      contentPermissionService as any,
      {} as any,
    ) as any

    await expect(
      service.assertAdTargetAllowed({
        targetId: 2,
        targetScope: 1,
        targetType: 2,
      }),
    ).rejects.toMatchObject({
      code: 20004,
      message: '广告奖励目标类型与章节类型不一致',
    })
  })

  it('returns credential options without raw secret or editable env key values', async () => {
    process.env.ES_AD_PANGLE_SSV_SECRET = 'test-secret'
    const service = new AdRewardService({} as any, {} as any, {} as any) as any

    const options = await service.getAdRewardCredentialOptions()

    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          credentialVersionRef: 'ad:pangle:sandbox:ssv',
          disabledReason: null,
          fingerprint: expect.stringMatching(/^sha256:[a-f0-9]{12}$/),
          provider: 1,
          status: 'available',
          value: 'ad:pangle:sandbox:ssv',
        }),
      ]),
    )
    expect(JSON.stringify(options)).not.toContain('test-secret')
    expect(JSON.stringify(options)).not.toContain('ES_AD_PANGLE_SSV_SECRET')
    delete process.env.ES_AD_PANGLE_SSV_SECRET
  })

  it('fails closed when enabling a config whose selected credential is unavailable', async () => {
    delete process.env.ES_AD_PANGLE_SSV_SECRET
    const service = new AdRewardService({} as any, {} as any, {} as any) as any

    await expect(
      service.createAdProviderConfig({
        credentialOptionRef: 'ad:pangle:sandbox:ssv',
        environment: 1,
        isEnabled: true,
        placementKey: 'reward-low-price',
        platform: 1,
        provider: 1,
        targetScope: 1,
      }),
    ).rejects.toMatchObject({
      code: 20004,
      message: '广告验签密钥未配置或不可用',
    })
  })

  it('rejects provider configs when the credential option does not match provider or environment', async () => {
    const service = new AdRewardService({} as any, {} as any, {} as any) as any

    await expect(
      service.createAdProviderConfig({
        credentialOptionRef: 'ad:tencent-youlianghui:sandbox:ssv',
        environment: 1,
        isEnabled: false,
        placementKey: 'reward-low-price',
        platform: 1,
        provider: 1,
        targetScope: 1,
      }),
    ).rejects.toMatchObject({
      code: 20004,
      message: '广告验签密钥选项与 provider 或环境不匹配',
    })
  })

  it('requires a matching credential option when changing provider or environment', async () => {
    const service = new AdRewardService(
      {
        db: {
          query: {
            adProviderConfig: {
              findFirst: jest.fn(async () =>
                Promise.resolve({
                  id: 1,
                  provider: 1,
                  environment: 1,
                  isEnabled: false,
                }),
              ),
            },
          },
        },
        schema,
      } as any,
      {} as any,
      {} as any,
    ) as any

    await expect(
      service.updateAdProviderConfig({
        id: 1,
        provider: 2,
      }),
    ).rejects.toMatchObject({
      code: 20004,
      message: '修改广告 provider 或环境时必须重新选择匹配的 SSV 密钥选项',
    })
  })

  it('revokes reward records and the exact AD source entitlement', async () => {
    const where = jest.fn(async () => Promise.resolve())
    const set = jest.fn(() => ({ where }))
    const tx = {
      query: {
        adRewardRecord: {
          findFirst: jest.fn(async () =>
            Promise.resolve({
              id: 7,
              status: 1,
              verifyPayload: { provider: 1 },
            }),
          ),
        },
      },
      update: jest.fn(() => ({ set })),
    }
    const drizzle = {
      schema,
      withTransaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(tx),
      ),
    }
    const contentEntitlementService = {
      grantEntitlement: jest.fn(),
      revokeEntitlementBySource: jest.fn(async () => Promise.resolve(1)),
    }
    const service = new AdRewardService(
      drizzle as any,
      {} as any,
      contentEntitlementService as any,
    )

    await expect(
      service.revokeAdRewardRecord({
        id: 7,
        reason: ' 对账异常 ',
      }),
    ).resolves.toBe(true)

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 3,
        verifyPayload: expect.objectContaining({
          provider: 1,
          revokeReason: '对账异常',
          revokedAt: expect.any(String),
        }),
      }),
    )
    expect(contentEntitlementService.revokeEntitlementBySource).toHaveBeenCalledWith(
      tx,
      {
        grantSource: ContentEntitlementGrantSourceEnum.AD,
        sourceId: 7,
      },
    )
  })

  it('revokes stale AD source entitlements even when the reward record is already revoked', async () => {
    const tx = {
      query: {
        adRewardRecord: {
          findFirst: jest.fn(async () =>
            Promise.resolve({
              id: 7,
              status: AdRewardStatusEnum.REVOKED,
              verifyPayload: { provider: 1 },
            }),
          ),
        },
      },
      update: jest.fn(),
    }
    const drizzle = {
      schema,
      withTransaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(tx),
      ),
    }
    const contentEntitlementService = {
      grantEntitlement: jest.fn(),
      revokeEntitlementBySource: jest.fn(async () => Promise.resolve(1)),
    }
    const service = new AdRewardService(
      drizzle as any,
      {} as any,
      contentEntitlementService as any,
    )

    await expect(
      service.revokeAdRewardRecord({
        id: 7,
        reason: '重复撤销',
      }),
    ).resolves.toBe(true)

    expect(tx.update).not.toHaveBeenCalled()
    expect(contentEntitlementService.revokeEntitlementBySource).toHaveBeenCalledWith(
      tx,
      {
        grantSource: ContentEntitlementGrantSourceEnum.AD,
        sourceId: 7,
      },
    )
  })

  it('keeps list/reconcile projections away from raw reward payload columns', () => {
    const service = new AdRewardService(
      { schema } as any,
      {} as any,
      {} as any,
    ) as any

    expect(Object.keys(service.adRewardRecordPageSelect)).toEqual(
      expect.arrayContaining([
        'id',
        'userId',
        'targetScope',
        'targetType',
        'targetId',
        'status',
      ]),
    )
    expect(Object.keys(service.adRewardRecordPageSelect)).not.toEqual(
      expect.arrayContaining([
        'clientContext',
        'rawNotifyPayload',
        'verifyPayload',
      ]),
    )
  })

  it('redacts provider config metadata before returning admin list rows', () => {
    const service = new AdRewardService({} as any, {} as any, {} as any) as any

    const row = service.sanitizeAdProviderConfigForAdmin({
      id: 1,
      configMetadata: {
        credentialOptionRef: 'ad:pangle:sandbox:ssv',
        keyFingerprint: 'sha256:123456789abc',
        verifySecretEnvKey: 'ES_AD_PANGLE_SSV_SECRET',
      },
    })

    expect(row.configMetadata).toEqual({
      credentialOptionRef: 'ad:pangle:sandbox:ssv',
      keyFingerprint: 'sha256:123456789abc',
    })
    expect(JSON.stringify(row)).not.toContain('ES_AD_PANGLE_SSV_SECRET')
  })

  it('sanitizes reward record details before returning admin payloads', () => {
    const service = new AdRewardService({} as any, {} as any, {} as any) as any

    const detail = service.sanitizeAdRewardRecordDetail({
      id: 1,
      clientContext: {
        deviceModel: 'phone',
        sign: 'raw-signature',
        token: 'secret-token',
      },
      rawNotifyPayload: { sign: 'provider-signature' },
      verifyPayload: {
        provider: 1,
        targetScope: 1,
        rawPayload: { sign: 'provider-signature' },
      },
    })

    expect(detail.rawNotifyPayload).toBeUndefined()
    expect(detail.providerRewardId).toBeUndefined()
    expect(detail.credentialVersionRef).toBeUndefined()
    expect(detail.adProviderConfigId).toBeUndefined()
    expect(detail.clientContext).toEqual({ deviceModel: 'phone' })
    expect(detail.verifyPayload).toEqual({ provider: 1, targetScope: 1 })
    expect(JSON.stringify(detail)).not.toContain('provider-signature')
    expect(JSON.stringify(detail)).not.toContain('secret-token')
  })

  it('reports reconcile statuses for revoked, expired, missing, and failed reward states', () => {
    const service = new AdRewardService({} as any, {} as any, {} as any) as any
    const now = new Date('2026-06-06T00:00:00.000Z')

    expect(
      service.resolveAdRewardReconcileStatus(
        AdRewardStatusEnum.REVOKED,
        ContentEntitlementStatusEnum.ACTIVE,
        new Date('2026-06-07T00:00:00.000Z'),
        now,
      ),
    ).toMatchObject({
      reconcileStatus: 'revoked_reward_active_entitlement',
    })
    expect(
      service.resolveAdRewardReconcileStatus(
        AdRewardStatusEnum.SUCCESS,
        ContentEntitlementStatusEnum.ACTIVE,
        new Date('2026-06-05T00:00:00.000Z'),
        now,
      ),
    ).toMatchObject({
      reconcileStatus: 'entitlement_expired',
    })
    expect(
      service.resolveAdRewardReconcileStatus(
        AdRewardStatusEnum.SUCCESS,
        null,
        null,
        now,
      ),
    ).toMatchObject({
      reconcileStatus: 'entitlement_missing',
    })
    expect(
      service.resolveAdRewardReconcileStatus(
        AdRewardStatusEnum.FAILED,
        ContentEntitlementStatusEnum.ACTIVE,
        null,
        now,
      ),
    ).toMatchObject({
      reconcileStatus: 'failed_reward_active_entitlement',
    })
    expect(
      service.resolveAdRewardReconcileStatus(
        AdRewardStatusEnum.FAILED,
        null,
        null,
        now,
      ),
    ).toMatchObject({
      reconcileStatus: 'reward_failed',
    })
  })
})
