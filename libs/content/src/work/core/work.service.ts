import type { WorkWhereInput } from '@libs/base/database'
import { BaseService, Prisma } from '@libs/base/database'
import { PageDto } from '@libs/base/dto'
import { isNotNil } from '@libs/base/utils'
import {
  LikeService,
  FavoriteService,
  InteractionTargetType,
} from '@libs/interaction'
import { UserGrowthEventService } from '@libs/user/growth-event'
import { BadRequestException, Injectable } from '@nestjs/common'
import { CreateWorkDto, QueryWorkDto, UpdateWorkDto } from './dto/work.dto'
import { WorkGrowthEventKey } from './work.constant'
import { WORK_LIST_SELECT } from './work.select'

@Injectable()
export class WorkService extends BaseService {
  get work() {
    return this.prisma.work
  }

  get appUser() {
    return this.prisma.appUser
  }

  constructor(
    private readonly userGrowthEventService: UserGrowthEventService,
    private readonly likeService: LikeService,
    private readonly favoriteService: FavoriteService,
  ) {
    super()
  }

  private getTargetType(workType: number): InteractionTargetType {
    return workType === 1 ? InteractionTargetType.COMIC : InteractionTargetType.NOVEL
  }

  /**
   * 验证作品和用户是否存在
   * @param id 作品ID
   * @param userId 用户ID
   */
  async verifyWorkAndUserExist(id: number, userId: number) {
    const [work, user] = await Promise.all([
      this.work.findUnique({ where: { id } }),
      this.appUser.findUnique({ where: { id: userId } }),
    ])

    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    if (!user) {
      throw new BadRequestException('用户不存在')
    }
    return { work, user }
  }

  /**
   * 创建作品
   * @param createWorkDto 创建作品的数据
   * @returns 创建的作品信息
   */
  async createWork(createWorkDto: CreateWorkDto) {
    const { authorIds, categoryIds, tagIds, ...workData } = createWorkDto

    // 验证作品名称在同一类型下是否已存在
    const existingWork = await this.work.findFirst({
      where: { name: workData.name, type: workData.type },
    })

    if (existingWork) {
      throw new BadRequestException('同类型作品名称已存在')
    }

    // 验证所有作者是否存在且已启用
    const existingAuthors = await this.prisma.workAuthor.findMany({
      where: {
        id: { in: authorIds },
        isEnabled: true,
      },
    })

    if (existingAuthors.length !== authorIds.length) {
      throw new BadRequestException('部分作者不存在或已禁用')
    }

    // 验证所有分类是否存在且已启用
    const existingCategories = await this.prisma.workCategory.findMany({
      where: {
        id: { in: categoryIds },
        isEnabled: true,
      },
    })

    if (existingCategories.length !== categoryIds.length) {
      throw new BadRequestException('部分分类不存在或已禁用')
    }

    // 验证所有标签是否存在且已启用
    const existingTags = await this.prisma.workTag.findMany({
      where: {
        id: { in: tagIds },
        isEnabled: true,
      },
    })

    if (existingTags.length !== tagIds.length) {
      throw new BadRequestException('部分标签不存在或已禁用')
    }

    // 创建作品并关联作者、分类、标签
    return this.work.create({
      data: {
        ...workData,
        authors: {
          create: authorIds.map((authorId, index) => ({
            authorId,
            sortOrder: index,
          })),
        },
        categories: {
          create: categoryIds.map((categoryId, index) => ({
            categoryId,
            sortOrder: categoryIds.length - index,
          })),
        },
        tags: {
          create: tagIds.map((tagId) => ({
            tagId,
          })),
        },
      },
    })
  }

  /**
   * 分页查询作品列表
   * @param queryWorkDto 查询条件
   * @returns 分页的作品列表
   */
  async getWorkPage(queryWorkDto: QueryWorkDto) {
    const { name, publisher, author, tagIds, ...otherDto } = queryWorkDto

    // 构建查询条件
    const where: WorkWhereInput = {}

    // 作品名称模糊查询（不区分大小写）
    if (name?.trim()) {
      where.name = {
        contains: name.trim(),
        mode: 'insensitive',
      }
    }

    // 出版社模糊查询（不区分大小写）
    if (publisher?.trim()) {
      where.publisher = {
        contains: publisher.trim(),
        mode: 'insensitive',
      }
    }

    // 作者名称模糊查询（不区分大小写）
    if (author?.trim()) {
      where.authors = {
        some: {
          author: {
            name: {
              contains: author.trim(),
              mode: 'insensitive',
            },
          },
        },
      }
    }

    // 标签ID数组精确匹配
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      where.tags = {
        some: {
          tagId: {
            in: tagIds,
          },
        },
      }
    }

