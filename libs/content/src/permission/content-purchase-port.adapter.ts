import type { DbTransaction, PageResult } from '@db/core'
import type {
  QueryPurchasedWorkChapterCommandDto,
  QueryPurchasedWorkCommandDto,
} from '@libs/interaction/purchase/dto/purchase.dto'
import type {
  GrantPurchaseContentEntitlementInput,
  PurchaseContentPort,
  PurchasedWorkChapterPortItem,
  PurchasedWorkPortItem,
  PurchasePricingSnapshot,
  ResolvedPurchaseTarget,
} from '@libs/interaction/purchase/types/purchase-content-port.type'
import type {
  PurchasedWorkChapterHistoryRow,
  PurchasedWorkHistoryRow,
  PurchasePricingSnapshotSource,
} from './types/content-purchase-port.type'
import { DrizzleService, extractRows, toPageResult } from '@db/core'
import {
  PurchaseStatusEnum,
  PurchaseTargetTypeEnum,
} from '@libs/interaction/purchase/purchase.constant'
import {
  BusinessErrorCode,
  ContentTypeEnum,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { WorkCounterService } from '../work/counter/work-counter.service'
import {
  ContentEntitlementGrantSourceEnum,
  ContentEntitlementStatusEnum,
  ContentEntitlementTargetTypeEnum,
} from './content-entitlement.constant'
import { ContentEntitlementService } from './content-entitlement.service'
import { ContentPermissionService } from './content-permission.service'

const PURCHASE_CONTENT_TARGET_TYPES_SQL = sql.join(
  [
    ContentEntitlementTargetTypeEnum.COMIC_CHAPTER,
    ContentEntitlementTargetTypeEnum.NOVEL_CHAPTER,
  ].map((targetType) => sql`${targetType}`),
  sql`, `,
)

/** 内容域对购买端口的具体实现。 */
@Injectable()
export class ContentPurchasePortAdapter implements PurchaseContentPort {
  // 初始化内容权限、权益和计数 owner。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly contentPermissionService: ContentPermissionService,
    private readonly contentEntitlementService: ContentEntitlementService,
    private readonly workCounterService: WorkCounterService,
  ) {}

  // 读取默认 db，查询不参与购买写事务。
  private get db() {
    return this.drizzle.db
  }

  // 校验章节可购买并返回订单冻结所需原价，保留购买域的既有失败语义。
  async ensureChapterPurchaseable(
    targetType: PurchaseTargetTypeEnum,
    targetId: number,
  ): Promise<ResolvedPurchaseTarget> {
    const permission =
      await this.contentPermissionService.resolveChapterPermission(targetId)
    const expectedWorkType = this.toContentWorkType(targetType)

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

    return { originalPrice: permission.purchasePricing.originalPrice }
  }

  // 在购买事务内依次写入永久权益和章节购买计数，不能另开事务。
  async grantPurchaseEntitlement(
    tx: DbTransaction,
    input: GrantPurchaseContentEntitlementInput,
  ): Promise<void> {
    await this.contentEntitlementService.grantPurchaseEntitlement(tx, {
      userId: input.userId,
      targetType: this.toContentEntitlementTargetType(input.targetType),
      targetId: input.targetId,
      sourceId: input.sourceId,
      grantSnapshot: input.grantSnapshot,
    })
    await this.workCounterService.updateWorkChapterPurchaseCount(
      tx,
      input.targetId,
      this.toContentWorkType(input.targetType),
      1,
      '章节不存在',
    )
  }

  // 已购作品保留原生 SQL：跨表 JOIN、GROUP BY/COUNT 与 allowlisted dynamic order 无法以 RQBv2 清晰且可审计地表达。
  async getPurchasedWorks(
    query: QueryPurchasedWorkCommandDto,
  ): Promise<PageResult<PurchasedWorkPortItem>> {
    const { userId, workType, status = PurchaseStatusEnum.SUCCESS } = query
    const purchaseCreatedAt = this.buildPurchaseCreatedAtExpression()
    const pageParams = this.drizzle.buildPageParams(query, {
      allowlistedOrderBy: {
        columns: {
          lastPurchasedAt: sql`MAX(${purchaseCreatedAt})`,
          purchasedChapterCount: sql`COUNT(*)::bigint`,
          workId: sql`wc.work_id`,
          workType: sql`w.type`,
        },
        fallbackOrderBy: [{ lastPurchasedAt: 'desc' }, { workId: 'desc' }],
      },
    })
    const workTypeFilter = workType
      ? sql` AND w.type = ${workType}`
      : sql.empty()
    const startDateFilter = pageParams.dateRange?.gte
      ? sql` AND ${purchaseCreatedAt} >= ${pageParams.dateRange.gte}`
      : sql.empty()
    const endDateFilter = pageParams.dateRange?.lt
      ? sql` AND ${purchaseCreatedAt} < ${pageParams.dateRange.lt}`
      : sql.empty()

    const [rowsResult, totalResult] = await Promise.all([
      this.db.execute(sql`
        SELECT
          wc.work_id AS "workId",
          w.type AS "workType",
          w.name AS "workName",
          w.cover AS "workCover",
          COUNT(*)::bigint AS "purchasedChapterCount",
          MAX(${purchaseCreatedAt}) AS "lastPurchasedAt"
        FROM user_content_entitlement uce
        INNER JOIN user_purchase_record upr ON upr.id = uce.source_id
        INNER JOIN work_chapter wc ON wc.id = uce.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE uce.user_id = ${userId}
          AND uce.status = ${ContentEntitlementStatusEnum.ACTIVE}
          AND uce.grant_source = ${ContentEntitlementGrantSourceEnum.PURCHASE}
          AND uce.target_type IN (${PURCHASE_CONTENT_TARGET_TYPES_SQL})
          AND upr.status = ${status}
          ${workTypeFilter}
          ${startDateFilter}
          ${endDateFilter}
        GROUP BY wc.work_id, w.type, w.name, w.cover
        ORDER BY ${pageParams.order.orderByClause}
        LIMIT ${pageParams.page.limit}
        OFFSET ${pageParams.page.offset}
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::bigint AS "total"
        FROM (
          SELECT wc.work_id
          FROM user_content_entitlement uce
          INNER JOIN user_purchase_record upr ON upr.id = uce.source_id
          INNER JOIN work_chapter wc ON wc.id = uce.target_id
          INNER JOIN work w ON w.id = wc.work_id
          WHERE uce.user_id = ${userId}
            AND uce.status = ${ContentEntitlementStatusEnum.ACTIVE}
            AND uce.grant_source = ${ContentEntitlementGrantSourceEnum.PURCHASE}
            AND uce.target_type IN (${PURCHASE_CONTENT_TARGET_TYPES_SQL})
            AND upr.status = ${status}
            ${workTypeFilter}
            ${startDateFilter}
            ${endDateFilter}
          GROUP BY wc.work_id, w.type, w.name, w.cover
        ) grouped_purchased_works
      `),
    ])
    const rows = extractRows<PurchasedWorkHistoryRow>(rowsResult)
    const total = this.extractTotal(totalResult)

    return toPageResult(
      rows.map((row) => ({
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
      pageParams.page,
    )
  }

  // 已购章节保留原生 SQL：跨表 JOIN 与 allowlisted dynamic order（同端口作品查询另含 GROUP BY/COUNT）无法以 RQBv2 清晰且可审计地表达。
  async getPurchasedWorkChapters(
    query: QueryPurchasedWorkChapterCommandDto,
  ): Promise<PageResult<PurchasedWorkChapterPortItem>> {
    const {
      userId,
      workId,
      workType,
      status = PurchaseStatusEnum.SUCCESS,
    } = query
    const purchaseCreatedAt = this.buildPurchaseCreatedAtExpression()
    const pageParams = this.drizzle.buildPageParams(query, {
      allowlistedOrderBy: {
        columns: {
          createdAt: purchaseCreatedAt,
          updatedAt: sql`upr.updated_at`,
          id: sql`upr.id`,
          targetId: sql`uce.target_id`,
          chapterId: sql`wc.id`,
          chapterSortOrder: sql`wc.sort_order`,
          chapterPublishAt: sql`wc.publish_at`,
        },
        fallbackOrderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      },
    })
    const workTypeFilter = workType
      ? sql` AND wc.work_type = ${workType}`
      : sql.empty()
    const startDateFilter = pageParams.dateRange?.gte
      ? sql` AND ${purchaseCreatedAt} >= ${pageParams.dateRange.gte}`
      : sql.empty()
    const endDateFilter = pageParams.dateRange?.lt
      ? sql` AND ${purchaseCreatedAt} < ${pageParams.dateRange.lt}`
      : sql.empty()

    const [rowsResult, totalResult] = await Promise.all([
      this.db.execute(sql`
        SELECT
          upr.id AS "id",
          uce.target_type AS "targetType",
          uce.target_id AS "targetId",
          uce.user_id AS "userId",
          upr.original_price AS "originalPrice",
          upr.paid_price AS "paidPrice",
          upr.payable_rate AS "payableRate",
          upr.status AS "status",
          upr.payment_method AS "paymentMethod",
          upr.out_trade_no AS "outTradeNo",
          upr.discount_amount AS "discountAmount",
          upr.coupon_instance_id AS "couponInstanceId",
          upr.discount_source AS "discountSource",
          ${purchaseCreatedAt} AS "createdAt",
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
        FROM user_content_entitlement uce
        INNER JOIN user_purchase_record upr ON upr.id = uce.source_id
        INNER JOIN work_chapter wc ON wc.id = uce.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE uce.user_id = ${userId}
          AND uce.status = ${ContentEntitlementStatusEnum.ACTIVE}
          AND uce.grant_source = ${ContentEntitlementGrantSourceEnum.PURCHASE}
          AND uce.target_type IN (${PURCHASE_CONTENT_TARGET_TYPES_SQL})
          AND upr.status = ${status}
          AND wc.work_id = ${workId}
          ${workTypeFilter}
          ${startDateFilter}
          ${endDateFilter}
        ORDER BY ${pageParams.order.orderByClause}
        LIMIT ${pageParams.page.limit}
        OFFSET ${pageParams.page.offset}
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::bigint AS "total"
        FROM user_content_entitlement uce
        INNER JOIN user_purchase_record upr ON upr.id = uce.source_id
        INNER JOIN work_chapter wc ON wc.id = uce.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE uce.user_id = ${userId}
          AND uce.status = ${ContentEntitlementStatusEnum.ACTIVE}
          AND uce.grant_source = ${ContentEntitlementGrantSourceEnum.PURCHASE}
          AND uce.target_type IN (${PURCHASE_CONTENT_TARGET_TYPES_SQL})
          AND upr.status = ${status}
          AND wc.work_id = ${workId}
          ${workTypeFilter}
          ${startDateFilter}
          ${endDateFilter}
      `),
    ])
    const rows = extractRows<PurchasedWorkChapterHistoryRow>(rowsResult)
    const total = this.extractTotal(totalResult)

    return toPageResult(
      rows.map((row) => ({
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
          subtitle: row.chapterSubtitle ?? null,
          cover: row.chapterCover ?? null,
          sortOrder: row.chapterSortOrder,
          isPublished: row.chapterIsPublished,
          publishAt: row.chapterPublishAt ?? null,
        },
      })),
      total,
      pageParams.page,
    )
  }

  // 读取购买订单创建时间表达式。
  private buildPurchaseCreatedAtExpression() {
    return sql`upr.created_at`
  }

  // 将购买目标类型映射为内容作品闭集。
  private toContentWorkType(targetType: PurchaseTargetTypeEnum) {
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

  // 将购买目标类型映射为内容权益闭集。
  private toContentEntitlementTargetType(targetType: PurchaseTargetTypeEnum) {
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

  // 将数据库订单冻结值映射为内容购买价格读模型。
  private toPurchasePricingSnapshot(
    input: PurchasePricingSnapshotSource,
  ): PurchasePricingSnapshot {
    const payableRate = Number(input.payableRate)

    return {
      originalPrice: input.originalPrice,
      payableRate,
      payablePrice: input.paidPrice,
      discountAmount: input.originalPrice - input.paidPrice,
    }
  }

  // 从总数 SQL 投影提取数值，空结果按零处理以保留既有分页合同。
  private extractTotal(result: object | null | undefined) {
    const [row] = extractRows<{
      total?: bigint | number | string | null
    }>(result)
    return Number(row?.total ?? 0)
  }
}
