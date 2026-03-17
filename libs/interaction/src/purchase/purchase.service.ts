import {
  buildColumnDateRangeSqlFilter,
  DrizzleService,
  normalizePagination,
} from '@db/core'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
  GrowthLedgerService,
} from '@libs/growth'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import {
  PurchaseTargetDto,
  QueryPurchasedWorkChapterDto,
  QueryPurchasedWorkDto,
} from './dto/purchase.dto'
import { IPurchaseTargetResolver } from './interfaces/purchase-target-resolver.interface'
import { PurchaseStatusEnum, PurchaseTargetTypeEnum } from './purchase.constant'

@Injectable()
export class PurchaseService {
  private readonly logger = new Logger(PurchaseService.name)
  private readonly resolvers = new Map<
    PurchaseTargetTypeEnum,
    IPurchaseTargetResolver
  >()

  constructor(
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly drizzle: DrizzleService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get userPurchaseRecord() {
    return this.drizzle.schema.userPurchaseRecord
  }

  /**
   * 注册购买目标解析器
   */
  registerResolver(resolver: IPurchaseTargetResolver) {
    if (this.resolvers.has(resolver.targetType)) {
      console.warn(
        `Purchase resolver for type ${resolver.targetType} is being overwritten.`,
      )
    }
    this.resolvers.set(resolver.targetType, resolver)
  }

  /**
   * 获取指定的购买解析器
   */
  private getResolver(
    targetType: PurchaseTargetTypeEnum,
  ): IPurchaseTargetResolver {
    const resolver = this.resolvers.get(targetType)
    if (!resolver) {
      throw new BadRequestException('不支持的购买业务类型')
    }
    return resolver
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      this.drizzle.isUniqueViolation(error)
    )
  }

  private extractRows<T>(result: unknown): T[] {
    if (!result || typeof result !== 'object' || !('rows' in result)) {
      return []
    }
    const rows = (result as { rows?: unknown }).rows
    return Array.isArray(rows) ? (rows as T[]) : []
  }

  /**
   * 校验购买条件并获取价格
   */
  async checkNeedPurchase(
    targetType: PurchaseTargetTypeEnum,
    targetId: number,
  ) {
    const resolver = this.getResolver(targetType)
    return resolver.ensurePurchaseable(targetId)
  }

