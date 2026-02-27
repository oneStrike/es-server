import { WorkViewPermissionEnum } from '@libs/base/constant'
import { BaseService, Prisma } from '@libs/base/database'
import { DragReorderDto, PageDto } from '@libs/base/dto'
import {
  DownloadService,
  DownloadTargetTypeEnum,
  InteractionTargetType,
  LikeService,
} from '@libs/interaction'
import { UserBalanceRecordTypeEnum, UserBalanceService } from '@libs/user/balance'
import { UserGrowthEventService } from '@libs/user/growth-event'
import { UserPermissionService } from '@libs/user/permission'
import { UserPointService } from '@libs/user/point'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateWorkChapterDto,
  QueryWorkChapterDto,
  UpdateWorkChapterDto,
} from './dto/work-chapter.dto'
import { WorkChapterGrowthEventKey } from './work-chapter.constant'
import { PAGE_WORK_CHAPTER_SELECT } from './work-chapter.select'

/**
 * 作品章节服务
 * 提供章节管理、阅读权限控制、购买下载等核心功能
 */
@Injectable()
export class WorkChapterService extends BaseService {
  /**
   * 获取章节数据访问对象
   */
  get workChapter() {
    return this.prisma.workChapter
  }

  /**
   * 获取作品数据访问对象
   */
  get work() {
    return this.prisma.work
  }

  /**
   * 获取章节购买记录数据访问对象
   */
  get workChapterPurchase() {
    return this.prisma.workChapterPurchase
  }

  /**
   * 获取应用用户数据访问对象
   */
  get appUser() {
    return this.prisma.appUser
  }

  /**
   * 获取用户等级规则数据访问对象
   */
  get userLevelRule() {
    return this.prisma.userLevelRule
  }

  /**
   * 构造函数
   * @param userGrowthEventService 用户成长事件服务
   * @param likeService 点赞服务
   * @param downloadService 下载服务
   */
  constructor(
    private readonly userGrowthEventService: UserGrowthEventService,
    private readonly likeService: LikeService,
    private readonly downloadService: DownloadService,
    private readonly userPermissionService: UserPermissionService,
    private readonly userPointService: UserPointService,
    private readonly userBalanceService: UserBalanceService,
    private readonly contentPermissionService: ContentPermissionService,
  ) {
    super()
  }

  /**
   * 获取章节列表查询字段选择器
   * 用于控制返回的字段，排除敏感或不需要的字段
   * @returns 字段选择配置对象
   */
  private getChapterListSelect() {
    return {
      id: true, // 章节ID
      title: true, // 章节标题
      subtitle: true, // 章节副标题
      isPublished: true, // 是否已发布
      workId: true, // 关联作品ID
      workType: true, // 作品类型(1=漫画, 2=小说)
      sortOrder: true, // 排序号
      viewRule: true, // 阅读权限规则
      price: true, // 价格
      exchangePoints: true, // 兑换积分
      canExchange: true, // 是否允许兑换
      canDownload: true, // 是否允许下载
      canComment: true, // 是否允许评论
      requiredViewLevelId: true, // 阅读所需会员等级ID
      isPreview: true, // 是否为预览章节
      publishAt: true, // 发布时间
      purchaseCount: true, // 购买次数
      viewCount: true, // 浏览次数
      likeCount: true, // 点赞次数
      commentCount: true, // 评论次数
      wordCount: true, // 字数统计
      createdAt: true, // 创建时间
      updatedAt: true, // 更新时间
    }
  }

  /**
   * 根据作品类型获取交互目标类型
   * @param workType 作品类型(1=漫画, 2=小说)
   * @returns 对应的交互目标类型枚举
   */
  private getTargetType(workType: number): InteractionTargetType {
    return workType === 1
      ? InteractionTargetType.COMIC_CHAPTER
      : InteractionTargetType.NOVEL_CHAPTER
  }

