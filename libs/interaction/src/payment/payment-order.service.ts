import type {
  PaymentOrderSelect,
  PaymentProviderCertificateSelect,
  PaymentProviderConfigSelect,
  PaymentProviderCredentialSelect,
} from '@db/schema'
import type {
  CreatePaymentOrderInput,
  PaymentOrderPublicResult,
  PaymentProviderCredentialMaterial,
} from '../payment/types/payment.type'
import process from 'node:process'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, Logger } from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { CreatePaymentOrderBaseDto } from '../payment/dto/payment.dto'
import { PAYMENT_PROVIDER_ADAPTERS } from '../payment/payment-provider.adapter'
import {
  PaymentOrderStatusEnum,
  PaymentSceneEnum,
  PaymentSubscriptionModeEnum,
} from '../payment/payment.constant'

@Injectable()
export class PaymentOrderService {
  private readonly logger = new Logger(PaymentOrderService.name)

  constructor(private readonly drizzle: DrizzleService) {}

  // 获取支付订单表定义。
  private get paymentOrder() {
    return this.drizzle.schema.paymentOrder
  }

  // 获取当前请求使用的 Drizzle 查询实例。
  private get db() {
    return this.drizzle.db
  }

  // 获取支付 provider 配置表定义。
  private get paymentProviderConfig() {
    return this.drizzle.schema.paymentProviderConfig
  }

  // 获取支付 provider 配置不可变版本表定义。
  private get paymentProviderConfigVersion() {
    return this.drizzle.schema.paymentProviderConfigVersion
  }

  // 获取支付 provider 凭据表定义。
  private get paymentProviderCredential() {
    return this.drizzle.schema.paymentProviderCredential
  }

  // 获取支付 provider 证书表定义。
  private get paymentProviderCertificate() {
    return this.drizzle.schema.paymentProviderCertificate
  }

