import { WorkViewPermissionEnum } from '@libs/base/constant'
import { BaseService, Prisma } from '@libs/base/database'
import { ContentPermissionService } from '@libs/content/permission'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import {
  PurchasedWorkChapterPageDto,
  PurchasedWorkPageDto,
  PurchaseTargetDto,
  QueryPurchasedWorkChapterDto,
  QueryPurchasedWorkDto,
  QueryUserPurchaseRecordDto,
} from './dto/purchase.dto'
import { PurchaseStatusEnum, PurchaseTargetTypeEnum } from './purchase.constant'

/**
 * 购买服务
 * 处理用户购买章节的核心逻辑，包括购买验证、支付处理、退款等
 */
@Injectable()
export class PurchaseService extends BaseService {
  private readonly logger = new Logger(PurchaseService.name)

  constructor(
    private readonly contentPermissionService: ContentPermissionService,
  ) {
    super()
  }

  /** 获取作品数据访问对象 */
  get work() {
    return this.prisma.work
  }

  /** 获取作品章节数据访问对象 */
  get workChapter() {
    return this.prisma.workChapter
  }

  /** 获取APP用户数据访问对象 */
  get appUser() {
    return this.prisma.appUser
  }

  /** 获取用户购买记录数据访问对象 */
  get userPurchaseRecord() {
    return this.prisma.userPurchaseRecord
  }

  /**
   * 检查当前目标是否需要购买
   */
  async checkNeedPurchase(
    targetType: PurchaseTargetTypeEnum,
    targetId: number,
    userId: number,
  ) {
    if (
      targetType !== PurchaseTargetTypeEnum.COMIC_CHAPTER &&
      targetType !== PurchaseTargetTypeEnum.NOVEL_CHAPTER
    ) {
      throw new BadRequestException('仅支持章节购买')
    }
    const { price, viewRule } =
      await this.contentPermissionService.resolveChapterPermission(targetId)

    if (viewRule !== WorkViewPermissionEnum.PURCHASE) {
      throw new BadRequestException('该章节禁止购买')
    }

    const existingPurchase =
      await this.contentPermissionService.validateChapterPurchasePermission(
        userId,
        targetId,
      )

    if (existingPurchase) {
      throw new BadRequestException('该章节已购买')
    }

    const user = await this.appUser.findUnique({
      where: { id: userId },
      select: { points: true },
    })
    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const deficitPoints = Math.max(price - user.points, 0)
    if (deficitPoints > 0) {
      throw new BadRequestException('积分不足')
    }

    return {
      targetPrice: price,
    }
  }

