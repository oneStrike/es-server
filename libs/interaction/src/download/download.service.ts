import { ContentTypeEnum } from '@libs/base/constant'
import { BaseService, Prisma } from '@libs/base/database'
import { ContentPermissionService } from '@libs/content/permission'
import { BadRequestException, Injectable } from '@nestjs/common'
import { DownloadTargetTypeEnum } from './download.constant'
import {
  DownloadedWorkChapterPageDto,
  DownloadedWorkPageDto,
  QueryDownloadedWorkChapterDto,
  QueryDownloadedWorkDto,
  QueryUserDownloadRecordDto,
  UserDownloadRecordKeyDto,
} from './dto/download.dto'

@Injectable()
export class DownloadService extends BaseService {
  constructor(
    private readonly contentPermissionService: ContentPermissionService,
  ) {
    super()
  }

  get userDownloadRecord() {
    return this.prisma.userDownloadRecord
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
        filters.push(Prisma.sql`udr.created_at >= ${start}`)
      }
    }

    if (endDate) {
      const end = new Date(endDate)
      if (!Number.isNaN(end.getTime())) {
        end.setDate(end.getDate() + 1)
        filters.push(Prisma.sql`udr.created_at < ${end}`)
      }
    }

    if (filters.length === 0) {
      return Prisma.empty
    }

    return Prisma.sql` AND ${Prisma.join(filters, ' AND ')}`
  }

  async downloadTarget(
    dto: UserDownloadRecordKeyDto,
    chapterPermission?: Awaited<
      ReturnType<ContentPermissionService['resolveChapterPermission']>
    >,
  ) {
    const { targetType, targetId, userId } = dto

    if (
      targetType !== DownloadTargetTypeEnum.COMIC_CHAPTER &&
      targetType !== DownloadTargetTypeEnum.NOVEL_CHAPTER
    ) {
      throw new BadRequestException('不支持的目标类型')
    }

    await this.contentPermissionService.checkChapterDownload(
      userId,
      targetId,
      chapterPermission,
    )

    return this.prisma.$transaction(async (tx) => {
      await tx.userDownloadRecord.create({
        data: dto,
      })

      const workChapter = await tx.workChapter.update({
        where: { id: targetId },
        data: { downloadCount: { increment: 1 } },
        select: { content: true },
      })
      if (!workChapter.content) {
        throw new BadRequestException('下载内容不存在')
      }
      return workChapter.content
    })
  }

  async downloadChapter(userId: number, chapterId: number) {
    const chapterPermission =
      await this.contentPermissionService.resolveChapterPermission(chapterId)

    if (chapterPermission.workType === ContentTypeEnum.COMIC) {
      return this.downloadTarget(
        {
          targetType: DownloadTargetTypeEnum.COMIC_CHAPTER,
          targetId: chapterId,
          userId,
        },
        chapterPermission,
      )
    }

    if (chapterPermission.workType === ContentTypeEnum.NOVEL) {
      return this.downloadTarget(
        {
          targetType: DownloadTargetTypeEnum.NOVEL_CHAPTER,
          targetId: chapterId,
          userId,
        },
        chapterPermission,
      )
    }

    throw new BadRequestException('不支持的章节类型')
  }

  async checkDownloadStatus(dto: UserDownloadRecordKeyDto) {
    return this.userDownloadRecord.exists(dto)
  }

  async checkStatusBatch(
    targetType: DownloadTargetTypeEnum,
    targetIds: number[],
    userId: number,
  ) {
    if (targetIds.length === 0) {
      return new Map()
    }

    const uniqueTargetIds = [...new Set(targetIds)]

    const downloads = await this.userDownloadRecord.findMany({
      where: {
        targetType,
        targetId: { in: uniqueTargetIds },
        userId,
      },
      select: {
        targetId: true,
      },
    })

    const downloadedIds = new Set(downloads.map((d) => d.targetId))

    const result = new Map<number, boolean>(
      uniqueTargetIds.map((id) => [id, false]),
    )
    for (const id of downloadedIds) {
      result.set(id, true)
    }

    return result
  }

  async recordDownload(dto: UserDownloadRecordKeyDto) {
    return this.userDownloadRecord.create({
      data: dto,
    })
  }

  async deleteDownloadRecord(id: number) {
    return this.userDownloadRecord.delete({
      where: { id },
    })
  }

  async getUserDownloadRecord(dto: QueryUserDownloadRecordDto) {
    const { userId, targetType, ...restDto } = dto

    return this.userDownloadRecord.findPagination({
      where: {
        ...restDto,
        userId,
        ...(targetType && { targetType }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  async getDownloadedWorks(
    dto: QueryDownloadedWorkDto,
  ): Promise<DownloadedWorkPageDto> {
    const { userId, workType, pageIndex, pageSize, startDate, endDate } = dto
    const {
      pageIndex: normalizedPageIndex,
      pageSize: normalizedPageSize,
      skip,
      take,
    } = this.normalizePagination(pageIndex, pageSize)
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
          downloadedChapterCount: bigint
          lastDownloadedAt: Date
        }>
      >(Prisma.sql`
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
      this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
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
    } = this.normalizePagination(pageIndex, pageSize)
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
        }>
      >(Prisma.sql`
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
        WHERE udr.user_id = ${userId}
          AND udr.target_type IN (${DownloadTargetTypeEnum.COMIC_CHAPTER}, ${DownloadTargetTypeEnum.NOVEL_CHAPTER})
          AND wc.work_id = ${workId}
          ${workTypeFilter}
          ${createdAtFilter}
        ORDER BY udr.created_at DESC
        LIMIT ${take} OFFSET ${skip}
      `),
      this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS "total"
        FROM user_download_record udr
        INNER JOIN work_chapter wc ON wc.id = udr.target_id
        WHERE udr.user_id = ${userId}
          AND udr.target_type IN (${DownloadTargetTypeEnum.COMIC_CHAPTER}, ${DownloadTargetTypeEnum.NOVEL_CHAPTER})
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
