import { BaseService } from '@libs/base/database'
import { DragReorderDto } from '@libs/base/dto'
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
   * 创建漫画章节
   * @param createComicChapterDto 创建章节的数据
   * @returns 创建的章节信息
   */
  async createComicChapter(createComicChapterDto: CreateComicChapterDto) {
    const { comicId, sortOrder, requiredReadLevelId, requiredDownloadLevelId } =
      createComicChapterDto

    if (!(await this.workComicChapter.exists({ id: comicId }))) {
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
    return this.workComicChapter.findUnique({
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
      sortOrder &&
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

    // 使用事务确保数据一致性
    return this.prisma.$transaction(async (tx) => {
      // 临时章节号，避免唯一约束冲突
      const tempChapterNumber = -Math.random() * 1000000

      // 第一步：将拖拽章节的章节号设为临时值
      await tx.workComicChapter.update({
        where: { id: dragId },
        data: { sortOrder: tempChapterNumber },
      })

      // 第二步：将目标章节的章节号设为拖拽章节的原章节号
      await tx.workComicChapter.update({
        where: { id: targetId },
        data: { sortOrder: dragChapter.sortOrder },
      })

      // 第三步：将拖拽章节的章节号设为目标章节的原章节号
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
      this.appUser.findUnique({ where: { id: userId } }),
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
      this.appUser.findUnique({ where: { id: userId } }),
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
