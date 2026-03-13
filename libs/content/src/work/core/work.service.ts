import type { WorkWhereInput } from '@libs/platform/database'
import { ContentTypeEnum } from '@libs/platform/constant'
import { PlatformService } from '@libs/platform/database'
import { isNotNil } from '@libs/platform/utils'
import {
  BrowseLogService,
  FavoriteService,
  LikeService,
  ReadingStateService,
} from '@libs/interaction'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  CreateWorkDto,
  QueryWorkDto,
  QueryWorkTypeDto,
  UpdateWorkDto,
  UpdateWorkStatusDto,
} from './dto/work.dto'
import { PAGE_WORK_SELECT, WORK_RELATION_SELECT } from './work.select'

/**
 * 作品详情上下文接口
 * 用于传递用户访问作品详情时的上下文信息
 */
interface WorkDetailContext {
  /** 用户ID */
  userId?: number
  /** IP地址 */
  ipAddress?: string
  /** 设备信息 */
  device?: string
  /** 用户代理字符串 */
  userAgent?: string
}

/**
 * 作品服务类
 * 负责作品的全生命周期管理，包括创建、更新、查询、删除等操作
 * 同时处理与作品相关的用户交互（点赞、收藏、浏览）
 */
@Injectable()
export class WorkService extends PlatformService {
  get work() {
    return this.prisma.work
  }

  get workChapter() {
    return this.prisma.workChapter
  }

  get appUser() {
    return this.prisma.appUser
  }

  constructor(
    private readonly likeService: LikeService,
    private readonly favoriteService: FavoriteService,
    private readonly browseLogService: BrowseLogService,
    private readonly readingStateService: ReadingStateService,
  ) {
    super()
  }

  /**
   * 验证作品和用户是否存在
   * @param id 作品ID
   * @param userId 用户ID
   * @returns 包含作品和用户信息的对象
   * @throws BadRequestException 当作品或用户不存在时抛出异常
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
   * 验证作品关联的作者、分类、标签是否存在且已启用
   * 业务规则：作品必须关联有效的作者、分类和标签，且这些关联项必须处于启用状态
   * @param authorIds 作者ID列表
   * @param categoryIds 分类ID列表
   * @param tagIds 标签ID列表
   * @throws BadRequestException 当任何关联项不存在或已禁用时抛出异常
   */
  private async validateWorkRelations(
    authorIds: number[],
    categoryIds: number[],
    tagIds: number[],
  ) {
    const [existingAuthors, existingCategories, existingTags] =
      await Promise.all([
        this.prisma.workAuthor.findMany({
          where: { id: { in: authorIds }, isEnabled: true },
        }),
        this.prisma.workCategory.findMany({
          where: { id: { in: categoryIds }, isEnabled: true },
        }),
        this.prisma.workTag.findMany({
          where: { id: { in: tagIds }, isEnabled: true },
        }),
      ])

    if (existingAuthors.length !== authorIds.length) {
      throw new BadRequestException('部分作者不存在或已禁用')
    }
    if (existingCategories.length !== categoryIds.length) {
      throw new BadRequestException('部分分类不存在或已禁用')
    }
    if (existingTags.length !== tagIds.length) {
      throw new BadRequestException('部分标签不存在或已禁用')
    }
  }

