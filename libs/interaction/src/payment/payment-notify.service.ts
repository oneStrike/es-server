import type {
  PaymentNotifyEventFailedInput,
  PaymentNotifyEventOrderSnapshot,
  PaymentNotifyEventProcessedInput,
  PaymentNotifyEventResolution,
  PaymentNotifyEventResolutionInput,
  PaymentNotifyEventSnapshot,
  PaymentNotifyOrderSnapshot,
  PaymentNotifyPersistInput,
  PaymentNotifyRedactedPayload,
  PaymentProviderNotifyPayload,
  ProviderPaymentNotifyRequest,
} from './types/payment-notify.type'
import type { PaymentProviderAdapter } from './types/payment.type'
import { createHash } from 'node:crypto'
import {
  acquireIntegrityLocks,
  DrizzleService,
  exclusiveIntegrityLock,
  relationIntegrityLock,
} from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq, notInArray } from 'drizzle-orm'
import { PaymentProviderRuntimeService } from './payment-provider-runtime.service'
import {
  redactPaymentSensitiveRecord,
  sanitizePaymentSensitiveError,
} from './payment-sensitive-data.helper'
import { PaymentSettlementService } from './payment-settlement.service'
import {
  PaymentChannelEnum,
  PaymentNotifyEventTypeEnum,
  PaymentNotifyProcessStatusEnum,
  PaymentNotifyVerifyStatusEnum,
  PaymentOrderStatusEnum,
} from './payment.constant'

/**
 * Provider 通知用例只负责原生载荷验签、幂等事件和调用结算。
 * HTTP ACK 由 app transport adapter 生成，订单、钱包、会员状态只由结算服务推进。
 */