    return this.work.findPagination({
      where: { ...where, ...otherDto },
      select: WORK_LIST_SELECT,
    })
  }

  /**
   * 获取作品详情
   * @param id 作品ID
   * @returns 作品详情信息
   */
  async getWorkDetail(id: number) {
    const work = await this.work.findUnique({
      where: { id },
      include: {
        authors: WORK_LIST_SELECT.authors,
        categories: WORK_LIST_SELECT.categories,
        tags: WORK_LIST_SELECT.tags,
      },
    })

    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    return work
  }

  async getWorkDetailWithUserStatus(id: number, userId: number) {
    const work = await this.getWorkDetail(id)
    const targetType = this.getTargetType(work.type)

    const [liked, favorited] = await Promise.all([
      this.likeService.checkLikeStatus(targetType, id, userId),
      this.favoriteService.checkFavoriteStatus(targetType, id, userId),
    ])

    return {
      ...work,
      liked,
      favorited,
    }
  }

  /**
   * 增加作品浏览次数
   * @param id 作品ID
   * @param userId 用户ID
   * @param ip 用户IP地址
   * @param deviceId 设备ID
   * @returns 作品ID
   */
  async incrementViewCount(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    // 并行验证作品和用户是否存在
    await this.verifyWorkAndUserExist(id, userId)

    // 更新作品浏览次数
    await this.work.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })

    // 触发用户成长事件（浏览作品）
    await this.userGrowthEventService.handleEvent({
      business: 'work',
      eventKey: WorkGrowthEventKey.View,
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
    const { work } = await this.verifyWorkAndUserExist(id, userId)
    const targetType = this.getTargetType(work.type)

    await this.likeService.like(targetType, id, userId)

    await this.userGrowthEventService.handleEvent({
      business: 'work',
      eventKey: WorkGrowthEventKey.Like,
      userId,
      targetId: id,
      ip,
      deviceId,
      occurredAt: new Date(),
    })

    return { id }
  }

  async incrementFavoriteCount(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    const { work } = await this.verifyWorkAndUserExist(id, userId)
    const targetType = this.getTargetType(work.type)

    await this.favoriteService.favorite(targetType, id, userId)

    await this.userGrowthEventService.handleEvent({
      business: 'work',
      eventKey: WorkGrowthEventKey.Favorite,
      userId,
      targetId: id,
      ip,
      deviceId,
      occurredAt: new Date(),
    })

    return { id }
  }

  async checkUserLiked(workId: number, userId: number) {
    const work = await this.work.findUnique({ where: { id: workId } })
    if (!work) {
      throw new BadRequestException('作品不存在')
    }
    const targetType = this.getTargetType(work.type)
    const liked = await this.likeService.checkLikeStatus(targetType, workId, userId)
    return { liked }
  }

  async checkUserFavorited(workId: number, userId: number) {
    const work = await this.work.findUnique({ where: { id: workId } })
    if (!work) {
      throw new BadRequestException('作品不存在')
    }
    const targetType = this.getTargetType(work.type)
    const favorited = await this.favoriteService.checkFavoriteStatus(targetType, workId, userId)
    return { favorited }
  }

  async getWorkUserStatus(ids: number[], userId: number) {
    if (ids.length === 0) {
      return []
    }

    const works = await this.work.findMany({
      where: { id: { in: ids } },
      select: { id: true, type: true },
    })

    const workMap = new Map(works.map((w) => [w.id, w.type]))

    const comicIds = works.filter((w) => w.type === 1).map((w) => w.id)
    const novelIds = works.filter((w) => w.type === 2).map((w) => w.id)

    const [comicLikes, novelLikes, comicFavorites, novelFavorites] = await Promise.all([
      comicIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.COMIC, comicIds, userId)
        : new Map(),
      novelIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.NOVEL, novelIds, userId)
        : new Map(),
      comicIds.length > 0
        ? this.favoriteService.checkStatusBatch(InteractionTargetType.COMIC, comicIds, userId)
        : new Map(),
      novelIds.length > 0
        ? this.favoriteService.checkStatusBatch(InteractionTargetType.NOVEL, novelIds, userId)
        : new Map(),
    ])

    return ids.map((id) => {
      const workType = workMap.get(id)
      const isComic = workType === 1
      return {
        id,
        liked: isComic ? comicLikes.get(id) ?? false : novelLikes.get(id) ?? false,
        favorited: isComic ? comicFavorites.get(id) ?? false : novelFavorites.get(id) ?? false,
      }
    })
  }

  async getWorkPageWithUserStatus(queryWorkDto: QueryWorkDto, userId: number) {
    const page = await this.getWorkPage(queryWorkDto)
    const workIds = page.list.map((item) => item.id)

    if (workIds.length === 0) {
      return page
    }

    const works = page.list
    const comicIds = works.filter((w) => w.type === 1).map((w) => w.id)
    const novelIds = works.filter((w) => w.type === 2).map((w) => w.id)

    const [comicLikes, novelLikes, comicFavorites, novelFavorites] = await Promise.all([
      comicIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.COMIC, comicIds, userId)
        : new Map(),
      novelIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.NOVEL, novelIds, userId)
        : new Map(),
      comicIds.length > 0
        ? this.favoriteService.checkStatusBatch(InteractionTargetType.COMIC, comicIds, userId)
        : new Map(),
      novelIds.length > 0
        ? this.favoriteService.checkStatusBatch(InteractionTargetType.NOVEL, novelIds, userId)
        : new Map(),
    ])

    return {
      ...page,
      list: page.list.map((item) => {
        const isComic = item.type === 1
        return {
          ...item,
          liked: isComic ? comicLikes.get(item.id) ?? false : novelLikes.get(item.id) ?? false,
          favorited: isComic ? comicFavorites.get(item.id) ?? false : novelFavorites.get(item.id) ?? false,
        }
      }),
    }
  }

  async getMyFavoritePage(dto: PageDto, userId: number) {
    const { pageIndex = 0, pageSize = 15 } = dto

    const [comicResult, novelResult] = await Promise.all([
      this.favoriteService.getUserFavorites(userId, InteractionTargetType.COMIC, pageIndex, pageSize),
      this.favoriteService.getUserFavorites(userId, InteractionTargetType.NOVEL, pageIndex, pageSize),
    ])

    const allFavorites = [...comicResult.list, ...novelResult.list]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, pageSize)

    const workIds = allFavorites.map((f) => f.targetId)
    if (workIds.length === 0) {
      return { list: [], total: comicResult.total + novelResult.total }
    }

    const works = await this.work.findMany({
      where: { id: { in: workIds } },
      select: WORK_LIST_SELECT,
    })

    const workMap = new Map(works.map((item) => [item.id, item]))
    const orderedWorks = workIds
      .map((id) => workMap.get(id))
      .filter((item): item is NonNullable<typeof item> => !!item)

    const comicIds = works.filter((w) => w.type === 1).map((w) => w.id)
    const novelIds = works.filter((w) => w.type === 2).map((w) => w.id)

    const [comicLikes, novelLikes] = await Promise.all([
      comicIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.COMIC, comicIds, userId)
        : new Map(),
      novelIds.length > 0
        ? this.likeService.checkStatusBatch(InteractionTargetType.NOVEL, novelIds, userId)
        : new Map(),
    ])

    return {
      list: orderedWorks.map((item) => ({
        ...item,
        liked: item.type === 1 ? comicLikes.get(item.id) ?? false : novelLikes.get(item.id) ?? false,
        favorited: true,
      })),
      total: comicResult.total + novelResult.total,
    }
  }

  async getMyLikedPage(dto: PageDto, userId: number) {
    const { pageIndex = 0, pageSize = 15 } = dto

    const [comicResult, novelResult] = await Promise.all([
      this.likeService.getUserLikes(userId, InteractionTargetType.COMIC, pageIndex, pageSize),
      this.likeService.getUserLikes(userId, InteractionTargetType.NOVEL, pageIndex, pageSize),
    ])

    const allLikes = [...comicResult.list, ...novelResult.list]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, pageSize)

    const workIds = allLikes.map((l) => l.targetId)
    if (workIds.length === 0) {
      return { list: [], total: comicResult.total + novelResult.total }
    }

    const works = await this.work.findMany({
      where: { id: { in: workIds } },
      select: WORK_LIST_SELECT,
    })

    const workMap = new Map(works.map((item) => [item.id, item]))
    const orderedWorks = workIds
      .map((id) => workMap.get(id))
      .filter((item): item is NonNullable<typeof item> => !!item)

    const comicIds = works.filter((w) => w.type === 1).map((w) => w.id)
    const novelIds = works.filter((w) => w.type === 2).map((w) => w.id)

    const [comicFavorites, novelFavorites] = await Promise.all([
      comicIds.length > 0
        ? this.favoriteService.checkStatusBatch(InteractionTargetType.COMIC, comicIds, userId)
        : new Map(),
      novelIds.length > 0
        ? this.favoriteService.checkStatusBatch(InteractionTargetType.NOVEL, novelIds, userId)
        : new Map(),
    ])

    return {
      list: orderedWorks.map((item) => ({
        ...item,
        liked: true,
        favorited: item.type === 1 ? comicFavorites.get(item.id) ?? false : novelFavorites.get(item.id) ?? false,
      })),
      total: comicResult.total + novelResult.total,
    }
  }

  /**
   * 更新作品
   * @param updateWorkDto 更新作品的数据
   * @returns 更新后的作品信息
   */
  async updateWork(updateWorkDto: UpdateWorkDto) {
    const { id, authorIds, categoryIds, tagIds, ...updateData } = updateWorkDto

    const existingWork = await this.work.findUnique({ where: { id } })
    if (!existingWork) {
      throw new BadRequestException('作品不存在')
    }

    // 如果更新名称，需要验证同类型下是否重名
    if (isNotNil(updateData.name) && updateData.name !== existingWork.name) {
      const duplicateWork = await this.work.findFirst({
        where: {
          name: updateData.name,
          type: existingWork.type,
          id: { not: id },
        },
      })
      if (duplicateWork) {
        throw new BadRequestException('同类型作品名称已存在')
      }
    }

    // 验证所有作者是否存在且已启用
    if (authorIds && authorIds.length > 0) {
      const existingAuthors = await this.prisma.workAuthor.findMany({
        where: {
          id: { in: authorIds },
          isEnabled: true,
        },
      })

      if (existingAuthors.length !== authorIds.length) {
        throw new BadRequestException('部分作者不存在或已禁用')
      }
    }

    // 验证所有分类是否存在且已启用
    if (categoryIds && categoryIds.length > 0) {
      const existingCategories = await this.prisma.workCategory.findMany({
        where: {
          id: { in: categoryIds },
          isEnabled: true,
        },
      })

      if (existingCategories.length !== categoryIds.length) {
        throw new BadRequestException('部分分类不存在或已禁用')
      }
    }

    // 验证所有标签是否存在且已启用
    if (tagIds && tagIds.length > 0) {
      const existingTags = await this.prisma.workTag.findMany({
        where: {
          id: { in: tagIds },
          isEnabled: true,
        },
      })

      if (existingTags.length !== tagIds.length) {
        throw new BadRequestException('部分标签不存在或已禁用')
      }
    }

    // 使用事务更新作品信息和关联关系
    return this.prisma.$transaction(async (tx) => {
      const updatedWork = await tx.work.update({
        where: { id },
        data: updateData,
      })

      // 更新作者关联（先删除后重建）
      if (authorIds !== undefined) {
        await tx.workAuthorRelation.deleteMany({
          where: { workId: id },
        })

        if (authorIds.length > 0) {
          await tx.workAuthorRelation.createMany({
            data: authorIds.map((authorId, index) => ({
              workId: id,
              authorId,
              sortOrder: index,
            })),
          })
        }
      }

      // 更新分类关联（先删除后重建）
      if (categoryIds !== undefined) {
        await tx.workCategoryRelation.deleteMany({
          where: { workId: id },
        })

        if (categoryIds.length > 0) {
          await tx.workCategoryRelation.createMany({
            data: categoryIds.map((categoryId, index) => ({
              workId: id,
              categoryId,
              sortOrder: categoryIds.length - index,
            })),
          })
        }
      }

      // 更新标签关联（先删除后重建）
      if (tagIds !== undefined) {
        await tx.workTagRelation.deleteMany({
          where: { workId: id },
        })

        if (tagIds.length > 0) {
          await tx.workTagRelation.createMany({
            data: tagIds.map((tagId) => ({
              workId: id,
              tagId,
            })),
          })
        }
      }

      return updatedWork
    })
  }

  /**
   * 删除作品（软删除）
   * @param id 作品ID
   * @returns 删除结果
   */
  async deleteWork(id: number) {
    // 检查作品是否还有未删除的章节
    const chapterCount = await this.prisma.workChapter.count({
      where: {
        workId: id,
        deletedAt: null,
      },
    })

    if (chapterCount > 0) {
      throw new BadRequestException(
        `该作品还有 ${chapterCount} 个关联章节，无法删除`,
      )
    }

    return this.work.softDelete({ id })
  }
}
