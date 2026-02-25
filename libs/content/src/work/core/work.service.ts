import type { WorkWhereInput } from '@libs/base/database'
import { BaseService, Prisma } from '@libs/base/database'
import { PageDto } from '@libs/base/dto'
import { isNotNil } from '@libs/base/utils'
import { UserGrowthEventService } from '@libs/user/growth-event'
import { BadRequestException, Injectable } from '@nestjs/common'
import { CreateWorkDto, QueryWorkDto, UpdateWorkDto } from './dto/work.dto'
import { WorkGrowthEventKey } from './work.constant'
import { WORK_LIST_SELECT } from './work.select'

/**
 * 作品服务类
 * 继承 BaseService，提供作品相关的核心业务逻辑
 * 包括作品的增删改查、点赞、收藏、浏览统计等功能
 */
@Injectable()
export class WorkService extends BaseService {
  /** 获取作品模型 */
  get work() {
    return this.prisma.work
  }

  /** 获取作品点赞模型 */
  get workLike() {
    return this.prisma.workLike
  }

  /** 获取作品收藏模型 */
  get workFavorite() {
    return this.prisma.workFavorite
  }

  /** 获取应用用户模型 */
  get appUser() {
    return this.prisma.appUser
  }

  constructor(private readonly userGrowthEventService: UserGrowthEventService) {
    super()
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

  /**
   * 获取作品详情并包含用户状态（点赞、收藏）
   * @param id 作品ID
   * @param userId 用户ID
   * @returns 作品详情及用户状态
   */
  async getWorkDetailWithUserStatus(id: number, userId: number) {
    // 并行查询作品详情、点赞记录、收藏记录，提高查询效率
    const [work, like, favorite] = await Promise.all([
      this.getWorkDetail(id),
      this.workLike.findUnique({
        where: {
          workId_userId: {
            workId: id,
            userId,
          },
        },
      }),
      this.workFavorite.findUnique({
        where: {
          workId_userId: {
            workId: id,
            userId,
          },
        },
      }),
    ])

    return {
      ...work,
      liked: !!like,
      favorited: !!favorite,
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

  /**
   * 增加作品点赞次数
   * @param id 作品ID
   * @param userId 用户ID
   * @param ip 用户IP地址
   * @param deviceId 设备ID
   * @returns 作品ID
   */
  async incrementLikeCount(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    // 并行验证作品和用户是否存在
    await this.verifyWorkAndUserExist(id, userId)

    // 检查是否已点赞过该作品
    const existingLike = await this.workLike.findUnique({
      where: {
        workId_userId: {
          workId: id,
          userId,
        },
      },
    })

    if (existingLike) {
      throw new BadRequestException('已经点赞过该作品')
    }

    // 使用事务确保点赞记录创建和点赞数更新的原子性
    await this.prisma.$transaction(async (tx) => {
      // 创建点赞记录
      await tx.workLike.create({
        data: {
          workId: id,
          userId,
        },
      })

      // 更新作品点赞数
      await tx.work.update({
        where: { id },
        data: {
          likeCount: {
            increment: 1,
          },
        },
      })
    })

    // 触发用户成长事件（点赞作品）
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

  /**
   * 增加作品收藏次数
   * @param id 作品ID
   * @param userId 用户ID
   * @param ip 用户IP地址
   * @param deviceId 设备ID
   * @returns 作品ID
   */
  async incrementFavoriteCount(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    // 并行验证作品和用户是否存在
    const { work } = await this.verifyWorkAndUserExist(id, userId)

    // 检查是否已收藏过该作品
    const existingFavorite = await this.workFavorite.findUnique({
      where: {
        workId_userId: {
          workId: id,
          userId,
        },
      },
    })

    if (existingFavorite) {
      throw new BadRequestException('已经收藏过该作品')
    }

    // 使用事务确保收藏记录创建和收藏数更新的原子性
    await this.prisma.$transaction(async (tx) => {
      // 创建收藏记录（包含作品类型用于按类型筛选收藏）
      await tx.workFavorite.create({
        data: {
          workId: id,
          userId,
          workType: work.type,
        },
      })

      // 更新作品收藏数
      await tx.work.update({
        where: { id },
        data: {
          favoriteCount: {
            increment: 1,
          },
        },
      })
    })

    // 触发用户成长事件（收藏作品）
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

  /**
   * 检查用户是否点赞过作品
   * @param workId 作品ID
   * @param userId 用户ID
   * @returns 点赞状态
   */
  async checkUserLiked(workId: number, userId: number) {
    const like = await this.workLike.findUnique({
      where: {
        workId_userId: {
          workId,
          userId,
        },
      },
    })

    return {
      liked: !!like,
    }
  }

  /**
   * 检查用户是否收藏过作品
   * @param workId 作品ID
   * @param userId 用户ID
   * @returns 收藏状态
   */
  async checkUserFavorited(workId: number, userId: number) {
    const favorite = await this.workFavorite.findUnique({
      where: {
        workId_userId: {
          workId,
          userId,
        },
      },
    })

    return {
      favorited: !!favorite,
    }
  }

  /**
   * 批量获取作品用户状态（点赞、收藏）
   * @param ids 作品ID数组
   * @param userId 用户ID
   * @returns 作品用户状态列表
   */
  async getWorkUserStatus(ids: number[], userId: number) {
    if (ids.length === 0) {
      return []
    }

    // 并行查询用户的点赞和收藏记录
    const [likes, favorites] = await Promise.all([
      this.workLike.findMany({
        where: {
          userId,
          workId: { in: ids },
        },
        select: { workId: true },
      }),
      this.workFavorite.findMany({
        where: {
          userId,
          workId: { in: ids },
        },
        select: { workId: true },
      }),
    ])

    // 使用 Set 提高查询效率
    const likeSet = new Set(likes.map((item) => item.workId))
    const favoriteSet = new Set(favorites.map((item) => item.workId))

    // 按原始 ID 顺序返回结果
    return ids.map((id) => ({
      id,
      liked: likeSet.has(id),
      favorited: favoriteSet.has(id),
    }))
  }

  /**
   * 分页查询作品列表并包含用户状态（点赞、收藏）
   * @param queryWorkDto 查询条件
   * @param userId 用户ID
   * @returns 分页的作品列表及用户状态
   */
  async getWorkPageWithUserStatus(queryWorkDto: QueryWorkDto, userId: number) {
    const page = await this.getWorkPage(queryWorkDto)
    const workIds = page.list.map((item) => item.id)

    // 如果没有数据，直接返回
    if (workIds.length === 0) {
      return page
    }

    // 并行查询用户的点赞和收藏记录
    const [likes, favorites] = await Promise.all([
      this.workLike.findMany({
        where: {
          userId,
          workId: { in: workIds },
        },
        select: { workId: true },
      }),
      this.workFavorite.findMany({
        where: {
          userId,
          workId: { in: workIds },
        },
        select: { workId: true },
      }),
    ])

    // 使用 Set 提高查询效率
    const likeSet = new Set(likes.map((item) => item.workId))
    const favoriteSet = new Set(favorites.map((item) => item.workId))

    return {
      ...page,
      list: page.list.map((item) => ({
        ...item,
        liked: likeSet.has(item.id),
        favorited: favoriteSet.has(item.id),
      })),
    }
  }

  /**
   * 分页查询我的收藏列表
   * @param dto 分页参数
   * @param userId 用户ID
   * @returns 分页的收藏作品列表
   */
  async getMyFavoritePage(dto: PageDto, userId: number) {
    const { pageIndex = 0, pageSize = 15 } = dto
    type FavoriteWhere = Prisma.WorkFavoriteWhereInput & {
      pageIndex?: number
      pageSize?: number
    }
    const where: FavoriteWhere = {
      userId,
      pageIndex,
      pageSize,
    }
    // 查询收藏记录（按创建时间倒序）
    const result = await this.workFavorite.findPagination({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const workIds = result.list.map((item) => item.workId)
    if (workIds.length === 0) {
      return { ...result, list: [] }
    }

    // 批量查询作品详情
    const works = await this.work.findMany({
      where: {
        id: { in: workIds },
      },
      select: WORK_LIST_SELECT,
    })

    // 使用 Map 保持收藏顺序
    const workMap = new Map(works.map((item) => [item.id, item]))
    const orderedWorks = workIds
      .map((id) => workMap.get(id))
      .filter((item): item is NonNullable<typeof item> => !!item)

    // 查询用户对这些作品的点赞状态
    const likes = await this.workLike.findMany({
      where: {
        userId,
        workId: { in: workIds },
      },
      select: { workId: true },
    })
    const likeSet = new Set(likes.map((item) => item.workId))

    return {
      ...result,
      list: orderedWorks.map((item) => ({
        ...item,
        liked: likeSet.has(item.id),
        favorited: true, // 收藏列表中的作品都是已收藏状态
      })),
    }
  }

  /**
   * 分页查询我的点赞列表
   * @param dto 分页参数
   * @param userId 用户ID
   * @returns 分页的点赞作品列表
   */
  async getMyLikedPage(dto: PageDto, userId: number) {
    const { pageIndex = 0, pageSize = 15 } = dto
    type LikeWhere = Prisma.WorkLikeWhereInput & {
      pageIndex?: number
      pageSize?: number
    }
    const where: LikeWhere = {
      userId,
      pageIndex,
      pageSize,
    }
    // 查询点赞记录（按创建时间倒序）
    const result = await this.workLike.findPagination({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const workIds = result.list.map((item) => item.workId)
    if (workIds.length === 0) {
      return { ...result, list: [] }
    }

    // 批量查询作品详情
    const works = await this.work.findMany({
      where: {
        id: { in: workIds },
      },
      select: WORK_LIST_SELECT,
    })

    // 使用 Map 保持点赞顺序
    const workMap = new Map(works.map((item) => [item.id, item]))
    const orderedWorks = workIds
      .map((id) => workMap.get(id))
      .filter((item): item is NonNullable<typeof item> => !!item)

    // 查询用户对这些作品的收藏状态
    const favorites = await this.workFavorite.findMany({
      where: {
        userId,
        workId: { in: workIds },
      },
      select: { workId: true },
    })
    const favoriteSet = new Set(favorites.map((item) => item.workId))

    return {
      ...result,
      list: orderedWorks.map((item) => ({
        ...item,
        liked: true, // 点赞列表中的作品都是已点赞状态
        favorited: favoriteSet.has(item.id),
      })),
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
