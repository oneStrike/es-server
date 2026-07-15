import type {
  CreatePaymentOrderInput,
  PaymentOrderPublicResult,
} from '../payment/types/payment.type'
import type {
  PaymentOrderCreateSnapshot,
  PaymentOrderPublicResultSource,
  PaymentProviderConfigOrderSnapshot,
} from './types/payment-order.type'
import {
  acquireIntegrityLocks,
  DrizzleService,
  sharedIntegrityLock,
  tableIntegrityLock,
} from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { CreatePaymentOrderBaseDto } from '../payment/dto/payment.dto'
import {
  PaymentOrderStatusEnum,
  PaymentSceneEnum,
  PaymentSubscriptionModeEnum,
} from '../payment/payment.constant'
import { PaymentProviderRuntimeService } from './payment-provider-runtime.service'

@Injectable()
export class PaymentOrderService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly paymentProviderRuntimeService: PaymentProviderRuntimeService,
  ) {}

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

  // 获取创建订单后需要回传和调用适配器的最小订单投影。
  private get paymentOrderCreateSnapshotSelect() {
    return {
      id: this.paymentOrder.id,
      orderNo: this.paymentOrder.orderNo,
      orderType: this.paymentOrder.orderType,
      channel: this.paymentOrder.channel,
      paymentScene: this.paymentOrder.paymentScene,
      subscriptionMode: this.paymentOrder.subscriptionMode,
      status: this.paymentOrder.status,
      payableAmount: this.paymentOrder.payableAmount,
      providerConfigId: this.paymentOrder.providerConfigId,
      credentialVersionRef: this.paymentOrder.credentialVersionRef,
    } as const
  }

  // 获取按场景匹配当前可用配置所需的最小字段投影。
  private get paymentProviderConfigOrderSelect() {
    return {
      id: this.paymentProviderConfig.id,
      paymentScene: this.paymentProviderConfig.paymentScene,
      allowedReturnDomains: this.paymentProviderConfig.allowedReturnDomains,
      configVersion: this.paymentProviderConfig.configVersion,
    } as const
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

    const { order, runtime } = await this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [
          sharedIntegrityLock(
            tableIntegrityLock('payment_provider_config', config.id),
          ),
        ])
        const activeConfig = await tx.query.paymentProviderConfig.findFirst({
          where: {
            configVersion: config.configVersion,
            id: config.id,
            isEnabled: true,
          },
          columns: { id: true },
        })
        if (!activeConfig) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '支付 provider 配置已冻结或已轮换，请重新发起下单',
          )
        }
        const runtime =
          await this.paymentProviderRuntimeService.getCurrentConfigVersionForCreateOrder(
            config.id,
            config.configVersion,
          )
        const credentialSnapshot = runtime.credentialSnapshot
        const [order]: PaymentOrderCreateSnapshot[] = await tx
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
            providerConfigVersionId: runtime.id,
            providerConfigVersion: runtime.configVersion,
            appPrivateCredentialId: credentialSnapshot.appPrivateCredentialId,
            alipayPublicCredentialId:
              credentialSnapshot.alipayPublicCredentialId,
            wechatApiV3CredentialId: credentialSnapshot.wechatApiV3CredentialId,
            providerCertificateIds: credentialSnapshot.providerCertificateIds,
            credentialVersionRef: runtime.credentialVersionRef,
            configSnapshot: runtime.configSnapshot,
            clientContext,
          })
          .returning(this.paymentOrderCreateSnapshotSelect)
        if (!order) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '支付订单创建失败',
          )
        }
        return { order, runtime }
      },
    })

    const adapter = this.paymentProviderRuntimeService.getPaymentAdapter(
      input.channel,
    )
    const clientPayPayload = await adapter.createOrder({
      credentialMaterial: runtime.credentialMaterial,
      order,
      config: runtime.adapterConfig,
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
    order: PaymentOrderPublicResultSource,
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
    const candidates: PaymentProviderConfigOrderSnapshot[] = await this.db
      .select(this.paymentProviderConfigOrderSelect)
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

  // 校验 H5 returnUrl 的域名位于当前配置白名单。
  private assertPaymentReturnUrlAllowed(
    returnUrl: string | null | undefined,
    config: Pick<
      PaymentProviderConfigOrderSnapshot,
      'allowedReturnDomains' | 'paymentScene'
    >,
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

  // 解析并限制 returnUrl 为无认证信息的 HTTP(S) 地址。
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

  // 规范化允许域名，兼容配置中填写域名或完整 URL 的情况。
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

  // 从 JSON 字段读取非空字符串数组。
  private toStringArray(input: unknown) {
    if (!Array.isArray(input)) {
      return []
    }
    return input.filter((item): item is string => typeof item === 'string')
  }
}
