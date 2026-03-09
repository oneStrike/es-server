import { ContentTypeEnum, InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { DragReorderDto } from '@libs/base/dto'
import { ContentPermissionService } from '@libs/content/permission'
import {
  DownloadService,
  DownloadTargetTypeEnum,
  FavoriteService,
  LikeService,
} from '@libs/interaction'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateWorkChapterDto,
  QueryWorkChapterDto,
  UpdateWorkChapterDto,
} from './dto/work-chapter.dto'
import { PAGE_WORK_CHAPTER_SELECT } from './work-chapter.select'

/**
 * 作品章节服务
 * 负责处理作品章节的 CRUD 操作、交互状态查询、相邻章节导航等功能
 */
@Injectable()
export class WorkChapterService extends BaseService {
  /** 章节 Prisma 代理 */
  get workChapter() {
    return this.prisma.workChapter
  }

  /** 作品 Prisma 代理 */
  get work() {
    return this.prisma.work
  }

  /** 用户 Prisma 代理 */
  get appUser() {
    return this.prisma.appUser
  }

  /** 用户等级规则 Prisma 代理 */
  get userLevelRule() {
    return this.prisma.userLevelRule
  }

  constructor(
    private readonly likeService: LikeService,
    private readonly favoriteService: FavoriteService,
    private readonly downloadService: DownloadService,
    private readonly contentPermissionService: ContentPermissionService,
  ) {
    super()
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

    if (!(await this.work.exists({ id: workId }))) {
      throw new BadRequestException('关联的作品不存在')
    }

    try {
      return await this.workChapter.create({ data: createDto })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('该作品下章节号已存在')
        },
      })
    }
  }

  /**
   * 分页查询章节列表
   * @param dto - 查询参数，支持按 workId、title 筛选
   * @returns 分页章节列表
   */
  async getChapterPage(dto: QueryWorkChapterDto) {
    return this.workChapter.findPagination({
      where: {
        ...dto,
        title: dto.title
          ? {
              contains: dto.title,
              mode: 'insensitive',
            }
          : undefined,
      },
      select: PAGE_WORK_CHAPTER_SELECT,
    })
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
    const chapter = await this.workChapter.findUnique({
      where: { id },
      include: {
        work: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        requiredViewLevel: {
          select: {
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
      return chapter
    }

    // 根据 workType 确定目标类型
    const interactionTargetType =
      chapter.workType === ContentTypeEnum.COMIC
        ? InteractionTargetTypeEnum.COMIC_CHAPTER
        : InteractionTargetTypeEnum.NOVEL_CHAPTER

    const downloadTargetType =
      chapter.workType === ContentTypeEnum.COMIC
        ? DownloadTargetTypeEnum.COMIC_CHAPTER
        : DownloadTargetTypeEnum.NOVEL_CHAPTER

    // 并行查询四个交互状态
    const [liked, favorited, downloaded, purchased] = await Promise.all([
      this.likeService.checkLikeStatus(interactionTargetType, id, userId),
      this.favoriteService.checkFavoriteStatus(
        interactionTargetType,
        id,
        userId,
      ),
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

    return {
      ...chapter,
      liked,
      favorited,
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
    const currentChapter = await this.workChapter.findUnique({
      where: { id },
      select: {
        workId: true,
        sortOrder: true,
      },
    })

    if (!currentChapter) {
      throw new BadRequestException('章节不存在')
    }

    const adjacentChapter = await this.workChapter.findFirst({
      where: {
        workId: currentChapter.workId,
        sortOrder:
          direction === 'previous'
            ? { lt: currentChapter.sortOrder }
            : { gt: currentChapter.sortOrder },
      },
      orderBy: {
        sortOrder: direction === 'previous' ? 'desc' : 'asc',
      },
      select: {
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
  async updateChapter(dto: UpdateWorkChapterDto) {
    const { id, ...updateData } = dto
    const { requiredViewLevelId } = updateData

    if (
      requiredViewLevelId &&
      !(await this.userLevelRule.exists({ id: requiredViewLevelId }))
    ) {
      throw new BadRequestException('指定的阅读会员等级不存在')
    }

    try {
      return await this.workChapter.update({
        where: { id },
        data: updateData,
      })
    } catch (error) {
      this.handlePrismaError(error, {
        P2002: () => {
          throw new BadRequestException('该作品下章节号已存在')
        },
        P2025: () => {
          throw new BadRequestException('章节不存在')
        },
      })
    }
  }

  /**
   * 删除章节
   * @param id - 章节ID
   * @returns 被删除的章节
   * @throws BadRequestException 章节不存在
   */
  async deleteChapter(id: number) {
    try {
      return await this.workChapter.delete({ where: { id } })
    } catch (error) {
      this.handlePrismaError(error, {
        P2025: () => {
          throw new BadRequestException('章节不存在')
        },
      })
    }
  }

  /**
   * 交换章节排序（拖拽重排）
   * @param dto - 拖拽参数，包含 dragId 和 targetId
   * @returns 交换结果
   */
  async swapChapterNumbers(dto: DragReorderDto) {
    return this.workChapter.swapField({
      where: [{ id: dto.dragId }, { id: dto.targetId }],
      sourceField: 'workId',
    })
  }
}