  /**
   * 购买目标内容（章节）
   * @param dto - 购买请求参数
   * @returns 购买记录
   * @throws BadRequestException 目标类型不支持或购买验证失败
   */
  async purchaseTarget(dto: PurchaseTargetDto) {
    const { targetType, targetId, userId, paymentMethod, outTradeNo } = dto

    const { targetPrice } = await this.checkNeedPurchase(
      targetType,
      targetId,
      userId,
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

        const updateResult = await tx.appUser.updateMany({
          where: {
            id: userId,
            points: {
              gte: targetPrice,
            },
          },
          data: {
            points: {
              decrement: targetPrice,
            },
          },
        })

        if (updateResult.count === 0) {
          const user = await tx.appUser.findUnique({
            where: { id: userId },
            select: { id: true },
          })
          if (!user) {
            this.logger.warn(
              `purchase_failed_user_not_found userId=${userId} targetType=${targetType} targetId=${targetId}`,
            )
            throw new BadRequestException('用户不存在')
          }
          this.logger.warn(
            `purchase_failed_points_not_enough userId=${userId} targetType=${targetType} targetId=${targetId} need=${targetPrice}`,
          )
          throw new BadRequestException('积分不足')
        }

        const user = await tx.appUser.findUniqueOrThrow({
          where: { id: userId },
          select: { points: true },
        })
        const afterPoints = user.points
        const beforePoints = afterPoints + targetPrice

        await tx.userPointRecord.create({
          data: {
            userId,
            points: -targetPrice,
            beforePoints,
            afterPoints,
            purchaseId: record.id,
            targetType,
            targetId,
            remark: '购买章节',
          },
        })

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
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        this.logger.warn(
          `purchase_failed_duplicate userId=${userId} targetType=${targetType} targetId=${targetId}`,
        )
        throw new BadRequestException('该章节已购买')
      }
      this.logger.error(
        `purchase_failed_unknown userId=${userId} targetType=${targetType} targetId=${targetId}`,
        error instanceof Error ? error.stack : undefined,
      )
      throw error
    }
  }

  /**
   * 获取用户购买记录列表
   * 支持分页查询
   * @param dto - 查询参数
   * @returns 分页购买记录
   */
  async getUserPurchases(dto: QueryUserPurchaseRecordDto) {
    const { userId, targetType, status, ...other } = dto
    return this.prisma.userPurchaseRecord.findPagination({
      where: {
        ...other,
        userId,
        targetType,
        status,
      },
    })
  }

  private normalizePagination(pageIndex?: number, pageSize?: number) {
    const rawPageIndex = Number.isFinite(Number(pageIndex))
      ? Math.floor(Number(pageIndex))
      : 0
    const normalizedPageIndex =
      rawPageIndex >= 1 ? rawPageIndex : Math.max(0, rawPageIndex)

    const rawPageSize = Number.isFinite(Number(pageSize))
      ? Math.floor(Number(pageSize))
      : 15
    const normalizedPageSize = Math.min(Math.max(1, rawPageSize), 500)

    const skip =
      normalizedPageIndex >= 1
        ? (normalizedPageIndex - 1) * normalizedPageSize
        : normalizedPageIndex * normalizedPageSize

    return {
      pageIndex: normalizedPageIndex,
      pageSize: normalizedPageSize,
      skip,
      take: normalizedPageSize,
    }
  }

  private buildCreatedAtFilter(startDate?: string, endDate?: string) {
    const filters: Prisma.Sql[] = []

    if (startDate) {
      const start = new Date(startDate)
      if (!Number.isNaN(start.getTime())) {
        filters.push(Prisma.sql`upr.created_at >= ${start}`)
      }
    }

    if (endDate) {
      const end = new Date(endDate)
      if (!Number.isNaN(end.getTime())) {
        end.setDate(end.getDate() + 1)
        filters.push(Prisma.sql`upr.created_at < ${end}`)
      }
    }

    if (filters.length === 0) {
      return Prisma.empty
    }

    return Prisma.sql` AND ${Prisma.join(filters, ' AND ')}`
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
      this.normalizePagination(pageIndex, pageSize)
    const createdAtFilter = this.buildCreatedAtFilter(startDate, endDate)
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
        WHERE upr.user_id = ${userId}
          AND upr.status = ${status}
          AND upr.target_type IN (${PurchaseTargetTypeEnum.COMIC_CHAPTER}, ${PurchaseTargetTypeEnum.NOVEL_CHAPTER})
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
      this.normalizePagination(pageIndex, pageSize)
    const createdAtFilter = this.buildCreatedAtFilter(startDate, endDate)
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
        WHERE upr.user_id = ${userId}
          AND upr.status = ${status}
          AND upr.target_type IN (${PurchaseTargetTypeEnum.COMIC_CHAPTER}, ${PurchaseTargetTypeEnum.NOVEL_CHAPTER})
          AND wc.work_id = ${workId}
          ${workTypeFilter}
          ${createdAtFilter}
        ORDER BY upr.created_at DESC
        LIMIT ${take} OFFSET ${skip}
      `),
      this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS "total"
        FROM user_purchase_record upr
        INNER JOIN work_chapter wc ON wc.id = upr.target_id
        WHERE upr.user_id = ${userId}
          AND upr.status = ${status}
          AND upr.target_type IN (${PurchaseTargetTypeEnum.COMIC_CHAPTER}, ${PurchaseTargetTypeEnum.NOVEL_CHAPTER})
          AND wc.work_id = ${workId}
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
