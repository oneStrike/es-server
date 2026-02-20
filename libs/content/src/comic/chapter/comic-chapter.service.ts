import { WorkViewPermissionEnum } from '@libs/base/constant'
import { BaseService, Prisma } from '@libs/base/database'
import { DragReorderDto, PageDto } from '@libs/base/dto'
import { UserGrowthEventService } from '@libs/user/growth-event'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ComicChapterGrowthEventKey } from './comic-chapter.constant'
import {
  CreateComicChapterDto,
  QueryComicChapterDto,
  UpdateComicChapterDto,
} from './dto/comic-chapter.dto'

/**
 * 漫画章节服务类
 * 提供漫画章节的增删改查等核心业务逻辑
 */
@Injectable()
export class ComicChapterService extends BaseService {
  get workComicChapter() {
    return this.prisma.workComicChapter
  }

  get workComic() {
    return this.prisma.workComic
  }

  get workComicChapterLike() {
    return this.prisma.workComicChapterLike
  }

  get workComicChapterPurchase() {
    return this.prisma.workComicChapterPurchase
  }

  get workComicChapterDownload() {
    return this.prisma.workComicChapterDownload
  }

  get appUser() {
    return this.prisma.appUser
  }

  constructor(
    private readonly userGrowthEventService: UserGrowthEventService,
  ) {
    super()
  }

  get userLevelRule() {
    return this.prisma.userLevelRule
  }

  /**
   * 章节列表轻量字段选择器
   * @returns 章节列表必要字段
   */
  private getChapterListSelect() {
    return {
      id: true,
      title: true,
      subtitle: true,
      isPublished: true,
      comicId: true,
      sortOrder: true,
      readRule: true,
      readPoints: true,
      downloadRule: true,
      downloadPoints: true,
      canComment: true,
      requiredReadLevelId: true,
      requiredDownloadLevelId: true,
      isPreview: true,
      publishAt: true,
      purchaseCount: true,
      viewCount: true,
      likeCount: true,
      commentCount: true,
      createdAt: true,
      updatedAt: true,
    }
  }

  /**
   * 创建漫画章节
   * @param createComicChapterDto 创建章节的数据
   * @returns 创建的章节信息
   */
  async createComicChapter(createComicChapterDto: CreateComicChapterDto) {
    const { comicId, sortOrder, requiredReadLevelId, requiredDownloadLevelId } =
      createComicChapterDto

    if (!(await this.workComic.exists({ id: comicId }))) {
      throw new BadRequestException('关联的漫画不存在')
    }

    // 验证同一漫画下章节号是否已存在
    if (
      await this.workComicChapter.exists({
        comicId,
        sortOrder,
      })
    ) {
      throw new BadRequestException('该漫画下章节号已存在')
    }

    // 验证会员等级ID是否存在
    if (
      requiredReadLevelId &&
      !(await this.userLevelRule.exists({ id: requiredReadLevelId }))
    ) {
      throw new BadRequestException('指定的阅读会员等级不存在')
    }

    if (
      requiredDownloadLevelId &&
      !(await this.userLevelRule.exists({ id: requiredDownloadLevelId }))
    ) {
      throw new BadRequestException('指定的下载会员等级不存在')
    }

    return this.workComicChapter.create({ data: createComicChapterDto })
  }

  /**
   * 分页查询漫画章节列表
   * @param dto 查询条件
   * @returns 分页章节列表
   */
  async getComicChapterPage(dto: QueryComicChapterDto) {
    return this.workComicChapter.findPagination({
      where: {
        ...dto,
        title: {
          contains: dto.title,
          mode: 'insensitive',
        },
      },
      omit: {
        description: true,
        contents: true,
        remark: true,
        deletedAt: true,
      },
      orderBy: [{ sortOrder: 'desc' }],
    })
  }