  /**
   * 执行购买逻辑
   */
  async purchaseTarget(dto: PurchaseTargetDto) {
    const { targetType, targetId, userId, paymentMethod, outTradeNo } = dto
    const resolver = this.getResolver(targetType)

    const { price: targetPrice } = await resolver.ensurePurchaseable(targetId)

    this.logger.log(
      `purchase_start userId=${userId} targetType=${targetType} targetId=${targetId} price=${targetPrice}`,
    )

    try {
      return await this.db.transaction(async (tx) => {
        const [record] = await tx
          .insert(this.userPurchaseRecord)
          .values({
            targetType,
            targetId,
            userId,
            price: targetPrice,
            status: PurchaseStatusEnum.SUCCESS,
            paymentMethod,
            outTradeNo,
          })
          .returning()

        if (targetPrice > 0) {
          const consumeResult = await this.growthLedgerService.applyDelta(tx, {
            userId,
            assetType: GrowthAssetTypeEnum.POINTS,
            action: GrowthLedgerActionEnum.CONSUME,
            amount: targetPrice,
            bizKey: `purchase:${record.id}:consume`,
            source: 'purchase',
            remark: '购买积分扣减',
            targetType,
            targetId,
            context: {
              purchaseId: record.id,
              paymentMethod,
              outTradeNo,
            },
          })

          if (!consumeResult.success && !consumeResult.duplicated) {
            if (consumeResult.reason === 'insufficient_balance') {
              this.logger.warn(
                `purchase_failed_points_not_enough userId=${userId} targetType=${targetType} targetId=${targetId} need=${targetPrice}`,
              )
              throw new BadRequestException('积分不足')
            }
            this.logger.warn(
              `purchase_failed_ledger_reject userId=${userId} targetType=${targetType} targetId=${targetId} reason=${consumeResult.reason ?? 'unknown'}`,
            )
            throw new BadRequestException('积分扣减失败，请稍后重试')
          }
        }

        // 更新各业务方购买计数
        await resolver.applyCountDelta(tx, targetId, 1)

        this.logger.log(
          `purchase_success userId=${userId} targetType=${targetType} targetId=${targetId} price=${targetPrice} purchaseId=${record.id}`,
        )

        return record
      })
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
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
  async purchaseChapter(dto: PurchaseTargetDto) {
    return this.purchaseTarget(dto)
  }

  /**
   * 获取已购作品列表
   */
  async getPurchasedWorks(dto: QueryPurchasedWorkDto) {
    const {
      userId,
      workType,
      status = PurchaseStatusEnum.SUCCESS,
      pageIndex,
      pageSize,
      startDate,
      endDate,
    } = dto
    const {
      pageIndex: normalizedPageIndex,
      pageSize: normalizedPageSize,
      skip,
      take,
    } = normalizePagination(pageIndex, pageSize)
    const createdAtFilter = buildColumnDateRangeSqlFilter(
      'upr.created_at',
      startDate,
      endDate,
    )
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
          MAX(upr.created_at) AS "lastPurchasedAt"
        FROM user_purchase_record upr
        INNER JOIN work_chapter wc ON wc.id = upr.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE upr.user_id = ${userId}
          AND upr.status = ${status}
          AND upr.target_type IN (${PurchaseTargetTypeEnum.COMIC_CHAPTER}, ${PurchaseTargetTypeEnum.NOVEL_CHAPTER})
          AND wc.deleted_at IS NULL
          AND w.deleted_at IS NULL
          ${workTypeFilter}
          ${createdAtFilter}
        GROUP BY wc.work_id, w.type, w.name, w.cover
        ORDER BY MAX(upr.created_at) DESC
        LIMIT ${take} OFFSET ${skip}
      `),
      this.db.execute(sql`
        SELECT COUNT(DISTINCT wc.work_id)::bigint AS "total"
        FROM user_purchase_record upr
        INNER JOIN work_chapter wc ON wc.id = upr.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE upr.user_id = ${userId}
          AND upr.status = ${status}
          AND upr.target_type IN (${PurchaseTargetTypeEnum.COMIC_CHAPTER}, ${PurchaseTargetTypeEnum.NOVEL_CHAPTER})
          AND wc.deleted_at IS NULL
          AND w.deleted_at IS NULL
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
      pageIndex: normalizedPageIndex,
      pageSize: normalizedPageSize,
    }
  }

  /**
   * 获取已购章节列表
   */
  async getPurchasedWorkChapters(dto: QueryPurchasedWorkChapterDto) {
    const {
      userId,
      workId,
      workType,
      status = PurchaseStatusEnum.SUCCESS,
      pageIndex,
      pageSize,
      startDate,
      endDate,
    } = dto
    const {
      pageIndex: normalizedPageIndex,
      pageSize: normalizedPageSize,
      skip,
      take,
    } = normalizePagination(pageIndex, pageSize)
    const createdAtFilter = buildColumnDateRangeSqlFilter(
      'upr.created_at',
      startDate,
      endDate,
    )
    const workTypeFilter = workType
      ? sql` AND wc.work_type = ${workType}`
      : sql.empty()

    const [rowsResult, totalRowsResult] = await Promise.all([
      this.db.execute(sql`
        SELECT
          upr.id AS "id",
          upr.target_type AS "targetType",
          upr.target_id AS "targetId",
          upr.user_id AS "userId",
          upr.price AS "price",
          upr.status AS "status",
          upr.payment_method AS "paymentMethod",
          upr.out_trade_no AS "outTradeNo",
          upr.created_at AS "createdAt",
          upr.updated_at AS "updatedAt",
          wc.id AS "chapterId",
          wc.work_id AS "chapterWorkId",
          wc.work_type AS "chapterWorkType",
          wc.title AS "chapterTitle",
          wc.subtitle AS "chapterSubtitle",
          wc.cover AS "chapterCover",
          wc.sort_order AS "chapterSortOrder",
          wc.is_published AS "chapterIsPublished",
          wc.publish_at AS "chapterPublishAt"
        FROM user_purchase_record upr
        INNER JOIN work_chapter wc ON wc.id = upr.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE upr.user_id = ${userId}
          AND upr.status = ${status}
          AND upr.target_type IN (${PurchaseTargetTypeEnum.COMIC_CHAPTER}, ${PurchaseTargetTypeEnum.NOVEL_CHAPTER})
          AND wc.work_id = ${workId}
          AND wc.deleted_at IS NULL
          AND w.deleted_at IS NULL
          ${workTypeFilter}
          ${createdAtFilter}
        ORDER BY upr.created_at DESC
        LIMIT ${take} OFFSET ${skip}
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::bigint AS "total"
        FROM user_purchase_record upr
        INNER JOIN work_chapter wc ON wc.id = upr.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE upr.user_id = ${userId}
          AND upr.status = ${status}
          AND upr.target_type IN (${PurchaseTargetTypeEnum.COMIC_CHAPTER}, ${PurchaseTargetTypeEnum.NOVEL_CHAPTER})
          AND wc.work_id = ${workId}
          AND wc.deleted_at IS NULL
          AND w.deleted_at IS NULL
          ${workTypeFilter}
          ${createdAtFilter}
      `),
    ])
    const rows = this.extractRows<{
      id: number
      targetType: number
      targetId: number
      userId: number
      price: number
      status: number
      paymentMethod: number
      outTradeNo: string | null
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
        price: row.price,
        status: row.status,
        paymentMethod: row.paymentMethod,
        outTradeNo: row.outTradeNo,
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
      pageIndex: normalizedPageIndex,
      pageSize: normalizedPageSize,
    }
  }
}