  /**
   * 根据作品类型获取下载目标类型
   * @param workType 作品类型(1=漫画, 2=小说)
   * @returns 对应的下载目标类型枚举
   */
  private getDownloadTargetType(workType: number): DownloadTargetTypeEnum {
    return workType === 1
      ? DownloadTargetTypeEnum.COMIC_CHAPTER
      : DownloadTargetTypeEnum.NOVEL_CHAPTER
  }


  /**
   * 创建新章节
   * @param createDto 创建章节数据传输对象
   * @returns 创建的章节记录
   * @throws BadRequestException 当关联作品不存在、章节号已存在或会员等级不存在时抛出
   */
  async createChapter(createDto: CreateWorkChapterDto) {
    const { workId, sortOrder } = createDto

    // 验证关联作品是否存在
    if (!(await this.work.exists({ id: workId }))) {
      throw new BadRequestException('关联的作品不存在')
    }

    // 验证章节号是否已存在
    if (await this.workChapter.exists({ workId, sortOrder })) {
      throw new BadRequestException('该作品下章节号已存在')
    }

    return this.workChapter.create({ data: createDto })
  }

  /**
   * 获取章节分页列表
   * @param dto 查询条件数据传输对象
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
   * @param id 章节ID
   * @returns 章节详情，包含作品信息和会员等级信息
   * @throws BadRequestException 当章节不存在时抛出
   */
  async getChapterDetail(id: number) {
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

    return chapter
  }

  /**
   * 获取章节详情及用户状态
   * @param id 章节ID
   * @param userId 用户ID
   * @returns 章节详情及用户点赞、购买、下载状态
   */
  async getChapterDetailWithUserStatus(id: number, userId: number) {
    const chapter = await this.getChapterDetail(id)
    const targetType = this.getTargetType(chapter.workType)
    const downloadTargetType = this.getDownloadTargetType(chapter.workType)

    // 并行查询用户的点赞、购买、下载状态
    const [liked, purchased, downloaded] = await Promise.all([
      this.likeService.checkLikeStatus(targetType, id, userId),
      this.workChapterPurchase
        .findUnique({
          where: {
            chapterId_userId: {
              chapterId: id,
              userId,
            },
          },
        })
        .then((p) => !!p),
      this.downloadService.checkDownloadStatus({
        targetType: downloadTargetType,
        targetId: id,
        userId,
      }),
    ])

    return {
      ...chapter,
      liked,
      purchased,
      downloaded,
    }
  }

