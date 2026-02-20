import type {WorkComicWhereInput} from '@libs/base/database';
import { BaseService, Prisma } from '@libs/base/database'
import { PageDto } from '@libs/base/dto'
import { isNotNil } from '@libs/base/utils'
import { UserGrowthEventService } from '@libs/user/growth-event'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ComicGrowthEventKey } from './comic.constant'
import {
  CreateComicDto,
  QueryComicDto,
  UpdateComicDto,
} from './dto/comic.dto'

/**
 * 漫画服务类
 * 提供漫画的增删改查等核心业务逻辑
 */
@Injectable()
export class ComicService extends BaseService {
  get workComic() {
    return this.prisma.workComic
  }

  get workComicLike() {
    return this.prisma.workComicLike
  }

  get workComicFavorite() {
    return this.prisma.workComicFavorite
  }

  get appUser() {
    return this.prisma.appUser
  }

  /**
   * 漫画列表轻量字段选择器
   * @returns 漫画列表必要字段
   */
  private getComicListSelect() {
    return {
      id: true,
      name: true,
      alias: true,
      cover: true,
      popularity: true,
      language: true,
      region: true,
      ageRating: true,
      isPublished: true,
      publishAt: true,
      lastUpdated: true,
      publisher: true,
      originalSource: true,
      serialStatus: true,
      rating: true,
      ratingCount: true,
      recommendWeight: true,
      isRecommended: true,
      isHot: true,
      isNew: true,
      likeCount: true,
      favoriteCount: true,
      viewCount: true,
      createdAt: true,
      updatedAt: true,
      comicAuthors: {
        select: {
          author: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      comicCategories: {
        select: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      comicTags: {
        select: {
          tag: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    }
  }

  constructor(
    private readonly userGrowthEventService: UserGrowthEventService,
  ) {
    super()
  }

  /**
   * 创建漫画
   * @param createComicDto 创建漫画的数据
   * @returns 创建的漫画信息
   */
  async createComic(createComicDto: CreateComicDto) {
    const { authorIds, categoryIds, tagIds, ...comicData } = createComicDto

    const existingComic = await this.workComic.findFirst({
      where: { name: comicData.name },
    })

    if (existingComic) {
      throw new BadRequestException('漫画名称已存在')
    }

    const existingAuthors = await this.prisma.workAuthor.findMany({
      where: {
        id: { in: authorIds },
        isEnabled: true,
      },
    })

    if (existingAuthors.length !== authorIds.length) {
      throw new BadRequestException('部分作者不存在')
    }

    // 验证分类是否存在
    const existingCategories = await this.prisma.workCategory.findMany({
      where: {
        id: { in: categoryIds },
        isEnabled: true,
      },
    })

    if (existingCategories.length !== categoryIds.length) {
      throw new BadRequestException('部分分类不存在或已禁用')
    }

    // 验证标签是否存在
    const existingTags = await this.prisma.workTag.findMany({
      where: {
        id: { in: tagIds },
        isEnabled: true,
      },
    })

    if (existingTags.length !== tagIds.length) {
      throw new BadRequestException('部分标签不存在或已禁用')
    }

    return this.workComic.create({
      data: {
        ...comicData,
        // 创建作者关联关系
        comicAuthors: {
          create: authorIds.map((authorId) => ({
            authorId,
          })),
        },
        // 创建分类关联关系
        comicCategories: {
          create: categoryIds.map((categoryId) => ({
            categoryId,
          })),
        },
        // 创建标签关联关系
        comicTags: {
          create: tagIds.map((tagId) => ({
            tagId,
          })),
        },
      },
    })
  }

  /**
   * 分页查询漫画列表
   * @param queryComicDto 查询条件
   * @returns 分页的漫画列表
   */
  async getComicPage(queryComicDto: QueryComicDto) {
    const { name, publisher, author, tagIds, ...otherDto } = queryComicDto

    // 构建查询条件
    const where: WorkComicWhereInput = {}

    // 漫画名称模糊搜索
    if (name?.trim()) {
      where.name = {
        contains: name.trim(),
        mode: 'insensitive',
      }
    }

    // 出版社模糊搜索
    if (publisher?.trim()) {
      where.publisher = {
        contains: publisher.trim(),
        mode: 'insensitive',
      }
    }

    // 作者名称模糊搜索
    if (author?.trim()) {
      where.comicAuthors = {
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

    // 标签筛选
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      where.comicTags = {
        some: {
          tagId: {
            in: tagIds,
          },
        },
      }
    }

    return this.workComic.findPagination({
      where: { ...where, ...otherDto },
      select: {
        id: true,
        name: true,
        alias: true,
        cover: true,
        popularity: true,
        language: true,
        region: true,
        ageRating: true,
        isPublished: true,
        publishAt: true,
        lastUpdated: true,
        publisher: true,
        originalSource: true,
        serialStatus: true,
        rating: true,
        ratingCount: true,
        recommendWeight: true,
        isRecommended: true,
        isHot: true,
        isNew: true,
        likeCount: true,
        favoriteCount: true,
        viewCount: true,
        createdAt: true,
        updatedAt: true,
        // 关联关系
        comicAuthors: {
          select: {
            author: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        comicCategories: {
          select: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        // 标签关联
        comicTags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })
  }

  /**
   * 获取漫画详情
   * @param id 漫画ID
   * @returns 漫画详情信息
   */
  async getComicDetail(id: number) {
    const comic = await this.workComic.findUnique({
      where: { id },
      include: {
        comicAuthors: {
          select: {
            author: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        comicCategories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            sortOrder: 'desc',
          },
        },
        comicTags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!comic) {
      throw new BadRequestException('漫画不存在')
    }

    return comic
  }

  async getComicDetailWithUserStatus(id: number, userId: number) {
    const [comic, like, favorite] = await Promise.all([
      this.getComicDetail(id),
      this.workComicLike.findUnique({
        where: {
          comicId_userId: {
            comicId: id,
            userId,
          },
        },
      }),
      this.workComicFavorite.findUnique({
        where: {
          comicId_userId: {
            comicId: id,
            userId,
          },
        },
      }),
    ])

    return {
      ...comic,
      liked: !!like,
      favorited: !!favorite,
    }
  }

  async incrementViewCount(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    await this.workComic.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })

    await this.userGrowthEventService.handleEvent({
      business: 'comic',
      eventKey: ComicGrowthEventKey.View,
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
    const [comic, user] = await Promise.all([
      this.workComic.findUnique({ where: { id } }),
      this.appUser.findUnique({ where: { id: userId } }),
    ])

    if (!comic) {
      throw new BadRequestException('漫画不存在')
    }

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const existingLike = await this.workComicLike.findUnique({
      where: {
        comicId_userId: {
          comicId: id,
          userId,
        },
      },
    })

    if (existingLike) {
      throw new BadRequestException('已经点赞过该漫画')
    }

    // 点赞记录与计数更新保持一致
    await this.prisma.$transaction(async (tx) => {
      await tx.workComicLike.create({
        data: {
          comicId: id,
          userId,
        },
      })

      await tx.workComic.update({
        where: { id },
        data: {
          likeCount: {
            increment: 1,
          },
        },
      })
    })

    // 点赞成功后触发成长事件
    await this.userGrowthEventService.handleEvent({
      business: 'comic',
      eventKey: ComicGrowthEventKey.Like,
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
    const [comic, user] = await Promise.all([
      this.workComic.findUnique({ where: { id } }),
      this.appUser.findUnique({ where: { id: userId } }),
    ])

    if (!comic) {
      throw new BadRequestException('漫画不存在')
    }

    if (!user) {
      throw new BadRequestException('用户不存在')
    }

    const existingFavorite = await this.workComicFavorite.findUnique({
      where: {
        comicId_userId: {
          comicId: id,
          userId,
        },
      },
    })

    if (existingFavorite) {
      throw new BadRequestException('已经收藏过该漫画')
    }

    // 收藏记录与计数更新保持一致
    await this.prisma.$transaction(async (tx) => {
      await tx.workComicFavorite.create({
        data: {
          comicId: id,
          userId,
        },
      })

      await tx.workComic.update({
        where: { id },
        data: {
          favoriteCount: {
            increment: 1,
          },
        },
      })
    })

    // 收藏成功后触发成长事件
    await this.userGrowthEventService.handleEvent({
      business: 'comic',
      eventKey: ComicGrowthEventKey.Favorite,
      userId,
      targetId: id,
      ip,
      deviceId,
      occurredAt: new Date(),
    })

    return { id }
  }

  async checkUserLiked(comicId: number, userId: number) {
    const like = await this.workComicLike.findUnique({
      where: {
        comicId_userId: {
          comicId,
          userId,
        },
      },
    })

    return {
      liked: !!like,
    }
  }

  async checkUserFavorited(comicId: number, userId: number) {
    const favorite = await this.workComicFavorite.findUnique({
      where: {
        comicId_userId: {
          comicId,
          userId,
        },
      },
    })

    return {
      favorited: !!favorite,
    }
  }

  async getComicUserStatus(ids: number[], userId: number) {
    if (ids.length === 0) {
      return []
    }

    const [likes, favorites] = await Promise.all([
      this.workComicLike.findMany({
        where: {
          userId,
          comicId: { in: ids },
        },
        select: { comicId: true },
      }),
      this.workComicFavorite.findMany({
        where: {
          userId,
          comicId: { in: ids },
        },
        select: { comicId: true },
      }),
    ])

    const likeSet = new Set(likes.map((item) => item.comicId))
    const favoriteSet = new Set(favorites.map((item) => item.comicId))

    return ids.map((id) => ({
      id,
      liked: likeSet.has(id),
      favorited: favoriteSet.has(id),
    }))
  }

  async getComicPageWithUserStatus(
    queryComicDto: QueryComicDto,
    userId: number,
  ) {
    const page = await this.getComicPage(queryComicDto)
    const comicIds = page.list.map((item) => item.id)

    if (comicIds.length === 0) {
      return page
    }

    const [likes, favorites] = await Promise.all([
      this.workComicLike.findMany({
        where: {
          userId,
          comicId: { in: comicIds },
        },
        select: { comicId: true },
      }),
      this.workComicFavorite.findMany({
        where: {
          userId,
          comicId: { in: comicIds },
        },
        select: { comicId: true },
      }),
    ])

    const likeSet = new Set(likes.map((item) => item.comicId))
    const favoriteSet = new Set(favorites.map((item) => item.comicId))

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
   * 分页查询我的漫画收藏
   * @param dto 分页参数
   * @param userId 用户ID
   * @returns 漫画列表（含用户状态）
   */
  async getMyFavoriteComicPage(dto: PageDto, userId: number) {
    // 使用分页插件统一处理 pageIndex/pageSize 兼容 0/1 基
    const { pageIndex = 0, pageSize = 15 } = dto
    type FavoriteWhere = Prisma.WorkComicFavoriteWhereInput & {
      pageIndex?: number
      pageSize?: number
    }
    const where: FavoriteWhere = {
      userId,
      pageIndex,
      pageSize,
    }
    const result = await this.workComicFavorite.findPagination({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // 依据收藏记录顺序获取漫画信息
    const comicIds = result.list.map((item) => item.comicId)
    if (comicIds.length === 0) {
      return { ...result, list: [] }
    }

    // 批量拉取漫画并恢复原始顺序
    const comics = await this.workComic.findMany({
      where: {
        id: { in: comicIds },
      },
      select: this.getComicListSelect(),
    })
    const comicMap = new Map(comics.map((item) => [item.id, item]))
    const orderedComics = comicIds
      .map((id) => comicMap.get(id))
      .filter((item): item is NonNullable<typeof item> => !!item)

    // 组装用户状态信息
    const likes = await this.workComicLike.findMany({
      where: {
        userId,
        comicId: { in: comicIds },
      },
      select: { comicId: true },
    })
    const likeSet = new Set(likes.map((item) => item.comicId))

    return {
      ...result,
      list: orderedComics.map((item) => ({
        ...item,
        liked: likeSet.has(item.id),
        favorited: true,
      })),
    }
  }

  /**
   * 分页查询我的漫画点赞
   * @param dto 分页参数
   * @param userId 用户ID
   * @returns 漫画列表（含用户状态）
   */
  async getMyLikedComicPage(dto: PageDto, userId: number) {
    // 使用分页插件统一处理 pageIndex/pageSize 兼容 0/1 基
    const { pageIndex = 0, pageSize = 15 } = dto
    type LikeWhere = Prisma.WorkComicLikeWhereInput & {
      pageIndex?: number
      pageSize?: number
    }
    const where: LikeWhere = {
      userId,
      pageIndex,
      pageSize,
    }
    const result = await this.workComicLike.findPagination({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // 依据点赞记录顺序获取漫画信息
    const comicIds = result.list.map((item) => item.comicId)
    if (comicIds.length === 0) {
      return { ...result, list: [] }
    }

    // 批量拉取漫画并恢复原始顺序
    const comics = await this.workComic.findMany({
      where: {
        id: { in: comicIds },
      },
      select: this.getComicListSelect(),
    })
    const comicMap = new Map(comics.map((item) => [item.id, item]))
    const orderedComics = comicIds
      .map((id) => comicMap.get(id))
      .filter((item): item is NonNullable<typeof item> => !!item)

    // 组装用户状态信息
    const favorites = await this.workComicFavorite.findMany({
      where: {
        userId,
        comicId: { in: comicIds },
      },
      select: { comicId: true },
    })
    const favoriteSet = new Set(favorites.map((item) => item.comicId))

    return {
      ...result,
      list: orderedComics.map((item) => ({
        ...item,
        liked: true,
        favorited: favoriteSet.has(item.id),
      })),
    }
  }

  /**
   * 更新漫画信息
   * @param updateComicDto 更新漫画的数据
   * @returns 更新后的漫画信息
   */
  async updateComic(updateComicDto: UpdateComicDto) {
    const { id, authorIds, categoryIds, tagIds, ...updateData } = updateComicDto

    // 验证漫画是否存在
    const existingComic = await this.workComic.findUnique({ where: { id } })
    if (!existingComic) {
      throw new BadRequestException('漫画不存在')
    }

    // 如果更新名称，验证是否与其他漫画重复
    if (isNotNil(updateData.name) && updateData.name !== existingComic.name) {
      const duplicateComic = await this.workComic.findFirst({
        where: {
          name: updateData.name,
          id: { not: id },
        },
      })
      if (duplicateComic) {
        throw new BadRequestException('漫画名称已存在')
      }
    }

    // 若提供作者列表则校验并准备全量替换关系
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

    // 若提供分类列表则校验并准备全量替换关系
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

    // 若提供标签列表则校验并准备全量替换关系
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

    // 基础信息与关联关系保持在同一事务中，避免部分更新
    return this.prisma.$transaction(async (tx) => {
      // 更新漫画基本信息，确保不包含关联属性
      const { comicTags, ...basicUpdateData } = updateData as any
      const updatedComic = await tx.workComic.update({
        where: { id },
        data: basicUpdateData,
      })

      // authorIds 为 undefined 表示不更新；为空数组表示清空关联
      if (authorIds !== undefined) {
        // 先清空再重建以保证顺序与一致性
        await tx.workComicAuthor.deleteMany({
          where: { comicId: id },
        })

        // 以传入顺序作为排序
        if (authorIds.length > 0) {
          await tx.workComicAuthor.createMany({
            data: authorIds.map((authorId, index) => ({
              comicId: id,
              authorId,
              sortOrder: index,
            })),
          })
        }
      }

      // categoryIds 为 undefined 表示不更新；为空数组表示清空关联
      if (categoryIds !== undefined) {
        // 先清空再重建以保证顺序与一致性
        await tx.workComicCategory.deleteMany({
          where: { comicId: id },
        })

        // 分类权重按列表顺序递减
        if (categoryIds.length > 0) {
          await tx.workComicCategory.createMany({
            data: categoryIds.map((categoryId, index) => ({
              comicId: id,
              categoryId,
              sortOrder: categoryIds.length - index, // 权重递减
            })),
          })
        }
      }

      // tagIds 为 undefined 表示不更新；为空数组表示清空关联
      if (tagIds !== undefined) {
        // 先清空再重建
        await tx.workComicTag.deleteMany({
          where: { comicId: id },
        })

        // 标签不排序，仅建立关联
        if (tagIds.length > 0) {
          await tx.workComicTag.createMany({
            data: tagIds.map((tagId) => ({
              comicId: id,
              tagId,
            })),
          })
        }
      }

      return updatedComic
    })
  }

  /**
   * 软删除漫画
   * @param id 漫画ID
   * @returns 删除结果
   */
  async deleteComic(id: number) {
    // 检查是否有关联的章节
    const chapterCount = await this.prisma.workComicChapter.count({
      where: {
        comicId: id,
        deletedAt: null,
      },
    })

    if (chapterCount > 0) {
      throw new BadRequestException(
        `该漫画还有 ${chapterCount} 个关联章节，无法删除`,
      )
    }

    return this.workComic.softDelete({ id })
  }
}
