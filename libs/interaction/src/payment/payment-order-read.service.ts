import type { SQL } from 'drizzle-orm'
import type {
  AdminPaymentOrderPageItemDto,
  QueryPaymentOrderDto,
} from './dto/payment.dto'
import type {
  AdminPaymentOrderPageSource,
  AppPaymentOrderStatusSource,
  PaymentProviderAccountLabelOrderSource,
} from './types/payment-order.type'
import type { PaymentOrderStatusResult } from './types/payment.type'
import { DrizzleService, toPageResult } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { buildDateOnlyRangeInAppTimeZone } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import { and, eq, gte, lt } from 'drizzle-orm'

/** 支付订单的后台分页与 App 自助查询 read-model owner。 */
@Injectable()
export class PaymentOrderReadService {
  constructor(private readonly drizzle: DrizzleService) {}

  // 获取当前请求使用的 Drizzle 查询实例。
  private get db() {
    return this.drizzle.db
  }

  // 获取支付订单表定义。
  private get paymentOrder() {
    return this.drizzle.schema.paymentOrder
  }

  // 分页查询后台支付订单，不返回内部 provider 配置或原始通知。
  async getPaymentOrderPage(dto: QueryPaymentOrderDto) {
    const conditions = this.buildPaymentOrderConditions(dto)
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const pageQuery = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(
      dto.orderBy ?? JSON.stringify({ createdAt: 'desc', id: 'desc' }),
      { table: this.paymentOrder },
    )
    const [list, total] = await Promise.all([
      this.db
        .select({
          id: this.paymentOrder.id,
          createdAt: this.paymentOrder.createdAt,
          updatedAt: this.paymentOrder.updatedAt,
          orderNo: this.paymentOrder.orderNo,
          userId: this.paymentOrder.userId,
          orderType: this.paymentOrder.orderType,
          channel: this.paymentOrder.channel,
          paymentScene: this.paymentOrder.paymentScene,
          platform: this.paymentOrder.platform,
          environment: this.paymentOrder.environment,
          clientAppKey: this.paymentOrder.clientAppKey,
          subscriptionMode: this.paymentOrder.subscriptionMode,
          status: this.paymentOrder.status,
          payableAmount: this.paymentOrder.payableAmount,
          paidAmount: this.paymentOrder.paidAmount,
          targetId: this.paymentOrder.targetId,
          providerConfigId: this.paymentOrder.providerConfigId,
          providerConfigVersion: this.paymentOrder.providerConfigVersion,
          configSnapshot: this.paymentOrder.configSnapshot,
          providerTradeNo: this.paymentOrder.providerTradeNo,
          paidAt: this.paymentOrder.paidAt,
          closedAt: this.paymentOrder.closedAt,
          refundedAt: this.paymentOrder.refundedAt,
        })
        .from(this.paymentOrder)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.paymentOrder, where),
    ])
    const page = toPageResult(list, total, pageQuery)
    return {
      ...page,
      list: page.list.map((order) => this.toAdminPaymentOrderPageItem(order)),
    }
  }

  // 查询当前用户自己的支付订单状态，订单归属不符时统一按不存在处理。
  async getAppPaymentOrderStatus(
    userId: number,
    orderNo: string,
  ): Promise<PaymentOrderStatusResult> {
    const order = await this.db.query.paymentOrder.findFirst({
      where: { orderNo },
      columns: {
        userId: true,
        orderNo: true,
        status: true,
        orderType: true,
        channel: true,
        paymentScene: true,
        payableAmount: true,
        paidAmount: true,
        paidAt: true,
        closedAt: true,
        clientPayPayload: true,
      },
    })
    if (!order || order.userId !== userId) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '支付订单不存在',
      )
    }
    return this.toAppPaymentOrderStatus(order)
  }

  // 构建后台支付订单分页的可组合查询条件。
  private buildPaymentOrderConditions(dto: QueryPaymentOrderDto) {
    const conditions: SQL[] = []
    if (dto.orderNo !== undefined) {
      conditions.push(eq(this.paymentOrder.orderNo, dto.orderNo))
    }
    if (dto.userId !== undefined) {
      conditions.push(eq(this.paymentOrder.userId, dto.userId))
    }
    if (dto.orderType !== undefined) {
      conditions.push(eq(this.paymentOrder.orderType, dto.orderType))
    }
    if (dto.status !== undefined) {
      conditions.push(eq(this.paymentOrder.status, dto.status))
    }
    if (dto.providerTradeNo !== undefined) {
      conditions.push(
        eq(this.paymentOrder.providerTradeNo, dto.providerTradeNo),
      )
    }
    if (dto.channel !== undefined) {
      conditions.push(eq(this.paymentOrder.channel, dto.channel))
    }
    if (dto.paymentScene !== undefined) {
      conditions.push(eq(this.paymentOrder.paymentScene, dto.paymentScene))
    }
    if (dto.platform !== undefined) {
      conditions.push(eq(this.paymentOrder.platform, dto.platform))
    }
    if (dto.environment !== undefined) {
      conditions.push(eq(this.paymentOrder.environment, dto.environment))
    }
    if (dto.clientAppKey !== undefined) {
      conditions.push(
        eq(this.paymentOrder.clientAppKey, this.normalizeKey(dto.clientAppKey)),
      )
    }
    if (dto.providerConfigId !== undefined) {
      conditions.push(
        eq(this.paymentOrder.providerConfigId, dto.providerConfigId),
      )
    }
    const dateRange = buildDateOnlyRangeInAppTimeZone(
      dto.startDate,
      dto.endDate,
    )
    if (dateRange?.gte) {
      conditions.push(gte(this.paymentOrder.createdAt, dateRange.gte))
    }
    if (dateRange?.lt) {
      conditions.push(lt(this.paymentOrder.createdAt, dateRange.lt))
    }
    return conditions
  }

  // 将订单行映射为后台分页视图，禁止透出原始上下文和 provider payload。
  private toAdminPaymentOrderPageItem(
    order: AdminPaymentOrderPageSource,
  ): AdminPaymentOrderPageItemDto {
    return {
      id: order.id,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      orderNo: order.orderNo,
      userId: order.userId,
      orderType: order.orderType,
      channel: order.channel,
      paymentScene: order.paymentScene,
      platform: order.platform,
      environment: order.environment,
      clientAppKey: order.clientAppKey,
      subscriptionMode: order.subscriptionMode,
      status: order.status,
      payableAmount: order.payableAmount,
      paidAmount: order.paidAmount,
      targetId: order.targetId,
      providerConfigId: order.providerConfigId,
      providerAccountLabel: this.buildPaymentProviderAccountLabel(order),
      providerConfigVersionLabel: this.buildProviderConfigVersionLabel(
        order.providerConfigVersion,
      ),
      providerTradeNo: order.providerTradeNo ?? null,
      paidAt: order.paidAt ?? null,
      closedAt: order.closedAt ?? null,
      refundedAt: order.refundedAt ?? null,
    }
  }

  // 将归属校验后的订单行映射为 App 只读状态。
  private toAppPaymentOrderStatus(
    order: AppPaymentOrderStatusSource,
  ): PaymentOrderStatusResult {
    return {
      orderNo: order.orderNo,
      status: order.status,
      orderType: order.orderType,
      channel: order.channel,
      scene: order.paymentScene,
      payableAmount: order.payableAmount,
      paidAmount: order.paidAmount > 0 ? order.paidAmount : null,
      currency: 'CNY',
      expireAt: null,
      paidAt: order.paidAt ?? null,
      closedAt: order.closedAt ?? null,
      clientPayPayload: this.toSafeClientPayPayload(order.clientPayPayload),
    }
  }

  // 从下单时配置快照恢复展示名，当前配置轮换不得影响历史订单展示。
  private buildPaymentProviderAccountLabel(
    source: PaymentProviderAccountLabelOrderSource,
  ) {
    const snapshot = this.asRecord(source.configSnapshot)
    const configName = this.readStringField(snapshot, 'configName')
    const appId = this.readStringField(snapshot, 'appId')
    const mchId = this.readStringField(snapshot, 'mchId')
    const name = configName || `支付账号 ${source.providerConfigId}`
    const maskedAccount = this.maskIdentifier(mchId || appId)
    return maskedAccount ? `${name} / ${maskedAccount}` : name
  }

  // 格式化历史订单固化的 provider 配置版本。
  private buildProviderConfigVersionLabel(version: number) {
    return `配置版本 v${version}`
  }

  // 过滤客户端支付参数中的内部配置与敏感材料字段。
  private toSafeClientPayPayload(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null
    }
    const unsafeKeys = new Set([
      'privateKey',
      'apiV3Key',
      'certificate',
      'providerConfigId',
      'providerConfigVersion',
      'credentialVersionRef',
      'publicKeyRef',
      'privateKeyRef',
      'apiV3KeyRef',
    ])
    const source = payload as Record<string, unknown>
    const safePayload: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(source)) {
      if (!unsafeKeys.has(key)) {
        safePayload[key] = value
      }
    }
    return safePayload
  }

  // 将开放 JSON 快照收窄为对象，避免数组进入账户标签解析。
  private asRecord(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return {}
    }
    return input as Record<string, unknown>
  }

  // 从开放配置快照读取非空字符串展示字段。
  private readStringField(input: Record<string, unknown>, field: string) {
    const value = input[field]
    return typeof value === 'string' && value.trim() ? value.trim() : ''
  }

  // 标准化筛选用客户端应用键，和配置选择逻辑保持一致。
  private normalizeKey(input?: string | null) {
    return input?.trim() ?? ''
  }

  // 掩码 provider 账号，仅保留末四位供后台核对。
  private maskIdentifier(value?: string | null) {
    const normalized = value?.trim()
    if (!normalized) {
      return ''
    }
    if (normalized.length <= 4) {
      return '****'
    }
    return `****${normalized.slice(-4)}`
  }
}
