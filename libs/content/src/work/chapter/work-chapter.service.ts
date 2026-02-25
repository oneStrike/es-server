import { WorkViewPermissionEnum } from '@libs/base/constant'
import { BaseService, Prisma } from '@libs/base/database'
import { DragReorderDto, PageDto } from '@libs/base/dto'
import {
  DownloadService,
  InteractionTargetType,
  LikeService,
} from '@libs/interaction'
import { UserGrowthEventService } from '@libs/user/growth-event'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateWorkChapterDto,
  QueryWorkChapterDto,
  UpdateWorkChapterDto,
} from './dto/work-chapter.dto'
import { WorkChapterGrowthEventKey } from './work-chapter.constant'

@Injectable()
export class WorkChapterService extends BaseService {
  get workChapter() {
    return this.prisma.workChapter
  }

  get work() {
    return this.prisma.work
  }

  get workChapterPurchase() {
    return this.prisma.workChapterPurchase
  }

  get appUser() {
    return this.prisma.appUser
  }

  get userLevelRule() {
    return this.prisma.userLevelRule
  }

  constructor(
    private readonly userGrowthEventService: UserGrowthEventService,
    private readonly likeService: LikeService,
    private readonly downloadService: DownloadService,
  ) {
    super()
  }

  private getChapterListSelect() {
    return {
      id: true,
      title: true,
      subtitle: true,
      isPublished: true,
      workId: true,
      workType: true,
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
      wordCount: true,
      createdAt: true,
      updatedAt: true,
    }
  }

  private getTargetType(workType: number): InteractionTargetType {
    return workType === 1
      ? InteractionTargetType.COMIC_CHAPTER
      : InteractionTargetType.NOVEL_CHAPTER
  }