  /**
   * 获取漫画章节详情
   * @param id 章节ID
   * @returns 章节详情信息
   */
  async getComicChapterDetail(id: number) {
    const chapter = await this.workComicChapter.findUnique({
      where: { id },
      include: {
        relatedComic: {
          select: {
            id: true,
            name: true,
          },
        },
        requiredReadLevel: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        requiredDownloadLevel: {
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

  async getComicChapterDetailWithUserStatus(id: number, userId: number) {
    const [chapter, like, purchase, download] = await Promise.all([
      this.getComicChapterDetail(id),
      this.workComicChapterLike.findUnique({
        where: {
          chapterId_userId: {
            chapterId: id,
            userId,
          },
        },
      }),
      this.workComicChapterPurchase.findUnique({
        where: {
          chapterId_userId: {
            chapterId: id,
            userId,
          },
        },
      }),
      this.workComicChapterDownload.findUnique({
        where: {
          chapterId_userId: {
            chapterId: id,
            userId,
          },
        },
      }),
    ])

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    return {
      ...chapter,
      liked: !!like,
      purchased: !!purchase,
      downloaded: !!download,
    }
  }

  /**
   * 更新漫画章节信息
   * @param dto 更新章节的数据
   * @returns 更新后的章节信息
   */
  async updateComicChapter(dto: UpdateComicChapterDto) {
    const { id, comicId, ...updateData } = dto
    const { requiredReadLevelId, requiredDownloadLevelId, sortOrder } =
      updateData
    if (
      sortOrder !== undefined &&
      (await this.workComicChapter.exists({
        id: { not: id },
        sortOrder: updateData.sortOrder,
        comicId,
      }))
    ) {
      throw new BadRequestException('该漫画下章节号已存在')
    }

    // 验证会员等级ID是否存在
    if (
      requiredReadLevelId &&
      !(await this.userLevelRule.exists({ id: requiredReadLevelId }))
    ) {
      throw new BadRequestException('指定的阅读会员等级不存在')
    }

    if (
      requiredDownloadLevelId &&
      !(await this.userLevelRule.exists({ id: requiredDownloadLevelId }))
    ) {
      throw new BadRequestException('指定的下载会员等级不存在')
    }

    return this.workComicChapter.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * 删除章节
   * @param id 章节ID
   * @returns 删除结果
   */
  async deleteComicChapter(id: number) {
    return this.workComicChapter.delete({ where: { id } })
  }

  /**
   * 交换两个章节的章节号
   * @param swapChapterNumberDto 交换章节号的数据
   * @returns 交换结果
   */
  async swapChapterNumbers(swapChapterNumberDto: DragReorderDto) {
    const { targetId, dragId } = swapChapterNumberDto

    // 验证两个章节ID不能相同
    if (targetId === dragId) {
      throw new BadRequestException('不能交换相同的章节')
    }

    // 获取两个章节的信息
    const [targetChapter, dragChapter] = await Promise.all([
      this.workComicChapter.findUnique({ where: { id: targetId } }),
      this.workComicChapter.findUnique({ where: { id: dragId } }),
    ])

    // 验证章节是否存在
    if (!targetChapter) {
      throw new BadRequestException(`章节ID ${targetId} 不存在`)
    }
    if (!dragChapter) {
      throw new BadRequestException(`章节ID ${dragId} 不存在`)
    }

    // 验证两个章节是否属于同一漫画
    if (targetChapter.comicId !== dragChapter.comicId) {
      throw new BadRequestException('只能交换同一漫画下的章节号')
    }

    // 使用事务确保排序交换过程原子化
    return this.prisma.$transaction(async (tx) => {
      // 临时章节号用于避开 sortOrder 唯一约束冲突
      const tempChapterNumber = -Math.floor(Math.random() * 1000000) - 1

      // 第一步：将拖拽章节置为临时值，释放目标排序号
      await tx.workComicChapter.update({
        where: { id: dragId },
        data: { sortOrder: tempChapterNumber },
      })

      // 第二步：目标章节占用拖拽章节原排序
      await tx.workComicChapter.update({
        where: { id: targetId },
        data: { sortOrder: dragChapter.sortOrder },
      })

      // 第三步：拖拽章节占用目标章节原排序
      await tx.workComicChapter.update({
        where: { id: dragId },
        data: { sortOrder: targetChapter.sortOrder },
      })

      return { targetId, dragId }
    })
  }

  async incrementViewCount(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    const chapter = await this.workComicChapter.findUnique({ where: { id } })

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    if (chapter.readRule !== WorkViewPermissionEnum.ALL) {
      const user = await this.appUser.findUnique({
        where: { id: userId },
        include: { level: true },
      })

      if (!user) {
        throw new BadRequestException('用户不存在')
      }

      if (chapter.readRule === WorkViewPermissionEnum.MEMBER) {
        if (!user.levelId || !user.level) {
          throw new BadRequestException('会员等级不足')
        }

        if (chapter.requiredReadLevelId) {
          const requiredLevel = await this.userLevelRule.findUnique({
            where: { id: chapter.requiredReadLevelId },
          })

          if (!requiredLevel) {
            throw new BadRequestException('指定的阅读会员等级不存在')
          }

          if (user.level.requiredExperience < requiredLevel.requiredExperience) {
            throw new BadRequestException('会员等级不足')
          }
        }
      }

      if (chapter.readRule === WorkViewPermissionEnum.POINTS) {
        const requiredPoints = chapter.readPoints ?? 0
        if (requiredPoints <= 0) {
          throw new BadRequestException('章节未配置购买积分')
        }
        if (user.points < requiredPoints) {
          throw new BadRequestException('积分不足')
        }
      }
    }

    await this.workComicChapter.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })

    await this.userGrowthEventService.handleEvent({
      business: 'comic',
      eventKey: ComicChapterGrowthEventKey.Read,
      userId,
      targetId: id,
      ip,
      deviceId,
      occurredAt: new Date(),
    })

    return { id }
  }

  async incrementLikeCount(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    const [chapter, user] = await Promise.all([
      this.workComicChapter.findUnique({ where: { id } }),
      this.appUser.findUnique({ where: { id: userId } }),
    ])

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const existingLike = await this.workComicChapterLike.findUnique({
      where: {
        chapterId_userId: {
          chapterId: id,
          userId,
        },
      },
    })

    if (existingLike) {
      throw new BadRequestException('已经点赞过该章节')
    }

    // 点赞记录与计数更新保持一致
    // 购买记录与计数更新保持一致
    await this.prisma.$transaction(async (tx) => {
      await tx.workComicChapterLike.create({
        data: {
          chapterId: id,
          userId,
        },
      })

      await tx.workComicChapter.update({
        where: { id },
        data: {
          likeCount: {
            increment: 1,
          },
        },
      })
    })

    // 点赞成功后触发成长事件
    // 购买成功后触发成长事件
    await this.userGrowthEventService.handleEvent({
      business: 'comic',
      eventKey: ComicChapterGrowthEventKey.Like,
      userId,
      targetId: id,
      ip,
      deviceId,
      occurredAt: new Date(),
    })

    return { id }
  }

  async incrementPurchaseCount(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    const [chapter, user] = await Promise.all([
      this.workComicChapter.findUnique({ where: { id } }),
      this.appUser.findUnique({ where: { id: userId }, include: { level: true } }),
    ])

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const existingPurchase = await this.workComicChapterPurchase.findUnique({
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

    if (chapter.readRule !== WorkViewPermissionEnum.POINTS) {
      throw new BadRequestException('该章节不支持购买')
    }

    if (chapter.requiredReadLevelId) {
      if (!user.levelId || !user.level) {
        throw new BadRequestException('会员等级不足')
      }

      const requiredLevel = await this.userLevelRule.findUnique({
        where: { id: chapter.requiredReadLevelId },
      })

      if (!requiredLevel) {
        throw new BadRequestException('指定的阅读会员等级不存在')
      }

      if (user.level.requiredExperience < requiredLevel.requiredExperience) {
        throw new BadRequestException('会员等级不足')
      }
    }

    const requiredPoints = chapter.readPoints ?? 0
    if (requiredPoints <= 0) {
      throw new BadRequestException('章节未配置购买积分')
    }

    if (user.points < requiredPoints) {
      throw new BadRequestException('积分不足')
    }

    // 下载记录与计数更新保持一致
    await this.prisma.$transaction(async (tx) => {
      await tx.workComicChapterPurchase.create({
        data: {
          chapterId: id,
          userId,
        },
      })

      await tx.workComicChapter.update({
        where: { id },
        data: {
          purchaseCount: {
            increment: 1,
          },
        },
      })
    })

    // 下载成功后触发成长事件
    await this.userGrowthEventService.handleEvent({
      business: 'comic',
      eventKey: ComicChapterGrowthEventKey.Purchase,
      userId,
      targetId: id,
      ip,
      deviceId,
      occurredAt: new Date(),
    })

    return { id }
  }

  async reportDownload(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    const [chapter, user] = await Promise.all([
      this.workComicChapter.findUnique({ where: { id } }),
      this.appUser.findUnique({ where: { id: userId }, include: { level: true } }),
    ])

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const existingDownload = await this.workComicChapterDownload.findUnique({
      where: {
        chapterId_userId: {
          chapterId: id,
          userId,
        },
      },
    })

    if (existingDownload) {
      throw new BadRequestException('已下载该章节')
    }

    if (chapter.downloadRule === 0) {
      throw new BadRequestException('该章节禁止下载')
    }

    if (chapter.downloadRule !== WorkViewPermissionEnum.ALL) {
      if (chapter.downloadRule === WorkViewPermissionEnum.LOGGED_IN) {
        if (!user) {
          throw new BadRequestException('用户不存在')
        }
      }

      if (chapter.downloadRule === WorkViewPermissionEnum.MEMBER) {
        if (!user.levelId || !user.level) {
          throw new BadRequestException('会员等级不足')
        }

        if (chapter.requiredDownloadLevelId) {
          const requiredLevel = await this.userLevelRule.findUnique({
            where: { id: chapter.requiredDownloadLevelId },
          })

          if (!requiredLevel) {
            throw new BadRequestException('指定的下载会员等级不存在')
          }

          if (
            user.level.requiredExperience < requiredLevel.requiredExperience
          ) {
            throw new BadRequestException('会员等级不足')
          }
        }
      }

      if (chapter.downloadRule === WorkViewPermissionEnum.POINTS) {
        const requiredPoints = chapter.downloadPoints ?? 0
        if (requiredPoints <= 0) {
          throw new BadRequestException('章节未配置下载积分')
        }
        if (user.points < requiredPoints) {
          throw new BadRequestException('积分不足')
        }
      }
    }

    await this.workComicChapterDownload.create({
      data: {
        chapterId: id,
        userId,
      },
    })

    await this.userGrowthEventService.handleEvent({
      business: 'comic',
      eventKey: ComicChapterGrowthEventKey.Download,
      userId,
      targetId: id,
      ip,
      deviceId,
      occurredAt: new Date(),
    })

    return { id }
  }

  async checkUserLiked(chapterId: number, userId: number) {
    const like = await this.workComicChapterLike.findUnique({
      where: {
        chapterId_userId: {
          chapterId,
          userId,
        },
      },
    })

    return {
      liked: !!like,
    }
  }

  async checkUserPurchased(chapterId: number, userId: number) {
    const purchase = await this.workComicChapterPurchase.findUnique({
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

  async checkUserDownloaded(chapterId: number, userId: number) {
    const download = await this.workComicChapterDownload.findUnique({
      where: {
        chapterId_userId: {
          chapterId,
          userId,
        },
      },
    })

    return {
      downloaded: !!download,
    }
  }

  async getComicChapterUserStatus(ids: number[], userId: number) {
    if (ids.length === 0) {
      return []
    }

    const [likes, purchases, downloads] = await Promise.all([
      this.workComicChapterLike.findMany({
        where: {
          userId,
          chapterId: { in: ids },
        },
        select: { chapterId: true },
      }),
      this.workComicChapterPurchase.findMany({
        where: {
          userId,
          chapterId: { in: ids },
        },
        select: { chapterId: true },
      }),
      this.workComicChapterDownload.findMany({
        where: {
          userId,
          chapterId: { in: ids },
        },
        select: { chapterId: true },
      }),
    ])

    const likeSet = new Set(likes.map((item) => item.chapterId))
    const purchaseSet = new Set(purchases.map((item) => item.chapterId))
    const downloadSet = new Set(downloads.map((item) => item.chapterId))

    return ids.map((id) => ({
      id,
      liked: likeSet.has(id),
      purchased: purchaseSet.has(id),
      downloaded: downloadSet.has(id),
    }))
  }

  /**
   * 分页查询我的章节购买记录
   * @param dto 分页参数
   * @param userId 用户ID
   * @returns 章节列表（含用户状态）
   */
  async getMyPurchasedChapterPage(dto: PageDto, userId: number) {
    // 使用分页插件统一处理 pageIndex/pageSize 兼容 0/1 基
    const { pageIndex = 0, pageSize = 15 } = dto
    type PurchaseWhere = Prisma.WorkComicChapterPurchaseWhereInput & {
      pageIndex?: number
      pageSize?: number
    }
    const where: PurchaseWhere = {
      userId,
      pageIndex,
      pageSize,
    }
    const result = await this.workComicChapterPurchase.findPagination({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // 依据购买记录顺序获取章节信息
    const chapterIds = result.list.map((item) => item.chapterId)
    if (chapterIds.length === 0) {
      return { ...result, list: [] }
    }

    // 批量拉取章节并恢复原始顺序
    const chapters = await this.workComicChapter.findMany({
      where: {
        id: { in: chapterIds },
      },
      select: this.getChapterListSelect(),
    })
    const chapterMap = new Map(chapters.map((item) => [item.id, item]))
    const orderedChapters = chapterIds
      .map((id) => chapterMap.get(id))
      .filter((item): item is NonNullable<typeof item> => !!item)

    // 组装用户状态信息
    const [likes, downloads] = await Promise.all([
      this.workComicChapterLike.findMany({
        where: {
          userId,
          chapterId: { in: chapterIds },
        },
        select: { chapterId: true },
      }),
      this.workComicChapterDownload.findMany({
        where: {
          userId,
          chapterId: { in: chapterIds },
        },
        select: { chapterId: true },
      }),
    ])

    const likeSet = new Set(likes.map((item) => item.chapterId))
    const downloadSet = new Set(downloads.map((item) => item.chapterId))

    return {
      ...result,
      list: orderedChapters.map((item) => ({
        ...item,
        liked: likeSet.has(item.id),
        purchased: true,
        downloaded: downloadSet.has(item.id),
      })),
    }
  }

  /**
   * 分页查询我的章节下载记录
   * @param dto 分页参数
   * @param userId 用户ID
   * @returns 章节列表（含用户状态）
   */
  async getMyDownloadedChapterPage(dto: PageDto, userId: number) {
    // 使用分页插件统一处理 pageIndex/pageSize 兼容 0/1 基
    const { pageIndex = 0, pageSize = 15 } = dto
    type DownloadWhere = Prisma.WorkComicChapterDownloadWhereInput & {
      pageIndex?: number
      pageSize?: number
    }
    const where: DownloadWhere = {
      userId,
      pageIndex,
      pageSize,
    }
    const result = await this.workComicChapterDownload.findPagination({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // 依据下载记录顺序获取章节信息
    const chapterIds = result.list.map((item) => item.chapterId)
    if (chapterIds.length === 0) {
      return { ...result, list: [] }
    }

    // 批量拉取章节并恢复原始顺序
    const chapters = await this.workComicChapter.findMany({
      where: {
        id: { in: chapterIds },
      },
      select: this.getChapterListSelect(),
    })
    const chapterMap = new Map(chapters.map((item) => [item.id, item]))
    const orderedChapters = chapterIds
      .map((id) => chapterMap.get(id))
      .filter((item): item is NonNullable<typeof item> => !!item)

    // 组装用户状态信息
    const [likes, purchases] = await Promise.all([
      this.workComicChapterLike.findMany({
        where: {
          userId,
          chapterId: { in: chapterIds },
        },
        select: { chapterId: true },
      }),
      this.workComicChapterPurchase.findMany({
        where: {
          userId,
          chapterId: { in: chapterIds },
        },
        select: { chapterId: true },
      }),
    ])

    const likeSet = new Set(likes.map((item) => item.chapterId))
    const purchaseSet = new Set(purchases.map((item) => item.chapterId))

    return {
      ...result,
      list: orderedChapters.map((item) => ({
        ...item,
        liked: likeSet.has(item.id),
        purchased: purchaseSet.has(item.id),
        downloaded: true,
      })),
    }
  }

  /**
   * 分页查询我的章节阅读记录
   * @param dto 分页参数
   * @param userId 用户ID
   * @returns 章节列表（含用户状态）
   */
  async getMyReadChapterPage(dto: PageDto, userId: number) {
    // 使用成长事件作为阅读记录来源
    const { pageIndex = 0, pageSize = 15 } = dto
    type ReadWhere = Prisma.UserGrowthEventWhereInput & {
      pageIndex?: number
      pageSize?: number
    }
    const where: ReadWhere = {
      userId,
      business: 'comic',
      eventKey: ComicChapterGrowthEventKey.Read,
      pageIndex,
      pageSize,
    }
    const result = await this.prisma.userGrowthEvent.findPagination({
      where,
      orderBy: { occurredAt: 'desc' },
    })

    // 提取章节ID并按事件顺序返回
    const targetIds = result.list
      .map((item) => item.targetId)
      .filter((id): id is number => typeof id === 'number')
    if (targetIds.length === 0) {
      return { ...result, list: [] }
    }

    const chapters = await this.workComicChapter.findMany({
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

    // 组装用户状态信息
    const uniqueChapterIds = Array.from(new Set(targetIds))
    const [likes, purchases, downloads] = await Promise.all([
      this.workComicChapterLike.findMany({
        where: {
          userId,
          chapterId: { in: uniqueChapterIds },
        },
        select: { chapterId: true },
      }),
      this.workComicChapterPurchase.findMany({
        where: {
          userId,
          chapterId: { in: uniqueChapterIds },
        },
        select: { chapterId: true },
      }),
      this.workComicChapterDownload.findMany({
        where: {
          userId,
          chapterId: { in: uniqueChapterIds },
        },
        select: { chapterId: true },
      }),
    ])

    const likeSet = new Set(likes.map((item) => item.chapterId))
    const purchaseSet = new Set(purchases.map((item) => item.chapterId))
    const downloadSet = new Set(downloads.map((item) => item.chapterId))

    return {
      ...result,
      list: orderedChapters.map((item) => ({
        ...item,
        liked: likeSet.has(item.id),
        purchased: purchaseSet.has(item.id),
        downloaded: downloadSet.has(item.id),
      })),
    }
  }

  async getComicChapterPageWithUserStatus(
    dto: QueryComicChapterDto,
    userId: number,
  ) {
    const page = await this.getComicChapterPage(dto)
    const chapterIds = page.list.map((item) => item.id)

    if (chapterIds.length === 0) {
      return page
    }

    const [likes, purchases, downloads] = await Promise.all([
      this.workComicChapterLike.findMany({
        where: {
          userId,
          chapterId: { in: chapterIds },
        },
        select: { chapterId: true },
      }),
      this.workComicChapterPurchase.findMany({
        where: {
          userId,
          chapterId: { in: chapterIds },
        },
        select: { chapterId: true },
      }),
      this.workComicChapterDownload.findMany({
        where: {
          userId,
          chapterId: { in: chapterIds },
        },
        select: { chapterId: true },
      }),
    ])

    const likeSet = new Set(likes.map((item) => item.chapterId))
    const purchaseSet = new Set(purchases.map((item) => item.chapterId))
    const downloadSet = new Set(downloads.map((item) => item.chapterId))

    return {
      ...page,
      list: page.list.map((item) => ({
        ...item,
        liked: likeSet.has(item.id),
        purchased: purchaseSet.has(item.id),
        downloaded: downloadSet.has(item.id),
      })),
    }
  }
}
