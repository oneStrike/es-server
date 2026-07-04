import type { WorkChapterSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService, toPageResult } from '@db/core'

import { BrowseLogTargetTypeEnum } from '@libs/interaction/browse-log/browse-log.constant'
import { BrowseLogService } from '@libs/interaction/browse-log/browse-log.service'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { DownloadTargetTypeEnum } from '@libs/interaction/download/download.constant'
import { DownloadService } from '@libs/interaction/download/download.service'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import { LikeService } from '@libs/interaction/like/like.service'
import { ReadingStateService } from '@libs/interaction/reading-state/reading-state.service'
import {
  BusinessErrorCode,
  ContentTypeEnum,
  WorkTypeEnum,
} from '@libs/platform/constant'

import { BatchUpdatePublishedStatusDto } from '@libs/platform/dto'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { ContentPermissionService } from '../../permission/content-permission.service'
import {
  AdminWorkChapterDetailDto,
  CreateWorkChapterDto,
  QueryAppWorkChapterPageDto,
  QueryWorkChapterDto,
  UpdateWorkChapterDto,
} from './dto/work-chapter.dto'
import {
  AdminChapterPageRow,
  AppChapterPageRow,
  SwapWorkChapterNumbersInput,
  WorkChapterDetailContext,
  WorkChapterPublicDetailRow,
} from './work-chapter.type'

/**
 * 作品章节服务
 * 负责处理作品章节的 CRUD 操作、交互状态查询、相邻章节导航等功能
 */
