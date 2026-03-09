import { ContentTypeEnum, WorkViewPermissionEnum } from '@libs/base/constant'
import { BaseService, Prisma } from '@libs/base/database'
import { ContentPermissionService } from '@libs/content/permission'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
  GrowthLedgerService,
} from '@libs/user/growth-ledger'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import {
  buildCreatedAtSqlFilter,
  normalizeInteractionPagination,
} from '../query.helper'
import {
  PurchasedWorkChapterPageDto,
  PurchasedWorkPageDto,
  PurchaseTargetDto,
  QueryPurchasedWorkChapterDto,
  QueryPurchasedWorkDto,
} from './dto/purchase.dto'
import {
  PaymentMethodEnum,
  PurchaseStatusEnum,
  PurchaseTargetTypeEnum,
} from './purchase.constant'

@Injectable()
export class PurchaseService extends BaseService {
  private readonly logger = new Logger(PurchaseService.name)

  constructor(
    private readonly contentPermissionService: ContentPermissionService,
    private readonly growthLedgerService: GrowthLedgerService,
  ) {
    super()
  }

  async checkNeedPurchase(
    targetType: PurchaseTargetTypeEnum,
    targetId: number,
    chapterPermission?: Pick<
      Awaited<ReturnType<ContentPermissionService['resolveChapterPermission']>>,
      'price' | 'viewRule'
    >,
  ) {
    if (
      targetType !== PurchaseTargetTypeEnum.COMIC_CHAPTER &&
      targetType !== PurchaseTargetTypeEnum.NOVEL_CHAPTER
    ) {
      throw new BadRequestException('仅支持章节购买')
    }

    const { price, viewRule } =
      chapterPermission ??
      (await this.contentPermissionService.resolveChapterPermission(targetId))

    if (viewRule !== WorkViewPermissionEnum.PURCHASE) {
      throw new BadRequestException('该章节不支持购买')
    }

    if (price < 0) {
      throw new BadRequestException('章节价格配置错误')
    }

    return {
      targetPrice: price,
    }
  }

  async purchaseTarget(
    dto: PurchaseTargetDto,
    chapterPermission?: Pick<
      Awaited<ReturnType<ContentPermissionService['resolveChapterPermission']>>,
      'price' | 'viewRule'
    >,
  ) {
    const { targetType, targetId, userId, paymentMethod, outTradeNo } = dto

    const { targetPrice } = await this.checkNeedPurchase(
      targetType,
      targetId,
      chapterPermission,
    )

    this.logger.log(
      `purchase_start userId=${userId} targetType=${targetType} targetId=${targetId} price=${targetPrice}`,
    )

    try {
      return await this.prisma.$transaction(async (tx) => {
        const record = await tx.userPurchaseRecord.create({
          data: {
            targetType,
            targetId,
            userId,
            price: targetPrice,
            status: PurchaseStatusEnum.SUCCESS,
            paymentMethod,
            outTradeNo,
          },
        })

        if (targetPrice > 0) {
          const consumeResult = await this.growthLedgerService.applyDelta(tx, {
            userId,
            assetType: GrowthAssetTypeEnum.POINTS,
            action: GrowthLedgerActionEnum.CONSUME,
            amount: targetPrice,
            bizKey: `purchase:${record.id}:consume`,
            source: 'purchase',
            remark: '购买章节积分扣减',
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

        await tx.workChapter.update({
          where: { id: targetId },
          data: { purchaseCount: { increment: 1 } },
        })

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
      }

      this.handlePrismaBusinessError(error, {
        duplicateMessage: '该章节已购买',
      })

      this.logger.error(
        `purchase_failed_unknown userId=${userId} targetType=${targetType} targetId=${targetId}`,
        error instanceof Error ? error.stack : undefined,
      )
      throw error
    }
  }

  async purchaseChapter(userId: number, chapterId: number) {
    const chapterPermission =
      await this.contentPermissionService.resolveChapterPermission(chapterId)

    if (chapterPermission.workType === ContentTypeEnum.COMIC) {
      return this.purchaseTarget(
        {
          targetType: PurchaseTargetTypeEnum.COMIC_CHAPTER,
          targetId: chapterId,
          userId,
          paymentMethod: PaymentMethodEnum.POINTS,
        },
        chapterPermission,
      )
    }

    if (chapterPermission.workType === ContentTypeEnum.NOVEL) {
      return this.purchaseTarget(
        {
          targetType: PurchaseTargetTypeEnum.NOVEL_CHAPTER,
          targetId: chapterId,
          userId,
          paymentMethod: PaymentMethodEnum.POINTS,
        },
        chapterPermission,
      )
    }

    throw new BadRequestException('不支持的章节类型')
  }

  async getPurchasedWorks(dto: QueryPurchasedWorkDto): Promise<PurchasedWorkPageDto> {
    const {
      userId,
      workType,
      status = PurchaseStatusEnum.SUCCESS,
      pageIndex,
      pageSize,
      startDate,
      endDate,
    } = dto
    const { pageIndex: normalizedPageIndex, pageSize: normalizedPageSize, skip, take } =
      normalizeInteractionPagination(pageIndex, pageSize)
    const createdAtFilter = buildCreatedAtSqlFilter(
      'upr.created_at',
      startDate,
      endDate,
    )
    const workTypeFilter = workType
      ? Prisma.sql` AND w.type = ${workType}`
      : Prisma.empty

    const [rows, totalRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          workId: number
          workType: number
          workName: string
          workCover: string
          purchasedChapterCount: bigint
          lastPurchasedAt: Date
        }>
      >(Prisma.sql`
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
      this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
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

  async getPurchasedWorkChapters(
    dto: QueryPurchasedWorkChapterDto,
  ): Promise<PurchasedWorkChapterPageDto> {
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
    const { pageIndex: normalizedPageIndex, pageSize: normalizedPageSize, skip, take } =
      normalizeInteractionPagination(pageIndex, pageSize)
    const createdAtFilter = buildCreatedAtSqlFilter(
      'upr.created_at',
      startDate,
      endDate,
    )
    const workTypeFilter = workType
      ? Prisma.sql` AND wc.work_type = ${workType}`
      : Prisma.empty

    const [rows, totalRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
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
        }>
      >(Prisma.sql`
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
      this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
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
