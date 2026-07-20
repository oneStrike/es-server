import type { IntegrityLockRequest } from '@db/core'
import type { LevelPurchasePricing } from '@libs/growth/level-rule/level-rule.type'
import type { DiscountCouponReservationResult } from '../coupon/types/coupon.type'
import type { PurchaseContentPort } from './types/purchase-content-port.type'
import type { PreparedPurchaseAttempt } from './types/purchase.type'
import {
  acquireIntegrityLocks,
  buildSafeDatabaseDiagnostic,
  DrizzleService,
  PostgresErrorCode,
} from '@db/core'
import { UserLevelRuleService } from '@libs/growth/level-rule/level-rule.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { CouponRedemptionTargetTypeEnum } from '../coupon/coupon.constant'
import { CouponService } from '../coupon/coupon.service'
import { WalletService } from '../wallet/wallet.service'
import {
  PurchaseTargetCommandDto,
  QueryPurchasedWorkChapterCommandDto,
  QueryPurchasedWorkCommandDto,
} from './dto/purchase.dto'
import { PURCHASE_CONTENT_PORT } from './purchase-content.port'
import {
  PaymentMethodEnum,
  PurchaseStatusEnum,
  PurchaseTargetTypeEnum,
} from './purchase.constant'

/** 只标记事务外计价发现与锁后权威重读不一致。 */
class PurchaseSnapshotDriftError extends Error {}

/** 购买订单、钱包和优惠券的事务 owner。 */
@Injectable()
export class PurchaseService {
  private readonly logger = new Logger(PurchaseService.name)