  async createChapter(createDto: CreateWorkChapterDto) {
    const { workId, sortOrder, requiredReadLevelId, requiredDownloadLevelId } =
      createDto

    if (!(await this.work.exists({ id: workId }))) {
      throw new BadRequestException('关联的作品不存在')
    }

    if (await this.workChapter.exists({ workId, sortOrder })) {
      throw new BadRequestException('该作品下章节号已存在')
    }

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

    return this.workChapter.create({ data: createDto })
  }

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
      omit: {
        description: true,
        contentPath: true,
        remark: true,
        deletedAt: true,
      },
      orderBy: [{ sortOrder: 'asc' }],
    })
  }

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

  async getChapterDetailWithUserStatus(id: number, userId: number) {
    const chapter = await this.getChapterDetail(id)
    const targetType = this.getTargetType(chapter.workType)

    const [liked, purchased, downloaded] = await Promise.all([
      this.likeService.checkLikeStatus(targetType, id, userId),
      this.workChapterPurchase.findUnique({
        where: {
          chapterId_userId: {
            chapterId: id,
            userId,
          },
        },
      }).then((p) => !!p),
      this.downloadService.checkDownloadStatus(targetType, id, userId),
    ])

    return {
      ...chapter,
      liked,
      purchased,
      downloaded,
    }
  }

  async updateChapter(dto: UpdateWorkChapterDto) {
    const { id, workId, ...updateData } = dto
    const { requiredReadLevelId, requiredDownloadLevelId, sortOrder } =
      updateData

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

    return this.workChapter.update({
      where: { id },
      data: updateData,
    })
  }

  async deleteChapter(id: number) {
    return this.workChapter.delete({ where: { id } })
  }

  async swapChapterNumbers(dto: DragReorderDto) {
    const { targetId, dragId } = dto

    if (targetId === dragId) {
      throw new BadRequestException('不能交换相同的章节')
    }

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

    if (targetChapter.workId !== dragChapter.workId) {
      throw new BadRequestException('只能交换同一作品下的章节号')
    }

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

    await this.workChapter.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })

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

    await this.likeService.like(targetType, id, userId)

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

  async incrementPurchaseCount(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    const [chapter, user] = await Promise.all([
      this.workChapter.findUnique({ where: { id } }),
      this.appUser.findUnique({
        where: { id: userId },
        include: { level: true },
      }),
    ])

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    if (!user) {
      throw new BadRequestException('用户不存在')
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

    await this.prisma.$transaction(async (tx) => {
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

  async reportDownload(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    const [chapter, user] = await Promise.all([
      this.workChapter.findUnique({ where: { id } }),
      this.appUser.findUnique({
        where: { id: userId },
        include: { level: true },
      }),
    ])

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    const targetType = this.getTargetType(chapter.workType)

    const existingDownload = await this.downloadService.checkDownloadStatus(
      targetType,
      id,
      userId,
    )

    if (existingDownload) {
      throw new BadRequestException('已下载该章节')
    }

    if (chapter.downloadRule === 0) {
      throw new BadRequestException('该章节禁止下载')
    }

    if (chapter.downloadRule !== WorkViewPermissionEnum.ALL) {
      if (!user) {
        throw new BadRequestException('用户不存在')
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

    await this.downloadService.recordDownload(targetType, id, userId, chapter.workId, chapter.workType)

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

  async checkUserLiked(chapterId: number, userId: number) {
    const chapter = await this.workChapter.findUnique({ where: { id: chapterId } })
    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }
    const targetType = this.getTargetType(chapter.workType)
    const liked = await this.likeService.checkLikeStatus(targetType, chapterId, userId)
    return { liked }
  }

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

  async checkUserDownloaded(chapterId: number, userId: number) {
    const chapter = await this.workChapter.findUnique({ where: { id: chapterId } })
    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }
    const targetType = this.getTargetType(chapter.workType)
    const downloaded = await this.downloadService.checkDownloadStatus(targetType, chapterId, userId)
    return { downloaded }
  }

  async getChapterUserStatus(ids: number[], userId: number) {
    if (ids.length === 0) {
      return []
    }

    const chapters = await this.workChapter.findMany({
      where: { id: { in: ids } },
      select: { id: true, workType: true },
    })

    const comicChapterIds = chapters.filter((c) => c.workType === 1).map((c) => c.id)
    const novelChapterIds = chapters.filter((c) => c.workType === 2).map((c) => c.id)

    const [
      comicLikes,
      novelLikes,
      purchases,
      comicDownloads,
      novelDownloads,
    ] = await Promise.all([
      comicChapterIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.COMIC_CHAPTER, comicChapterIds, userId)
        : new Map(),
      novelChapterIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.NOVEL_CHAPTER, novelChapterIds, userId)
        : new Map(),
      this.workChapterPurchase.findMany({
        where: {
          userId,
          chapterId: { in: ids },
        },
        select: { chapterId: true },
      }),
      comicChapterIds.length > 0
        ? this.downloadService.checkStatusBatch(InteractionTargetType.COMIC_CHAPTER, comicChapterIds, userId)
        : new Map(),
      novelChapterIds.length > 0
        ? this.downloadService.checkStatusBatch(InteractionTargetType.NOVEL_CHAPTER, novelChapterIds, userId)
        : new Map(),
    ])

    const purchaseSet = new Set(purchases.map((item) => item.chapterId))
    const chapterMap = new Map(chapters.map((c) => [c.id, c.workType]))

    return ids.map((id) => {
      const workType = chapterMap.get(id)
      const isComic = workType === 1
      return {
        id,
        liked: isComic ? comicLikes.get(id) ?? false : novelLikes.get(id) ?? false,
        purchased: purchaseSet.has(id),
        downloaded: isComic ? comicDownloads.get(id) ?? false : novelDownloads.get(id) ?? false,
      }
    })
  }

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

    const chaptersWithType = chapters.map((c) => ({ id: c.id, workType: c.workType }))
    const comicChapterIds = chaptersWithType.filter((c) => c.workType === 1).map((c) => c.id)
    const novelChapterIds = chaptersWithType.filter((c) => c.workType === 2).map((c) => c.id)

    const [comicLikes, novelLikes, comicDownloads, novelDownloads] = await Promise.all([
      comicChapterIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.COMIC_CHAPTER, comicChapterIds, userId)
        : new Map(),
      novelChapterIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.NOVEL_CHAPTER, novelChapterIds, userId)
        : new Map(),
      comicChapterIds.length > 0
        ? this.downloadService.checkStatusBatch(InteractionTargetType.COMIC_CHAPTER, comicChapterIds, userId)
        : new Map(),
      novelChapterIds.length > 0
        ? this.downloadService.checkStatusBatch(InteractionTargetType.NOVEL_CHAPTER, novelChapterIds, userId)
        : new Map(),
    ])

    return {
      ...result,
      list: orderedChapters.map((item) => {
        const isComic = item.workType === 1
        return {
          ...item,
          liked: isComic ? comicLikes.get(item.id) ?? false : novelLikes.get(item.id) ?? false,
          purchased: true,
          downloaded: isComic ? comicDownloads.get(item.id) ?? false : novelDownloads.get(item.id) ?? false,
        }
      }),
    }
  }

  async getMyDownloadedPage(dto: PageDto, userId: number) {
    const { pageIndex = 0, pageSize = 15 } = dto

    const [comicResult, novelResult] = await Promise.all([
      this.downloadService.getUserDownloads(userId, InteractionTargetType.COMIC_CHAPTER, pageIndex, pageSize),
      this.downloadService.getUserDownloads(userId, InteractionTargetType.NOVEL_CHAPTER, pageIndex, pageSize),
    ])

    const allDownloads = [...comicResult.list, ...novelResult.list]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, pageSize)

    const chapterIds = allDownloads.map((d) => d.targetId)
    if (chapterIds.length === 0) {
      return { list: [], total: comicResult.total + novelResult.total }
    }

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

    const comicChapterIds = chapters.filter((c) => c.workType === 1).map((c) => c.id)
    const novelChapterIds = chapters.filter((c) => c.workType === 2).map((c) => c.id)

    const [comicLikes, novelLikes, purchases] = await Promise.all([
      comicChapterIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.COMIC_CHAPTER, comicChapterIds, userId)
        : new Map(),
      novelChapterIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.NOVEL_CHAPTER, novelChapterIds, userId)
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
          liked: isComic ? comicLikes.get(item.id) ?? false : novelLikes.get(item.id) ?? false,
          purchased: purchaseSet.has(item.id),
          downloaded: true,
        }
      }),
      total: comicResult.total + novelResult.total,
    }
  }

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

    const targetIds = result.list
      .map((item) => item.targetId)
      .filter((id): id is number => typeof id === 'number')
    if (targetIds.length === 0) {
      return { ...result, list: [] }
    }

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

    const uniqueChapterIds = Array.from(new Set(targetIds))
    const comicChapterIds = chapters.filter((c) => c.workType === 1).map((c) => c.id)
    const novelChapterIds = chapters.filter((c) => c.workType === 2).map((c) => c.id)

    const [comicLikes, novelLikes, purchases, comicDownloads, novelDownloads] = await Promise.all([
      comicChapterIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.COMIC_CHAPTER, comicChapterIds, userId)
        : new Map(),
      novelChapterIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.NOVEL_CHAPTER, novelChapterIds, userId)
        : new Map(),
      this.workChapterPurchase.findMany({
        where: {
          userId,
          chapterId: { in: uniqueChapterIds },
        },
        select: { chapterId: true },
      }),
      comicChapterIds.length > 0
        ? this.downloadService.checkStatusBatch(InteractionTargetType.COMIC_CHAPTER, comicChapterIds, userId)
        : new Map(),
      novelChapterIds.length > 0
        ? this.downloadService.checkStatusBatch(InteractionTargetType.NOVEL_CHAPTER, novelChapterIds, userId)
        : new Map(),
    ])

    const purchaseSet = new Set(purchases.map((item) => item.chapterId))

    return {
      ...result,
      list: orderedChapters.map((item) => {
        const isComic = item.workType === 1
        return {
          ...item,
          liked: isComic ? comicLikes.get(item.id) ?? false : novelLikes.get(item.id) ?? false,
          purchased: purchaseSet.has(item.id),
          downloaded: isComic ? comicDownloads.get(item.id) ?? false : novelDownloads.get(item.id) ?? false,
        }
      }),
    }
  }

  async getChapterPageWithUserStatus(
    dto: QueryWorkChapterDto,
    userId: number,
  ) {
    const page = await this.getChapterPage(dto)
    const chapterIds = page.list.map((item) => item.id)

    if (chapterIds.length === 0) {
      return page
    }

    const comicChapterIds = page.list.filter((c) => c.workType === 1).map((c) => c.id)
    const novelChapterIds = page.list.filter((c) => c.workType === 2).map((c) => c.id)

    const [comicLikes, novelLikes, purchases, comicDownloads, novelDownloads] = await Promise.all([
      comicChapterIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.COMIC_CHAPTER, comicChapterIds, userId)
        : new Map(),
      novelChapterIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.NOVEL_CHAPTER, novelChapterIds, userId)
        : new Map(),
      this.workChapterPurchase.findMany({
        where: {
          userId,
          chapterId: { in: chapterIds },
        },
        select: { chapterId: true },
      }),
      comicChapterIds.length > 0
        ? this.downloadService.checkStatusBatch(InteractionTargetType.COMIC_CHAPTER, comicChapterIds, userId)
        : new Map(),
      novelChapterIds.length > 0
        ? this.downloadService.checkStatusBatch(InteractionTargetType.NOVEL_CHAPTER, novelChapterIds, userId)
        : new Map(),
    ])

    const purchaseSet = new Set(purchases.map((item) => item.chapterId))

    return {
      ...page,
      list: page.list.map((item) => {
        const isComic = item.workType === 1
        return {
          ...item,
          liked: isComic ? comicLikes.get(item.id) ?? false : novelLikes.get(item.id) ?? false,
          purchased: purchaseSet.has(item.id),
          downloaded: isComic ? comicDownloads.get(item.id) ?? false : novelDownloads.get(item.id) ?? false,
        }
      }),
    }
  }
}
