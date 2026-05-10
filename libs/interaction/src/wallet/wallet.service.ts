import type { PaymentOrderSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type { PaymentTx } from '../payment/types/payment.type'
import type { ConsumeForPurchaseInput } from './types/wallet.type'
import { DrizzleService } from '@db/core'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
} from '@libs/growth/growth-ledger/growth-ledger.constant'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, Logger } from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { PaymentOrderService } from '../payment/payment-order.service'
import { PaymentOrderTypeEnum } from '../payment/payment.constant'
import {
  CreateCurrencyPackageDto,
  CreateCurrencyRechargeOrderDto,
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
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.currencyPackage.isEnabled, dto.isEnabled))
    }
    return this.drizzle.ext.findPagination(this.currencyPackage, {
      ...dto,
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: dto.orderBy ?? JSON.stringify({ sortOrder: 'asc', id: 'asc' }),
    })
  }

  // 创建虚拟币充值支付订单。
  async createCurrencyRechargeOrder(
    userId: number,
    dto: CreateCurrencyRechargeOrderDto,
  ) {
    const [pack] = await this.db
      .select()
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
      .select()
      .from(this.currencyPackage)
      .where(eq(this.currencyPackage.isEnabled, true))
      .orderBy(
        asc(this.currencyPackage.sortOrder),
        asc(this.currencyPackage.id),
      )
  }

  // 结算虚拟币充值订单，实际余额写入统一收口在钱包域。
  async applyRechargeSettlement(tx: PaymentTx, order: PaymentOrderSelect) {
    const [pack] = await tx
      .select()
      .from(this.currencyPackage)
      .where(eq(this.currencyPackage.id, order.targetId))
      .limit(1)
    if (!pack) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '充值包不存在',
      )
    }
    const grantAmount = pack.currencyAmount + pack.bonusAmount
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
        currencyAmount: pack.currencyAmount,
        bonusAmount: pack.bonusAmount,
      },
    })
    if (!result.success && !result.duplicated) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '虚拟币发放失败',
      )
    }
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
}