  /**
   * 更新章节信息
   * @param dto 更新章节数据传输对象
   * @returns 更新后的章节记录
   * @throws BadRequestException 当章节号已存在或会员等级不存在时抛出
   */
  async updateChapter(dto: UpdateWorkChapterDto) {
    const { id, workId, ...updateData } = dto
    const { requiredViewLevelId, sortOrder } = updateData

    // 验证章节号是否与其他章节冲突
    if (
      sortOrder !== undefined &&
      workId !== undefined &&
      (await this.workChapter.exists({
        id: { not: id },
        sortOrder,
        workId,
      }))
    ) {
      throw new BadRequestException('该作品下章节号已存在')
    }

    // 验证阅读会员等级是否存在
    if (
      requiredViewLevelId &&
      !(await this.userLevelRule.exists({ id: requiredViewLevelId }))
    ) {
      throw new BadRequestException('指定的阅读会员等级不存在')
    }

    return this.workChapter.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 删除章节
   * @param id 章节ID
   * @returns 删除的章节记录
   */
  async deleteChapter(id: number) {
    return this.workChapter.delete({ where: { id } })
  }

  /**
   * 交换两个章节的排序号
   * @param dto 拖拽排序数据传输对象
   * @returns 交换后的章节ID
   * @throws BadRequestException 当章节不存在或不是同一作品时抛出
   */
  async swapChapterNumbers(dto: DragReorderDto) {
    const { targetId, dragId } = dto

    if (targetId === dragId) {
      throw new BadRequestException('不能交换相同的章节')
    }

    // 查询两个章节信息
    const [targetChapter, dragChapter] = await Promise.all([
      this.workChapter.findUnique({ where: { id: targetId } }),
      this.workChapter.findUnique({ where: { id: dragId } }),
    ])

    if (!targetChapter) {
      throw new BadRequestException(`章节ID ${targetId} 不存在`)
    }
    if (!dragChapter) {
      throw new BadRequestException(`章节ID ${dragId} 不存在`)
    }

    // 验证是否属于同一作品
    if (targetChapter.workId !== dragChapter.workId) {
      throw new BadRequestException('只能交换同一作品下的章节号')
    }

    // 使用临时值进行交换，避免唯一约束冲突
    return this.prisma.$transaction(async (tx) => {
      const tempChapterNumber = -Math.floor(Math.random() * 1000000) - 1

      await tx.workChapter.update({
        where: { id: dragId },
        data: { sortOrder: tempChapterNumber },
      })

      await tx.workChapter.update({
        where: { id: targetId },
        data: { sortOrder: dragChapter.sortOrder },
      })

      await tx.workChapter.update({
        where: { id: dragId },
        data: { sortOrder: targetChapter.sortOrder },
      })

      return { targetId, dragId }
    })
  }

  /**
   * 增加章节浏览次数
   * 同时处理阅读权限验证和用户成长事件
   * @param id 章节ID
   * @param userId 用户ID
   * @param ip 用户IP地址
   * @param deviceId 设备ID
   * @returns 章节ID
   * @throws BadRequestException 当权限不足或积分不足时抛出
   */
  async incrementViewCount(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    const chapter = await this.workChapter.findUnique({ where: { id } })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    const effectivePermission =
      await this.contentPermissionService.resolveChapterPermission(chapter)
    await this.contentPermissionService.checkAccess(
      userId,
      id,
      effectivePermission,
      'view',
    )

    // 增加浏览次数
    await this.workChapter.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })

    // 触发阅读成长事件
    await this.userGrowthEventService.handleEvent({
      business: 'work',
      eventKey: WorkChapterGrowthEventKey.Read,
      userId,
      targetId: id,
      ip,
      deviceId,
      occurredAt: new Date(),
    })

