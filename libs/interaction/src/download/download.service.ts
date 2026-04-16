import type { SQL } from 'drizzle-orm'
import { DrizzleService } from '@db/core'
import { buildDateOnlyRangeInAppTimeZone } from '@libs/platform/utils/time';
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, inArray, sql } from 'drizzle-orm'
import {
  DOWNLOAD_WORK_CHAPTER_TARGET_TYPES,
  DownloadTargetTypeEnum,
} from './download.constant'
import {
  DownloadTargetCommandDto,
  QueryDownloadedWorkChapterCommandDto,
  QueryDownloadedWorkCommandDto,
} from './dto/download.dto'
import { IDownloadTargetResolver } from './interfaces/download-target-resolver.interface'

const DOWNLOAD_WORK_CHAPTER_TARGET_TYPES_SQL = sql.join(
  DOWNLOAD_WORK_CHAPTER_TARGET_TYPES.map((targetType) => sql`${targetType}`),
  sql`, `,
)

@Injectable()
export class DownloadService {
  private readonly resolvers = new Map<
    DownloadTargetTypeEnum,
    IDownloadTargetResolver
  >()

  constructor(private readonly drizzle: DrizzleService) {}

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
  private getResolver(targetType: DownloadTargetTypeEnum) {
    const resolver = this.resolvers.get(targetType)
    if (!resolver) {
      throw new BadRequestException('不支持的下载业务类型')
    }
    return resolver
  }

  private extractRows<T, TResult = object | null | undefined>(result: TResult) {
    if (!result || typeof result !== 'object' || !('rows' in result)) {
      return []
    }
    const rows = (result as { rows?: T[] }).rows
    return Array.isArray(rows) ? (rows) : []
  }

  private buildDownloadCreatedAtFilter(
    startDate?: string,
    endDate?: string,
  ): SQL {
    const filters: SQL[] = []
    const columnRef = sql`udr.created_at`
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

  /**
   * 执行下载逻辑
   * @param input 下载请求信息
   * @returns 章节内容
   */
  async downloadTarget(input: DownloadTargetCommandDto): Promise<string> {
    const { targetType, targetId, userId } = input
    const resolver = this.getResolver(targetType)

    return this.drizzle.withTransaction(async (tx) => {
      // 校验下载权限并获取内容（由各个业务方 Resolver 实现）
      const content = await resolver.ensureDownloadable(tx, targetId)

      // 通过唯一键保证下载记录幂等，避免重复计数
      const inserted = await tx
        .insert(this.userDownloadRecord)
        .values({
          targetType,
          targetId,
          userId,
        })
        .onConflictDoNothing()
        .returning({ id: this.userDownloadRecord.id })

      if (inserted.length > 0) {
        await resolver.applyCountDelta(tx, targetId, 1)
      }

      return content
    })
  }

  /**
   * 下载章节（对外通用接口）
   */
  async downloadChapter(input: DownloadTargetCommandDto) {
    return this.downloadTarget(input)
  }

  /**
   * 检查下载状态
   */
  async checkDownloadStatus(input: DownloadTargetCommandDto) {
    const record = await this.db.query.userDownloadRecord.findFirst({
      where: input,
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
  async getDownloadedWorks(query: QueryDownloadedWorkCommandDto) {
    const { userId, workType, pageIndex, pageSize, startDate, endDate } = query
    const page = this.drizzle.buildPage({ pageIndex, pageSize })
    const createdAtFilter = this.buildDownloadCreatedAtFilter(
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
          AND udr.target_type IN (${DOWNLOAD_WORK_CHAPTER_TARGET_TYPES_SQL})
          ${workTypeFilter}
          ${createdAtFilter}
        GROUP BY wc.work_id, w.type, w.name, w.cover
        ORDER BY MAX(udr.created_at) DESC
        LIMIT ${page.limit} OFFSET ${page.offset}
      `),
      this.db.execute(sql`
        SELECT COUNT(DISTINCT wc.work_id)::bigint AS "total"
        FROM user_download_record udr
        INNER JOIN work_chapter wc ON wc.id = udr.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE udr.user_id = ${userId}
          AND udr.target_type IN (${DOWNLOAD_WORK_CHAPTER_TARGET_TYPES_SQL})
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
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  /**
   * 获取已下载章节列表
   */
  async getDownloadedWorkChapters(query: QueryDownloadedWorkChapterCommandDto) {
    const {
      userId,
      workId,
      workType,
      pageIndex,
      pageSize,
      startDate,
      endDate,
    } = query
    const page = this.drizzle.buildPage({ pageIndex, pageSize })
    const createdAtFilter = this.buildDownloadCreatedAtFilter(
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
          AND udr.target_type IN (${DOWNLOAD_WORK_CHAPTER_TARGET_TYPES_SQL})
          AND wc.work_id = ${workId}
          ${workTypeFilter}
          ${createdAtFilter}
        ORDER BY udr.created_at DESC
        LIMIT ${page.limit} OFFSET ${page.offset}
      `),
      this.db.execute(sql`
        SELECT COUNT(*)::bigint AS "total"
        FROM user_download_record udr
        INNER JOIN work_chapter wc ON wc.id = udr.target_id
        INNER JOIN work w ON w.id = wc.work_id
        WHERE udr.user_id = ${userId}
          AND udr.target_type IN (${DOWNLOAD_WORK_CHAPTER_TARGET_TYPES_SQL})
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
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }
}
