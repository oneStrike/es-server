import type {
  AdminPaymentReconciliationPageItemDto,
  QueryPaymentReconciliationDto,
  RepairPaidPaymentOrderDto,
} from './dto/payment.dto'
import type {
  PaymentReconciliationConditions,
  PaymentReconciliationEvidence,
  PaymentReconciliationPageSource,
  PaymentRepairReconciliationSnapshot,
} from './types/payment-reconciliation.type'
import { DrizzleService, toPageResult } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { buildDateOnlyRangeInAppTimeZone } from '@libs/platform/utils'
import { Injectable, Logger } from '@nestjs/common'
import { and, eq, gte, lt } from 'drizzle-orm'
import { redactPaymentSensitiveRecord } from './payment-sensitive-data.helper'
import { PaymentSettlementService } from './payment-settlement.service'
import {
  PaymentOrderStatusEnum,
  PaymentReconciliationMismatchTypeEnum,
  PaymentReconciliationStatusEnum,
} from './payment.constant'

/**
 * 支付对账用例只读取对账记录并执行已审计的修复编排。
 * 支付状态、钱包和会员履约仍由 PaymentSettlementService 的唯一事务拥有。
 */
@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name)

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly settlementService: PaymentSettlementService,
  ) {}

  // 获取当前请求使用的 Drizzle 查询实例。
  private get db() {
    return this.drizzle.db
  }

  // 获取支付对账记录表定义。
  private get paymentReconciliationRecord() {
    return this.drizzle.schema.paymentReconciliationRecord
  }

  /** 分页查询支付对账记录，并只输出已脱敏的审计证据。 */
  async getPaymentReconciliationPage(dto: QueryPaymentReconciliationDto) {
    const conditions = this.buildPaymentReconciliationConditions(dto)
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(
      dto.orderBy ?? JSON.stringify({ createdAt: 'desc', id: 'desc' }),
      { table: this.paymentReconciliationRecord },
    )
    const [list, total] = await Promise.all([
      this.db
        .select({
          id: this.paymentReconciliationRecord.id,
          createdAt: this.paymentReconciliationRecord.createdAt,
          updatedAt: this.paymentReconciliationRecord.updatedAt,
          paymentOrderId: this.paymentReconciliationRecord.paymentOrderId,
          orderNo: this.paymentReconciliationRecord.orderNo,
          channel: this.paymentReconciliationRecord.channel,
          mismatchType: this.paymentReconciliationRecord.mismatchType,
          status: this.paymentReconciliationRecord.status,
          localStatus: this.paymentReconciliationRecord.localStatus,
          providerStatus: this.paymentReconciliationRecord.providerStatus,
          providerTradeNo: this.paymentReconciliationRecord.providerTradeNo,
          localAmount: this.paymentReconciliationRecord.localAmount,
          providerAmount: this.paymentReconciliationRecord.providerAmount,
          currency: this.paymentReconciliationRecord.currency,
          evidence: this.paymentReconciliationRecord.evidence,
          handledRemark: this.paymentReconciliationRecord.handledRemark,
        })
        .from(this.paymentReconciliationRecord)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.paymentReconciliationRecord, where),
    ])
    return toPageResult(
      list.map((record) => this.toPaymentReconciliationPageItem(record)),
      total,
      page,
    )
  }

  /**
   * 将已核对的 provider 已支付差异记录修复为本地已支付。
   * 修复原因和脱敏证据必须先写入通知载荷，实际状态推进始终委托给结算服务。
   */
  async repairPaidOrder(dto: RepairPaidPaymentOrderDto, adminUserId: number) {
    const reason = dto.reason.trim()
    if (!reason) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '异常修复必须填写原因',
      )
    }
    const evidence = this.sanitizeRepairEvidence(dto.evidence)
    const record = await this.resolveRepairReconciliationRecord(dto)
    const result = await this.settlementService.confirmPaymentOrderManually(
      {
        orderNo: record.orderNo,
        paidAmount: record.providerAmount ?? 0,
        providerTradeNo: record.providerTradeNo ?? '',
        notifyPayload: {
          source: 'admin_repair_paid',
          adminUserId,
          reason,
          evidence,
          reconciliationRecordId: record.id,
          providerStatus: record.providerStatus,
        },
      },
      async ({ tx }) => {
        await tx
          .update(this.paymentReconciliationRecord)
          .set({
            status: PaymentReconciliationStatusEnum.REPAIRED,
            handledRemark: reason,
          })
          .where(eq(this.paymentReconciliationRecord.id, record.id))
      },
    )
    this.logger.log(
      `payment_order_repair_paid orderNo=${record.orderNo} adminUserId=${adminUserId} reconciliationRecordId=${record.id}`,
    )
    return result
  }

  // 读取并严格核验可修复的 provider 已支付对账记录。
  private async resolveRepairReconciliationRecord(
    dto: RepairPaidPaymentOrderDto,
  ): Promise<PaymentRepairReconciliationSnapshot> {
    const record = await this.db.query.paymentReconciliationRecord.findFirst({
      where: { id: dto.reconciliationRecordId },
      columns: {
        id: true,
        orderNo: true,
        mismatchType: true,
        status: true,
        localStatus: true,
        providerStatus: true,
        providerTradeNo: true,
        providerAmount: true,
      },
    })
    if (
      !record ||
      record.orderNo !== dto.orderNo ||
      record.mismatchType !==
        PaymentReconciliationMismatchTypeEnum.LOCAL_PENDING_PROVIDER_PAID ||
      record.status !== PaymentReconciliationStatusEnum.PENDING ||
      record.localStatus !== PaymentOrderStatusEnum.PENDING ||
      record.providerAmount !== dto.paidAmount ||
      record.providerTradeNo !== dto.providerTradeNo ||
      !record.providerTradeNo ||
      !this.isProviderPaidStatus(record.providerStatus)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '异常修复必须绑定匹配的 provider 已支付对账记录',
      )
    }
    return record
  }

  // 构建支付对账分页的精确查询条件。
  private buildPaymentReconciliationConditions(
    dto: QueryPaymentReconciliationDto,
  ): PaymentReconciliationConditions {
    const conditions: PaymentReconciliationConditions = []
    if (dto.orderNo !== undefined) {
      conditions.push(eq(this.paymentReconciliationRecord.orderNo, dto.orderNo))
    }
    if (dto.channel !== undefined) {
      conditions.push(eq(this.paymentReconciliationRecord.channel, dto.channel))
    }
    if (dto.mismatchType !== undefined) {
      conditions.push(
        eq(this.paymentReconciliationRecord.mismatchType, dto.mismatchType),
      )
    }
    if (dto.status !== undefined) {
      conditions.push(eq(this.paymentReconciliationRecord.status, dto.status))
    }
    if (dto.providerTradeNo !== undefined) {
      conditions.push(
        eq(
          this.paymentReconciliationRecord.providerTradeNo,
          dto.providerTradeNo,
        ),
      )
    }
    const dateRange = buildDateOnlyRangeInAppTimeZone(
      dto.startDate,
      dto.endDate,
    )
    if (dateRange?.gte) {
      conditions.push(
        gte(this.paymentReconciliationRecord.createdAt, dateRange.gte),
      )
    }
    if (dateRange?.lt) {
      conditions.push(
        lt(this.paymentReconciliationRecord.createdAt, dateRange.lt),
      )
    }
    return conditions
  }

  // 将对账记录映射为管理端页面项，并保持证据字段脱敏。
  private toPaymentReconciliationPageItem(
    record: PaymentReconciliationPageSource,
  ): AdminPaymentReconciliationPageItemDto {
    return {
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      paymentOrderId: record.paymentOrderId ?? null,
      orderNo: record.orderNo,
      channel: record.channel,
      mismatchType: record.mismatchType,
      status: record.status,
      localStatus: record.localStatus,
      providerStatus: record.providerStatus,
      providerTradeNo: record.providerTradeNo ?? null,
      localAmount: record.localAmount,
      providerAmount: record.providerAmount ?? null,
      currency: record.currency,
      evidence: this.sanitizePublicRecord(record.evidence),
      handledRemark: record.handledRemark ?? null,
      repairPaidAvailable:
        record.status === PaymentReconciliationStatusEnum.PENDING &&
        record.mismatchType ===
          PaymentReconciliationMismatchTypeEnum.LOCAL_PENDING_PROVIDER_PAID &&
        record.localStatus === PaymentOrderStatusEnum.PENDING,
      refundExecutionAvailable: false,
    }
  }

  // 脱敏后台修复证据，防止凭据与签名类字段进入审计展示。
  private sanitizeRepairEvidence(
    evidence: PaymentReconciliationEvidence,
  ): PaymentReconciliationEvidence {
    return this.redactSensitiveRecord(this.sanitizePublicRecord(evidence) ?? {})
  }

  // 判断 provider 对账状态是否代表已支付完成。
  private isProviderPaidStatus(status: string): boolean {
    return ['success', 'trade_success', 'trade_finished', 'paid'].includes(
      status.trim().toLowerCase(),
    )
  }

  // 将开放 JSON 证据收窄为对象并脱敏，数组与基础类型不对外展示。
  private sanitizePublicRecord(
    input: unknown,
  ): PaymentReconciliationEvidence | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null
    }
    return this.redactSensitiveRecord(input as PaymentReconciliationEvidence)
  }

  // 遮蔽记录中可能包含 secret、证书、签名或 token 的值。
  private redactSensitiveRecord(
    input: PaymentReconciliationEvidence,
  ): PaymentReconciliationEvidence {
    return redactPaymentSensitiveRecord(input)
  }
}
