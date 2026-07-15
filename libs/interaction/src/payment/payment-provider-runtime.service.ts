import type {
  PaymentProviderAdapterConfig,
  PaymentProviderCertificateMaterialSource,
  PaymentProviderConfigVersionRuntimeSnapshot,
  PaymentProviderCreateOrderRuntime,
  PaymentProviderCredentialMaterialSource,
  PaymentProviderCredentialSnapshot,
  PaymentProviderMaterialFieldNames,
  PaymentProviderMetadata,
  PaymentProviderOrderCredentialConfig,
  PaymentProviderOrderCredentialReference,
  PaymentProviderOrderVersionReference,
  PaymentProviderWechatCredentialMaterial,
  PaymentProviderWechatPlatformSerialNumber,
} from './types/payment-provider-runtime.type'
import type {
  PaymentProviderAdapter,
  PaymentProviderCredentialMaterial,
} from './types/payment.type'
import process from 'node:process'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { PAYMENT_PROVIDER_ADAPTERS } from './payment-provider.adapter'
import {
  PaymentChannelEnum,
  PaymentProviderCredentialTypeEnum,
} from './payment.constant'

/**
 * Provider Runtime 只拥有适配器查找、不可变配置版本读取和凭据材料解析。
 * 它不创建配置版本、不修改订单，也不依赖任何支付用例 service。
 */
@Injectable()
export class PaymentProviderRuntimeService {
  constructor(private readonly drizzle: DrizzleService) {}

  // 获取当前请求使用的 Drizzle 查询实例。
  private get db() {
    return this.drizzle.db
  }

  // 获取支付 provider 凭据注册表定义。
  private get paymentProviderCredential() {
    return this.drizzle.schema.paymentProviderCredential
  }

  // 获取所有公开 Runtime API 实际消费的最小不可变版本投影，禁止顺手带出管理字段。
  private get paymentProviderConfigVersionRuntimeColumns() {
    return {
      id: true,
      providerConfigId: true,
      configVersion: true,
      channel: true,
      appId: true,
      mchId: true,
      notifyUrl: true,
      returnUrl: true,
      appPrivateCredentialId: true,
      alipayPublicCredentialId: true,
      wechatApiV3CredentialId: true,
      appCertificateId: true,
      platformCertificateId: true,
      rootCertificateId: true,
      configSnapshot: true,
      status: true,
      isActive: true,
    } as const
  }

  // 获取按 ID 或引用解析凭据材料所需的查询字段。
  private get paymentProviderCredentialMaterialColumns() {
    return {
      metadata: true,
    } as const
  }

  // 获取按引用解析证书材料所需的查询字段。
  private get paymentProviderCertificateMaterialColumns() {
    return {
      metadata: true,
      serialNo: true,
    } as const
  }

  // 获取微信通知候选 APIv3 key 所需的最小字段，排序键仅用于查询稳定性而不返回。
  private get paymentProviderCredentialNotifyMaterialSelect() {
    return {
      metadata: this.paymentProviderCredential.metadata,
    } as const
  }

