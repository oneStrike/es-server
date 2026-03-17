import {
  buildColumnDateRangeSqlFilter,
  DrizzleService,
  normalizePagination,
} from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { DownloadTargetTypeEnum } from './download.constant'
import {
  DownloadedWorkChapterPageDto,
  DownloadedWorkPageDto,
  QueryDownloadedWorkChapterDto,
  QueryDownloadedWorkDto,
  UserDownloadRecordKeyDto,
} from './dto/download.dto'
import { IDownloadTargetResolver } from './interfaces/download-target-resolver.interface'

@Injectable()
export class DownloadService {
  private readonly resolvers = new Map<
    DownloadTargetTypeEnum,
    IDownloadTargetResolver
  >()

  constructor(
    private readonly drizzle: DrizzleService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get userDownloadRecord() {
    return this.drizzle.schema.userDownloadRecord
  }

  /**
   * 注册下载目标解析器
   */
  registerResolver(resolver: IDownloadTargetResolver) {
    if (this.resolvers.has(resolver.targetType)) {
      console.warn(
        `Download resolver for type ${resolver.targetType} is being overwritten.`,
      )
    }
    this.resolvers.set(resolver.targetType, resolver)
  }

  /**
   * 获取指定的下载解析器
   */
  private getResolver(
    targetType: DownloadTargetTypeEnum,
  ): IDownloadTargetResolver {
    const resolver = this.resolvers.get(targetType)
    if (!resolver) {
      throw new BadRequestException('不支持的下载业务类型')
    }
    return resolver
  }

  private extractRows<T>(result: unknown): T[] {
    if (!result || typeof result !== 'object' || !('rows' in result)) {
      return []
    }
    const rows = (result as { rows?: unknown }).rows
    return Array.isArray(rows) ? (rows as T[]) : []
  }

  /**
   * 执行下载逻辑
   * @param dto 下载请求信息
   * @returns 章节内容
   */
  async downloadTarget(dto: UserDownloadRecordKeyDto): Promise<string> {
    const { targetType, targetId, userId } = dto
    const resolver = this.getResolver(targetType)

    try {
      return await this.db.transaction(async (tx) => {
        // 校验下载权限并获取内容（由各个业务方 Resolver 实现）
        const content = await resolver.ensureDownloadable(tx, targetId)

        // 记录下载记录
        await tx.insert(this.userDownloadRecord).values({
          targetType,
          targetId,
          userId,
        })

        // 更新各业务方下载计数
        await resolver.applyCountDelta(tx, targetId, 1)

        return content
      })
    } catch (error) {
      let duplicateDownload = false
      try {
        await this.drizzle.withErrorHandling(
          async () => {
            throw error
          },
          {
            duplicate: '__DOWNLOAD_DUPLICATE__',
          },
        )
      } catch (mappedError) {
        duplicateDownload = mappedError instanceof Error
          && mappedError.message === '__DOWNLOAD_DUPLICATE__'
        if (!duplicateDownload) {
          throw mappedError
        }
      }

      if (duplicateDownload) {
        return this.db.transaction(async (tx) => {
          return resolver.ensureDownloadable(tx, targetId)
        })
      }
      throw error
    }
  }

  /**
   * 下载章节（对外通用接口）
   */
  async downloadChapter(dto: UserDownloadRecordKeyDto) {
    return this.downloadTarget(dto)
  }

  /**
   * 检查下载状态
   */
  async checkDownloadStatus(dto: UserDownloadRecordKeyDto) {
    const record = await this.db.query.userDownloadRecord.findFirst({
      where: dto,
      columns: {
        id: true,
      },
    })
    return Boolean(record)
  }

  /**
   * 批量检查状态
   */
  async checkStatusBatch(
    targetType: DownloadTargetTypeEnum,
    targetIds: number[],
    userId: number,
  ) {
    if (targetIds.length === 0) {
      return new Map()
    }

    const uniqueTargetIds = [...new Set(targetIds)]

    const downloads = await this.db
      .select({
        targetId: this.userDownloadRecord.targetId,
      })
      .from(this.userDownloadRecord)
      .where(
        and(
          eq(this.userDownloadRecord.targetType, targetType),
          inArray(this.userDownloadRecord.targetId, uniqueTargetIds),
          eq(this.userDownloadRecord.userId, userId),
        ),
      )

    const downloadedIds = new Set(downloads.map((d) => d.targetId))

    const result = new Map<number, boolean>(
      uniqueTargetIds.map((id) => [id, false]),
    )
    for (const id of downloadedIds) {
      result.set(id, true)
    }

    return result
  }

  /**
   * 获取已下载作品列表
   */
  async getDownloadedWorks(
    dto: QueryDownloadedWorkDto,
  ): Promise<DownloadedWorkPageDto> {
    const { userId, workType, pageIndex, pageSize, startDate, endDate } = dto
    const {
      pageIndex: normalizedPageIndex,
      pageSize: normalizedPageSize,
      skip,
      take,
    } = normalizePagination(pageIndex, pageSize)
    const createdAtFilter = buildColumnDateRangeSqlFilter(
      'udr.created_at',
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
          COUNT(*)::bigint AS "downloadedChapterCount",
          MAX(udr.created_at) AS "lastDownloadedAt"
        FROM user_download_record udr
        INNER JOIN work_chapter wc ON wc.id = udr.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE udr.user_id = ${userId}
          AND udr.target_type IN (${DownloadTargetTypeEnum.COMIC_CHAPTER}, ${DownloadTargetTypeEnum.NOVEL_CHAPTER})
          ${workTypeFilter}
          ${createdAtFilter}
        GROUP BY wc.work_id, w.type, w.name, w.cover
        ORDER BY MAX(udr.created_at) DESC
        LIMIT ${take} OFFSET ${skip}
      `),
      this.db.execute(sql`
        SELECT COUNT(DISTINCT wc.work_id)::bigint AS "total"
        FROM user_download_record udr
        INNER JOIN work_chapter wc ON wc.id = udr.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE udr.user_id = ${userId}
          AND udr.target_type IN (${DownloadTargetTypeEnum.COMIC_CHAPTER}, ${DownloadTargetTypeEnum.NOVEL_CHAPTER})
          ${workTypeFilter}
          ${createdAtFilter}
      `),
    ])
    const rows = this.extractRows<{
      workId: number
      workType: number
      workName: string
      workCover: string
      downloadedChapterCount: bigint
      lastDownloadedAt: Date
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
        downloadedChapterCount: Number(row.downloadedChapterCount),
        lastDownloadedAt: row.lastDownloadedAt,
      })),
      total,
      pageIndex: normalizedPageIndex,
      pageSize: normalizedPageSize,
    }
  }

  /**
   * 获取已下载章节列表
   */
  async getDownloadedWorkChapters(
    dto: QueryDownloadedWorkChapterDto,
  ): Promise<DownloadedWorkChapterPageDto> {
    const {
      userId,
      workId,
      workType,
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
      'udr.created_at',
      startDate,
      endDate,
    )
    const workTypeFilter = workType
      ? sql` AND wc.work_type = ${workType}`
      : sql.empty()

    const [rowsResult, totalRowsResult] = await Promise.all([
      this.db.execute(sql`
        SELECT
          udr.id AS "id",
          udr.target_type AS "targetType",
          udr.target_id AS "targetId",
          udr.user_id AS "userId",
          udr.created_at AS "createdAt",
          wc.id AS "chapterId",
          wc.work_id AS "chapterWorkId",
          wc.work_type AS "chapterWorkType",
          wc.title AS "chapterTitle",
          wc.subtitle AS "chapterSubtitle",
          wc.cover AS "chapterCover",
          wc.sort_order AS "chapterSortOrder",
          wc.is_published AS "chapterIsPublished",
          wc.publish_at AS "chapterPublishAt"
        FROM user_download_record udr
        INNER JOIN work_chapter wc ON wc.id = udr.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE udr.user_id = ${userId}
          AND udr.target_type IN (${DownloadTargetTypeEnum.COMIC_CHAPTER}, ${DownloadTargetTypeEnum.NOVEL_CHAPTER})
          AND wc.work_id = ${workId}
          ${workTypeFilter}
          ${createdAtFilter}
        ORDER BY udr.created_at DESC
        LIMIT ${take} OFFSET ${skip}
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::bigint AS "total"
        FROM user_download_record udr
        INNER JOIN work_chapter wc ON wc.id = udr.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE udr.user_id = ${userId}
          AND udr.target_type IN (${DownloadTargetTypeEnum.COMIC_CHAPTER}, ${DownloadTargetTypeEnum.NOVEL_CHAPTER})
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
      createdAt: Date
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
        createdAt: row.createdAt,
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
