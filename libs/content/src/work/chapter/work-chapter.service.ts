import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'

import { BrowseLogTargetTypeEnum } from '@libs/interaction/browse-log/browse-log.constant'
import { BrowseLogService } from '@libs/interaction/browse-log/browse-log.service'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { DownloadTargetTypeEnum } from '@libs/interaction/download/download.constant'
import { DownloadService } from '@libs/interaction/download/download.service'
import { FavoriteService } from '@libs/interaction/favorite/favorite.service'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import { LikeService } from '@libs/interaction/like/like.service'
import { ReadingStateService } from '@libs/interaction/reading-state/reading-state.service'
import { BusinessErrorCode, ContentTypeEnum } from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { jsonParse } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { ContentPermissionService } from '../../permission/content-permission.service'
import {
  CreateWorkChapterDto,
  QueryWorkChapterDto,
  UpdateWorkChapterDto,
} from './dto/work-chapter.dto'
import {
  SwapWorkChapterNumbersInput,
  WorkChapterDetailContext,
  WorkChapterPageContext,
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
    private readonly favoriteService: FavoriteService,
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

  // user_level_rule 表访问入口。
  get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  // 构建 app/public 章节详情响应，明确裁剪 remark、删除标记和后台挂载对象，避免公开接口直接暴露内部字段。
  private buildPublicChapterDetail(chapter: WorkChapterPublicDetailRow) {
    return {
      id: chapter.id,
      workId: chapter.workId,
      workType: chapter.workType,
      title: chapter.title,
      subtitle: chapter.subtitle,
      cover: chapter.cover,
      description: chapter.description,
      sortOrder: chapter.sortOrder,
      isPublished: chapter.isPublished,
      isPreview: chapter.isPreview,
      publishAt: chapter.publishAt,
      viewRule: chapter.resolvedViewRule ?? chapter.viewRule,
      requiredViewLevelId:
        chapter.resolvedRequiredViewLevelId ?? chapter.requiredViewLevelId,
      purchasePricing: chapter.purchasePricing ?? null,
      canDownload: chapter.canDownload,
      canComment: chapter.canComment,
      content: chapter.content,
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

  // 创建章节。
  async createChapter(createDto: CreateWorkChapterDto) {
    const { workId } = createDto

    if (
      !(await this.drizzle.ext.exists(
        this.work,
        and(eq(this.work.id, workId), isNull(this.work.deletedAt)),
      ))
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '关联的作品不存在',
      )
    }

    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.workChapter).values(createDto),
      { duplicate: '该作品下章节号已存在' },
    )
    return true
  }

  // 分页查询章节列表。
  async getChapterPage(
    dto: QueryWorkChapterDto,
    context: WorkChapterPageContext = {},
  ) {
    const { userId, bypassVisibilityCheck = false } = context
    const conditions: SQL[] = [isNull(this.workChapter.deletedAt)]

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

    const where = and(...conditions)
    const orderBy = dto.orderBy?.trim()
      ? dto.orderBy
      : { sortOrder: 'asc' as const }

    const page = await this.drizzle.ext.findPagination(this.workChapter, {
      where,
      ...dto,
      orderBy,
    })

    if (bypassVisibilityCheck) {
      return {
        ...page,
        list: page.list.map((chapter) => ({
          id: chapter.id,
          isPreview: chapter.isPreview,
          cover: chapter.cover,
          title: chapter.title,
          subtitle: chapter.subtitle,
          price: chapter.price,
          canComment: chapter.canComment,
          sortOrder: chapter.sortOrder,
          viewRule: chapter.viewRule,
          canDownload: chapter.canDownload,
          requiredViewLevelId: chapter.requiredViewLevelId,
          publishAt: chapter.publishAt,
          createdAt: chapter.createdAt,
          updatedAt: chapter.updatedAt,
          isPublished: chapter.isPublished,
        })),
      }
    }

    const permissionEntries = await Promise.all(
      page.list.map(
        async (chapter) =>
          [
            chapter.id,
            await this.contentPermissionService.resolveChapterPermission(
              chapter.id,
              userId,
            ),
          ] as const,
      ),
    )
    const permissionMap = new Map(permissionEntries)

    return {
      ...page,
      list: page.list.map((chapter) => ({
        id: chapter.id,
        isPreview: chapter.isPreview,
        cover: chapter.cover,
        title: chapter.title,
        subtitle: chapter.subtitle,
        canComment: chapter.canComment,
        sortOrder: chapter.sortOrder,
        viewRule: permissionMap.get(chapter.id)?.viewRule ?? chapter.viewRule,
        canDownload:
          permissionMap.get(chapter.id)?.canDownload ?? chapter.canDownload,
        requiredViewLevelId:
          permissionMap.get(chapter.id)?.requiredViewLevelId ??
          chapter.requiredViewLevelId,
        purchasePricing: permissionMap.get(chapter.id)?.purchasePricing ?? null,
        publishAt: chapter.publishAt,
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
    const { userId, ipAddress, device, bypassVisibilityCheck = false } = context
    const chapter = await this.db.query.workChapter.findFirst({
      where: { id, deletedAt: { isNull: true } },
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

    const parsedContent =
      chapter.workType === ContentTypeEnum.COMIC
        ? (jsonParse<string>(chapter.content, '') ?? '')
        : chapter.content
    const resolvedPermission = bypassVisibilityCheck
      ? undefined
      : await this.contentPermissionService.resolveChapterPermission(id, userId)

    // 未登录用户直接返回基础信息
    if (!userId) {
      if (bypassVisibilityCheck) {
        chapter.content = parsedContent
        return chapter
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
      workType: chapter.workType as ContentTypeEnum,
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
      return detail
    }

    return {
      ...this.buildPublicChapterDetail(detail),
      liked,
      downloaded,
      purchased,
    }
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
    const currentChapter = await this.db.query.workChapter.findFirst({
      where: { id, deletedAt: { isNull: true } },
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
              sortOrder: { lt: currentChapter.sortOrder },
              deletedAt: { isNull: true },
            }
          : {
              workId: currentChapter.workId,
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
  async updateChapter(dto: UpdateWorkChapterDto) {
    const { id, ...updateData } = dto
    const { requiredViewLevelId } = updateData

    if (
      requiredViewLevelId &&
      !(await this.drizzle.ext.exists(
        this.userLevelRule,
        eq(this.userLevelRule.id, requiredViewLevelId),
      ))
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '指定的阅读会员等级不存在',
      )
    }

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workChapter)
          .set(updateData)
          .where(
            and(
              eq(this.workChapter.id, id),
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
  async deleteChapter(id: number) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workChapter)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(this.workChapter.id, id),
              isNull(this.workChapter.deletedAt),
            ),
          ),
      { notFound: '章节不存在' },
    )
    return true
  }

  // 交换章节排序（拖拽重排）。
  async swapChapterNumbers(dto: SwapWorkChapterNumbersInput) {
    return this.drizzle.ext.swapField(this.workChapter, {
      where: [{ id: dto.dragId }, { id: dto.targetId }],
      sourceField: 'workId',
    })
  }
}