@Injectable()
export class PaymentNotifyService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly runtime: PaymentProviderRuntimeService,
    private readonly settlementService: PaymentSettlementService,
  ) {}

  // 获取当前请求使用的 Drizzle 查询实例。
  private get db() {
    return this.drizzle.db
  }

  // 获取支付订单表定义。
  private get paymentOrder() {
    return this.drizzle.schema.paymentOrder
  }

  // 获取支付通知幂等事件表定义。
  private get paymentNotifyEvent() {
    return this.drizzle.schema.paymentNotifyEvent
  }

  // 复用通知事件去重和状态迁移所需的最小投影，避免查询敏感审计载荷。
  private get paymentNotifyEventColumns() {
    return {
      id: true,
      payloadHash: true,
      processStatus: true,
      providerEventId: true,
      verifyStatus: true,
    } as const
  }

  // 获取通知验签和结算需要的订单最小投影。
  private get paymentNotifyOrderColumns() {
    return {
      id: true,
      orderNo: true,
      channel: true,
      paymentScene: true,
      subscriptionMode: true,
      status: true,
      payableAmount: true,
      paidAmount: true,
      providerConfigId: true,
      providerConfigVersionId: true,
      providerConfigVersion: true,
      alipayPublicCredentialId: true,
      wechatApiV3CredentialId: true,
      credentialVersionRef: true,
      providerTradeNo: true,
      orderType: true,
      targetId: true,
      userId: true,
    } as const
  }

  /**
   * 处理已到达的 provider 原生通知。
   * 成功时只返回 void；transport 层根据渠道写入精确 ACK，失败会更新同一幂等事件后继续抛出错误。
   */
  async handleProviderPaymentNotify(
    input: ProviderPaymentNotifyRequest,
  ): Promise<void> {
    const adapter = this.runtime.getPaymentAdapter(input.channel)
    const payloadHash = this.buildProviderNotifyPayloadHash(input)
    let notifyEvent: PaymentNotifyEventSnapshot | undefined
    let order: PaymentNotifyOrderSnapshot | null = null
    let orderNo: string | undefined
    let providerTradeNo: string | undefined
    let verified = false

    notifyEvent = await this.createPaymentNotifyEvent(input, payloadHash)
    try {
      orderNo = await this.resolveProviderNotifyOrderNo(input, adapter)
      if (!orderNo) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '支付通知缺少站内订单号',
        )
      }
      order =
        (await this.db.query.paymentOrder.findFirst({
          where: { orderNo },
          columns: this.paymentNotifyOrderColumns,
        })) ?? null
      if (!order || order.channel !== input.channel) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '支付订单不存在',
        )
      }
      await this.markPaymentNotifyEventOrder(input.channel, payloadHash, order)

      const version =
        await this.runtime.getPaymentProviderConfigVersionForOrder(order)
      const config =
        this.runtime.buildPaymentProviderConfigForOrderVersion(version)
      const credentialMaterial =
        await this.runtime.resolvePaymentProviderCredentialMaterial(
          order,
          config,
        )
      const notifyPayload = this.buildProviderNotifyPayload(input)
      const adapterInput = {
        order,
        config,
        credentialMaterial,
        payload: notifyPayload,
      }
      if (!adapter.verifyNotify(adapterInput)) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '支付通知验签失败',
        )
      }
      verified = true
      const parsed = adapter.parseNotify(adapterInput)
      const providerEventId = parsed.providerEventId
      providerTradeNo = parsed.providerTradeNo
      const paidAmount = parsed.paidAmount
      if (!providerTradeNo || paidAmount === undefined) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '支付通知缺少已验签交易字段',
        )
      }
      const verifiedProviderTradeNo = providerTradeNo
      if (paidAmount !== order.payableAmount) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '支付通知金额与订单不一致',
        )
      }
      const eventResolution = await this.resolveVerifiedPaymentNotifyEvent({
        channel: input.channel,
        currentEvent: notifyEvent,
        order,
        providerEventId,
        providerTradeNo: verifiedProviderTradeNo,
      })
      const selectedNotifyEvent = eventResolution.event
      notifyEvent = selectedNotifyEvent
      if (eventResolution.shouldAcknowledge) {
        return
      }
      if (
        order.status !== PaymentOrderStatusEnum.PENDING &&
        order.status !== PaymentOrderStatusEnum.PAID
      ) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '当前订单状态不允许支付通知确认',
        )
      }

      await this.settlementService.settleVerifiedPayment({
        order,
        paidAmount,
        providerTradeNo: verifiedProviderTradeNo,
        notifyPayload: this.redactProviderNotifyPayload(input.body.raw),
        stateConflictMessage: '当前订单状态不允许支付通知确认',
        afterPersist: async (settlement) =>
          this.persistVerifiedPaymentNotifyEvents({
            duplicateEventId: eventResolution.duplicateEventId,
            settlement,
            selectedNotifyEvent,
            verifiedProviderTradeNo,
          }),
      })
    } catch (error) {
      if (notifyEvent) {
        await this.markPaymentNotifyEventFailed({
          error,
          eventId: notifyEvent.id,
          order,
          orderNo,
          providerTradeNo,
          verified,
        })
      }
      throw error
    }
  }

  // 组合 body、headers、query 和原始 body，保持 provider adapter 的验签输入完整。
  private buildProviderNotifyPayload(
    input: ProviderPaymentNotifyRequest,
  ): PaymentProviderNotifyPayload {
    return {
      body: input.body.raw,
      headers: input.headers.raw,
      query: input.query.raw,
      rawBody: input.rawBody,
    }
  }

  // 以渠道和稳定通知原文生成幂等哈希；headers 易变，缺少原文时只序列化 body 和 query。
  private buildProviderNotifyPayloadHash(
    input: ProviderPaymentNotifyRequest,
  ): string {
    const payloadSource =
      input.rawBody ??
      this.stringifyStableProviderNotifyPayload({
        body: input.body.raw,
        query: input.query.raw,
      })
    return createHash('sha256')
      .update(String(input.channel))
      .update('\n')
      .update(payloadSource)
      .digest('hex')
  }

  // 稳定序列化 JSON 兼容通知载荷，确保键顺序不影响幂等事件。
  private stringifyStableProviderNotifyPayload(input: unknown): string {
    if (input === null) {
      return 'null'
    }
    if (Array.isArray(input)) {
      return `[${input
        .map((item) => this.stringifyStableProviderNotifyPayload(item))
        .join(',')}]`
    }
    if (typeof input === 'object') {
      const entries = Object.entries(input as Record<string, unknown>)
        .filter(([, value]) => value !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
      return `{${entries
        .map(
          ([key, value]) =>
            `${JSON.stringify(key)}:${this.stringifyStableProviderNotifyPayload(value)}`,
        )
        .join(',')}}`
    }
    if (
      typeof input === 'string' ||
      typeof input === 'number' ||
      typeof input === 'boolean'
    ) {
      return JSON.stringify(input)
    }
    return JSON.stringify(String(input))
  }

  // 在验签前建立或复用同一渠道和同一载荷哈希的幂等事件。
  private async createPaymentNotifyEvent(
    input: ProviderPaymentNotifyRequest,
    payloadHash: string,
  ): Promise<PaymentNotifyEventSnapshot> {
    await this.db
      .insert(this.paymentNotifyEvent)
      .values({
        channel: input.channel,
        eventType: PaymentNotifyEventTypeEnum.PROVIDER,
        payloadHash,
        headers: this.redactProviderNotifyPayload(input.headers.raw),
        redactedPayload: this.redactProviderNotifyPayload({
          ...input.body.raw,
          query: input.query.raw,
          rawBody: input.rawBody ? '[RAW_BODY_PRESENT]' : null,
        }),
        verifyStatus: PaymentNotifyVerifyStatusEnum.PENDING,
        processStatus: PaymentNotifyProcessStatusEnum.PENDING,
      })
      .onConflictDoNothing()
    const event = await this.db.query.paymentNotifyEvent.findFirst({
      where: { channel: input.channel, payloadHash },
      columns: this.paymentNotifyEventColumns,
    })
    if (!event) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付通知事件创建失败',
      )
    }
    return event
  }

  // 将已定位订单关联到同一通知事件，便于失败与重试审计。
  private async markPaymentNotifyEventOrder(
    channel: PaymentChannelEnum,
    payloadHash: string,
    order: PaymentNotifyEventOrderSnapshot,
  ): Promise<void> {
    await this.db
      .update(this.paymentNotifyEvent)
      .set({ orderNo: order.orderNo, paymentOrderId: order.id })
      .where(
        and(
          eq(this.paymentNotifyEvent.channel, channel),
          eq(this.paymentNotifyEvent.payloadHash, payloadHash),
        ),
      )
  }

  // 在结算事务内将唯一通知事件标记为首次处理成功或重复确认。
  private async markPaymentNotifyEventProcessed(
    input: PaymentNotifyEventProcessedInput,
  ): Promise<void> {
    await input.tx
      .update(this.paymentNotifyEvent)
      .set({
        eventType: PaymentNotifyEventTypeEnum.PAYMENT,
        errorCode: null,
        errorMessage: null,
        orderNo: input.order.orderNo,
        paymentOrderId: input.order.id,
        processStatus: input.isDuplicate
          ? PaymentNotifyProcessStatusEnum.DUPLICATE
          : PaymentNotifyProcessStatusEnum.PROCESSED,
        processedAt: new Date(),
        providerTradeNo: input.providerTradeNo,
        verifyStatus: PaymentNotifyVerifyStatusEnum.SUCCESS,
      })
      .where(eq(this.paymentNotifyEvent.id, input.eventId))
  }

  // 在结算事务内完成 canonical 事件，并将同 provider 事件的当前 payload 同步落为重复终态。
  private async persistVerifiedPaymentNotifyEvents(
    input: PaymentNotifyPersistInput,
  ): Promise<void> {
    const order = input.settlement.result.order
    await this.markPaymentNotifyEventProcessed({
      tx: input.settlement.tx,
      eventId: input.selectedNotifyEvent.id,
      order,
      providerTradeNo: input.verifiedProviderTradeNo,
      isDuplicate: input.settlement.result.isDuplicate,
    })
    if (!input.duplicateEventId) {
      return
    }
    await this.markPaymentNotifyEventProcessed({
      tx: input.settlement.tx,
      eventId: input.duplicateEventId,
      order,
      providerTradeNo: input.verifiedProviderTradeNo,
      isDuplicate: true,
    })
  }

  // 在事务回滚或验签失败后更新同一幂等事件，完成状态绝不允许被覆盖。
  private async markPaymentNotifyEventFailed(
    input: PaymentNotifyEventFailedInput,
  ): Promise<void> {
    await this.db
      .update(this.paymentNotifyEvent)
      .set({
        errorCode:
          input.error instanceof BusinessException
            ? String(input.error.code)
            : 'UNKNOWN',
        errorMessage: this.sanitizePaymentNotifyError(input.error),
        orderNo: input.order?.orderNo ?? input.orderNo ?? null,
        paymentOrderId: input.order?.id ?? null,
        processStatus: PaymentNotifyProcessStatusEnum.FAILED,
        processedAt: new Date(),
        providerTradeNo: input.providerTradeNo ?? null,
        verifyStatus: input.verified
          ? PaymentNotifyVerifyStatusEnum.SUCCESS
          : PaymentNotifyVerifyStatusEnum.FAILED,
      })
      .where(
        and(
          eq(this.paymentNotifyEvent.id, input.eventId),
          notInArray(this.paymentNotifyEvent.processStatus, [
            PaymentNotifyProcessStatusEnum.PROCESSED,
            PaymentNotifyProcessStatusEnum.DUPLICATE,
          ]),
        ),
      )
  }

  // 将已验签通知绑定到唯一 provider 事件；已完成事件只确认 ACK，不得再次结算或回写失败。
  private async resolveVerifiedPaymentNotifyEvent(
    input: PaymentNotifyEventResolutionInput,
  ): Promise<PaymentNotifyEventResolution> {
    if (this.isCompletedPaymentNotifyEvent(input.currentEvent)) {
      return { event: input.currentEvent, shouldAcknowledge: true }
    }
    const providerEventId = input.providerEventId
    if (!providerEventId) {
      return { event: input.currentEvent, shouldAcknowledge: false }
    }
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [
          exclusiveIntegrityLock(
            relationIntegrityLock(
              'payment-notify-provider-event',
              input.channel,
              providerEventId,
            ),
          ),
        ])
        const currentEvent = await tx.query.paymentNotifyEvent.findFirst({
          where: { id: input.currentEvent.id },
          columns: this.paymentNotifyEventColumns,
        })
        if (!currentEvent) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '支付通知事件不存在',
          )
        }
        if (this.isCompletedPaymentNotifyEvent(currentEvent)) {
          return { event: currentEvent, shouldAcknowledge: true }
        }
        const providerEvent = await tx.query.paymentNotifyEvent.findFirst({
          where: {
            channel: input.channel,
            providerEventId,
          },
          columns: this.paymentNotifyEventColumns,
        })
        if (!providerEvent || providerEvent.id === currentEvent.id) {
          if (currentEvent.providerEventId !== providerEventId) {
            await tx
              .update(this.paymentNotifyEvent)
              .set({ providerEventId })
              .where(eq(this.paymentNotifyEvent.id, currentEvent.id))
          }
          return {
            event: { ...currentEvent, providerEventId },
            shouldAcknowledge: false,
          }
        }
        if (this.isCompletedPaymentNotifyEvent(providerEvent)) {
          await tx
            .update(this.paymentNotifyEvent)
            .set({
              eventType: PaymentNotifyEventTypeEnum.PAYMENT,
              orderNo: input.order.orderNo,
              paymentOrderId: input.order.id,
              processStatus: PaymentNotifyProcessStatusEnum.DUPLICATE,
              processedAt: new Date(),
              providerTradeNo: input.providerTradeNo,
              verifyStatus: PaymentNotifyVerifyStatusEnum.SUCCESS,
            })
            .where(eq(this.paymentNotifyEvent.id, currentEvent.id))
          return {
            event: {
              ...currentEvent,
              processStatus: PaymentNotifyProcessStatusEnum.DUPLICATE,
              verifyStatus: PaymentNotifyVerifyStatusEnum.SUCCESS,
            },
            shouldAcknowledge: true,
          }
        }
        await tx
          .update(this.paymentNotifyEvent)
          .set({
            errorCode: null,
            errorMessage: null,
            eventType: PaymentNotifyEventTypeEnum.PAYMENT,
            orderNo: input.order.orderNo,
            paymentOrderId: input.order.id,
            processStatus: PaymentNotifyProcessStatusEnum.PENDING,
            processedAt: null,
            providerTradeNo: input.providerTradeNo,
            verifyStatus: PaymentNotifyVerifyStatusEnum.SUCCESS,
          })
          .where(eq(this.paymentNotifyEvent.id, providerEvent.id))
        return {
          duplicateEventId: currentEvent.id,
          event: providerEvent,
          shouldAcknowledge: false,
        }
      },
    })
  }

  // 只有验签成功且已完成结算或已确认重复的事件才可以直接返回 provider ACK。
  private isCompletedPaymentNotifyEvent(
    event: PaymentNotifyEventSnapshot,
  ): boolean {
    return (
      event.verifyStatus === PaymentNotifyVerifyStatusEnum.SUCCESS &&
      (event.processStatus === PaymentNotifyProcessStatusEnum.PROCESSED ||
        event.processStatus === PaymentNotifyProcessStatusEnum.DUPLICATE)
    )
  }

  // 将内部异常转为可审计文本，并删除可能泄漏的凭据相关片段。
  private sanitizePaymentNotifyError(error: unknown): string {
    return sanitizePaymentSensitiveError(error)
  }

  // 先从明文通知定位订单号；微信加密通知再按受控 APIv3 key 候选逐个解密。
  private async resolveProviderNotifyOrderNo(
    input: ProviderPaymentNotifyRequest,
    adapter: PaymentProviderAdapter,
  ): Promise<string | undefined> {
    const payload = this.buildProviderNotifyPayload(input)
    const directOrderNo = adapter.extractNotifyOrderNo({ payload })
    if (directOrderNo) {
      return directOrderNo
    }
    if (input.channel !== PaymentChannelEnum.WECHAT) {
      return undefined
    }
    const candidates =
      await this.runtime.getWechatNotifyCredentialMaterialCandidates(
        input.channel,
      )
    for (const credentialMaterial of candidates) {
      const orderNo = adapter.extractNotifyOrderNo({
        credentialMaterial,
        payload,
      })
      if (orderNo) {
        return orderNo
      }
    }
    return undefined
  }

  // 脱敏通知对象的密钥、证书与签名字段，保留必要的审计结构。
  private redactProviderNotifyPayload(
    payload: PaymentNotifyRedactedPayload,
  ): PaymentNotifyRedactedPayload {
    return redactPaymentSensitiveRecord(payload)
  }
}
