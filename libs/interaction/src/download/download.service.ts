import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, inArray, sql } from 'drizzle-orm'
import {
  assertCursorOnlyQuery,
  encodeCreatedAtIdCursor,
  parseCreatedAtIdCursor,
  toCursorPageResult,
} from '../favorite/cursor-pagination.helper'
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
      const content = await resolver.ensureDownloadable(tx, targetId, userId)

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
    assertCursorOnlyQuery(query, '已下载作品列表')
    const { userId, workType, pageSize } = query
    const page = this.drizzle.buildPage({ pageSize })
    const cursor = parseCreatedAtIdCursor(query.cursor, '已下载作品列表')
    const workTypeFilter = workType
      ? sql` AND w.type = ${workType}`
      : sql.empty()
    const cursorHaving = cursor
      ? sql` HAVING MAX(udr.created_at) < ${cursor.createdAt} OR (MAX(udr.created_at) = ${cursor.createdAt} AND wc.work_id < ${cursor.id})`
      : sql.empty()
    const rowsResult = await this.db.execute(sql`
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
        GROUP BY wc.work_id, w.type, w.name, w.cover
        ${cursorHaving}
        ORDER BY MAX(udr.created_at) DESC, wc.work_id DESC
        LIMIT ${page.limit + 1}
      `)
    const rows = this.extractRows<{
      workId: number
      workType: number
      workName: string
      workCover: string
      downloadedChapterCount: bigint
      lastDownloadedAt: Date
    }>(rowsResult)
    const pageResult = toCursorPageResult(rows, page.limit, (row) =>
      encodeCreatedAtIdCursor({
        createdAt: row.lastDownloadedAt,
        id: row.workId,
      }),
    )

    return {
      ...pageResult,
      list: pageResult.list.map((row) => ({
        work: {
          id: row.workId,
          type: row.workType,
          name: row.workName,
          cover: row.workCover,
        },
        downloadedChapterCount: Number(row.downloadedChapterCount),
        lastDownloadedAt: row.lastDownloadedAt,
      })),
    }
  }

  /**
   * 获取已下载章节列表
   */
  async getDownloadedWorkChapters(query: QueryDownloadedWorkChapterCommandDto) {
    const { userId, workId, workType, pageSize } = query
    assertCursorOnlyQuery(query, '已下载章节列表')
    const page = this.drizzle.buildPage({ pageSize })
    const cursor = parseCreatedAtIdCursor(query.cursor, '已下载章节列表')
    const workTypeFilter = workType
      ? sql` AND wc.work_type = ${workType}`
      : sql.empty()
    const cursorFilter = cursor
      ? sql` AND (udr.created_at < ${cursor.createdAt} OR (udr.created_at = ${cursor.createdAt} AND udr.id < ${cursor.id}))`
      : sql.empty()
    const rowsResult = await this.db.execute(sql`
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
          ${cursorFilter}
        ORDER BY udr.created_at DESC, udr.id DESC
        LIMIT ${page.limit + 1}
      `)
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
    const pageResult = toCursorPageResult(rows, page.limit, (row) =>
      encodeCreatedAtIdCursor(row),
    )

    return {
      ...pageResult,
      list: pageResult.list.map((row) => ({
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
    }
  }
}
