import { WorkViewPermissionEnum } from '@libs/base/constant'
import { BaseService, Prisma } from '@libs/base/database'
import { DragReorderDto, PageDto } from '@libs/base/dto'
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

  get workChapterLike() {
    return this.prisma.workChapterLike
  }

  get workChapterPurchase() {
    return this.prisma.workChapterPurchase
  }

  get workChapterDownload() {
    return this.prisma.workChapterDownload
  }

  get appUser() {
    return this.prisma.appUser
  }

  get userLevelRule() {
    return this.prisma.userLevelRule
  }

  constructor(
    private readonly userGrowthEventService: UserGrowthEventService,
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
    const [chapter, like, purchase, download] = await Promise.all([
      this.getChapterDetail(id),
      this.workChapterLike.findUnique({
        where: {
          chapterId_userId: {
            chapterId: id,
            userId,
          },
        },
      }),
      this.workChapterPurchase.findUnique({
        where: {
          chapterId_userId: {
            chapterId: id,
            userId,
          },
        },
      }),
      this.workChapterDownload.findUnique({
        where: {
          chapterId_userId: {
            chapterId: id,
            userId,
          },
        },
      }),
    ])

    return {
      ...chapter,
      liked: !!like,
      purchased: !!purchase,
      downloaded: !!download,
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
    const [chapter, user] = await Promise.all([
      this.workChapter.findUnique({ where: { id } }),
      this.appUser.findUnique({ where: { id: userId } }),
    ])

    if (!chapter) {
      throw new BadRequestException('章节不存在')
    }

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const existingLike = await this.workChapterLike.findUnique({
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

    await this.prisma.$transaction(async (tx) => {
      await tx.workChapterLike.create({
        data: {
          chapterId: id,
          userId,
        },
      })

      await tx.workChapter.update({
        where: { id },
        data: {
          likeCount: {
            increment: 1,
          },
        },
      })
    })

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

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const existingDownload = await this.workChapterDownload.findUnique({
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

    await this.workChapterDownload.create({
      data: {
        chapterId: id,
        userId,
      },
    })

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
    const like = await this.workChapterLike.findUnique({
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
    const download = await this.workChapterDownload.findUnique({
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

  async getChapterUserStatus(ids: number[], userId: number) {
    if (ids.length === 0) {
      return []
    }

    const [likes, purchases, downloads] = await Promise.all([
      this.workChapterLike.findMany({
        where: {
          userId,
          chapterId: { in: ids },
        },
        select: { chapterId: true },
      }),
      this.workChapterPurchase.findMany({
        where: {
          userId,
          chapterId: { in: ids },
        },
        select: { chapterId: true },
      }),
      this.workChapterDownload.findMany({
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

    const [likes, downloads] = await Promise.all([
      this.workChapterLike.findMany({
        where: {
          userId,
          chapterId: { in: chapterIds },
        },
        select: { chapterId: true },
      }),
      this.workChapterDownload.findMany({
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

  async getMyDownloadedPage(dto: PageDto, userId: number) {
    const { pageIndex = 0, pageSize = 15 } = dto
    type DownloadWhere = Prisma.WorkChapterDownloadWhereInput & {
      pageIndex?: number
      pageSize?: number
    }
    const where: DownloadWhere = {
      userId,
      pageIndex,
      pageSize,
    }
    const result = await this.workChapterDownload.findPagination({
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

    const [likes, purchases] = await Promise.all([
      this.workChapterLike.findMany({
        where: {
          userId,
          chapterId: { in: chapterIds },
        },
        select: { chapterId: true },
      }),
      this.workChapterPurchase.findMany({
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
    const [likes, purchases, downloads] = await Promise.all([
      this.workChapterLike.findMany({
        where: {
          userId,
          chapterId: { in: uniqueChapterIds },
        },
        select: { chapterId: true },
      }),
      this.workChapterPurchase.findMany({
        where: {
          userId,
          chapterId: { in: uniqueChapterIds },
        },
        select: { chapterId: true },
      }),
      this.workChapterDownload.findMany({
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

  async getChapterPageWithUserStatus(
    dto: QueryWorkChapterDto,
    userId: number,
  ) {
    const page = await this.getChapterPage(dto)
    const chapterIds = page.list.map((item) => item.id)

    if (chapterIds.length === 0) {
      return page
    }

    const [likes, purchases, downloads] = await Promise.all([
      this.workChapterLike.findMany({
        where: {
          userId,
          chapterId: { in: chapterIds },
        },
        select: { chapterId: true },
      }),
      this.workChapterPurchase.findMany({
        where: {
          userId,
          chapterId: { in: chapterIds },
        },
        select: { chapterId: true },
      }),
      this.workChapterDownload.findMany({
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
