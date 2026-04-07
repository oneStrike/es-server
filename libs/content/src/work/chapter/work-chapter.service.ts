import type { SQL } from 'drizzle-orm'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { BrowseLogTargetTypeEnum } from '@libs/interaction/browse-log/browse-log.constant';
import { BrowseLogService } from '@libs/interaction/browse-log/browse-log.service';
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant';
import { DownloadTargetTypeEnum } from '@libs/interaction/download/download.constant';
import { DownloadService } from '@libs/interaction/download/download.service';
import { FavoriteService } from '@libs/interaction/favorite/favorite.service';
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant';
import { LikeService } from '@libs/interaction/like/like.service';
import { ReadingStateService } from '@libs/interaction/reading-state/reading-state.service';
import { ContentTypeEnum } from '@libs/platform/constant/content.constant';
import { jsonParse } from '@libs/platform/utils/jsonParse';
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { ContentPermissionService } from '../../permission/content-permission.service';
import {
  CreateWorkChapterDto,
  QueryWorkChapterDto,
  UpdateWorkChapterDto,
} from './dto/work-chapter.dto'
import {
  SwapWorkChapterNumbersInput,
  WorkChapterDetailContext,
} from './work-chapter.type'

/**
 * 作品章节服务
 * 负责处理作品章节的 CRUD 操作、交互状态查询、相邻章节导航等功能
 */
@Injectable()
export class WorkChapterService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly likeService: LikeService,
    private readonly favoriteService: FavoriteService,
    private readonly browseLogService: BrowseLogService,
    private readonly downloadService: DownloadService,
    private readonly contentPermissionService: ContentPermissionService,
    private readonly readingStateService: ReadingStateService,
  ) {}

  /** 统一复用当前模块的 Drizzle 数据库实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** work_chapter 表访问入口。 */
  get workChapter() {
    return this.drizzle.schema.workChapter
  }

  /** work 表访问入口。 */
  get work() {
    return this.drizzle.schema.work
  }

  /** app_user 表访问入口。 */
  get appUser() {
    return this.drizzle.schema.appUser
  }

  /** app_user_level_rule 表访问入口。 */
  get appUserLevelRule() {
    return this.drizzle.schema.appUserLevelRule
  }

  /**
   * 构建 app/public 章节详情响应。
   * 明确裁剪 remark、删除标记和后台挂载对象，避免公开接口直接暴露内部字段。
   */
  private buildPublicChapterDetail(chapter: Record<string, any>) {
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
      viewRule: chapter.viewRule,
      requiredViewLevelId: chapter.requiredViewLevelId,
      price: chapter.price,
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

  /**
   * 创建章节
   * @param createDto - 创建章节参数，包含 workId、章节号等信息
   * @returns 新创建的章节
   * @throws BadRequestException 关联的作品不存在
   * @throws BadRequestException 该作品下章节号已存在（唯一约束冲突）
   */
  async createChapter(createDto: CreateWorkChapterDto) {
    const { workId } = createDto

    if (
      !(await this.drizzle.ext.exists(
        this.work,
        and(eq(this.work.id, workId), isNull(this.work.deletedAt)),
      ))
    ) {
      throw new BadRequestException('关联的作品不存在')
    }

    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.workChapter).values(createDto),
      { duplicate: '该作品下章节号已存在' },
    )
    return true
  }

  /**
   * 分页查询章节列表
   * @param dto - 查询参数，支持按 workId、title 筛选
   * @returns 分页章节列表
   */
  async getChapterPage(dto: QueryWorkChapterDto) {
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
      conditions.push(
        buildILikeCondition(this.workChapter.title, dto.title)!,
      )
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
      throw new BadRequestException('章节不存在')
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
      throw new BadRequestException('章节所属作品未发布或不存在')
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

    throw new BadRequestException('章节类型不支持评论')
  }

  /**
   * 获取章节详情
   * 未登录用户返回基础信息，登录用户额外返回交互状态（点赞、收藏、下载、购买）
   * @param id - 章节ID
   * @param context - 当前用户与请求上下文（可选）
   * @returns 章节详情，包含作品信息、等级要求、交互状态
   * @throws BadRequestException 章节不存在
   */
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
      throw new BadRequestException('章节不存在')
    }

    const parsedContent
      = chapter.workType === ContentTypeEnum.COMIC
        ? (jsonParse(chapter.content, []) as unknown as string)
        : chapter.content

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

  /**
   * 获取上一章详情
   * @param id - 当前章节ID
   * @param context - 当前用户与请求上下文（可选）
   * @returns 上一章详情，不存在则返回 null
   */
  async getPreviousChapterDetail(
    id: number,
    context: WorkChapterDetailContext = {},
  ) {
    return this.getAdjacentChapterDetail(id, 'previous', context)
  }

  /**
   * 获取下一章详情
   * @param id - 当前章节ID
   * @param context - 当前用户与请求上下文（可选）
   * @returns 下一章详情，不存在则返回 null
   */
  async getNextChapterDetail(
    id: number,
    context: WorkChapterDetailContext = {},
  ) {
    return this.getAdjacentChapterDetail(id, 'next', context)
  }

  /**
   * 获取相邻章节详情（私有方法）
   * 根据 sortOrder 查找相邻章节
   * @param id - 当前章节ID
   * @param direction - 方向：'previous' 上一章 | 'next' 下一章
   * @param context - 当前用户与请求上下文（可选）
   * @returns 相邻章节详情，不存在则返回 null
   * @throws BadRequestException 当前章节不存在
   */
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
      throw new BadRequestException('章节不存在')
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

  /**
   * 更新章节
   * @param dto - 更新参数，包含章节ID和待更新字段
   * @returns 更新后的章节
   * @throws BadRequestException 指定的阅读会员等级不存在
   * @throws BadRequestException 该作品下章节号已存在（唯一约束冲突）
   * @throws BadRequestException 章节不存在
   */
  async updateChapter(dto: UpdateWorkChapterDto) {
    const { id, ...updateData } = dto
    const { requiredViewLevelId } = updateData

    if (
      requiredViewLevelId &&
      !(await this.drizzle.ext.exists(
        this.appUserLevelRule,
        eq(this.appUserLevelRule.id, requiredViewLevelId),
      ))
    ) {
      throw new BadRequestException('指定的阅读会员等级不存在')
    }

    const result = await this.drizzle.withErrorHandling(
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
      { duplicate: '该作品下章节号已存在' },
    )
    this.drizzle.assertAffectedRows(result, '章节不存在')
    return true
  }

  /**
   * 删除章节
   * @param id - 章节ID
   * @returns 被删除的章节
   * @throws BadRequestException 章节不存在
   */
  async deleteChapter(id: number) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workChapter)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(this.workChapter.id, id), isNull(this.workChapter.deletedAt)),
        ),
    )
    this.drizzle.assertAffectedRows(result, '章节不存在')
    return true
  }

  /**
   * 交换章节排序（拖拽重排）
   * @param dto - 拖拽参数，包含 dragId 和 targetId
   * @returns 交换结果
   */
  async swapChapterNumbers(dto: SwapWorkChapterNumbersInput) {
    return this.drizzle.ext.swapField(this.workChapter, {
      where: [{ id: dto.dragId }, { id: dto.targetId }],
      sourceField: 'workId',
    })
  }
}