  // 初始化购买事务 owner 及其最小跨域内容端口。
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(PURCHASE_CONTENT_PORT)
    private readonly purchaseContentPort: PurchaseContentPort,
    private readonly userLevelRuleService: UserLevelRuleService,
    private readonly couponService: CouponService,
    private readonly walletService: WalletService,
  ) {}

  // 读取默认 db，购买流程在此处创建唯一事务。
  private get db() {
    return this.drizzle.db
  }

  // 读取购买记录表定义。
  private get userPurchaseRecord() {
    return this.drizzle.schema.userPurchaseRecord
  }

  // 判断底层异常是否为购买唯一约束冲突。
  private isUniqueConstraintError(error: unknown) {
    const facts = this.drizzle.classifyError(error)
    return (
      facts?.sqlState === PostgresErrorCode.UNIQUE_VIOLATION &&
      facts.constraint === 'user_purchase_record_success_unique_idx'
    )
  }

  // 委托内容域校验章节可购买性并读取订单冻结原价。
  async checkNeedPurchase(
    targetType: PurchaseTargetTypeEnum,
    targetId: number,
  ) {
    return this.purchaseContentPort.ensureChapterPurchaseable(
      targetType,
      targetId,
    )
  }

  // 执行购买事务，订单、余额、权益和计数必须原子提交或回滚。
  async purchaseTarget(input: PurchaseTargetCommandDto) {
    if (input.paymentMethod !== PaymentMethodEnum.CURRENCY) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '章节购买仅支持虚拟币余额支付',
      )
    }

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const prepared = await this.preparePurchaseAttempt(input)
        if (attempt === 0) {
          this.logger.log(
            `purchase_start userId=${input.userId} targetType=${input.targetType} targetId=${input.targetId} originalPrice=${prepared.originalPrice} couponInstanceId=${input.couponInstanceId ?? 'none'}`,
          )
        }
        try {
          return await this.executePurchaseAttempt(input, prepared)
        } catch (error) {
          if (!(error instanceof PurchaseSnapshotDriftError)) {
            throw error
          }
          if (attempt === 1) {
            throw new BusinessException(
              BusinessErrorCode.STATE_CONFLICT,
              '购买计价或优惠券状态并发变化，请稍后重试',
            )
          }
        }
      }
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '购买计价或优惠券状态并发变化，请稍后重试',
      )
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        this.logger.warn(
          `purchase_failed_duplicate userId=${input.userId} targetType=${input.targetType} targetId=${input.targetId}`,
        )
        await this.drizzle.withErrorHandling(
          async () => {
            throw error
          },
          {
            duplicate: '该目标已购买',
          },
        )
      }

      this.logger.error(
        `purchase_failed_unknown userId=${input.userId} targetType=${input.targetType} targetId=${input.targetId} diagnostic=${JSON.stringify(
          buildSafeDatabaseDiagnostic(error),
        )}`,
      )
      throw error
    }
  }

  /** 每个全新事务前发现内容价格、等级价、折扣券快照与完整锁并集。 */
  private async preparePurchaseAttempt(
    input: PurchaseTargetCommandDto,
  ): Promise<PreparedPurchaseAttempt> {
    const { originalPrice } =
      await this.purchaseContentPort.ensureChapterPurchaseable(
        input.targetType,
        input.targetId,
      )
    const levelPricing =
      await this.userLevelRuleService.resolveLevelPurchasePricingInTx(this.db, {
        userId: input.userId,
        originalPrice,
        business: null,
      })
    const coupon = input.couponInstanceId
      ? await this.couponService.prepareDiscountCouponReservation({
          userId: input.userId,
          couponInstanceId: input.couponInstanceId,
          targetType: this.toCouponRedemptionTargetType(input.targetType),
          targetId: input.targetId,
          originalPrice: levelPricing.levelPayablePrice,
        })
      : undefined
    const paidPrice = coupon?.paidPrice ?? levelPricing.levelPayablePrice
    const lockRequests: IntegrityLockRequest[] = [
      ...(coupon?.lockRequests ?? []),
    ]
    if (paidPrice > 0) {
      lockRequests.push(
        this.walletService.buildPurchaseConsumptionLockRequest(input),
      )
    }
    return {
      originalPrice,
      levelPricing,
      coupon,
      paidPrice,
      lockRequests,
    }
  }

  /**
   * 单次购买事务只取得一次完整并集，随后执行权威重读和全部零加锁 apply。
   */
  private async executePurchaseAttempt(
    input: PurchaseTargetCommandDto,
    prepared: PreparedPurchaseAttempt,
  ) {
    return this.db.transaction(async (tx) => {
      if (prepared.lockRequests.length > 0) {
        await acquireIntegrityLocks(tx, prepared.lockRequests)
      }
      const levelPricing =
        await this.userLevelRuleService.resolveLevelPurchasePricingInTx(tx, {
          userId: input.userId,
          originalPrice: prepared.originalPrice,
          business: null,
        })
      if (
        !this.isSameLevelPurchasePricing(levelPricing, prepared.levelPricing)
      ) {
        throw new PurchaseSnapshotDriftError()
      }

      let discount: DiscountCouponReservationResult | undefined
      const couponInstanceId = input.couponInstanceId
      if (couponInstanceId != null) {
        if (!prepared.coupon) {
          throw new PurchaseSnapshotDriftError()
        }
        const couponResult =
          await this.couponService.reserveDiscountCouponAfterLocks(
            tx,
            {
              userId: input.userId,
              couponInstanceId,
              targetType: this.toCouponRedemptionTargetType(input.targetType),
              targetId: input.targetId,
              originalPrice: levelPricing.levelPayablePrice,
            },
            prepared.coupon,
          )
        if (couponResult.status === 'snapshot_drift') {
          throw new PurchaseSnapshotDriftError()
        }
        discount = couponResult.reservation
      }
      const paidPrice = discount?.paidPrice ?? levelPricing.levelPayablePrice
      if (paidPrice !== prepared.paidPrice) {
        throw new PurchaseSnapshotDriftError()
      }
      const purchasePricing = {
        originalPrice: prepared.originalPrice,
        payableRate:
          prepared.originalPrice > 0
            ? Number((paidPrice / prepared.originalPrice).toFixed(2))
            : 1,
        payablePrice: paidPrice,
        discountAmount: prepared.originalPrice - paidPrice,
      }
      const payableRate =
        prepared.originalPrice > 0
          ? (paidPrice / prepared.originalPrice).toFixed(2)
          : '1.00'

      const [record] = await tx
        .insert(this.userPurchaseRecord)
        .values({
          targetType: input.targetType,
          targetId: input.targetId,
          userId: input.userId,
          originalPrice: prepared.originalPrice,
          paidPrice,
          payableRate,
          discountAmount: purchasePricing.discountAmount,
          couponInstanceId: input.couponInstanceId,
          discountSource: discount ? 1 : 0,
          status: PurchaseStatusEnum.SUCCESS,
          paymentMethod: input.paymentMethod,
          outTradeNo: input.outTradeNo,
        })
        .returning()

      if (paidPrice > 0) {
        await this.walletService.applyPurchaseConsumptionAfterOperationLock(
          tx,
          {
            userId: input.userId,
            amount: paidPrice,
            purchaseId: record.id,
            paymentMethod: input.paymentMethod,
            outTradeNo: input.outTradeNo,
            targetType: input.targetType,
            targetId: input.targetId,
          },
        )
      }

      await this.purchaseContentPort.grantPurchaseEntitlement(tx, {
        userId: input.userId,
        targetType: input.targetType,
        targetId: input.targetId,
        sourceId: record.id,
        grantSnapshot: {
          originalPrice: prepared.originalPrice,
          paidPrice,
          payableRate,
          paymentMethod: input.paymentMethod,
          outTradeNo: input.outTradeNo,
          couponInstanceId: input.couponInstanceId,
          discountAmount: purchasePricing.discountAmount,
          levelPayableRate: levelPricing.levelPayableRate,
          levelDiscountAmount: levelPricing.levelDiscountAmount,
          couponDiscountAmount: discount?.discountAmount ?? 0,
          discountSource: discount ? 1 : 0,
        },
      })

      this.logger.log(
        `purchase_success userId=${input.userId} targetType=${input.targetType} targetId=${input.targetId} originalPrice=${prepared.originalPrice} paidPrice=${paidPrice} purchaseId=${record.id}`,
      )

      const {
        originalPrice: _originalPrice,
        paidPrice: _paidPrice,
        payableRate: _payableRate,
        ...purchaseRecord
      } = record
      return { ...purchaseRecord, purchasePricing }
    })
  }

  /** 将购买目标映射到折扣券核销目标闭集。 */
  private toCouponRedemptionTargetType(targetType: PurchaseTargetTypeEnum) {
    return targetType === PurchaseTargetTypeEnum.COMIC_CHAPTER
      ? CouponRedemptionTargetTypeEnum.COMIC_CHAPTER
      : CouponRedemptionTargetTypeEnum.NOVEL_CHAPTER
  }

  /** 比较事务外等级计价与锁后权威重读结果。 */
  private isSameLevelPurchasePricing(
    actual: LevelPurchasePricing,
    expected: LevelPurchasePricing,
  ) {
    return (
      actual.originalPrice === expected.originalPrice &&
      actual.levelPayableRate === expected.levelPayableRate &&
      actual.levelPayablePrice === expected.levelPayablePrice &&
      actual.levelDiscountAmount === expected.levelDiscountAmount
    )
  }

  // 购买章节（对外通用接口）。
  async purchaseChapter(input: PurchaseTargetCommandDto) {
    return this.purchaseTarget(input)
  }

  // 委托内容域查询已购作品历史，保留内容表的历史展示口径。
  async getPurchasedWorks(query: QueryPurchasedWorkCommandDto) {
    return this.purchaseContentPort.getPurchasedWorks(query)
  }

  // 委托内容域查询已购章节历史，保留内容表的历史展示口径。
  async getPurchasedWorkChapters(query: QueryPurchasedWorkChapterCommandDto) {
    return this.purchaseContentPort.getPurchasedWorkChapters(query)
  }
}