    return { id }
  }

  /**
   * 增加章节点赞数
   * @param id 章节ID
   * @param userId 用户ID
   * @param ip 用户IP地址
   * @param deviceId 设备ID
   * @returns 章节ID
   * @throws BadRequestException 当章节不存在时抛出
   */
  async incrementLikeCount(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    const chapter = await this.workChapter.findUnique({ where: { id } })
    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    const targetType = this.getTargetType(chapter.workType)

    // 调用点赞服务
    await this.likeService.like(targetType, id, userId)

    // 触发点赞成长事件
    await this.userGrowthEventService.handleEvent({
      business: 'work',
      eventKey: WorkChapterGrowthEventKey.Like,
      userId,
      targetId: id,
      ip,
      deviceId,
      occurredAt: new Date(),
    })

    return { id }
  }

  /**
   * 购买章节
   * @param id 章节ID
   * @param userId 用户ID
   * @param ip 用户IP地址
   * @param deviceId 设备ID
   * @returns 章节ID
   * @throws BadRequestException 当已购买、不支持购买、会员等级不足或积分不足时抛出
   */
  async incrementPurchaseCount(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    const chapter = await this.workChapter.findUnique({ where: { id } })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    // 检查是否已购买
    const existingPurchase = await this.workChapterPurchase.findUnique({
      where: {
        chapterId_userId: {
          chapterId: id,
          userId,
        },
      },
    })

    if (existingPurchase) {
      throw new BadRequestException('已购买该章节')
    }

    const effectivePermission =
      await this.contentPermissionService.resolveChapterPermission(chapter)
    await this.userPermissionService.validateViewPermission(
      effectivePermission.viewRule,
      userId,
      effectivePermission.requiredViewLevelId,
    )

    if (effectivePermission.viewRule !== WorkViewPermissionEnum.POINTS) {
      throw new BadRequestException('该章节不支持购买')
    }

    const price = effectivePermission.price ?? 0
    if (price <= 0) {
      throw new BadRequestException('章节未配置购买价格')
    }

    await this.userPermissionService.validateBalance(userId, price)

    // 创建购买记录并增加购买次数
    await this.prisma.$transaction(async (tx) => {
      await this.userBalanceService.changeBalance(
        {
          userId,
          amount: -price,
          type: UserBalanceRecordTypeEnum.CHAPTER_PURCHASE,
          remark: '章节购买',
        },
        tx,
      )
      await tx.workChapterPurchase.create({
        data: {
          chapterId: id,
          userId,
        },
      })

      await tx.workChapter.update({
        where: { id },
        data: {
          purchaseCount: {
            increment: 1,
          },
        },
      })
    })

    // 触发购买成长事件
    await this.userGrowthEventService.handleEvent({
      business: 'work',
      eventKey: WorkChapterGrowthEventKey.Purchase,
      userId,
      targetId: id,
      ip,
      deviceId,
      occurredAt: new Date(),
    })

    return { id }
  }

  async exchangeChapter(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    const chapter = await this.workChapter.findUnique({ where: { id } })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    const existingPurchase = await this.workChapterPurchase.findUnique({
      where: {
        chapterId_userId: {
          chapterId: id,
          userId,
        },
      },
    })

    if (existingPurchase) {
      throw new BadRequestException('已获取该章节')
    }

    const effectivePermission =
      await this.contentPermissionService.resolveChapterPermission(chapter)
    await this.userPermissionService.validateViewPermission(
      effectivePermission.viewRule,
      userId,
      effectivePermission.requiredViewLevelId,
    )

    if (!effectivePermission.canExchange) {
      throw new BadRequestException('该章节不支持兑换')
    }

    const exchangePoints = effectivePermission.exchangePoints ?? 0
    if (exchangePoints <= 0) {
      throw new BadRequestException('章节未配置兑换积分')
    }

    await this.userPermissionService.validatePoints(userId, exchangePoints)

    const targetType = this.getTargetType(chapter.workType)

    await this.prisma.$transaction(async (tx) => {
      await this.userPointService.consumePoints(
        {
          userId,
          points: exchangePoints,
          remark: '章节兑换',
          targetType,
          targetId: id,
        },
        tx,
      )

      await tx.workChapterPurchase.create({
        data: {
          chapterId: id,
          userId,
        },
      })

      await tx.workChapter.update({
        where: { id },
        data: {
          purchaseCount: {
            increment: 1,
          },
        },
      })
    })

    await this.userGrowthEventService.handleEvent({
      business: 'work',
      eventKey: WorkChapterGrowthEventKey.Purchase,
      userId,
      targetId: id,
      ip,
      deviceId,
      occurredAt: new Date(),
    })

    return { id }
  }

  /**
   * 报告章节下载
   * @param id 章节ID
   * @param userId 用户ID
   * @param ip 用户IP地址
   * @param deviceId 设备ID
   * @returns 章节ID
   * @throws BadRequestException 当已下载、禁止下载、会员等级不足或积分不足时抛出
   */
  async reportDownload(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    const chapter = await this.workChapter.findUnique({ where: { id } })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    const work = await this.work.findUnique({ where: { id: chapter.workId } })
    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    const downloadTargetType = this.getDownloadTargetType(chapter.workType)

    // 检查是否已下载
    const existingDownload = await this.downloadService.checkDownloadStatus({
      targetType: downloadTargetType,
      targetId: id,
      userId,
    })

    if (existingDownload) {
      throw new BadRequestException('已下载该章节')
    }

    // 获取有效权限并校验
    const effectivePermission =
      await this.contentPermissionService.resolveChapterPermission(
        chapter,
        work,
      )

    await this.contentPermissionService.checkAccess(
      userId,
      id,
      effectivePermission,
      'download',
    )

    // 记录下载
    await this.downloadService.recordDownload({
      targetType: downloadTargetType,
      targetId: id,
      userId,
    })

    // 触发下载成长事件
    await this.userGrowthEventService.handleEvent({
      business: 'work',
      eventKey: WorkChapterGrowthEventKey.Download,
      userId,
      targetId: id,
      ip,
      deviceId,
      occurredAt: new Date(),
    })

    return { id }
  }

  /**
   * 检查用户是否已点赞章节
   * @param chapterId 章节ID
   * @param userId 用户ID
   * @returns 点赞状态
   * @throws BadRequestException 当章节不存在时抛出
   */
  async checkUserLiked(chapterId: number, userId: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
    })
    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }
    const targetType = this.getTargetType(chapter.workType)
    const liked = await this.likeService.checkLikeStatus(
      targetType,
      chapterId,
      userId,
    )
    return { liked }
  }

  /**
   * 检查用户是否已购买章节
   * @param chapterId 章节ID
   * @param userId 用户ID
   * @returns 购买状态
   */
  async checkUserPurchased(chapterId: number, userId: number) {
    const purchase = await this.workChapterPurchase.findUnique({
      where: {
        chapterId_userId: {
          chapterId,
          userId,
        },
      },
    })

    return {
      purchased: !!purchase,
    }
  }

  /**
   * 检查用户是否已下载章节
   * @param chapterId 章节ID
   * @param userId 用户ID
   * @returns 下载状态
   * @throws BadRequestException 当章节不存在时抛出
   */
  async checkUserDownloaded(chapterId: number, userId: number) {
    const chapter = await this.workChapter.findUnique({
      where: { id: chapterId },
    })
    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }
    const downloadTargetType = this.getDownloadTargetType(chapter.workType)
    const downloaded = await this.downloadService.checkDownloadStatus({
      targetType: downloadTargetType,
      targetId: chapterId,
      userId,
    })
    return { downloaded }
  }

  /**
   * 批量获取章节用户状态
   * @param ids 章节ID数组
   * @param userId 用户ID
   * @returns 章节状态列表
   */
  async getChapterUserStatus(ids: number[], userId: number) {
    if (ids.length === 0) {
      return []
    }

    // 查询章节基本信息
    const chapters = await this.workChapter.findMany({
      where: { id: { in: ids } },
      select: { id: true, workType: true },
    })

    // 按作品类型分组
    const comicChapterIds = chapters
      .filter((c) => c.workType === 1)
      .map((c) => c.id)
    const novelChapterIds = chapters
      .filter((c) => c.workType === 2)
      .map((c) => c.id)

    // 并行查询各类状态
    const [comicLikes, novelLikes, purchases, comicDownloads, novelDownloads] =
      await Promise.all([
        comicChapterIds.length > 0
          ? this.likeService.checkStatusBatch(
              InteractionTargetType.COMIC_CHAPTER,
              comicChapterIds,
              userId,
            )
          : new Map(),
        novelChapterIds.length > 0
          ? this.likeService.checkStatusBatch(
              InteractionTargetType.NOVEL_CHAPTER,
              novelChapterIds,
              userId,
            )
          : new Map(),
        this.workChapterPurchase.findMany({
          where: {
            userId,
            chapterId: { in: ids },
          },
          select: { chapterId: true },
        }),
        comicChapterIds.length > 0
          ? this.downloadService.checkStatusBatch(
              DownloadTargetTypeEnum.COMIC_CHAPTER,
              comicChapterIds,
              userId,
            )
          : new Map(),
        novelChapterIds.length > 0
          ? this.downloadService.checkStatusBatch(
              DownloadTargetTypeEnum.NOVEL_CHAPTER,
              novelChapterIds,
              userId,
            )
          : new Map(),
      ])

    const purchaseSet = new Set(purchases.map((item) => item.chapterId))
    const chapterMap = new Map(chapters.map((c) => [c.id, c.workType]))

    // 组装结果
    return ids.map((id) => {
      const workType = chapterMap.get(id)
      const isComic = workType === 1
      return {
        id,
        liked: isComic
          ? (comicLikes.get(id) ?? false)
          : (novelLikes.get(id) ?? false),
        purchased: purchaseSet.has(id),
        downloaded: isComic
          ? (comicDownloads.get(id) ?? false)
          : (novelDownloads.get(id) ?? false),
      }
    })
  }

  /**
   * 获取用户已购买章节分页列表
   * @param dto 分页查询对象
   * @param userId 用户ID
   * @returns 分页章节列表及状态
   */
  async getMyPurchasedPage(dto: PageDto, userId: number) {
    const { pageIndex = 0, pageSize = 15 } = dto
    type PurchaseWhere = Prisma.WorkChapterPurchaseWhereInput & {
      pageIndex?: number
      pageSize?: number
    }
    const where: PurchaseWhere = {
      userId,
      pageIndex,
      pageSize,
    }
    const result = await this.workChapterPurchase.findPagination({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const chapterIds = result.list.map((item) => item.chapterId)
    if (chapterIds.length === 0) {
      return { ...result, list: [] }
    }

    // 查询章节详情
    const chapters = await this.workChapter.findMany({
      where: {
        id: { in: chapterIds },
      },
      select: this.getChapterListSelect(),
    })
    const chapterMap = new Map(chapters.map((item) => [item.id, item]))
    const orderedChapters = chapterIds
      .map((id) => chapterMap.get(id))
      .filter((item): item is NonNullable<typeof item> => !!item)

    // 按类型分组查询状态
    const chaptersWithType = chapters.map((c) => ({
      id: c.id,
      workType: c.workType,
    }))
    const comicChapterIds = chaptersWithType
      .filter((c) => c.workType === 1)
      .map((c) => c.id)
    const novelChapterIds = chaptersWithType
      .filter((c) => c.workType === 2)
      .map((c) => c.id)

    const [comicLikes, novelLikes, comicDownloads, novelDownloads] =
      await Promise.all([
        comicChapterIds.length > 0
          ? this.likeService.checkStatusBatch(
              InteractionTargetType.COMIC_CHAPTER,
              comicChapterIds,
              userId,
            )
          : new Map(),
        novelChapterIds.length > 0
          ? this.likeService.checkStatusBatch(
              InteractionTargetType.NOVEL_CHAPTER,
              novelChapterIds,
              userId,
            )
          : new Map(),
        comicChapterIds.length > 0
          ? this.downloadService.checkStatusBatch(
              DownloadTargetTypeEnum.COMIC_CHAPTER,
              comicChapterIds,
              userId,
            )
          : new Map(),
        novelChapterIds.length > 0
          ? this.downloadService.checkStatusBatch(
              DownloadTargetTypeEnum.NOVEL_CHAPTER,
              novelChapterIds,
              userId,
            )
          : new Map(),
      ])

    return {
      ...result,
      list: orderedChapters.map((item) => {
        const isComic = item.workType === 1
        return {
          ...item,
          liked: isComic
            ? (comicLikes.get(item.id) ?? false)
            : (novelLikes.get(item.id) ?? false),
          purchased: true,
          downloaded: isComic
            ? (comicDownloads.get(item.id) ?? false)
            : (novelDownloads.get(item.id) ?? false),
        }
      }),
    }
  }

  /**
   * 获取用户已下载章节分页列表
   * @param dto 分页查询对象
   * @param userId 用户ID
   * @returns 分页章节列表及状态
   */
  async getMyDownloadedPage(dto: PageDto, userId: number) {
    const { pageSize = 15 } = dto

    // 分别查询漫画和小说下载记录
    const [comicResult, novelResult] = await Promise.all([
      this.downloadService.getUserDownloads({
        userId,
        targetType: DownloadTargetTypeEnum.COMIC_CHAPTER,
      }),
      this.downloadService.getUserDownloads({
        userId,
        targetType: DownloadTargetTypeEnum.NOVEL_CHAPTER,
      }),
    ])

    // 合并并按时间排序
    const allDownloads = [...comicResult.list, ...novelResult.list]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, pageSize)

    const chapterIds = allDownloads.map((d) => d.targetId)
    if (chapterIds.length === 0) {
      return { list: [], total: comicResult.total + novelResult.total }
    }

    // 查询章节详情
    const chapters = await this.workChapter.findMany({
      where: {
        id: { in: chapterIds },
      },
      select: this.getChapterListSelect(),
    })
    const chapterMap = new Map(chapters.map((item) => [item.id, item]))
    const orderedChapters = chapterIds
      .map((id) => chapterMap.get(id))
      .filter((item): item is NonNullable<typeof item> => !!item)

    // 按类型分组查询状态
    const comicChapterIds = chapters
      .filter((c) => c.workType === 1)
      .map((c) => c.id)
    const novelChapterIds = chapters
      .filter((c) => c.workType === 2)
      .map((c) => c.id)

    const [comicLikes, novelLikes, purchases] = await Promise.all([
      comicChapterIds.length > 0
        ? this.likeService.checkStatusBatch(
            InteractionTargetType.COMIC_CHAPTER,
            comicChapterIds,
            userId,
          )
        : new Map(),
      novelChapterIds.length > 0
        ? this.likeService.checkStatusBatch(
            InteractionTargetType.NOVEL_CHAPTER,
            novelChapterIds,
            userId,
          )
        : new Map(),
      this.workChapterPurchase.findMany({
        where: {
          userId,
          chapterId: { in: chapterIds },
        },
        select: { chapterId: true },
      }),
    ])

    const purchaseSet = new Set(purchases.map((item) => item.chapterId))

    return {
      list: orderedChapters.map((item) => {
        const isComic = item.workType === 1
        return {
          ...item,
          liked: isComic
            ? (comicLikes.get(item.id) ?? false)
            : (novelLikes.get(item.id) ?? false),
          purchased: purchaseSet.has(item.id),
          downloaded: true,
        }
      }),
      total: comicResult.total + novelResult.total,
    }
  }

  /**
   * 获取用户阅读历史分页列表
   * @param dto 分页查询对象
   * @param userId 用户ID
   * @returns 分页章节列表及状态
   */
  async getMyReadPage(dto: PageDto, userId: number) {
    const { pageIndex = 0, pageSize = 15 } = dto
    type ReadWhere = Prisma.UserGrowthEventWhereInput & {
      pageIndex?: number
      pageSize?: number
    }
    const where: ReadWhere = {
      userId,
      business: 'work',
      eventKey: WorkChapterGrowthEventKey.Read,
      pageIndex,
      pageSize,
    }
    const result = await this.prisma.userGrowthEvent.findPagination({
      where,
      orderBy: { occurredAt: 'desc' },
    })

    // 提取章节ID
    const targetIds = result.list
      .map((item) => item.targetId)
      .filter((id): id is number => typeof id === 'number')
    if (targetIds.length === 0) {
      return { ...result, list: [] }
    }

    // 查询章节详情
    const chapters = await this.workChapter.findMany({
      where: {
        id: { in: targetIds },
      },
      select: this.getChapterListSelect(),
    })
    const chapterMap = new Map(chapters.map((item) => [item.id, item]))
    const orderedChapters = result.list
      .map((item) =>
        typeof item.targetId === 'number'
          ? chapterMap.get(item.targetId)
          : undefined,
      )
      .filter((item): item is NonNullable<typeof item> => !!item)

    // 按类型分组查询状态
    const uniqueChapterIds = Array.from(new Set(targetIds))
    const comicChapterIds = chapters
      .filter((c) => c.workType === 1)
      .map((c) => c.id)
    const novelChapterIds = chapters
      .filter((c) => c.workType === 2)
      .map((c) => c.id)

    const [comicLikes, novelLikes, purchases, comicDownloads, novelDownloads] =
      await Promise.all([
        comicChapterIds.length > 0
          ? this.likeService.checkStatusBatch(
              InteractionTargetType.COMIC_CHAPTER,
              comicChapterIds,
              userId,
            )
          : new Map(),
        novelChapterIds.length > 0
          ? this.likeService.checkStatusBatch(
              InteractionTargetType.NOVEL_CHAPTER,
              novelChapterIds,
              userId,
            )
          : new Map(),
        this.workChapterPurchase.findMany({
          where: {
            userId,
            chapterId: { in: uniqueChapterIds },
          },
          select: { chapterId: true },
        }),
        comicChapterIds.length > 0
          ? this.downloadService.checkStatusBatch(
              DownloadTargetTypeEnum.COMIC_CHAPTER,
              comicChapterIds,
              userId,
            )
          : new Map(),
        novelChapterIds.length > 0
          ? this.downloadService.checkStatusBatch(
              DownloadTargetTypeEnum.NOVEL_CHAPTER,
              novelChapterIds,
              userId,
            )
          : new Map(),
      ])

    const purchaseSet = new Set(purchases.map((item) => item.chapterId))

    return {
      ...result,
      list: orderedChapters.map((item) => {
        const isComic = item.workType === 1
        return {
          ...item,
          liked: isComic
            ? (comicLikes.get(item.id) ?? false)
            : (novelLikes.get(item.id) ?? false),
          purchased: purchaseSet.has(item.id),
          downloaded: isComic
            ? (comicDownloads.get(item.id) ?? false)
            : (novelDownloads.get(item.id) ?? false),
        }
      }),
    }
  }

  /**
   * 获取章节分页列表及用户状态
   * @param dto 查询条件数据传输对象
   * @param userId 用户ID
   * @returns 分页章节列表及用户状态
   */
  async getChapterPageWithUserStatus(dto: QueryWorkChapterDto, userId: number) {
    const page = await this.getChapterPage(dto)
    const chapterIds = page.list.map((item) => item.id)

    if (chapterIds.length === 0) {
      return page
    }

    // 按类型分组
    const comicChapterIds = page.list
      .filter((c) => c.workType === 1)
      .map((c) => c.id)
    const novelChapterIds = page.list
      .filter((c) => c.workType === 2)
      .map((c) => c.id)

    // 并行查询各类状态
    const [comicLikes, novelLikes, purchases, comicDownloads, novelDownloads] =
      await Promise.all([
        comicChapterIds.length > 0
          ? this.likeService.checkStatusBatch(
              InteractionTargetType.COMIC_CHAPTER,
              comicChapterIds,
              userId,
            )
          : new Map(),
        novelChapterIds.length > 0
          ? this.likeService.checkStatusBatch(
              InteractionTargetType.NOVEL_CHAPTER,
              novelChapterIds,
              userId,
            )
          : new Map(),
        this.workChapterPurchase.findMany({
          where: {
            userId,
            chapterId: { in: chapterIds },
          },
          select: { chapterId: true },
        }),
        comicChapterIds.length > 0
          ? this.downloadService.checkStatusBatch(
              DownloadTargetTypeEnum.COMIC_CHAPTER,
              comicChapterIds,
              userId,
            )
          : new Map(),
        novelChapterIds.length > 0
          ? this.downloadService.checkStatusBatch(
              DownloadTargetTypeEnum.NOVEL_CHAPTER,
              novelChapterIds,
              userId,
            )
          : new Map(),
      ])

    const purchaseSet = new Set(purchases.map((item) => item.chapterId))

    return {
      ...page,
      list: page.list.map((item) => {
        const isComic = item.workType === 1
        return {
          ...item,
          liked: isComic
            ? (comicLikes.get(item.id) ?? false)
            : (novelLikes.get(item.id) ?? false),
          purchased: purchaseSet.has(item.id),
          downloaded: isComic
            ? (comicDownloads.get(item.id) ?? false)
            : (novelDownloads.get(item.id) ?? false),
        }
      }),
    }
  }
}
