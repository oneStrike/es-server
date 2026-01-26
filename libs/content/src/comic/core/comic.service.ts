import type { WorkComicWhereInput } from '@libs/base/database'
import { BaseService } from '@libs/base/database'
import { isNotNil } from '@libs/base/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
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

  /**
   * 创建漫画
   * @param createComicDto 创建漫画的数据
   * @returns 创建的漫画信息
   */
  async createComic(createComicDto: CreateComicDto) {
    const { authorIds, categoryIds, tagIds, ...comicData } = createComicDto

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
    where.name = {
      contains: name,
      mode: 'insensitive',
    }

    // 出版社模糊搜索
    where.publisher = {
      contains: publisher,
      mode: 'insensitive',
    }

    // 作者名称模糊搜索
    if (author) {
      where.comicAuthors = {
        some: {
          author: {
            name: {
              contains: author,
              mode: 'insensitive',
            },
          },
        },
      }
    }

    // 标签筛选
    if (tagIds) {
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
        popularityWeight: true,
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

    // 验证作者是否存在（如果提供了authorIds）
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

    // 验证分类是否存在（如果提供了categoryIds）
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

    // 验证标签是否存在（如果提供了tagIds）
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

    // 使用事务更新漫画及其关联关系
    return this.prisma.$transaction(async (tx) => {
      // 更新漫画基本信息，确保不包含关联属性
      const { comicTags, ...basicUpdateData } = updateData as any
      const updatedComic = await tx.workComic.update({
        where: { id },
        data: basicUpdateData,
      })

      // 更新作者关联关系（如果提供了authorIds）
      if (authorIds !== undefined) {
        // 删除现有的作者关联
        await tx.workComicAuthor.deleteMany({
          where: { comicId: id },
        })

        // 创建新的作者关联
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

      // 更新分类关联关系（如果提供了categoryIds）
      if (categoryIds !== undefined) {
        // 删除现有的分类关联
        await tx.workComicCategory.deleteMany({
          where: { comicId: id },
        })

        // 创建新的分类关联
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

      // 更新标签关联关系（如果提供了tagIds）
      if (tagIds !== undefined) {
        // 删除现有的标签关联
        await tx.workComicTag.deleteMany({
          where: { comicId: id },
        })

        // 创建新的标签关联
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