  /** 按渠道获取唯一的 provider 适配器，未知渠道一律拒绝。 */
  getPaymentAdapter(channel: PaymentChannelEnum): PaymentProviderAdapter {
    const adapter = PAYMENT_PROVIDER_ADAPTERS.find(
      (candidate) => candidate.channel === channel,
    )
    if (!adapter) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '不支持的支付渠道',
      )
    }
    return adapter
  }

  /**
   * 为创建订单读取当前配置对应的不可变版本及其材料。
   * 缺少、禁用或非当前版本均 fail closed，绝不从可变配置回退或补写版本行。
   */
  async getCurrentConfigVersionForCreateOrder(
    providerConfigId: number,
    configVersion: number,
  ): Promise<PaymentProviderCreateOrderRuntime> {
    const version = await this.db.query.paymentProviderConfigVersion.findFirst({
      where: {
        providerConfigId,
        configVersion,
      },
      columns: this.paymentProviderConfigVersionRuntimeColumns,
    })
    if (!version || !version.isActive || version.status !== 1) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付 provider 配置版本不可用',
      )
    }

    const adapterConfig =
      this.buildPaymentProviderConfigForOrderVersion(version)
    const credentialSnapshot =
      this.buildPaymentProviderCredentialSnapshot(version)
    const credentialMaterial = await this.resolveCreateOrderCredentialMaterial(
      version,
      adapterConfig,
    )
    return {
      id: version.id,
      configVersion: version.configVersion,
      configSnapshot: version.configSnapshot,
      credentialVersionRef: adapterConfig.credentialVersionRef,
      credentialSnapshot,
      adapterConfig,
      credentialMaterial,
    }
  }

  /**
   * 按订单保存的版本 ID 读取历史不可变版本。
   * 历史订单允许引用已轮换版本，但版本归属或版本号不一致时必须拒绝。
   */
  async getPaymentProviderConfigVersionForOrder(
    order: PaymentProviderOrderVersionReference,
  ): Promise<PaymentProviderConfigVersionRuntimeSnapshot> {
    if (order.providerConfigVersionId == null) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付订单缺少 provider 配置版本',
      )
    }
    const version = await this.db.query.paymentProviderConfigVersion.findFirst({
      where: { id: order.providerConfigVersionId },
      columns: this.paymentProviderConfigVersionRuntimeColumns,
    })
    if (
      !version ||
      version.providerConfigId !== order.providerConfigId ||
      version.configVersion !== order.providerConfigVersion
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付订单缺少有效的 provider 配置版本',
      )
    }
    return version
  }

  /** 从不可变版本快照还原适配器可消费的配置，避免读取可变 admin 配置。 */
  buildPaymentProviderConfigForOrderVersion(
    version: PaymentProviderConfigVersionRuntimeSnapshot,
  ): PaymentProviderAdapterConfig {
    const snapshot = this.asMetadata(version.configSnapshot)
    const credentialVersionRef = this.readRequiredSnapshotString(
      snapshot,
      'credentialVersionRef',
    )
    return {
      id: version.providerConfigId,
      channel: version.channel,
      appId: version.appId,
      mchId: version.mchId,
      notifyUrl: version.notifyUrl,
      returnUrl: version.returnUrl,
      credentialVersionRef,
      configMetadata: snapshot?.configMetadata ?? null,
      privateKeyRef: this.readSnapshotNullableString(snapshot, 'privateKeyRef'),
      publicKeyRef: this.readSnapshotNullableString(snapshot, 'publicKeyRef'),
      apiV3KeyRef: this.readSnapshotNullableString(snapshot, 'apiV3KeyRef'),
      appCertRef: this.readSnapshotNullableString(snapshot, 'appCertRef'),
      platformCertRef: this.readSnapshotNullableString(
        snapshot,
        'platformCertRef',
      ),
      rootCertRef: this.readSnapshotNullableString(snapshot, 'rootCertRef'),
    }
  }

  /** 按不可变版本解析下单所需的私钥、平台公钥、APIv3 key 与商户证书序列号。 */
  async resolveCreateOrderCredentialMaterial(
    version: PaymentProviderConfigVersionRuntimeSnapshot,
    config: PaymentProviderAdapterConfig,
  ): Promise<PaymentProviderCredentialMaterial> {
    const appPrivateCredential = await this.resolvePaymentCredentialByIdOrRef(
      version.appPrivateCredentialId,
      config.privateKeyRef,
    )
    const alipayPublicCredential = await this.resolvePaymentCredentialByIdOrRef(
      version.alipayPublicCredentialId,
      config.publicKeyRef,
    )
    const wechatApiV3Credential = await this.resolvePaymentCredentialByIdOrRef(
      version.wechatApiV3CredentialId,
      config.apiV3KeyRef,
    )
    const appCertificate = await this.resolvePaymentCertificateByIdOrRef(
      version.appCertificateId,
      config.appCertRef,
    )
    const metadata = this.asMetadata(config.configMetadata)

    return {
      alipayKeyType: this.readAlipayKeyType(appPrivateCredential?.metadata),
      alipayPublicKeyPem: this.resolvePaymentMaterialFromMetadata(
        alipayPublicCredential?.metadata,
        ['alipayPublicKeyPem', 'publicKeyPem'],
        ['alipayPublicKeyPemEnvKey', 'publicKeyPemEnvKey', 'materialEnvKey'],
      ),
      appPrivateKeyPem: this.resolvePaymentMaterialFromMetadata(
        appPrivateCredential?.metadata,
        ['appPrivateKeyPem', 'privateKeyPem', 'merchantPrivateKeyPem'],
        [
          'appPrivateKeyPemEnvKey',
          'privateKeyPemEnvKey',
          'merchantPrivateKeyPemEnvKey',
          'materialEnvKey',
        ],
      ),
      wechatApiV3Key: this.resolvePaymentMaterialFromMetadata(
        wechatApiV3Credential?.metadata,
        ['wechatApiV3Key', 'apiV3Key'],
        ['wechatApiV3KeyEnvKey', 'apiV3KeyEnvKey', 'materialEnvKey'],
      ),
      wechatMerchantSerialNo:
        this.readStringField(metadata ?? {}, 'wechatMerchantSerialNo') ??
        appCertificate?.serialNo ??
        undefined,
    }
  }

  /** 按订单保存的凭据 ID 与不可变配置引用解析验签材料。 */
  async resolvePaymentProviderCredentialMaterial(
    order: PaymentProviderOrderCredentialReference,
    config: PaymentProviderOrderCredentialConfig,
  ): Promise<PaymentProviderCredentialMaterial> {
    const metadata = this.asMetadata(config.configMetadata)
    const alipayPublicCredential = await this.resolvePaymentCredentialByIdOrRef(
      order.alipayPublicCredentialId,
      config.publicKeyRef,
    )
    const wechatApiV3Credential = await this.resolvePaymentCredentialByIdOrRef(
      order.wechatApiV3CredentialId,
      config.apiV3KeyRef,
    )
    const platformCertificate = await this.resolvePaymentCertificateByRef(
      config.platformCertRef,
    )

    return {
      alipayPublicKeyPem: this.resolvePaymentMaterialFromMetadata(
        alipayPublicCredential?.metadata,
        ['alipayPublicKeyPem', 'publicKeyPem'],
        ['alipayPublicKeyPemEnvKey', 'publicKeyPemEnvKey', 'materialEnvKey'],
      ),
      wechatApiV3Key: this.resolvePaymentMaterialFromMetadata(
        wechatApiV3Credential?.metadata,
        ['wechatApiV3Key', 'apiV3Key'],
        ['wechatApiV3KeyEnvKey', 'apiV3KeyEnvKey', 'materialEnvKey'],
      ),
      wechatPlatformPublicKeyPem: this.resolvePaymentMaterialFromMetadata(
        platformCertificate?.metadata,
        ['wechatPlatformPublicKeyPem', 'publicKeyPem', 'certificatePem'],
        [
          'wechatPlatformPublicKeyPemEnvKey',
          'publicKeyPemEnvKey',
          'certificatePemEnvKey',
          'materialEnvKey',
        ],
      ),
      wechatPlatformSerialNo:
        this.readStringField(metadata ?? {}, 'wechatPlatformSerialNo') ??
        platformCertificate?.serialNo ??
        undefined,
    }
  }

  /**
   * 查询微信通知解密可用的 APIv3 key 候选。
   * 序列号存在精确候选时只返回精确集合；否则按凭据 ID 升序返回全部候选，不做任意数量截断，确保轮换中的旧 key 不遗漏。
   */
  async getWechatNotifyCredentialMaterialCandidates(
    channel: PaymentChannelEnum,
    serialNumber?: PaymentProviderWechatPlatformSerialNumber,
  ): Promise<PaymentProviderWechatCredentialMaterial[]> {
    const credentials = await this.db
      .select(this.paymentProviderCredentialNotifyMaterialSelect)
      .from(this.paymentProviderCredential)
      .where(
        and(
          eq(this.paymentProviderCredential.channel, channel),
          eq(
            this.paymentProviderCredential.credentialType,
            PaymentProviderCredentialTypeEnum.WECHAT_API_V3_KEY,
          ),
        ),
      )
      .orderBy(asc(this.paymentProviderCredential.id))
    const requestedSerialNumber = serialNumber?.trim()
    const serialMatchedCredentials = requestedSerialNumber
      ? credentials.filter((credential) =>
          this.getWechatCredentialSerialNumbers(credential.metadata).includes(
            requestedSerialNumber,
          ),
        )
      : []
    const candidateCredentials =
      serialMatchedCredentials.length > 0
        ? serialMatchedCredentials
        : credentials

    return candidateCredentials
      .map((credential) => ({
        wechatApiV3Key: this.resolvePaymentMaterialFromMetadata(
          credential.metadata,
          ['wechatApiV3Key', 'apiV3Key'],
          ['wechatApiV3KeyEnvKey', 'apiV3KeyEnvKey', 'materialEnvKey'],
        ),
      }))
      .filter(
        (material): material is PaymentProviderWechatCredentialMaterial =>
          typeof material.wechatApiV3Key === 'string',
      )
  }

  // 由不可变版本列构建订单应持久化的凭据选择快照。
  private buildPaymentProviderCredentialSnapshot(
    version: PaymentProviderConfigVersionRuntimeSnapshot,
  ): PaymentProviderCredentialSnapshot {
    const providerCertificateIds = [
      version.appCertificateId,
      version.platformCertificateId,
      version.rootCertificateId,
    ].filter((id): id is number => typeof id === 'number')
    return {
      appPrivateCredentialId: version.appPrivateCredentialId,
      alipayPublicCredentialId: version.alipayPublicCredentialId,
      wechatApiV3CredentialId: version.wechatApiV3CredentialId,
      appCertificateId: version.appCertificateId,
      platformCertificateId: version.platformCertificateId,
      rootCertificateId: version.rootCertificateId,
      providerCertificateIds,
    }
  }

  // 优先按 ID 读取凭据，缺少 ID 时只允许读取不可变快照中的引用。
  private async resolvePaymentCredentialByIdOrRef(
    id: number | null,
    credentialRef: string | null,
  ): Promise<PaymentProviderCredentialMaterialSource | null> {
    if (id != null) {
      return (
        (await this.db.query.paymentProviderCredential.findFirst({
          where: { id },
          columns: this.paymentProviderCredentialMaterialColumns,
        })) ?? null
      )
    }
    if (!credentialRef) {
      return null
    }
    return (
      (await this.db.query.paymentProviderCredential.findFirst({
        where: { credentialRef },
        columns: this.paymentProviderCredentialMaterialColumns,
      })) ?? null
    )
  }

  // 优先按 ID 读取证书，缺少 ID 时只允许读取不可变快照中的引用。
  private async resolvePaymentCertificateByIdOrRef(
    id: number | null,
    certificateRef: string | null,
  ): Promise<PaymentProviderCertificateMaterialSource | null> {
    if (id != null) {
      return (
        (await this.db.query.paymentProviderCertificate.findFirst({
          where: { id },
          columns: this.paymentProviderCertificateMaterialColumns,
        })) ?? null
      )
    }
    return this.resolvePaymentCertificateByRef(certificateRef)
  }

  // 按不可变配置快照的证书引用读取证书材料。
  private async resolvePaymentCertificateByRef(
    certificateRef: string | null,
  ): Promise<PaymentProviderCertificateMaterialSource | null> {
    if (!certificateRef) {
      return null
    }
    return (
      (await this.db.query.paymentProviderCertificate.findFirst({
        where: { certificateRef },
        columns: this.paymentProviderCertificateMaterialColumns,
      })) ?? null
    )
  }

  // 从受控元数据字段或测试环境明文字段解析真实材料，生产环境不接受元数据明文。
  private resolvePaymentMaterialFromMetadata(
    metadata: unknown,
    materialFields: PaymentProviderMaterialFieldNames,
    envKeyFields: PaymentProviderMaterialFieldNames,
  ): string | undefined {
    const record = this.asMetadata(metadata)
    for (const envKeyField of envKeyFields) {
      const envKey = this.readStringField(record ?? {}, envKeyField)
      if (envKey && process.env[envKey]) {
        return process.env[envKey]
      }
    }
    if (process.env.NODE_ENV === 'test') {
      for (const materialField of materialFields) {
        const material = this.readStringField(record ?? {}, materialField)
        if (material) {
          return material
        }
      }
    }
    return undefined
  }

  // 读取支付宝私钥格式，未知格式留空并交由适配器 fail closed。
  private readAlipayKeyType(
    metadata: unknown,
  ): PaymentProviderCredentialMaterial['alipayKeyType'] {
    const keyType = this.readStringField(
      this.asMetadata(metadata) ?? {},
      'alipayKeyType',
    )
    return keyType === 'PKCS1' || keyType === 'PKCS8' ? keyType : undefined
  }

  // 从元数据中读取与微信平台证书对应的已知序列号。
  private getWechatCredentialSerialNumbers(metadata: unknown): string[] {
    const record = this.asMetadata(metadata) ?? {}
    const serialNumbers = [
      this.readStringField(record, 'wechatPlatformSerialNo'),
      this.readStringField(record, 'platformSerialNo'),
    ]
    return serialNumbers.filter(
      (serialNumber): serialNumber is string =>
        typeof serialNumber === 'string',
    )
  }

  // 将 JSON 边界收窄为对象元数据，数组和基础类型一律视为无效。
  private asMetadata(input: unknown): PaymentProviderMetadata | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null
    }
    return input as PaymentProviderMetadata
  }

  // 从元数据对象读取非空字符串，并统一去除首尾空白。
  private readStringField(
    input: PaymentProviderMetadata,
    field: string,
  ): string | null {
    const value = input[field]
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  // 从不可变快照读取可空字符串；字段缺失时保留 null 而不读取可变配置。
  private readSnapshotNullableString(
    snapshot: PaymentProviderMetadata | null,
    field: string,
  ): string | null {
    const value = snapshot?.[field]
    if (value === null) {
      return null
    }
    return typeof value === 'string' ? value : null
  }

  // 从不可变快照读取必须存在的凭据版本引用，缺失时拒绝继续执行。
  private readRequiredSnapshotString(
    snapshot: PaymentProviderMetadata | null,
    field: string,
  ): string {
    const value = this.readSnapshotNullableString(snapshot, field)
    if (!value) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付 provider 配置版本快照不完整',
      )
    }
    return value
  }
}
