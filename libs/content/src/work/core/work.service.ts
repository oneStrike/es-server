import type { WorkWhereInput } from '@libs/base/database'
import { BaseService, Prisma } from '@libs/base/database'
import { PageDto } from '@libs/base/dto'
import { isNotNil } from '@libs/base/utils'
import { UserGrowthEventService } from '@libs/user/growth-event'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateWorkDto,
  QueryWorkDto,
  UpdateWorkDto,
} from './dto/work.dto'
import { WorkGrowthEventKey } from './work.constant'

@Injectable()
export class WorkService extends BaseService {
  get work() {
    return this.prisma.work
  }

  get workLike() {
    return this.prisma.workLike
  }

  get workFavorite() {
    return this.prisma.workFavorite
  }

  get appUser() {
    return this.prisma.appUser
  }

  private getWorkListSelect() {
    return {
      id: true,
      type: true,
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
      authors: {
        select: {
          sortOrder: true,
          role: true,
          author: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      },
      categories: {
        select: {
          sortOrder: true,
          category: {
            select: {
              id: true,
              name: true,
              icon: true,
            },
          },
        },
      },
      tags: {
        select: {
          sortOrder: true,
          tag: {
            select: {
              id: true,
              name: true,
              icon: true,
            },
          },
        },
      },
    }
  }

  constructor(private readonly userGrowthEventService: UserGrowthEventService) {
    super()
  }

  async createWork(createWorkDto: CreateWorkDto) {
    const { authorIds, categoryIds, tagIds, ...workData } = createWorkDto

    const existingWork = await this.work.findFirst({
      where: { name: workData.name, type: workData.type },
    })

    if (existingWork) {
      throw new BadRequestException('同类型作品名称已存在')
    }

    const existingAuthors = await this.prisma.workAuthor.findMany({
      where: {
        id: { in: authorIds },
        isEnabled: true,
      },
    })

    if (existingAuthors.length !== authorIds.length) {
      throw new BadRequestException('部分作者不存在或已禁用')
    }

    const existingCategories = await this.prisma.workCategory.findMany({
      where: {
        id: { in: categoryIds },
        isEnabled: true,
      },
    })

    if (existingCategories.length !== categoryIds.length) {
      throw new BadRequestException('部分分类不存在或已禁用')
    }

    const existingTags = await this.prisma.workTag.findMany({
      where: {
        id: { in: tagIds },
        isEnabled: true,
      },
    })

    if (existingTags.length !== tagIds.length) {
      throw new BadRequestException('部分标签不存在或已禁用')
    }

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

  async getWorkPage(queryWorkDto: QueryWorkDto) {
    const { name, type, publisher, author, tagIds, ...otherDto } = queryWorkDto

    const where: WorkWhereInput = {}

    if (name?.trim()) {
      where.name = {
        contains: name.trim(),
        mode: 'insensitive',
      }
    }

    if (type !== undefined) {
      where.type = type
    }

    if (publisher?.trim()) {
      where.publisher = {
        contains: publisher.trim(),
        mode: 'insensitive',
      }
    }

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
      select: this.getWorkListSelect(),
    })
  }

  async getWorkDetail(id: number) {
    const work = await this.work.findUnique({
      where: { id },
      include: {
        authors: {
          select: {
            sortOrder: true,
            role: true,
            author: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        categories: {
          select: {
            sortOrder: true,
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
        tags: {
          select: {
            sortOrder: true,
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

    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    return work
  }

  async getWorkDetailWithUserStatus(id: number, userId: number) {
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

  async incrementViewCount(
    id: number,
    userId: number,
    ip?: string,
    deviceId?: string,
  ) {
    await this.work.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    })

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

    await this.prisma.$transaction(async (tx) => {
      await tx.workLike.create({
        data: {
          workId: id,
          userId,
        },
      })

      await tx.work.update({
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

    await this.prisma.$transaction(async (tx) => {
      await tx.workFavorite.create({
        data: {
          workId: id,
          userId,
          workType: work.type,
        },
      })

      await tx.work.update({
        where: { id },
        data: {
          favoriteCount: {
            increment: 1,
          },
        },
      })
    })

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

  async getWorkUserStatus(ids: number[], userId: number) {
    if (ids.length === 0) {
      return []
    }

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

    const likeSet = new Set(likes.map((item) => item.workId))
    const favoriteSet = new Set(favorites.map((item) => item.workId))

    return ids.map((id) => ({
      id,
      liked: likeSet.has(id),
      favorited: favoriteSet.has(id),
    }))
  }

  async getWorkPageWithUserStatus(
    queryWorkDto: QueryWorkDto,
    userId: number,
  ) {
    const page = await this.getWorkPage(queryWorkDto)
    const workIds = page.list.map((item) => item.id)

    if (workIds.length === 0) {
      return page
    }

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
    const result = await this.workFavorite.findPagination({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const workIds = result.list.map((item) => item.workId)
    if (workIds.length === 0) {
      return { ...result, list: [] }
    }

    const works = await this.work.findMany({
      where: {
        id: { in: workIds },
      },
      select: this.getWorkListSelect(),
    })
    const workMap = new Map(works.map((item) => [item.id, item]))
    const orderedWorks = workIds
      .map((id) => workMap.get(id))
      .filter((item): item is NonNullable<typeof item> => !!item)

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
        favorited: true,
      })),
    }
  }

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
    const result = await this.workLike.findPagination({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const workIds = result.list.map((item) => item.workId)
    if (workIds.length === 0) {
      return { ...result, list: [] }
    }

    const works = await this.work.findMany({
      where: {
        id: { in: workIds },
      },
      select: this.getWorkListSelect(),
    })
    const workMap = new Map(works.map((item) => [item.id, item]))
    const orderedWorks = workIds
      .map((id) => workMap.get(id))
      .filter((item): item is NonNullable<typeof item> => !!item)

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
        liked: true,
        favorited: favoriteSet.has(item.id),
      })),
    }
  }

  async updateWork(updateWorkDto: UpdateWorkDto) {
    const { id, authorIds, categoryIds, tagIds, ...updateData } = updateWorkDto

    const existingWork = await this.work.findUnique({ where: { id } })
    if (!existingWork) {
      throw new BadRequestException('作品不存在')
    }

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

    return this.prisma.$transaction(async (tx) => {
      const updatedWork = await tx.work.update({
        where: { id },
        data: updateData,
      })

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

  async deleteWork(id: number) {
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