@Injectable()
export class WorkChapterService {
  // 初始化 WorkChapterService 依赖。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly likeService: LikeService,
    private readonly browseLogService: BrowseLogService,
    private readonly downloadService: DownloadService,
    private readonly contentPermissionService: ContentPermissionService,
    private readonly readingStateService: ReadingStateService,
  ) {}

  // 统一复用当前模块的 Drizzle 数据库实例。
  private get db() {
    return this.drizzle.db
  }

  // work_chapter 表访问入口。
  get workChapter() {
    return this.drizzle.schema.workChapter
  }

  // work 表访问入口。
  get work() {
    return this.drizzle.schema.work
  }

  // app_user 表访问入口。
  get appUser() {
    return this.drizzle.schema.appUser
  }

  // 构建 app/public 章节详情响应，明确裁剪 remark、删除标记和后台挂载对象，避免公开接口直接暴露内部字段。
  private buildPublicChapterDetail(chapter: WorkChapterPublicDetailRow) {
    return {
      id: chapter.id,
      workId: chapter.workId,
      workType: chapter.workType,
      title: chapter.title,
      subtitle: chapter.subtitle ?? null,
      cover: chapter.cover ?? null,
      description: chapter.description ?? null,
      sortOrder: chapter.sortOrder,
      isPublished: chapter.isPublished,
      isPreview: chapter.isPreview,
      publishAt: chapter.publishAt ?? null,
      viewRule: chapter.resolvedViewRule ?? chapter.viewRule,
      requiredViewLevelId:
        chapter.resolvedRequiredViewLevelId ??
        chapter.requiredViewLevelId ??
        null,
      purchasePricing: chapter.purchasePricing ?? null,
      canDownload: chapter.canDownload,
      canComment: chapter.canComment,
      content: chapter.content ?? null,
      wordCount: chapter.wordCount,
      viewCount: chapter.viewCount,
      likeCount: chapter.likeCount,
      commentCount: chapter.commentCount,
      purchaseCount: chapter.purchaseCount,
      downloadCount: chapter.downloadCount,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
    }
  }

  private buildAdminChapterDetail(
    chapter: WorkChapterSelect & {
      content: string | string[] | null
      work: {
        id: number
        name: string
        type: number
      } | null
      requiredViewLevel: {
        id: number
        name: string
        color: string | null
      } | null
    },
  ): AdminWorkChapterDetailDto {
    if (!chapter.work) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '章节所属作品不存在',
      )
    }

    return {
      id: chapter.id,
      workId: chapter.workId,
      workType: chapter.workType,
      title: chapter.title,
      subtitle: chapter.subtitle ?? null,
      cover: chapter.cover ?? null,
      description: chapter.description ?? null,
      sortOrder: chapter.sortOrder,
      isPublished: chapter.isPublished,
      isPreview: chapter.isPreview,
      publishAt: chapter.publishAt ?? null,
      viewRule: chapter.viewRule,
      requiredViewLevelId: chapter.requiredViewLevelId ?? null,
      price: chapter.price,
      canDownload: chapter.canDownload,
      canComment: chapter.canComment,
      content: chapter.content ?? null,
      wordCount: chapter.wordCount,
      viewCount: chapter.viewCount,
      likeCount: chapter.likeCount,
      commentCount: chapter.commentCount,
      purchaseCount: chapter.purchaseCount,
      downloadCount: chapter.downloadCount,
      remark: chapter.remark ?? null,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
      work: {
        id: chapter.work.id,
        name: chapter.work.name,
        type: chapter.work.type,
      },
      requiredViewLevel: chapter.requiredViewLevel
        ? {
            id: chapter.requiredViewLevel.id,
            name: chapter.requiredViewLevel.name,
            color: chapter.requiredViewLevel.color ?? null,
          }
        : null,
    }
  }

  // 创建章节。
  async createChapter(
    createDto: CreateWorkChapterDto,
    expectedType: WorkTypeEnum,
  ) {
    await this.createChapterReturningId(createDto, expectedType)
    return true
  }

  // 创建章节并返回本地章节 ID，供导入链路继续写入图片内容。
  async createChapterReturningId(
    createDto: CreateWorkChapterDto,
    expectedType: WorkTypeEnum,
  ) {
    const { workId, workType } = createDto

    if (workType !== expectedType) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '章节类型与当前内容域不一致',
      )
    }

    if (!(await this.workExists(workId, expectedType))) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '关联的作品不存在',
      )
    }

    return this.drizzle.withErrorHandling(
      async () => {
        const [createdChapter] = await this.db
          .insert(this.workChapter)
          .values(createDto)
          .returning({ id: this.workChapter.id })

        if (!createdChapter) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '章节创建结果不存在',
          )
        }

        return createdChapter.id
      },
      { duplicate: '该作品下章节号已存在' },
    )
  }

  private buildAdminChapterPageConditions(
    dto: QueryWorkChapterDto,
    expectedType?: WorkTypeEnum,
  ) {
    const conditions: SQL[] = [isNull(this.workChapter.deletedAt)]
    if (expectedType) {
      conditions.push(eq(this.workChapter.workType, expectedType))
    }

    if (dto.workId !== undefined) {
      conditions.push(eq(this.workChapter.workId, dto.workId))
    }
    if (dto.isPublished !== undefined) {
      conditions.push(eq(this.workChapter.isPublished, dto.isPublished))
    }
    if (dto.isPreview !== undefined) {
      conditions.push(eq(this.workChapter.isPreview, dto.isPreview))
    }
    if (dto.viewRule !== undefined) {
      conditions.push(eq(this.workChapter.viewRule, dto.viewRule))
    }
    if (dto.canDownload !== undefined) {
      conditions.push(eq(this.workChapter.canDownload, dto.canDownload))
    }
    if (dto.canComment !== undefined) {
      conditions.push(eq(this.workChapter.canComment, dto.canComment))
    }
    if (dto.title) {
      conditions.push(buildILikeCondition(this.workChapter.title, dto.title)!)
    }

    return conditions
  }

  // 分页查询 app 公开章节列表。
  async getAppChapterPage(
    dto: QueryAppWorkChapterPageDto,
    _context: { userId?: number } = {},
  ) {
    const now = new Date()
    const pageParams = this.drizzle.buildPageParams(dto, {
      table: this.workChapter,
      fallbackOrderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    const conditions: SQL[] = [
      isNull(this.workChapter.deletedAt),
      eq(this.workChapter.workId, dto.workId),
      eq(this.workChapter.isPublished, true),
      or(
        isNull(this.workChapter.publishAt),
        lte(this.workChapter.publishAt, now),
      )!,
    ]
    if (pageParams.dateRange?.gte) {
      conditions.push(gte(this.workChapter.publishAt, pageParams.dateRange.gte))
    }
    if (pageParams.dateRange?.lt) {
      conditions.push(lt(this.workChapter.publishAt, pageParams.dateRange.lt))
    }

    const where = and(...conditions)
    const [list, total] = await Promise.all([
      this.db
        .select(this.appChapterPageColumns())
        .from(this.workChapter)
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(this.workChapter, where),
    ])

    return this.buildAppChapterPageResponse(
      toPageResult(list, total, pageParams.page),
    )
  }

  private async buildAppChapterPageResponse(page: {
    list: AppChapterPageRow[]
    total: number
    pageIndex: number
    pageSize: number
  }) {
    if (page.list.length === 0) {
      return { ...page, list: [] }
    }

    const permissionMap =
      await this.contentPermissionService.resolveChapterPermissionsFromData(
        page.list,
      )

    return {
      ...page,
      list: page.list.map((chapter) => {
        const permission = permissionMap.get(chapter.id)

        return {
          id: chapter.id,
          isPreview: chapter.isPreview,
          cover: chapter.cover ?? null,
          title: chapter.title,
          subtitle: chapter.subtitle ?? null,
          canComment: chapter.canComment,
          sortOrder: chapter.sortOrder,
          viewRule: permission?.viewRule ?? chapter.viewRule,
          canDownload: chapter.canDownload,
          purchasePricing: permission?.purchasePricing ?? null,
          publishAt: chapter.publishAt ?? null,
          createdAt: chapter.createdAt,
          updatedAt: chapter.updatedAt,
          isPublished: chapter.isPublished,
        }
      }),
    }
  }

  // 分页查询 admin 管理章节列表。
  async getAdminChapterPage(
    dto: QueryWorkChapterDto,
    expectedType: WorkTypeEnum,
  ) {
    const where = and(
      ...this.buildAdminChapterPageConditions(dto, expectedType),
    )
    const orderBy = dto.orderBy?.trim()
      ? dto.orderBy
      : { sortOrder: 'asc' as const }

    const page = await this.findAdminChapterPage({
      where: where!,
      pageIndex: dto.pageIndex,
      pageSize: dto.pageSize,
      orderBy,
    })

    return {
      ...page,
      list: page.list.map((chapter) => ({
        id: chapter.id,
        workId: chapter.workId,
        workType: chapter.workType,
        isPreview: chapter.isPreview,
        cover: chapter.cover ?? null,
        title: chapter.title,
        subtitle: chapter.subtitle ?? null,
        price: chapter.price,
        canComment: chapter.canComment,
        sortOrder: chapter.sortOrder,
        viewRule: chapter.viewRule,
        canDownload: chapter.canDownload,
        requiredViewLevelId: chapter.requiredViewLevelId ?? null,
        publishAt: chapter.publishAt ?? null,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
        isPublished: chapter.isPublished,
      })),
    }
  }

  // 获取 chapter Comment Target。
  async getChapterCommentTarget(id: number) {
    const chapter = await this.db.query.workChapter.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        workId: true,
        workType: true,
      },
    })

    if (!chapter) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '章节不存在',
      )
    }

    const work = await this.db.query.work.findFirst({
      where: {
        id: chapter.workId,
        deletedAt: { isNull: true },
      },
      columns: {
        isPublished: true,
      },
    })

    if (!work || !work.isPublished) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '章节所属作品未发布或不存在',
      )
    }

    if (chapter.workType === ContentTypeEnum.COMIC) {
      return {
        targetType: CommentTargetTypeEnum.COMIC_CHAPTER,
        targetId: chapter.id,
      }
    }

    if (chapter.workType === ContentTypeEnum.NOVEL) {
      return {
        targetType: CommentTargetTypeEnum.NOVEL_CHAPTER,
        targetId: chapter.id,
      }
    }

    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '章节类型不支持评论',
    )
  }

  // 获取章节详情，未登录用户返回基础信息，登录用户额外返回交互状态（点赞、收藏、下载、购买）。
  async getChapterDetail(id: number, context: WorkChapterDetailContext = {}) {
    const {
      userId,
      ipAddress,
      device,
      bypassVisibilityCheck = false,
      expectedType,
    } = context
    const chapter = await this.db.query.workChapter.findFirst({
      where: {
        id,
        ...(expectedType ? { workType: expectedType } : {}),
        deletedAt: { isNull: true },
      },
      with: {
        work: {
          columns: {
            id: true,
            name: true,
            type: true,
          },
        },
        requiredViewLevel: {
          columns: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    })

    if (!chapter) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '章节不存在',
      )
    }

    const parsedContent = this.resolveChapterContent(chapter)
    const resolvedPermission = bypassVisibilityCheck
      ? undefined
      : await this.contentPermissionService.resolveChapterPermission(id, userId)

    // 未登录用户直接返回基础信息
    if (!userId) {
      if (bypassVisibilityCheck) {
        return this.buildAdminChapterDetail({
          ...chapter,
          content: parsedContent,
        })
      }

      return {
        ...this.buildPublicChapterDetail({
          ...chapter,
          content: parsedContent,
          resolvedViewRule: resolvedPermission?.viewRule,
          resolvedRequiredViewLevelId:
            resolvedPermission?.requiredViewLevelId ?? null,
          purchasePricing: resolvedPermission?.purchasePricing ?? null,
        }),
        liked: false,
        downloaded: false,
        purchased: false,
      }
    }

    const downloadTargetType =
      chapter.workType === ContentTypeEnum.COMIC
        ? DownloadTargetTypeEnum.COMIC_CHAPTER
        : DownloadTargetTypeEnum.NOVEL_CHAPTER
    const likeTargetType =
      chapter.workType === ContentTypeEnum.COMIC
        ? LikeTargetTypeEnum.WORK_COMIC_CHAPTER
        : LikeTargetTypeEnum.WORK_NOVEL_CHAPTER

    // 并行查询三个交互状态
    const [liked, downloaded, purchased] = await Promise.all([
      this.likeService.checkLikeStatus({
        targetType: likeTargetType,
        targetId: id,
        userId,
      }),
      this.downloadService.checkDownloadStatus({
        targetType: downloadTargetType,
        targetId: id,
        userId,
      }),
      this.contentPermissionService.validateChapterPurchasePermission(
        userId,
        id,
      ),
    ])

    const browseTargetType =
      chapter.workType === ContentTypeEnum.COMIC
        ? BrowseLogTargetTypeEnum.COMIC_CHAPTER
        : BrowseLogTargetTypeEnum.NOVEL_CHAPTER

    await this.browseLogService.recordBrowseLogSafely(
      browseTargetType,
      id,
      userId,
      ipAddress,
      device,
      undefined,
      {
        skipTargetValidation: true,
        deferPostProcess: true,
      },
    )

    await this.readingStateService.touchByWorkSafely({
      userId,
      workId: chapter.workId,
      workType: chapter.workType,
      lastReadChapterId: id,
    })

    const detail = {
      ...chapter,
      content: parsedContent,
      viewCount: chapter.viewCount + 1,
      liked,
      downloaded,
      purchased,
      resolvedViewRule: resolvedPermission?.viewRule,
      resolvedRequiredViewLevelId:
        resolvedPermission?.requiredViewLevelId ?? null,
      purchasePricing: resolvedPermission?.purchasePricing ?? null,
    }

    if (bypassVisibilityCheck) {
      return this.buildAdminChapterDetail({
        ...chapter,
        content: parsedContent,
        viewCount: detail.viewCount,
      })
    }

    return {
      ...this.buildPublicChapterDetail(detail),
      liked,
      downloaded,
      purchased,
    }
  }

  private resolveChapterContent(chapter: {
    workType: number
    comicContentManifest?: unknown
    novelContentPath?: string | null
  }) {
    if (chapter.workType === ContentTypeEnum.COMIC) {
      if (!Array.isArray(chapter.comicContentManifest)) {
        return []
      }

      return chapter.comicContentManifest.filter(
        (item): item is string => typeof item === 'string',
      )
    }

    if (chapter.workType === ContentTypeEnum.NOVEL) {
      return chapter.novelContentPath ?? null
    }

    return null
  }

  // 获取上一章详情。
  async getPreviousChapterDetail(
    id: number,
    context: WorkChapterDetailContext = {},
  ) {
    return this.getAdjacentChapterDetail(id, 'previous', context)
  }

  // 获取下一章详情。
  async getNextChapterDetail(
    id: number,
    context: WorkChapterDetailContext = {},
  ) {
    return this.getAdjacentChapterDetail(id, 'next', context)
  }

  // 获取相邻章节详情（私有方法），根据 sortOrder 查找相邻章节。
  private async getAdjacentChapterDetail(
    id: number,
    direction: 'previous' | 'next',
    context: WorkChapterDetailContext = {},
  ) {
    const { expectedType } = context
    const currentChapter = await this.db.query.workChapter.findFirst({
      where: {
        id,
        ...(expectedType ? { workType: expectedType } : {}),
        deletedAt: { isNull: true },
      },
      columns: {
        workId: true,
        sortOrder: true,
      },
    })

    if (!currentChapter) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '章节不存在',
      )
    }

    const adjacentChapter = await this.db.query.workChapter.findFirst({
      where:
        direction === 'previous'
          ? {
              workId: currentChapter.workId,
              ...(expectedType ? { workType: expectedType } : {}),
              sortOrder: { lt: currentChapter.sortOrder },
              deletedAt: { isNull: true },
            }
          : {
              workId: currentChapter.workId,
              ...(expectedType ? { workType: expectedType } : {}),
              sortOrder: { gt: currentChapter.sortOrder },
              deletedAt: { isNull: true },
            },
      orderBy:
        direction === 'previous' ? { sortOrder: 'desc' } : { sortOrder: 'asc' },
      columns: {
        id: true,
      },
    })

    if (!adjacentChapter) {
      return null
    }

    return this.getChapterDetail(adjacentChapter.id, context)
  }

  // 更新章节。
  async updateChapter(dto: UpdateWorkChapterDto, expectedType: WorkTypeEnum) {
    const {
      id,
      workId: _workId,
      workType: _workType,
      ...updateData
    } = dto as UpdateWorkChapterDto & {
      workId?: number
      workType?: WorkTypeEnum
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workChapter)
          .set(updateData)
          .where(
            and(
              eq(this.workChapter.id, id),
              eq(this.workChapter.workType, expectedType),
              isNull(this.workChapter.deletedAt),
            ),
          ),
      {
        duplicate: '该作品下章节号已存在',
        notFound: '章节不存在',
      },
    )
    return true
  }

  // 删除章节。
  async deleteChapter(id: number, expectedType: WorkTypeEnum) {
    return this.deleteChapterRecords([id], expectedType)
  }

  // 批量删除章节。
  async deleteChapters(ids: number[], expectedType: WorkTypeEnum) {
    return this.deleteChapterRecords(ids, expectedType)
  }

  // 批量更新章节发布状态，并通过作品类型约束避免跨内容域误更新。
  async batchUpdateChapterPublishStatus(
    dto: BatchUpdatePublishedStatusDto,
    workType: WorkTypeEnum,
  ) {
    const uniqueIds = [...new Set(dto.ids)]
    if (uniqueIds.length === 0) {
      return true
    }

    await this.drizzle.withTransaction(async (tx) => {
      const updatedRows = await tx
        .update(this.workChapter)
        .set({ isPublished: dto.isPublished })
        .where(
          and(
            inArray(this.workChapter.id, uniqueIds),
            eq(this.workChapter.workType, workType),
            isNull(this.workChapter.deletedAt),
          ),
        )
        .returning({
          id: this.workChapter.id,
        })

      if (updatedRows.length !== uniqueIds.length) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '章节不存在',
        )
      }
    })

    return true
  }

  // 统一处理单删与批量软删除，避免批量删除只命中部分章节时静默成功。
  private async deleteChapterRecords(
    ids: number[],
    expectedType: WorkTypeEnum,
  ) {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) {
      return true
    }

    await this.drizzle.withTransaction(async (tx) => {
      const deletedRows = await tx
        .update(this.workChapter)
        .set({ deletedAt: new Date() })
        .where(
          and(
            inArray(this.workChapter.id, uniqueIds),
            eq(this.workChapter.workType, expectedType),
            isNull(this.workChapter.deletedAt),
          ),
        )
        .returning({
          id: this.workChapter.id,
        })

      if (deletedRows.length !== uniqueIds.length) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '章节不存在',
        )
      }
    })

    return true
  }

  // 交换章节排序（拖拽重排）。
  async swapChapterNumbers(
    dto: SwapWorkChapterNumbersInput,
    expectedType: WorkTypeEnum,
  ) {
    return this.drizzle.withTransaction(async (tx) => {
      const rows = await tx
        .select({
          id: this.workChapter.id,
          workId: this.workChapter.workId,
          sortOrder: this.workChapter.sortOrder,
        })
        .from(this.workChapter)
        .where(
          and(
            inArray(this.workChapter.id, [dto.dragId, dto.targetId]),
            eq(this.workChapter.workType, expectedType),
            isNull(this.workChapter.deletedAt),
          ),
        )

      const dragChapter = rows.find((row) => row.id === dto.dragId)
      const targetChapter = rows.find((row) => row.id === dto.targetId)

      if (!dragChapter || !targetChapter) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '章节不存在',
        )
      }
      if (dragChapter.workId !== targetChapter.workId) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '章节不是同一作品',
        )
      }
      if (dragChapter.sortOrder === targetChapter.sortOrder) {
        return true
      }

      const [minimumSortOrder] = await tx
        .select({
          value: sql<number>`min(${this.workChapter.sortOrder})`,
        })
        .from(this.workChapter)
        .where(
          and(
            eq(this.workChapter.workId, dragChapter.workId),
            eq(this.workChapter.workType, expectedType),
            isNull(this.workChapter.deletedAt),
          ),
        )
      const temporarySortOrder = (minimumSortOrder?.value ?? 0) - 1

      await tx
        .update(this.workChapter)
        .set({ sortOrder: temporarySortOrder })
        .where(
          and(
            eq(this.workChapter.id, dragChapter.id),
            eq(this.workChapter.workType, expectedType),
            isNull(this.workChapter.deletedAt),
          ),
        )
      await tx
        .update(this.workChapter)
        .set({ sortOrder: dragChapter.sortOrder })
        .where(
          and(
            eq(this.workChapter.id, targetChapter.id),
            eq(this.workChapter.workType, expectedType),
            isNull(this.workChapter.deletedAt),
          ),
        )
      await tx
        .update(this.workChapter)
        .set({ sortOrder: targetChapter.sortOrder })
        .where(
          and(
            eq(this.workChapter.id, dragChapter.id),
            eq(this.workChapter.workType, expectedType),
            isNull(this.workChapter.deletedAt),
          ),
        )

      return true
    })
  }

  private appChapterPageColumns() {
    return {
      id: this.workChapter.id,
      workId: this.workChapter.workId,
      workType: this.workChapter.workType,
      title: this.workChapter.title,
      subtitle: this.workChapter.subtitle,
      cover: this.workChapter.cover,
      sortOrder: this.workChapter.sortOrder,
      isPublished: this.workChapter.isPublished,
      isPreview: this.workChapter.isPreview,
      publishAt: this.workChapter.publishAt,
      viewRule: this.workChapter.viewRule,
      price: this.workChapter.price,
      canDownload: this.workChapter.canDownload,
      canComment: this.workChapter.canComment,
      createdAt: this.workChapter.createdAt,
      updatedAt: this.workChapter.updatedAt,
    }
  }

  private adminChapterPageColumns() {
    return {
      id: this.workChapter.id,
      workId: this.workChapter.workId,
      workType: this.workChapter.workType,
      cover: this.workChapter.cover,
      title: this.workChapter.title,
      subtitle: this.workChapter.subtitle,
      sortOrder: this.workChapter.sortOrder,
      viewRule: this.workChapter.viewRule,
      price: this.workChapter.price,
      requiredViewLevelId: this.workChapter.requiredViewLevelId,
      isPreview: this.workChapter.isPreview,
      canDownload: this.workChapter.canDownload,
      canComment: this.workChapter.canComment,
      isPublished: this.workChapter.isPublished,
      publishAt: this.workChapter.publishAt,
      createdAt: this.workChapter.createdAt,
      updatedAt: this.workChapter.updatedAt,
    }
  }

  private async findAdminChapterPage(input: {
    where: SQL
    pageIndex?: number | string
    pageSize?: number | string
    orderBy: Parameters<DrizzleService['buildOrderBy']>[0]
  }) {
    const page = this.drizzle.buildPage(input)
    const orderQuery = this.drizzle.buildOrderBy(input.orderBy, {
      table: this.workChapter,
    })
    const [list, total] = await Promise.all([
      this.db
        .select(this.adminChapterPageColumns())
        .from(this.workChapter)
        .where(input.where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.workChapter, input.where),
    ])

    return toPageResult<AdminChapterPageRow>(list, total, page)
  }

  private async workExists(workId: number, expectedType?: WorkTypeEnum) {
    const [row] = await this.db
      .select({ id: this.work.id })
      .from(this.work)
      .where(
        and(
          eq(this.work.id, workId),
          ...(expectedType ? [eq(this.work.type, expectedType)] : []),
          isNull(this.work.deletedAt),
        ),
      )
      .limit(1)

    return Boolean(row)
  }
}