  // 创建支付订单并写入 provider 原生客户端支付参数。
  async createPaymentOrder(userId: number, input: CreatePaymentOrderInput) {
    this.assertPaymentSceneContext(input)
    const subscriptionMode =
      input.subscriptionMode ?? PaymentSubscriptionModeEnum.ONE_TIME
    if (subscriptionMode !== PaymentSubscriptionModeEnum.ONE_TIME) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付订单仅支持一次性支付',
      )
    }
    const config = await this.resolvePaymentProviderConfig(input)
    this.assertPaymentReturnUrlAllowed(input.returnUrl, config)
    const credentialSnapshot = this.readPaymentProviderSelectionSnapshot(config)
    const configVersion = await this.ensurePaymentProviderConfigVersion(
      config,
      credentialSnapshot,
    )
    const credentialMaterial = await this.resolveCreateOrderCredentialMaterial(
      config,
      credentialSnapshot,
    )
    const orderNo = this.generateOrderNo()
    const clientAppKey = this.normalizeKey(input.clientAppKey)
    const clientContext = {
      platform: input.platform,
      environment: input.environment,
      clientAppKey,
      appId: this.normalizeKey(input.appId),
      mchId: this.normalizeKey(input.mchId),
      openId: input.openId,
      terminalIp: input.terminalIp,
      returnUrl: input.returnUrl,
      targetSnapshot: input.targetSnapshot,
    }

    const [order] = await this.db
      .insert(this.paymentOrder)
      .values({
        orderNo,
        userId,
        orderType: input.orderType,
        channel: input.channel,
        paymentScene: input.paymentScene,
        platform: input.platform,
        environment: input.environment,
        clientAppKey,
        subscriptionMode,
        status: PaymentOrderStatusEnum.PENDING,
        payableAmount: input.payableAmount,
        targetId: input.targetId,
        providerConfigId: config.id,
        providerConfigVersionId: configVersion.id,
        providerConfigVersion: config.configVersion,
        appPrivateCredentialId: credentialSnapshot.appPrivateCredentialId,
        alipayPublicCredentialId: credentialSnapshot.alipayPublicCredentialId,
        wechatApiV3CredentialId: credentialSnapshot.wechatApiV3CredentialId,
        providerCertificateIds: credentialSnapshot.providerCertificateIds,
        credentialVersionRef: config.credentialVersionRef,
        configSnapshot: this.buildProviderConfigSnapshot(config),
        clientContext,
      })
      .returning()

    const adapter = this.getPaymentAdapter(input.channel)
    const clientPayPayload = await adapter.createOrder({
      credentialMaterial,
      order,
      config,
      sceneContext: input,
    })
    const updatedRows = await this.db
      .update(this.paymentOrder)
      .set({ clientPayPayload })
      .where(eq(this.paymentOrder.id, order.id))
      .returning({ id: this.paymentOrder.id })
    if (!updatedRows[0]) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '支付订单不存在',
      )
    }
    return this.toPaymentOrderResult(order, clientPayPayload)
  }

  // 将支付订单行映射为 App 公开支付结果，禁止透出 provider 内部字段。
  private toPaymentOrderResult(
    order: PaymentOrderSelect,
    clientPayPayload: Record<string, unknown>,
  ): PaymentOrderPublicResult {
    return {
      orderNo: order.orderNo,
      orderType: order.orderType,
      status: order.status,
      subscriptionMode: order.subscriptionMode,
      payableAmount: order.payableAmount,
      clientPayPayload,
    }
  }

  // 获取指定支付渠道的 provider 适配器。
  private getPaymentAdapter(channel: number) {
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

  // 构建不含明文密钥的 provider 配置快照。
  private buildProviderConfigSnapshot(config: PaymentProviderConfigSelect) {
    return {
      channel: config.channel,
      paymentScene: config.paymentScene,
      platform: config.platform,
      environment: config.environment,
      clientAppKey: config.clientAppKey,
      configName: config.configName,
      appId: config.appId,
      mchId: config.mchId,
      notifyUrl: config.notifyUrl,
      returnUrl: config.returnUrl,
      allowedReturnDomains: config.allowedReturnDomains,
      certMode: config.certMode,
      publicKeyRef: config.publicKeyRef,
      privateKeyRef: config.privateKeyRef,
      apiV3KeyRef: config.apiV3KeyRef,
      appCertRef: config.appCertRef,
      platformCertRef: config.platformCertRef,
      rootCertRef: config.rootCertRef,
      configVersion: config.configVersion,
      credentialVersionRef: config.credentialVersionRef,
      configMetadata: config.configMetadata,
    }
  }

  private async ensurePaymentProviderConfigVersion(
    config: PaymentProviderConfigSelect,
    credentialSnapshot: ReturnType<
      PaymentOrderService['readPaymentProviderSelectionSnapshot']
    >,
  ) {
    const existing =
      await this.db.query.paymentProviderConfigVersion.findFirst({
        where: {
          configVersion: config.configVersion,
          providerConfigId: config.id,
        },
      })
    if (existing) {
      return existing
    }

    const [created] = await this.db
      .insert(this.paymentProviderConfigVersion)
      .values({
        alipayPublicCredentialId: credentialSnapshot.alipayPublicCredentialId,
        allowedReturnDomains: config.allowedReturnDomains,
        appCertificateId: credentialSnapshot.appCertificateId,
        appId: config.appId,
        appPrivateCredentialId: credentialSnapshot.appPrivateCredentialId,
        certMode: config.certMode,
        channel: config.channel,
        clientAppKey: config.clientAppKey,
        configName: config.configName,
        configSnapshot: this.buildProviderConfigSnapshot(config),
        configVersion: config.configVersion,
        credentialSnapshot: this.buildCredentialSnapshot(
          config,
          credentialSnapshot,
        ),
        environment: config.environment,
        isActive: config.isEnabled,
        mchId: config.mchId,
        notifyUrl: config.notifyUrl,
        paymentScene: config.paymentScene,
        platform: config.platform,
        platformCertificateId: credentialSnapshot.platformCertificateId,
        providerConfigId: config.id,
        returnUrl: config.returnUrl,
        rootCertificateId: credentialSnapshot.rootCertificateId,
        status: config.isEnabled ? 1 : 2,
        updatedAt: new Date(),
        wechatApiV3CredentialId: credentialSnapshot.wechatApiV3CredentialId,
      })
      .onConflictDoNothing()
      .returning()
    if (created) {
      return created
    }
    const raced = await this.db.query.paymentProviderConfigVersion.findFirst({
      where: {
        configVersion: config.configVersion,
        providerConfigId: config.id,
      },
    })
    if (!raced) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '支付 provider 配置版本不可用',
      )
    }
    return raced
  }

  private buildCredentialSnapshot(
    config: PaymentProviderConfigSelect,
    credentialSnapshot: ReturnType<
      PaymentOrderService['readPaymentProviderSelectionSnapshot']
    >,
  ) {
    return {
      alipayPublicCredentialId: credentialSnapshot.alipayPublicCredentialId,
      apiV3KeyRef: config.apiV3KeyRef,
      appCertRef: config.appCertRef,
      appCertificateId: credentialSnapshot.appCertificateId,
      appPrivateCredentialId: credentialSnapshot.appPrivateCredentialId,
      credentialVersionRef: config.credentialVersionRef,
      platformCertRef: config.platformCertRef,
      platformCertificateId: credentialSnapshot.platformCertificateId,
      privateKeyRef: config.privateKeyRef,
      publicKeyRef: config.publicKeyRef,
      rootCertRef: config.rootCertRef,
      rootCertificateId: credentialSnapshot.rootCertificateId,
      wechatApiV3CredentialId: credentialSnapshot.wechatApiV3CredentialId,
    }
  }

  private async resolveCreateOrderCredentialMaterial(
    config: PaymentProviderConfigSelect,
    credentialSnapshot: ReturnType<
      PaymentOrderService['readPaymentProviderSelectionSnapshot']
    >,
  ): Promise<PaymentProviderCredentialMaterial> {
    const appPrivateCredential = await this.resolvePaymentCredentialByIdOrRef(
      credentialSnapshot.appPrivateCredentialId,
      config.privateKeyRef,
    )
    const alipayPublicCredential = await this.resolvePaymentCredentialByIdOrRef(
      credentialSnapshot.alipayPublicCredentialId,
      config.publicKeyRef,
    )
    const wechatApiV3Credential = await this.resolvePaymentCredentialByIdOrRef(
      credentialSnapshot.wechatApiV3CredentialId,
      config.apiV3KeyRef,
    )
    const appCertificate = await this.resolvePaymentCertificateByIdOrRef(
      credentialSnapshot.appCertificateId,
      config.appCertRef,
    )
    const metadata = this.asRecord(config.configMetadata)

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
        appCertificate?.serialNo,
    }
  }

  private async resolvePaymentCredentialByIdOrRef(
    id: number | null,
    credentialRef: string | null,
  ): Promise<PaymentProviderCredentialSelect | null> {
    if (id != null) {
      return (
        (await this.db.query.paymentProviderCredential.findFirst({
          where: { id },
        })) ?? null
      )
    }
    if (!credentialRef) {
      return null
    }
    return (
      (await this.db.query.paymentProviderCredential.findFirst({
        where: { credentialRef },
      })) ?? null
    )
  }

  private async resolvePaymentCertificateByIdOrRef(
    id: number | null,
    certificateRef: string | null,
  ): Promise<PaymentProviderCertificateSelect | null> {
    if (id != null) {
      return (
        (await this.db.query.paymentProviderCertificate.findFirst({
          where: { id },
        })) ?? null
      )
    }
    if (!certificateRef) {
      return null
    }
    return (
      (await this.db.query.paymentProviderCertificate.findFirst({
        where: { certificateRef },
      })) ?? null
    )
  }

  private resolvePaymentMaterialFromMetadata(
    metadata: unknown,
    materialFields: string[],
    envKeyFields: string[],
  ) {
    const record = this.asRecord(metadata)
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

  private readAlipayKeyType(metadata: unknown) {
    const keyType = this.readStringField(
      this.asRecord(metadata) ?? {},
      'alipayKeyType',
    )
    return keyType === 'PKCS1' || keyType === 'PKCS8' ? keyType : undefined
  }

  // 标准化可选业务键，空值统一落为空字符串。
  private normalizeKey(input?: string | null) {
    return input?.trim() ?? ''
  }

  // 生成站内支付订单号。
  private generateOrderNo() {
    const now = new Date()
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
      String(now.getMilliseconds()).padStart(3, '0'),
    ].join('')
    return `PAY${timestamp}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`
  }

  // 按客户端场景解析唯一可用的支付 provider 配置。
  private async resolvePaymentProviderConfig(input: CreatePaymentOrderBaseDto) {
    const candidates = await this.db
      .select()
      .from(this.paymentProviderConfig)
      .where(
        and(
          eq(this.paymentProviderConfig.channel, input.channel),
          eq(this.paymentProviderConfig.paymentScene, input.paymentScene),
          eq(this.paymentProviderConfig.platform, input.platform),
          eq(this.paymentProviderConfig.environment, input.environment),
          eq(
            this.paymentProviderConfig.clientAppKey,
            this.normalizeKey(input.clientAppKey),
          ),
          eq(this.paymentProviderConfig.appId, this.normalizeKey(input.appId)),
          eq(this.paymentProviderConfig.mchId, this.normalizeKey(input.mchId)),
          eq(this.paymentProviderConfig.isEnabled, true),
        ),
      )
      .orderBy(
        asc(this.paymentProviderConfig.sortOrder),
        asc(this.paymentProviderConfig.id),
      )
      .limit(2)

    if (candidates.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付 provider 配置缺失或未启用',
      )
    }
    if (candidates.length > 1) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '支付 provider 配置冲突',
      )
    }
    return candidates[0]
  }

  // 校验不同支付场景所需的客户端上下文字段。
  private assertPaymentSceneContext(input: CreatePaymentOrderBaseDto) {
    if (input.paymentScene === PaymentSceneEnum.H5 && !input.returnUrl) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'H5 支付必须提供 returnUrl',
      )
    }
    if (input.paymentScene === PaymentSceneEnum.MINI_PROGRAM && !input.openId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '小程序支付必须提供 openId',
      )
    }
  }

  private assertPaymentReturnUrlAllowed(
    returnUrl: string | null | undefined,
    config: PaymentProviderConfigSelect,
  ) {
    if (config.paymentScene !== PaymentSceneEnum.H5) {
      return
    }
    if (!returnUrl) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'H5 支付必须提供 returnUrl',
      )
    }
    const allowedDomains = this.toStringArray(config.allowedReturnDomains)
      .map((domain) => this.normalizeAllowedReturnDomain(domain))
      .filter((domain): domain is string => typeof domain === 'string')
    if (allowedDomains.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'H5 支付 returnUrl 允许域名未配置',
      )
    }

    const parsedUrl = this.parseReturnUrl(returnUrl)
    const host = parsedUrl.hostname.toLowerCase()
    const matched = allowedDomains.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    )
    if (!matched) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'H5 支付 returnUrl 不在允许域名内',
      )
    }
  }

  private parseReturnUrl(returnUrl: string) {
    try {
      const parsedUrl = new URL(returnUrl)
      if (
        !['http:', 'https:'].includes(parsedUrl.protocol) ||
        parsedUrl.username ||
        parsedUrl.password
      ) {
        throw new Error('invalid returnUrl')
      }
      return parsedUrl
    } catch {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'H5 支付 returnUrl 格式不正确',
      )
    }
  }

  private normalizeAllowedReturnDomain(domain: string) {
    const trimmed = domain.trim().toLowerCase()
    if (!trimmed) {
      return null
    }
    try {
      return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
        .hostname
    } catch {
      return trimmed.replace(/^\./, '')
    }
  }

  private readPaymentProviderSelectionSnapshot(
    config: PaymentProviderConfigSelect,
  ) {
    const metadata = this.asRecord(config.configMetadata)
    const credentialOptions = this.asRecord(metadata?.credentialOptions)
    const certificateOptions = this.asRecord(metadata?.certificateOptions)
    const appCertificateId = this.readSelectionId(
      certificateOptions,
      'appCertificateId',
    )
    const platformCertificateId = this.readSelectionId(
      certificateOptions,
      'platformCertificateId',
    )
    const rootCertificateId = this.readSelectionId(
      certificateOptions,
      'rootCertificateId',
    )

    return {
      alipayPublicCredentialId: this.readSelectionId(
        credentialOptions,
        'publicKeyCredentialId',
      ),
      appCertificateId,
      appPrivateCredentialId:
        this.readSelectionId(credentialOptions, 'privateKeyCredentialId') ??
        this.readSelectionId(credentialOptions, 'credentialOptionId'),
      platformCertificateId,
      providerCertificateIds: [
        appCertificateId,
        platformCertificateId,
        rootCertificateId,
      ].filter((id): id is number => typeof id === 'number'),
      rootCertificateId,
      wechatApiV3CredentialId: this.readSelectionId(
        credentialOptions,
        'apiV3KeyCredentialId',
      ),
    }
  }

  private readSelectionId(
    options: Record<string, unknown> | null,
    field: string,
  ) {
    const value = this.asRecord(options?.[field])?.id
    return typeof value === 'number' ? value : null
  }

  private readStringField(input: Record<string, unknown>, field: string) {
    const value = input[field]
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  private asRecord(input: unknown): Record<string, unknown> | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null
    }
    return input as Record<string, unknown>
  }

  private toStringArray(input: unknown) {
    if (!Array.isArray(input)) {
      return []
    }
    return input.filter((item): item is string => typeof item === 'string')
  }
}
