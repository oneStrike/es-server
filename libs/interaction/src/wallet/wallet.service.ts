import type { PaymentOrderSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type { PaymentTx } from '../payment/types/payment.type'
import type { ConsumeForPurchaseInput } from './types/wallet.type'
import { DrizzleService, toPageResult } from '@db/core'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
} from '@libs/growth/growth-ledger/growth-ledger.constant'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { PageDto } from '@libs/platform/dto'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, Logger } from '@nestjs/common'
import { and, asc, eq, gte, ilike, lt } from 'drizzle-orm'
import { PaymentOrderService } from '../payment/payment-order.service'
import { PaymentOrderTypeEnum } from '../payment/payment.constant'
import {
  AdminCurrencyPackagePageItemDto,
  CreateCurrencyPackageDto,
  CreateCurrencyRechargeOrderDto,
  QueryAdminWalletLedgerDto,
  QueryCurrencyPackageDto,
  UpdateCurrencyPackageDto,
} from '../wallet/dto/wallet.dto'
import { READING_COIN_ASSET_KEY } from '../wallet/wallet.constant'

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name)

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly paymentOrderService: PaymentOrderService,
  ) {}

  // 获取当前请求使用的 Drizzle 查询实例。
  private get db() {
    return this.drizzle.db
  }

  // 获取虚拟币充值包表定义。
  private get currencyPackage() {
    return this.drizzle.schema.currencyPackage
  }

  // 后台充值包分页的稳定 contract。
  private buildCurrencyPackagePageSelect() {
    return {
      id: this.currencyPackage.id,
      packageKey: this.currencyPackage.packageKey,
      name: this.currencyPackage.name,
      price: this.currencyPackage.price,
      currencyAmount: this.currencyPackage.currencyAmount,
      bonusAmount: this.currencyPackage.bonusAmount,
      sortOrder: this.currencyPackage.sortOrder,
      isEnabled: this.currencyPackage.isEnabled,
      createdAt: this.currencyPackage.createdAt,
      updatedAt: this.currencyPackage.updatedAt,
    }
  }

  // 创建充值订单只需写入目标快照所依赖的字段。
  private buildEnabledCurrencyPackageForRechargeSelect() {
    return {
      id: this.currencyPackage.id,
      packageKey: this.currencyPackage.packageKey,
      price: this.currencyPackage.price,
      currencyAmount: this.currencyPackage.currencyAmount,
      bonusAmount: this.currencyPackage.bonusAmount,
    }
  }

  // 启用或停用虚拟币充值包。
  async updateCurrencyPackageStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.currencyPackage)
          .set({ isEnabled })
          .where(eq(this.currencyPackage.id, id)),
      { notFound: '充值包不存在' },
    )
    return true
  }

  // 更新虚拟币充值包。
  async updateCurrencyPackage(dto: UpdateCurrencyPackageDto) {
    const { id, ...data } = dto
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.currencyPackage)
          .set(data)
          .where(eq(this.currencyPackage.id, id)),
      { notFound: '充值包不存在', duplicate: '充值包业务键已存在' },
    )
    return true
  }

  // 创建虚拟币充值包。
  async createCurrencyPackage(dto: CreateCurrencyPackageDto) {
    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.currencyPackage).values(dto),
      { duplicate: '充值包业务键已存在' },
    )
    return true
  }

  // 分页查询后台虚拟币充值包配置。
  async getCurrencyPackagePage(dto: QueryCurrencyPackageDto) {
    const conditions: SQL[] = []
    const name = dto.name?.trim()
    if (name) {
      conditions.push(ilike(this.currencyPackage.name, `%${name}%`))
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.currencyPackage.isEnabled, dto.isEnabled))
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(
      dto.orderBy ?? JSON.stringify({ sortOrder: 'asc', id: 'asc' }),
      { table: this.currencyPackage },
    )
    const [list, total] = await Promise.all([
      this.db
        .select(this.buildCurrencyPackagePageSelect())
        .from(this.currencyPackage)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.currencyPackage, where),
    ])

    const pageItems: AdminCurrencyPackagePageItemDto[] = list.map((item) => ({
      id: item.id,
      packageKey: item.packageKey,
      name: item.name,
      price: item.price,
      currencyAmount: item.currencyAmount,
      bonusAmount: item.bonusAmount,
      sortOrder: item.sortOrder,
      isEnabled: item.isEnabled,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))

    return toPageResult(pageItems, total, page)
  }

  // 创建虚拟币充值支付订单。
  async createCurrencyRechargeOrder(
    userId: number,
    dto: CreateCurrencyRechargeOrderDto,
  ) {
    const [pack] = await this.db
      .select(this.buildEnabledCurrencyPackageForRechargeSelect())
      .from(this.currencyPackage)
      .where(
        and(
          eq(this.currencyPackage.id, dto.packageId),
          eq(this.currencyPackage.isEnabled, true),
        ),
      )
      .limit(1)
    if (!pack) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '充值包不存在或未启用',
      )
    }

    return this.paymentOrderService.createPaymentOrder(userId, {
      ...dto,
      orderType: PaymentOrderTypeEnum.CURRENCY_RECHARGE,
      targetId: pack.id,
      payableAmount: pack.price,
      targetSnapshot: {
        packageKey: pack.packageKey,
        currencyAmount: pack.currencyAmount,
        bonusAmount: pack.bonusAmount,
      },
    })
  }

  // 获取 App 可购买的虚拟币充值包列表。
  async getCurrencyPackageList() {
    return this.db
      .select({
        id: this.currencyPackage.id,
        name: this.currencyPackage.name,
        price: this.currencyPackage.price,
        currencyAmount: this.currencyPackage.currencyAmount,
        bonusAmount: this.currencyPackage.bonusAmount,
      })
      .from(this.currencyPackage)
      .where(eq(this.currencyPackage.isEnabled, true))
      .orderBy(
        asc(this.currencyPackage.sortOrder),
        asc(this.currencyPackage.id),
      )
  }

  // 结算虚拟币充值订单，实际余额写入统一收口在钱包域。
  async applyRechargeSettlement(tx: PaymentTx, order: PaymentOrderSelect) {
    const snapshot = this.getRechargeTargetSnapshot(order)
    if (!snapshot) {
      this.logger.error(
        `currency_recharge_settlement_missing_snapshot orderId=${order.id} orderNo=${order.orderNo} userId=${order.userId}`,
      )
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '充值订单快照缺失或非法',
      )
    }
    const grantAmount = snapshot.currencyAmount + snapshot.bonusAmount
    const result = await this.growthLedgerService.applyDelta(tx, {
      userId: order.userId,
      assetType: GrowthAssetTypeEnum.CURRENCY,
      assetKey: READING_COIN_ASSET_KEY,
      action: GrowthLedgerActionEnum.GRANT,
      amount: grantAmount,
      bizKey: `payment:${order.id}:currency`,
      source: 'payment_order',
      targetType: order.orderType,
      targetId: order.targetId,
      context: {
        orderNo: order.orderNo,
        providerTradeNo: order.providerTradeNo,
        packageKey: snapshot.packageKey,
        currencyAmount: snapshot.currencyAmount,
        bonusAmount: snapshot.bonusAmount,
      },
    })
    if (!result.success && !result.duplicated) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '虚拟币发放失败',
      )
    }
  }

  async getWalletLedgerPage(userId: number, dto: PageDto) {
    const table = this.drizzle.schema.growthLedgerRecord
    const pageParams = this.drizzle.buildPageParams(dto, {
      table,
      fallbackOrderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const conditions: SQL[] = [
      eq(table.userId, userId),
      eq(table.assetType, GrowthAssetTypeEnum.CURRENCY),
      eq(table.assetKey, READING_COIN_ASSET_KEY),
    ]
    if (pageParams.dateRange?.gte) {
      conditions.push(gte(table.createdAt, pageParams.dateRange.gte))
    }
    if (pageParams.dateRange?.lt) {
      conditions.push(lt(table.createdAt, pageParams.dateRange.lt))
    }
    const where = and(...conditions)
    const [rows, total] = await Promise.all([
      this.db
        .select({
          id: table.id,
          delta: table.delta,
          beforeValue: table.beforeValue,
          afterValue: table.afterValue,
          source: table.source,
          remark: table.remark,
          createdAt: table.createdAt,
        })
        .from(table)
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(table, where),
    ])
    const pageResult = toPageResult(rows, total, pageParams.page)

    return {
      ...pageResult,
      list: this.toWalletLedgerRecords(pageResult.list),
    }
  }

  async getAdminWalletLedgerPage(dto: QueryAdminWalletLedgerDto) {
    return this.getWalletLedgerPageByUser(dto.userId, dto)
  }

  // 章节购买扣减虚拟币余额，供 PurchaseService 在同一事务内调用。
  async consumeForPurchase(tx: PaymentTx, input: ConsumeForPurchaseInput) {
    const result = await this.growthLedgerService.applyDelta(tx, {
      userId: input.userId,
      assetType: GrowthAssetTypeEnum.CURRENCY,
      assetKey: READING_COIN_ASSET_KEY,
      action: GrowthLedgerActionEnum.CONSUME,
      amount: input.amount,
      bizKey: `purchase:${input.purchaseId}:consume`,
      source: 'purchase',
      targetType: input.targetType,
      targetId: input.targetId,
      context: {
        purchaseId: input.purchaseId,
        paymentMethod: input.paymentMethod,
        outTradeNo: input.outTradeNo,
      },
    })
    if (!result.success && !result.duplicated) {
      if (result.reason === 'insufficient_balance') {
        this.logger.warn(
          `purchase_failed_currency_not_enough userId=${input.userId} targetType=${input.targetType} targetId=${input.targetId} need=${input.amount}`,
        )
        throw new BusinessException(
          BusinessErrorCode.QUOTA_NOT_ENOUGH,
          '虚拟币余额不足',
        )
      }
      this.logger.warn(
        `purchase_failed_ledger_reject userId=${input.userId} targetType=${input.targetType} targetId=${input.targetId} reason=${result.reason ?? 'unknown'}`,
      )
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '虚拟币扣减失败，请稍后重试',
      )
    }
    return result
  }

  private async getWalletLedgerPageByUser(userId: number, dto: PageDto) {
    const table = this.drizzle.schema.growthLedgerRecord
    const pageParams = this.drizzle.buildPageParams(dto, {
      table,
      fallbackOrderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const where = and(
      eq(table.userId, userId),
      eq(table.assetType, GrowthAssetTypeEnum.CURRENCY),
      eq(table.assetKey, READING_COIN_ASSET_KEY),
      pageParams.dateRange?.gte
        ? gte(table.createdAt, pageParams.dateRange.gte)
        : undefined,
      pageParams.dateRange?.lt
        ? lt(table.createdAt, pageParams.dateRange.lt)
        : undefined,
    )
    const [list, total] = await Promise.all([
      this.db
        .select({
          id: table.id,
          delta: table.delta,
          beforeValue: table.beforeValue,
          afterValue: table.afterValue,
          source: table.source,
          remark: table.remark,
          createdAt: table.createdAt,
        })
        .from(table)
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(table, where),
    ])

    return toPageResult(
      this.toWalletLedgerRecords(list),
      total,
      pageParams.page,
    )
  }

  private toWalletLedgerRecords(
    list: Array<{
      id: number
      delta: number
      beforeValue: number
      afterValue: number
      source: string
      remark: string | null
      createdAt: Date
    }>,
  ) {
    return list.map((item) => ({
      id: item.id,
      action:
        item.delta >= 0
          ? GrowthLedgerActionEnum.GRANT
          : GrowthLedgerActionEnum.CONSUME,
      amount: Math.abs(item.delta),
      beforeValue: item.beforeValue,
      afterValue: item.afterValue,
      source: item.source,
      remark: item.remark ?? null,
      createdAt: item.createdAt,
    }))
  }

  private getRechargeTargetSnapshot(order: PaymentOrderSelect) {
    const context = order.clientContext
    if (!context || typeof context !== 'object' || Array.isArray(context)) {
      return undefined
    }
    const targetSnapshot = (context as Record<string, unknown>).targetSnapshot
    if (
      !targetSnapshot ||
      typeof targetSnapshot !== 'object' ||
      Array.isArray(targetSnapshot)
    ) {
      return undefined
    }
    const snapshot = targetSnapshot as Record<string, unknown>
    if (
      typeof snapshot.packageKey !== 'string' ||
      typeof snapshot.currencyAmount !== 'number' ||
      typeof snapshot.bonusAmount !== 'number' ||
      snapshot.currencyAmount <= 0 ||
      snapshot.bonusAmount < 0
    ) {
      return undefined
    }
    return {
      packageKey: snapshot.packageKey,
      currencyAmount: snapshot.currencyAmount,
      bonusAmount: snapshot.bonusAmount,
    }
  }
}