  /**
   * 创建作品
   * 事务说明：此方法使用数据库事务确保原子性，事务包含以下操作：
   * 1. 创建作品基础信息
   * 2. 创建作者、分类、标签关联
   * 3. 更新关联作者的作品数量（+1）
   *
   * 业务规则：
   * 1. 同类型下作品名称必须唯一
   * 2. 关联的作者、分类、标签必须存在且已启用
   * 3. 作者和分类按传入顺序设置排序权重
   * @param createWorkDto 创建作品的数据
   * @returns 创建的作品信息
   * @throws BadRequestException 当作品名称重复或关联项无效时抛出异常
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

    // 验证关联的作者、分类、标签是否存在且已启用
    await this.validateWorkRelations(authorIds, categoryIds, tagIds)

    // 使用事务确保作品创建和作者作品数更新的一致性
    return this.prisma.$transaction(async (tx) => {
      // 创建作品并关联作者、分类、标签
      const createdWork = await tx.work.create({
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
              // 分类按倒序设置排序权重（越靠前的分类权重越高）
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

      // 更新关联作者的作品数量（+1）
      await tx.workAuthor.updateMany({
        where: { id: { in: authorIds } },
        data: { workCount: { increment: 1 } },
      })

      return createdWork
    })
  }

  /**
   * 更新作品
   * 事务说明：此方法使用数据库事务确保原子性，事务包含以下操作：
   * 1. 更新作品基础信息
   * 2. 删除并重建作者关联（全量替换）
   * 3. 删除并重建分类关联（全量替换）
   * 4. 删除并重建标签关联（全量替换）
   * 5. 更新作者作品数量（处理新增和移除的作者）
   *
   * 业务规则：
   * - 同类型下作品名称必须唯一
   * - 关联的作者、分类、标签必须存在且已启用
   * - 采用先删除后重建的策略更新关联关系，确保数据一致性
   *
   * @param updateWorkDto 更新作品的数据
   * @returns 更新后的作品信息
   * @throws BadRequestException 当作品不存在、名称重复或关联项无效时抛出异常
   */
  async updateWork(updateWorkDto: UpdateWorkDto) {
    const { id, authorIds, categoryIds, tagIds, ...updateData } = updateWorkDto

    const existingWork = await this.work.findUnique({
      where: { id },
      include: {
        authors: {
          select: { authorId: true },
        },
      },
    })
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

    // 验证关联的作者、分类、标签是否存在且已启用（仅当传入了对应ID时验证）
    if (authorIds?.length || categoryIds?.length || tagIds?.length) {
      await this.validateWorkRelations(
        authorIds ?? [],
        categoryIds ?? [],
        tagIds ?? [],
      )
    }

    // 获取原有关联的作者ID列表
    const originalAuthorIds = existingWork.authors.map((rel) => rel.authorId)

    /**
     * 事务处理：使用 $transaction 确保所有更新操作的原子性
     * 如果其中任何一步失败，整个事务会回滚，保证数据一致性
     */
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

        // 计算新增和移除的作者，更新作品数量
        const addedAuthorIds = authorIds.filter(
          (aid) => !originalAuthorIds.includes(aid),
        )
        const removedAuthorIds = originalAuthorIds.filter(
          (aid) => !authorIds.includes(aid),
        )

        // 新增作者的作品数 +1
        if (addedAuthorIds.length > 0) {
          await tx.workAuthor.updateMany({
            where: { id: { in: addedAuthorIds } },
            data: { workCount: { increment: 1 } },
          })
        }

        // 移除作者的作品数 -1
        if (removedAuthorIds.length > 0) {
          await tx.workAuthor.updateMany({
            where: { id: { in: removedAuthorIds } },
            data: { workCount: { decrement: 1 } },
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
   * 更新作品发布状态
   * @param body 请求体
   * @returns 更新结果
   * @throws BadRequestException 当作品不存在时抛出异常
   */
  async updateStatus(body: UpdateWorkStatusDto) {
    if (!(await this.work.exists({ id: body.id }))) {
      throw new BadRequestException('作品不存在')
    }
    return this.work.update({
      where: { id: body.id },
      data: {
        isPublished: body.isPublished,
      },
    })
  }

  /**
   * 分页查询热门作品
   * 业务规则：仅返回标记为热门的作品
   * @param dto 查询条件（包含类型过滤等）
   * @returns 分页的热门作品列表
   */
  async getHotWorkPage(dto: QueryWorkTypeDto) {
    return this.work.findPagination({
      where: {
        ...dto,
        isHot: true,
      },
      select: PAGE_WORK_SELECT,
    })
  }

  /**
   * 分页查询最新作品
   * @param dto 查询条件（包含类型过滤等）
   * @returns 分页的最新作品列表
   */
  async getNewWorkPage(dto: QueryWorkTypeDto) {
    return this.work.findPagination({
      where: {
        ...dto,
        isNew: true,
      },
      select: PAGE_WORK_SELECT,
    })
  }

  /**
   * 分页查询推荐作品
   * @param dto 查询条件（包含类型过滤等）
   * @returns 分页的推荐作品列表
   */
  async getRecommendedWorkPage(dto: QueryWorkTypeDto) {
    return this.work.findPagination({
      where: {
        ...dto,
        isRecommended: true,
      },
      select: PAGE_WORK_SELECT,
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
    // 通过关联表查询，匹配任一关联作者的名称
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
    // 查询包含任一指定标签的作品
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
      select: PAGE_WORK_SELECT,
    })
  }

  /**
   * 获取作品详情
   * @param id 作品ID
   * @returns 作品详情信息（包含作者、分类、标签关联）
   * @throws BadRequestException 当作品不存在时抛出异常
   */
  async getWorkDetail(id: number, context: WorkDetailContext = {}) {
    const { userId, ipAddress, device, userAgent } = context
    const work = await this.work.findUnique({
      where: { id },
      include: {
        authors: WORK_RELATION_SELECT.authors,
        categories: WORK_RELATION_SELECT.categories,
        tags: WORK_RELATION_SELECT.tags,
      },
    })

    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    // 为匿名用户保持稳定的响应结构，使应用可以重用相同的DTO而无需条件解析
    if (!userId) {
      return {
        ...work,
        liked: false,
        favorited: false,
        viewed: false,
      }
    }

    const now = new Date()

    const [liked, favorited, readingState] = await Promise.all([
      this.likeService.checkLikeStatus(work.type, id, userId),
      this.favoriteService.checkFavoriteStatus(work.type, id, userId),
      this.readingStateService.getReadingState(
        work.type as ContentTypeEnum,
        id,
        userId,
      ),
    ])

    const continueChapter = readingState?.continueChapter

    // 历史记录和阅读状态服务于不同目的：
    // - user_browse_log 保持只追加的浏览轨迹和计数器
    // - user_work_reading_state 保持最新快照以快速读取详情
    await this.browseLogService.recordBrowseLog(
      work.type,
      id,
      userId,
      ipAddress,
      device,
      userAgent,
      {
        skipTargetValidation: true,
        deferPostProcess: true,
      },
    )

    await this.readingStateService.touchByWorkSafely({
      userId,
      workId: id,
      workType: work.type as ContentTypeEnum,
      lastReadAt: now,
      lastReadChapterId: continueChapter?.id,
    })

    return {
      ...work,
      // 立即反映刚记录的浏览，使当前响应与持久化的计数器更新保持一致
      viewCount: work.viewCount + 1,
      liked,
      favorited,
      viewed: true,
      lastReadAt: now,
      continueChapter: continueChapter
        ? {
            id: continueChapter.id,
            title: continueChapter.title,
            subtitle: continueChapter.subtitle ?? undefined,
            sortOrder: continueChapter.sortOrder,
          }
        : undefined,
    }
  }

  /**
   * 删除作品（软删除）
   * 事务说明：此方法使用数据库事务确保原子性，事务包含以下操作：
   * 1. 检查作品是否存在及关联章节
   * 2. 获取作品的关联作者列表
   * 3. 软删除作品
   * 4. 更新关联作者的作品数量（-1）
   *
   * @param id 作品ID
   * @returns 删除结果
   * @throws BadRequestException 当作品不存在或有关联章节时抛出异常
   */
  async deleteWork(id: number) {
    // 检查作品是否还有未删除的章节
    const chapterCount = await this.workChapter.count({
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

    // 获取作品信息，检查是否存在并获取关联作者
    const work = await this.work.findUnique({
      where: { id },
      include: {
        authors: {
          select: { authorId: true },
        },
      },
    })

    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    // 使用事务确保作品删除和作者作品数更新的一致性
    return this.prisma.$transaction(async (tx) => {
      // 软删除作品
      const deletedWork = await tx.work.update({
        where: { id },
        data: { deletedAt: new Date() },
      })

      // 更新关联作者的作品数量（-1）
      const authorIds = work.authors.map((rel) => rel.authorId)
      if (authorIds.length > 0) {
        await tx.workAuthor.updateMany({
          where: { id: { in: authorIds } },
          data: { workCount: { decrement: 1 } },
        })
      }

      return deletedWork
    })
  }
}
