import type { PostgresErrorSourceObject } from '@db/core'
import type { SQL } from 'drizzle-orm'
import type { PurchasePricingDto } from './dto/purchase-pricing.dto'
import { DrizzleService } from '@db/core'
import {
  ContentEntitlementGrantSourceEnum,
  ContentEntitlementTargetTypeEnum,
} from '@libs/content/permission/content-entitlement.constant'
import { ContentEntitlementService } from '@libs/content/permission/content-entitlement.service'
import { ContentPermissionService } from '@libs/content/permission/content-permission.service'
import { WorkCounterService } from '@libs/content/work/counter/work-counter.service'
import {
  BusinessErrorCode,
  ContentTypeEnum,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { buildDateOnlyRangeInAppTimeZone } from '@libs/platform/utils'
import { Injectable, Logger } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { CouponRedemptionTargetTypeEnum } from '../coupon/coupon.constant'
import { CouponService } from '../coupon/coupon.service'
import { WalletService } from '../wallet/wallet.service'
import {
  PurchaseChapterResultDto,
  PurchaseTargetCommandDto,
  QueryPurchasedWorkChapterCommandDto,
  QueryPurchasedWorkCommandDto,
} from './dto/purchase.dto'
import {
  PaymentMethodEnum,
  PURCHASE_WORK_CHAPTER_TARGET_TYPES,
  PurchaseStatusEnum,
  PurchaseTargetTypeEnum,
} from './purchase.constant'

const PURCHASE_WORK_CHAPTER_TARGET_TYPES_SQL = sql.join(
  PURCHASE_WORK_CHAPTER_TARGET_TYPES.map((targetType) => sql`${targetType}`),
  sql`, `,
)

@Injectable()
export class PurchaseService {
  private readonly logger = new Logger(PurchaseService.name)

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly contentPermissionService: ContentPermissionService,
    private readonly contentEntitlementService: ContentEntitlementService,
    private readonly workCounterService: WorkCounterService,
    private readonly couponService: CouponService,
    private readonly walletService: WalletService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get userPurchaseRecord() {
    return this.drizzle.schema.userPurchaseRecord
  }

  private isUniqueConstraintError(
    error: Error | PostgresErrorSourceObject | null | undefined,
  ) {
    return this.drizzle.isUniqueViolation(error)
  }

  private extractRows<T>(
    result: { rows?: T[] | null } | object | null | undefined,
  ) {
    if (!result || typeof result !== 'object' || !('rows' in result)) {
      return []
    }
    const rows = (result as { rows?: T[] | null }).rows
    return Array.isArray(rows) ? rows : []
  }

  private buildPurchaseCreatedAtFilter(
    startDate?: string,
    endDate?: string,
    columnRef = this.buildPurchaseCreatedAtExpression(),
  ) {
    const filters: SQL[] = []
    const dateRange = buildDateOnlyRangeInAppTimeZone(startDate, endDate)

    if (dateRange?.gte) {
      filters.push(sql`${columnRef} >= ${dateRange.gte}`)
    }

    if (dateRange?.lt) {
      filters.push(sql`${columnRef} < ${dateRange.lt}`)
    }

    if (filters.length === 0) {
      return sql.empty()
    }

    return sql` AND ${sql.join(filters, sql` AND `)}`
  }

  private buildPurchaseCreatedAtExpression() {
    return sql`COALESCE(upr.created_at, uce.created_at)`
  }

  /**
   * 校验购买条件并获取价格
   */
  async checkNeedPurchase(
    targetType: PurchaseTargetTypeEnum,
    targetId: number,
  ) {
    return this.ensureChapterPurchaseable(targetType, targetId)
  }

  // 将购买目标类型映射为内容作品类型。
  private resolveWorkType(targetType: PurchaseTargetTypeEnum) {
    if (targetType === PurchaseTargetTypeEnum.COMIC_CHAPTER) {
      return ContentTypeEnum.COMIC
    }
    if (targetType === PurchaseTargetTypeEnum.NOVEL_CHAPTER) {
      return ContentTypeEnum.NOVEL
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '不支持的购买业务类型',
    )
  }

  // 将购买目标类型映射为内容权益目标类型。
  private resolveEntitlementTargetType(targetType: PurchaseTargetTypeEnum) {
    if (targetType === PurchaseTargetTypeEnum.COMIC_CHAPTER) {
      return ContentEntitlementTargetTypeEnum.COMIC_CHAPTER
    }
    if (targetType === PurchaseTargetTypeEnum.NOVEL_CHAPTER) {
      return ContentEntitlementTargetTypeEnum.NOVEL_CHAPTER
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '不支持的购买权益目标类型',
    )
  }

  // 校验章节可购买并返回价格快照所需的原价。
  private async ensureChapterPurchaseable(
    targetType: PurchaseTargetTypeEnum,
    targetId: number,
  ) {
    const permission =
      await this.contentPermissionService.resolveChapterPermission(targetId)
    const expectedWorkType = this.resolveWorkType(targetType)

    if (permission.workType !== expectedWorkType) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '章节不存在',
      )
    }

    if (permission.viewRule !== WorkViewPermissionEnum.PURCHASE) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '该章节不支持购买',
      )
    }

    if (
      !permission.purchasePricing ||
      permission.purchasePricing.originalPrice < 0
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '章节价格配置错误',
      )
    }

    return {
      originalPrice: permission.purchasePricing.originalPrice,
      workType: expectedWorkType,
    }
  }

  /**
   * 将订单快照映射为统一价格读模型。
   * 历史订单展示统一读取冻结值，避免后续等级变动导致已购记录漂移。
   */
  private toPurchasePricingSnapshot(input: {
    originalPrice: number
    paidPrice: number
    payableRate: number | string
  }): PurchasePricingDto {
    const payableRate = Number(input.payableRate)

    return {
      originalPrice: input.originalPrice,
      payableRate,
      payablePrice: input.paidPrice,
      discountAmount: input.originalPrice - input.paidPrice,
    }
  }

  /**
   * 执行购买逻辑
   */
  async purchaseTarget(
    input: PurchaseTargetCommandDto,
  ): Promise<PurchaseChapterResultDto> {
    const {
      targetType,
      targetId,
      userId,
      paymentMethod,
      outTradeNo,
      couponInstanceId,
    } = input
    if (paymentMethod !== PaymentMethodEnum.CURRENCY) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '章节购买仅支持虚拟币余额支付',
      )
    }

    const { originalPrice, workType } = await this.ensureChapterPurchaseable(
      targetType,
      targetId,
    )
    const entitlementTargetType = this.resolveEntitlementTargetType(targetType)

    this.logger.log(
      `purchase_start userId=${userId} targetType=${targetType} targetId=${targetId} originalPrice=${originalPrice} couponInstanceId=${couponInstanceId ?? 'none'}`,
    )

    try {
      return await this.db.transaction(async (tx) => {
        const discount = couponInstanceId
          ? await this.couponService.reserveDiscountCoupon(tx, {
              userId,
              couponInstanceId,
              targetType:
                targetType === PurchaseTargetTypeEnum.COMIC_CHAPTER
                  ? CouponRedemptionTargetTypeEnum.COMIC_CHAPTER
                  : CouponRedemptionTargetTypeEnum.NOVEL_CHAPTER,
              targetId,
              originalPrice,
            })
          : undefined
        const purchasePricing = await this.contentPermissionService
          .resolvePurchasePricing(originalPrice)
          .then((pricing) => ({
            ...pricing,
            payablePrice: discount?.paidPrice ?? pricing.payablePrice,
            discountAmount: discount?.discountAmount ?? pricing.discountAmount,
          }))
        const paidPrice = purchasePricing.payablePrice
        const payableRate =
          originalPrice > 0 ? (paidPrice / originalPrice).toFixed(2) : '1.00'

        const [record] = await tx
          .insert(this.userPurchaseRecord)
          .values({
            targetType,
            targetId,
            userId,
            originalPrice,
            paidPrice,
            payableRate,
            discountAmount: purchasePricing.discountAmount,
            couponInstanceId,
            discountSource: discount ? 1 : 0,
            status: PurchaseStatusEnum.SUCCESS,
            paymentMethod,
            outTradeNo,
          })
          .returning()

        if (paidPrice > 0) {
          await this.walletService.consumeForPurchase(tx, {
            userId,
            amount: paidPrice,
            purchaseId: record.id,
            paymentMethod,
            outTradeNo,
            targetType,
            targetId,
          })
        }

        await this.contentEntitlementService.grantPurchaseEntitlement(tx, {
          userId,
          targetType: entitlementTargetType,
          targetId,
          sourceId: record.id,
          grantSnapshot: {
            originalPrice,
            paidPrice,
            payableRate,
            paymentMethod,
            outTradeNo,
            couponInstanceId,
            discountAmount: purchasePricing.discountAmount,
            discountSource: discount ? 1 : 0,
          },
        })

        // 更新各业务方购买计数
        await this.workCounterService.updateWorkChapterPurchaseCount(
          tx,
          targetId,
          workType,
          1,
          '章节不存在',
        )

        this.logger.log(
          `purchase_success userId=${userId} targetType=${targetType} targetId=${targetId} originalPrice=${originalPrice} paidPrice=${paidPrice} purchaseId=${record.id}`,
        )

        return {
          id: record.id,
          targetType: record.targetType,
          targetId: record.targetId,
          userId: record.userId,
          status: record.status,
          paymentMethod: record.paymentMethod,
          outTradeNo: record.outTradeNo,
          discountAmount: record.discountAmount,
          couponInstanceId: record.couponInstanceId,
          discountSource: record.discountSource,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          purchasePricing,
        }
      })
    } catch (error) {
      const drizzleError =
        error instanceof Error
          ? error
          : typeof error === 'object' && error !== null
            ? (error as PostgresErrorSourceObject)
            : undefined
      if (this.isUniqueConstraintError(drizzleError)) {
        this.logger.warn(
          `purchase_failed_duplicate userId=${userId} targetType=${targetType} targetId=${targetId}`,
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
        `purchase_failed_unknown userId=${userId} targetType=${targetType} targetId=${targetId}`,
        error instanceof Error ? error.stack : undefined,
      )
      throw error
    }
  }

  /**
   * 购买章节（对外通用接口）
   */
  async purchaseChapter(input: PurchaseTargetCommandDto) {
    return this.purchaseTarget(input)
  }

  /**
   * 获取已购作品列表
   * 保留历史购买记录展示口径，不因作品或章节被软删除而隐藏已购历史。
   */
  async getPurchasedWorks(query: QueryPurchasedWorkCommandDto) {
    const {
      userId,
      workType,
      status = PurchaseStatusEnum.SUCCESS,
      pageIndex,
      pageSize,
      startDate,
      endDate,
    } = query
    const page = this.drizzle.buildPage({ pageIndex, pageSize })
    const createdAtFilter = this.buildPurchaseCreatedAtFilter(
      startDate,
      endDate,
    )
    const purchaseCreatedAt = this.buildPurchaseCreatedAtExpression()
    const workTypeFilter = workType
      ? sql` AND w.type = ${workType}`
      : sql.empty()

    const [rowsResult, totalRowsResult] = await Promise.all([
      this.db.execute(sql`
        SELECT
          wc.work_id AS "workId",
          w.type AS "workType",
          w.name AS "workName",
          w.cover AS "workCover",
          COUNT(*)::bigint AS "purchasedChapterCount",
          MAX(${purchaseCreatedAt}) AS "lastPurchasedAt"
        FROM user_content_entitlement uce
        LEFT JOIN user_purchase_record upr ON upr.id = uce.source_id
        INNER JOIN work_chapter wc ON wc.id = uce.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE uce.user_id = ${userId}
          AND uce.status = 1
          AND uce.grant_source = ${ContentEntitlementGrantSourceEnum.PURCHASE}
          AND uce.target_type IN (${PURCHASE_WORK_CHAPTER_TARGET_TYPES_SQL})
          AND (upr.id IS NULL OR upr.status = ${status})
          ${workTypeFilter}
          ${createdAtFilter}
        GROUP BY wc.work_id, w.type, w.name, w.cover
        ORDER BY MAX(${purchaseCreatedAt}) DESC
        LIMIT ${page.limit} OFFSET ${page.offset}
      `),
      this.db.execute(sql`
        SELECT COUNT(DISTINCT wc.work_id)::bigint AS "total"
        FROM user_content_entitlement uce
        LEFT JOIN user_purchase_record upr ON upr.id = uce.source_id
        INNER JOIN work_chapter wc ON wc.id = uce.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE uce.user_id = ${userId}
          AND uce.status = 1
          AND uce.grant_source = ${ContentEntitlementGrantSourceEnum.PURCHASE}
          AND uce.target_type IN (${PURCHASE_WORK_CHAPTER_TARGET_TYPES_SQL})
          AND (upr.id IS NULL OR upr.status = ${status})
          ${workTypeFilter}
          ${createdAtFilter}
      `),
    ])
    const rows = this.extractRows<{
      workId: number
      workType: number
      workName: string
      workCover: string
      purchasedChapterCount: bigint
      lastPurchasedAt: Date
    }>(rowsResult)
    const totalRows = this.extractRows<{ total: bigint }>(totalRowsResult)
    const total = Number(totalRows[0]?.total ?? 0n)

    return {
      list: rows.map((row) => ({
        work: {
          id: row.workId,
          type: row.workType,
          name: row.workName,
          cover: row.workCover,
        },
        purchasedChapterCount: Number(row.purchasedChapterCount),
        lastPurchasedAt: row.lastPurchasedAt,
      })),
      total,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  /**
   * 获取已购章节列表
   * 保留历史购买记录展示口径，不因作品或章节被软删除而隐藏已购历史。
   */
  async getPurchasedWorkChapters(query: QueryPurchasedWorkChapterCommandDto) {
    const {
      userId,
      workId,
      workType,
      status = PurchaseStatusEnum.SUCCESS,
      pageIndex,
      pageSize,
      startDate,
      endDate,
    } = query
    const page = this.drizzle.buildPage({ pageIndex, pageSize })
    const createdAtFilter = this.buildPurchaseCreatedAtFilter(
      startDate,
      endDate,
    )
    const purchaseCreatedAt = this.buildPurchaseCreatedAtExpression()
    const workTypeFilter = workType
      ? sql` AND wc.work_type = ${workType}`
      : sql.empty()

    const [rowsResult, totalRowsResult] = await Promise.all([
      this.db.execute(sql`
        SELECT
          COALESCE(upr.id, uce.id) AS "id",
          uce.target_type AS "targetType",
          uce.target_id AS "targetId",
          uce.user_id AS "userId",
          COALESCE(upr.original_price, 0) AS "originalPrice",
          COALESCE(upr.paid_price, 0) AS "paidPrice",
          COALESCE(upr.payable_rate, 1.00) AS "payableRate",
          COALESCE(upr.status, 1) AS "status",
          COALESCE(upr.payment_method, 1) AS "paymentMethod",
          upr.out_trade_no AS "outTradeNo",
          COALESCE(upr.discount_amount, 0) AS "discountAmount",
          upr.coupon_instance_id AS "couponInstanceId",
          COALESCE(upr.discount_source, 0) AS "discountSource",
          ${purchaseCreatedAt} AS "createdAt",
          COALESCE(upr.updated_at, uce.updated_at) AS "updatedAt",
          wc.id AS "chapterId",
          wc.work_id AS "chapterWorkId",
          wc.work_type AS "chapterWorkType",
          wc.title AS "chapterTitle",
          wc.subtitle AS "chapterSubtitle",
          wc.cover AS "chapterCover",
          wc.sort_order AS "chapterSortOrder",
          wc.is_published AS "chapterIsPublished",
          wc.publish_at AS "chapterPublishAt"
        FROM user_content_entitlement uce
        LEFT JOIN user_purchase_record upr ON upr.id = uce.source_id
        INNER JOIN work_chapter wc ON wc.id = uce.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE uce.user_id = ${userId}
          AND uce.status = 1
          AND uce.grant_source = ${ContentEntitlementGrantSourceEnum.PURCHASE}
          AND uce.target_type IN (${PURCHASE_WORK_CHAPTER_TARGET_TYPES_SQL})
          AND (upr.id IS NULL OR upr.status = ${status})
          AND wc.work_id = ${workId}
          ${workTypeFilter}
          ${createdAtFilter}
        ORDER BY ${purchaseCreatedAt} DESC
        LIMIT ${page.limit} OFFSET ${page.offset}
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::bigint AS "total"
        FROM user_content_entitlement uce
        LEFT JOIN user_purchase_record upr ON upr.id = uce.source_id
        INNER JOIN work_chapter wc ON wc.id = uce.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE uce.user_id = ${userId}
          AND uce.status = 1
          AND uce.grant_source = ${ContentEntitlementGrantSourceEnum.PURCHASE}
          AND uce.target_type IN (${PURCHASE_WORK_CHAPTER_TARGET_TYPES_SQL})
          AND (upr.id IS NULL OR upr.status = ${status})
          AND wc.work_id = ${workId}
          ${workTypeFilter}
          ${createdAtFilter}
      `),
    ])
    const rows = this.extractRows<{
      id: number
      targetType: number
      targetId: number
      userId: number
      originalPrice: number
      paidPrice: number
      payableRate: string | number
      status: number
      paymentMethod: number
      outTradeNo: string | null
      discountAmount: number
      couponInstanceId: number | null
      discountSource: number
      createdAt: Date
      updatedAt: Date
      chapterId: number
      chapterWorkId: number
      chapterWorkType: number
      chapterTitle: string
      chapterSubtitle: string | null
      chapterCover: string | null
      chapterSortOrder: number
      chapterIsPublished: boolean
      chapterPublishAt: Date | null
    }>(rowsResult)
    const totalRows = this.extractRows<{ total: bigint }>(totalRowsResult)
    const total = Number(totalRows[0]?.total ?? 0n)

    return {
      list: rows.map((row) => ({
        id: row.id,
        targetType: row.targetType,
        targetId: row.targetId,
        userId: row.userId,
        purchasePricing: this.toPurchasePricingSnapshot({
          originalPrice: row.originalPrice,
          paidPrice: row.paidPrice,
          payableRate: row.payableRate,
        }),
        status: row.status,
        paymentMethod: row.paymentMethod,
        outTradeNo: row.outTradeNo,
        discountAmount: row.discountAmount,
        couponInstanceId: row.couponInstanceId,
        discountSource: row.discountSource,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        chapter: {
          id: row.chapterId,
          workId: row.chapterWorkId,
          workType: row.chapterWorkType,
          title: row.chapterTitle,
          subtitle: row.chapterSubtitle,
          cover: row.chapterCover,
          sortOrder: row.chapterSortOrder,
          isPublished: row.chapterIsPublished,
          publishAt: row.chapterPublishAt,
        },
      })),
      total,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }
}
