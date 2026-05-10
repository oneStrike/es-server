import type {
  PaymentOrderSelect,
  PaymentProviderConfigSelect,
} from '@db/schema'
import type {
  CreatePaymentOrderInput,
  PaymentOrderPublicResult,
} from '../payment/types/payment.type'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, Logger } from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { CreatePaymentOrderBaseDto } from '../payment/dto/payment.dto'
import { PAYMENT_PROVIDER_ADAPTERS } from '../payment/payment-provider.adapter'
import {
  PaymentOrderStatusEnum,
  PaymentOrderTypeEnum,
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

  // 创建支付订单并在同一事务中写入客户端支付参数，避免半成品 pending 订单。
  async createPaymentOrder(userId: number, input: CreatePaymentOrderInput) {
    this.assertPaymentSceneContext(input)
    const config = await this.resolvePaymentProviderConfig(input)
    const subscriptionMode =
      input.subscriptionMode ?? PaymentSubscriptionModeEnum.ONE_TIME
    if (
      input.orderType !== PaymentOrderTypeEnum.VIP_SUBSCRIPTION &&
      subscriptionMode !== PaymentSubscriptionModeEnum.ONE_TIME
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '非 VIP 订单不支持订阅模式',
      )
    }
    if (
      subscriptionMode !== PaymentSubscriptionModeEnum.ONE_TIME &&
      !config.supportsAutoRenew
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前支付配置不支持自动续费',
      )
    }
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

    return this.drizzle.withTransaction(async (tx) => {
      const [order] = await tx
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
          providerConfigVersion: config.configVersion,
          credentialVersionRef: config.credentialVersionRef,
          configSnapshot: this.buildProviderConfigSnapshot(config),
          clientContext,
        })
        .returning()

      const adapter = this.getPaymentAdapter(input.channel)
      const clientPayPayload = adapter.createOrder({
        order,
        config,
        sceneContext: input,
      })
      const updatedRows = await tx
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
    })
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
      agreementNotifyUrl: config.agreementNotifyUrl,
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
      supportsAutoRenew: config.supportsAutoRenew,
    }
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
}
