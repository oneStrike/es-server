import { DrizzleService } from '@db/core'
import {
  CommentTargetTypeEnum,
  DownloadService,
  DownloadTargetTypeEnum,
  FavoriteService,
  LikeService,
  LikeTargetTypeEnum,
  ReadingStateService,
} from '@libs/interaction'

import { ContentTypeEnum } from '@libs/platform/constant'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { ContentPermissionService } from '../../permission'
import {
  CreateWorkChapterInput,
  QueryWorkChapterInput,
  SwapWorkChapterNumbersInput,
  UpdateWorkChapterInput,
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
    private readonly downloadService: DownloadService,
    private readonly contentPermissionService: ContentPermissionService,
    private readonly readingStateService: ReadingStateService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  get workChapter() {
    return this.drizzle.schema.workChapter
  }

  get work() {
    return this.drizzle.schema.work
  }

  get appUser() {
    return this.drizzle.schema.appUser
  }

  get userLevelRule() {
    return this.drizzle.schema.userLevelRule
  }

  /**
   * 创建章节
   * @param createDto - 创建章节参数，包含 workId、章节号等信息
   * @returns 新创建的章节
   * @throws BadRequestException 关联的作品不存在
   * @throws BadRequestException 该作品下章节号已存在（唯一约束冲突）
   */
  async createChapter(createDto: CreateWorkChapterInput) {
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
  async getChapterPage(dto: QueryWorkChapterInput) {
    const where = this.drizzle.buildWhere(this.workChapter, {
      and: {
        deletedAt: { isNull: true },
        workId: dto.workId,
        isPublished: dto.isPublished,
        isPreview: dto.isPreview,
        viewRule: dto.viewRule,
        canDownload: dto.canDownload,
        canComment: dto.canComment,
        title: dto.title ? { like: dto.title } : undefined,
      },
    })

    const page = await this.drizzle.ext.findPagination(this.workChapter, {
      where,
      ...dto,
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
   * @param userId - 当前用户ID（可选）
   * @returns 章节详情，包含作品信息、等级要求、交互状态
   * @throws BadRequestException 章节不存在
   */
  async getChapterDetail(id: number, userId?: number) {
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

    // 未登录用户直接返回基础信息
    if (!userId) {
      chapter.content = chapter.content
        ? JSON.parse(chapter.content as unknown as string)
        : null
      return chapter
    }

    const downloadTargetType =
      chapter.workType === ContentTypeEnum.COMIC
        ? DownloadTargetTypeEnum.COMIC_CHAPTER
        : DownloadTargetTypeEnum.NOVEL_CHAPTER

    // 并行查询三个交互状态
    const [liked, downloaded, purchased] = await Promise.all([
      this.likeService.checkLikeStatus({
        targetType: LikeTargetTypeEnum.WORK_COMIC_CHAPTER,
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

    await this.readingStateService.touchByWorkSafely({
      userId,
      workId: chapter.workId,
      workType: chapter.workType as ContentTypeEnum,
      lastReadChapterId: id,
    })

    return {
      ...chapter,
      content: JSON.parse(chapter.content as unknown as string),
      liked,
      downloaded,
      purchased,
    }
  }

  /**
   * 获取上一章详情
   * @param id - 当前章节ID
   * @param userId - 当前用户ID（可选）
   * @returns 上一章详情，不存在则返回 null
   */
  async getPreviousChapterDetail(id: number, userId?: number) {
    return this.getAdjacentChapterDetail(id, 'previous', userId)
  }

  /**
   * 获取下一章详情
   * @param id - 当前章节ID
   * @param userId - 当前用户ID（可选）
   * @returns 下一章详情，不存在则返回 null
   */
  async getNextChapterDetail(id: number, userId?: number) {
    return this.getAdjacentChapterDetail(id, 'next', userId)
  }

  /**
   * 获取相邻章节详情（私有方法）
   * 根据 sortOrder 查找相邻章节
   * @param id - 当前章节ID
   * @param direction - 方向：'previous' 上一章 | 'next' 下一章
   * @param userId - 当前用户ID（可选）
   * @returns 相邻章节详情，不存在则返回 null
   * @throws BadRequestException 当前章节不存在
   */
  private async getAdjacentChapterDetail(
    id: number,
    direction: 'previous' | 'next',
    userId?: number,
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
        direction === 'previous'
          ? { sortOrder: 'desc' }
          : { sortOrder: 'asc' },
      columns: {
        id: true,
      },
    })

    if (!adjacentChapter) {
      return null
    }

    return this.getChapterDetail(adjacentChapter.id, userId)
  }

  /**
   * 更新章节
   * @param dto - 更新参数，包含章节ID和待更新字段
   * @returns 更新后的章节
   * @throws BadRequestException 指定的阅读会员等级不存在
   * @throws BadRequestException 该作品下章节号已存在（唯一约束冲突）
   * @throws BadRequestException 章节不存在
   */
  async updateChapter(dto: UpdateWorkChapterInput) {
    const { id, ...updateData } = dto
    const { requiredViewLevelId } = updateData

    if (
      requiredViewLevelId &&
      !(await this.drizzle.ext.exists(
        this.userLevelRule,
        eq(this.userLevelRule.id, requiredViewLevelId),
      ))
    ) {
      throw new BadRequestException('指定的阅读会员等级不存在')
    }

    const result = await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workChapter)
          .set(updateData)
          .where(and(eq(this.workChapter.id, id), isNull(this.workChapter.deletedAt))),
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
        .where(and(eq(this.workChapter.id, id), isNull(this.workChapter.deletedAt))),
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
