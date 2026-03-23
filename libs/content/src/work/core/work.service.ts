import { DrizzleService } from '@db/core'
import {
  BrowseLogService,
  CommentTargetTypeEnum,
  FavoriteService,
  LikeService,
  ReadingStateService,
} from '@libs/interaction'
import { ContentTypeEnum } from '@libs/platform/constant'
import { isNotNil } from '@libs/platform/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, ilike, inArray, isNull, sql } from 'drizzle-orm'
import {
  CreateWorkInput,
  QueryWorkInput,
  QueryWorkTypeInput,
  UpdateWorkInput,
  UpdateWorkStatusInput,
} from './work.type'

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
  /** 是否跳过 app 侧可见性约束，供管理端复用详情查询 */
  bypassVisibilityCheck?: boolean
}

/**
 * 作品服务类
 * 负责作品的全生命周期管理，包括创建、更新、查询、删除等操作
 * 同时处理与作品相关的用户交互（点赞、收藏、浏览）
 */
@Injectable()
export class WorkService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly likeService: LikeService,
    private readonly favoriteService: FavoriteService,
    private readonly browseLogService: BrowseLogService,
    private readonly readingStateService: ReadingStateService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  get work() {
    return this.drizzle.schema.work
  }

  get workChapter() {
    return this.drizzle.schema.workChapter
  }

  get appUser() {
    return this.drizzle.schema.appUser
  }

  get forumSection() {
    return this.drizzle.schema.forumSection
  }

  get workAuthor() {
    return this.drizzle.schema.workAuthor
  }

  get workCategory() {
    return this.drizzle.schema.workCategory
  }

  get workTag() {
    return this.drizzle.schema.workTag
  }

  get workAuthorRelation() {
    return this.drizzle.schema.workAuthorRelation
  }

  get workCategoryRelation() {
    return this.drizzle.schema.workCategoryRelation
  }

  get workTagRelation() {
    return this.drizzle.schema.workTagRelation
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
      this.db.query.work.findFirst({
        where: { id, deletedAt: { isNull: true } },
      }),
      this.db.query.appUser.findFirst({
        where: { id: userId, deletedAt: { isNull: true } },
      }),
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
        authorIds.length
          ? this.db.query.workAuthor.findMany({
              where: {
                id: { in: authorIds },
                isEnabled: true,
                deletedAt: { isNull: true },
              },
              columns: { id: true },
            })
          : [],
        categoryIds.length
          ? this.db.query.workCategory.findMany({
              where: {
                id: { in: categoryIds },
                isEnabled: true,
              },
              columns: { id: true },
            })
          : [],
        tagIds.length
          ? this.db.query.workTag.findMany({
              where: {
                id: { in: tagIds },
                isEnabled: true,
              },
              columns: { id: true },
            })
          : [],
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
  async createWork(createWorkDto: CreateWorkInput) {
    const { authorIds, categoryIds, tagIds, ...workData } = createWorkDto
    const normalizedWorkData = {
      ...workData,
      publishAt: workData.publishAt
        ? new Date(workData.publishAt).toISOString()
        : undefined,
    }

    // 验证作品名称在同一类型下是否已存在
    const existingWork = await this.db.query.work.findFirst({
      where: {
        name: normalizedWorkData.name,
        type: normalizedWorkData.type,
        deletedAt: { isNull: true },
      },
    })

    if (existingWork) {
      throw new BadRequestException('同类型作品名称已存在')
    }

    // 验证关联的作者、分类、标签是否存在且已启用
    await this.validateWorkRelations(authorIds, categoryIds, tagIds)

    // 使用事务确保作品创建和作者作品数更新的一致性
    return this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const [createdSection] = await tx
          .insert(this.forumSection)
          .values({
            name: workData.name,
            description: workData.description.slice(0, 500),
            isEnabled: workData.isPublished ?? true,
          })
          .returning({ id: this.forumSection.id })

        const [createdWork] = await tx
          .insert(this.work)
          .values({
            ...normalizedWorkData,
            forumSectionId: createdSection.id,
          })
          .returning({ id: this.work.id })

        if (authorIds.length) {
          await tx.insert(this.workAuthorRelation).values(
            authorIds.map((authorId, index) => ({
              workId: createdWork.id,
              authorId,
              sortOrder: index,
            })),
          )
          await tx
            .update(this.workAuthor)
            .set({ workCount: sql`${this.workAuthor.workCount} + 1` })
            .where(inArray(this.workAuthor.id, authorIds))
        }

        if (categoryIds.length) {
          await tx.insert(this.workCategoryRelation).values(
            categoryIds.map((categoryId, index) => ({
              workId: createdWork.id,
              categoryId,
              sortOrder: categoryIds.length - index,
            })),
          )
        }

        if (tagIds.length) {
          await tx.insert(this.workTagRelation).values(
            tagIds.map((tagId) => ({
              workId: createdWork.id,
              tagId,
            })),
          )
        }

        return true
      }),
    )
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
  async updateWork(updateWorkDto: UpdateWorkInput) {
    const { id, authorIds, categoryIds, tagIds, ...updateData } = updateWorkDto
    const normalizedUpdateData = {
      ...updateData,
      publishAt: updateData.publishAt
        ? new Date(updateData.publishAt).toISOString()
        : updateData.publishAt,
    }

    const existingWork = await this.db.query.work.findFirst({
      where: { id, deletedAt: { isNull: true } },
      with: {
        authors: {
          columns: { authorId: true },
        },
      },
    })
    if (!existingWork) {
      throw new BadRequestException('作品不存在')
    }

    // 如果更新名称，需要验证同类型下是否重名
    if (isNotNil(updateData.name) && updateData.name !== existingWork.name) {
      const duplicateWork = await this.db.query.work.findFirst({
        where: {
          name: updateData.name,
          type: existingWork.type,
          deletedAt: { isNull: true },
          id: { ne: id },
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
    const shouldSyncSectionName =
      isNotNil(updateData.name) && updateData.name !== existingWork.name
    const shouldSyncSectionDescription = isNotNil(updateData.description)
    const shouldSyncSectionEnabled = isNotNil(updateData.isPublished)

    /**
     * 事务处理：使用 $transaction 确保所有更新操作的原子性
     * 如果其中任何一步失败，整个事务会回滚，保证数据一致性
     */
    return this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const result = await tx
          .update(this.work)
          .set(normalizedUpdateData)
          .where(and(eq(this.work.id, id), isNull(this.work.deletedAt)))
        this.drizzle.assertAffectedRows(result, '作品不存在')

        if (
          existingWork.forumSectionId &&
          (shouldSyncSectionName ||
            shouldSyncSectionDescription ||
            shouldSyncSectionEnabled)
        ) {
          const sectionUpdateData: Record<string, unknown> = {}
          if (shouldSyncSectionName) {
            sectionUpdateData.name = updateData.name
          }
          if (shouldSyncSectionDescription) {
            sectionUpdateData.description = updateData.description?.slice(
              0,
              500,
            )
          }
          if (shouldSyncSectionEnabled) {
            sectionUpdateData.isEnabled = updateData.isPublished
          }
          await tx
            .update(this.forumSection)
            .set(sectionUpdateData)
            .where(eq(this.forumSection.id, existingWork.forumSectionId))
        }

        // 更新作者关联（先删除后重建）
        if (authorIds !== undefined) {
          await tx
            .delete(this.workAuthorRelation)
            .where(eq(this.workAuthorRelation.workId, id))

          if (authorIds.length > 0) {
            await tx.insert(this.workAuthorRelation).values(
              authorIds.map((authorId, index) => ({
                workId: id,
                authorId,
                sortOrder: index,
              })),
            )
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
            await tx
              .update(this.workAuthor)
              .set({ workCount: sql`${this.workAuthor.workCount} + 1` })
              .where(inArray(this.workAuthor.id, addedAuthorIds))
          }

          // 移除作者的作品数 -1
          if (removedAuthorIds.length > 0) {
            await tx
              .update(this.workAuthor)
              .set({ workCount: sql`${this.workAuthor.workCount} - 1` })
              .where(inArray(this.workAuthor.id, removedAuthorIds))
          }
        }

        // 更新分类关联（先删除后重建）
        if (categoryIds !== undefined) {
          await tx
            .delete(this.workCategoryRelation)
            .where(eq(this.workCategoryRelation.workId, id))

          if (categoryIds.length > 0) {
            await tx.insert(this.workCategoryRelation).values(
              categoryIds.map((categoryId, index) => ({
                workId: id,
                categoryId,
                sortOrder: categoryIds.length - index,
              })),
            )
          }
        }

        // 更新标签关联（先删除后重建）
        if (tagIds !== undefined) {
          await tx
            .delete(this.workTagRelation)
            .where(eq(this.workTagRelation.workId, id))

          if (tagIds.length > 0) {
            await tx.insert(this.workTagRelation).values(
              tagIds.map((tagId) => ({
                workId: id,
                tagId,
              })),
            )
          }
        }

        return true
      }),
    )
  }

  /**
   * 更新作品发布状态
   * @param body 请求体
   * @returns 更新结果
   * @throws BadRequestException 当作品不存在时抛出异常
   */
  async updateStatus(body: UpdateWorkStatusInput) {
    const work = await this.db.query.work.findFirst({
      where: { id: body.id, deletedAt: { isNull: true } },
      columns: {
        id: true,
        forumSectionId: true,
      },
    })
    if (!work) {
      throw new BadRequestException('作品不存在')
    }
    return this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const result = await tx
          .update(this.work)
          .set({ isPublished: body.isPublished })
          .where(and(eq(this.work.id, body.id), isNull(this.work.deletedAt)))
        this.drizzle.assertAffectedRows(result, '作品不存在')

        if (work.forumSectionId) {
          await tx
            .update(this.forumSection)
            .set({ isEnabled: body.isPublished })
            .where(eq(this.forumSection.id, work.forumSectionId))
        }

        return true
      }),
    )
  }

  async updateWorkFlags(
    id: number,
    data: Partial<{
      isPublished: boolean
      isRecommended: boolean
      isHot: boolean
      isNew: boolean
    }>,
  ) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.work)
        .set(data)
        .where(and(eq(this.work.id, id), isNull(this.work.deletedAt))),
    )
    this.drizzle.assertAffectedRows(result, '作品不存在')
    return true
  }

  /**
   * 分页查询热门作品
   * 业务规则：仅返回标记为热门的作品
   * @param dto 查询条件（包含类型过滤等）
   * @returns 分页的热门作品列表
   */
  async getHotWorkPage(dto: QueryWorkTypeInput) {
    return this.getWorkTypePage(dto, { isHot: true })
  }

  private async getWorkTypePage(
    dto: QueryWorkTypeInput,
    extra: { isHot?: boolean, isNew?: boolean, isRecommended?: boolean },
  ) {
    const page = await this.drizzle.ext.findPagination(this.work, {
      where: this.drizzle.buildWhere(this.work, {
        and: {
          deletedAt: { isNull: true },
          type: dto.type,
          isPublished: true,
          ...extra,
        },
      }),
      ...dto,
    })
    return this.attachWorkRelations(page)
  }

  private async attachWorkRelations(page: {
    list: Array<typeof this.work.$inferSelect>
    total: number
    pageIndex: number
    pageSize: number
  }) {
    if (page.list.length === 0) {
      return page
    }

    const workIds = page.list.map((item) => item.id)
    const [authors, categories, tags] = await Promise.all([
      this.db.query.workAuthorRelation.findMany({
        where: { workId: { in: workIds } },
        with: {
          author: {
            columns: { id: true, name: true, type: true, avatar: true },
          },
        },
      }),
      this.db.query.workCategoryRelation.findMany({
        where: { workId: { in: workIds } },
        with: { category: { columns: { id: true, name: true, icon: true } } },
      }),
      this.db.query.workTagRelation.findMany({
        where: { workId: { in: workIds } },
        with: { tag: { columns: { id: true, name: true, icon: true } } },
      }),
    ])

    const authorMap = new Map<number, typeof authors>()
    const categoryMap = new Map<number, typeof categories>()
    const tagMap = new Map<number, typeof tags>()
    for (const item of authors) {
      const list = authorMap.get(item.workId) ?? []
      list.push(item)
      authorMap.set(item.workId, list)
    }
    for (const item of categories) {
      const list = categoryMap.get(item.workId) ?? []
      list.push(item)
      categoryMap.set(item.workId, list)
    }
    for (const item of tags) {
      const list = tagMap.get(item.workId) ?? []
      list.push(item)
      tagMap.set(item.workId, list)
    }

    return {
      ...page,
      list: page.list.map((item) => ({
        ...item,
        authors: authorMap.get(item.id) ?? [],
        categories: categoryMap.get(item.id) ?? [],
        tags: tagMap.get(item.id) ?? [],
      })),
    }
  }

  async getNewWorkPage(dto: QueryWorkTypeInput) {
    return this.getWorkTypePage(dto, { isNew: true })
  }

  async getRecommendedWorkPage(dto: QueryWorkTypeInput) {
    return this.getWorkTypePage(dto, { isRecommended: true })
  }

  async getWorkPage(queryWorkDto: QueryWorkInput) {
    const { name, publisher, author, tagIds, ...otherDto } = queryWorkDto
    const normalizedAuthor = author?.trim()
    const normalizedName = name?.trim()
    const normalizedPublisher = publisher?.trim()
    const normalizedLanguage = otherDto.language?.trim()
    const normalizedRegion = otherDto.region?.trim()
    const normalizedAgeRating = otherDto.ageRating?.trim()
    const conditions = [
      isNull(this.work.deletedAt),
      otherDto.type ? eq(this.work.type, otherDto.type) : undefined,
      isNotNil(otherDto.isPublished)
        ? eq(this.work.isPublished, otherDto.isPublished)
        : undefined,
      isNotNil(otherDto.serialStatus)
        ? eq(this.work.serialStatus, otherDto.serialStatus)
        : undefined,
      normalizedLanguage
        ? eq(this.work.language, normalizedLanguage)
        : undefined,
      normalizedRegion ? eq(this.work.region, normalizedRegion) : undefined,
      normalizedAgeRating
        ? eq(this.work.ageRating, normalizedAgeRating)
        : undefined,
      isNotNil(otherDto.isRecommended)
        ? eq(this.work.isRecommended, otherDto.isRecommended)
        : undefined,
      isNotNil(otherDto.isHot)
        ? eq(this.work.isHot, otherDto.isHot)
        : undefined,
      isNotNil(otherDto.isNew)
        ? eq(this.work.isNew, otherDto.isNew)
        : undefined,
      normalizedName ? ilike(this.work.name, `%${normalizedName}%`) : undefined,
      normalizedPublisher
        ? ilike(this.work.publisher, `%${normalizedPublisher}%`)
        : undefined,
    ].filter(Boolean)

    if (normalizedAuthor) {
      conditions.push(sql`
        exists (
          select 1
          from ${this.workAuthorRelation}
          inner join ${this.workAuthor}
            on ${this.workAuthor.id} = ${this.workAuthorRelation.authorId}
          where ${this.workAuthorRelation.workId} = ${this.work.id}
            and ${ilike(this.workAuthor.name, `%${normalizedAuthor}%`)}
        )
      `)
    }

    if (Array.isArray(tagIds) && tagIds.length > 0) {
      conditions.push(sql`
        exists (
          select 1
          from ${this.workTagRelation}
          where ${this.workTagRelation.workId} = ${this.work.id}
            and ${inArray(this.workTagRelation.tagId, tagIds)}
        )
      `)
    }

    const page = await this.drizzle.ext.findPagination(this.work, {
      where: and(...(conditions as [any, ...any[]])),
      ...otherDto,
    })
    return this.attachWorkRelations(page as any)
  }

  async getWorkForumSection(id: number) {
    const work = await this.db.query.work.findFirst({
      where: { id, deletedAt: { isNull: true } },
      columns: {
        forumSectionId: true,
        isPublished: true,
      },
    })

    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    if (!work.isPublished) {
      throw new BadRequestException('作品未发布')
    }

    if (!work.forumSectionId) {
      throw new BadRequestException('作品未关联论坛板块')
    }

    const section = await this.db.query.forumSection.findFirst({
      where: {
        id: work.forumSectionId,
        deletedAt: { isNull: true },
        isEnabled: true,
      },
      columns: {
        id: true,
        name: true,
        description: true,
        icon: true,
        isEnabled: true,
        topicReviewPolicy: true,
        topicCount: true,
        replyCount: true,
        lastPostAt: true,
      },
    })

    if (!section) {
      throw new BadRequestException('论坛板块不存在')
    }

    return section
  }

  async getWorkCommentTarget(id: number) {
    const work = await this.db.query.work.findFirst({
      where: { id, deletedAt: { isNull: true } },
      columns: {
        id: true,
        type: true,
        isPublished: true,
      },
    })

    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    if (!work.isPublished) {
      throw new BadRequestException('作品未发布')
    }

    if (work.type === ContentTypeEnum.COMIC) {
      return {
        targetType: CommentTargetTypeEnum.COMIC,
        targetId: work.id,
      }
    }

    if (work.type === ContentTypeEnum.NOVEL) {
      return {
        targetType: CommentTargetTypeEnum.NOVEL,
        targetId: work.id,
      }
    }

    throw new BadRequestException('作品类型不支持评论')
  }

  /**
   * 获取作品详情
   * @param id 作品ID
   * @returns 作品详情信息（包含作者、分类、标签关联）
   * @throws BadRequestException 当作品不存在时抛出异常
   */
  async getWorkDetail(id: number, context: WorkDetailContext = {}) {
    const {
      userId,
      ipAddress,
      device,
      userAgent,
      bypassVisibilityCheck = false,
    } = context
    const work = await this.db.query.work.findFirst({
      where: { id, deletedAt: { isNull: true } },
      columns: {
        deletedAt: false,
      },
      with: {
        authorList: {
          columns: {
            id: true,
            name: true,
            type: true,
            avatar: true,
          },
        },
        categoryList: {
          columns: {
            id: true,
            name: true,
            icon: true,
          },
        },
        tagList: {
          columns: {
            id: true,
            name: true,
            icon: true,
          },
        },
      },
    })

    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    if (!bypassVisibilityCheck && !work.isPublished) {
      throw new BadRequestException('作品未发布')
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
      this.likeService.checkLikeStatus({
        targetType: work.type,
        targetId: id,
        userId,
      }),
      this.favoriteService.checkFavoriteStatus({
        targetType: work.type,
        targetId: id,
        userId,
      }),
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
    const chapterCount = await this.db.$count(
      this.workChapter,
      and(eq(this.workChapter.workId, id), isNull(this.workChapter.deletedAt)),
    )

    if (chapterCount > 0) {
      throw new BadRequestException(
        `该作品还有 ${chapterCount} 个关联章节，无法删除`,
      )
    }

    // 获取作品信息，检查是否存在并获取关联作者
    const work = await this.db.query.work.findFirst({
      where: { id, deletedAt: { isNull: true } },
      with: {
        authors: {
          columns: { authorId: true },
        },
      },
    })

    if (!work) {
      throw new BadRequestException('作品不存在')
    }

    // 使用事务确保作品删除和作者作品数更新的一致性
    return this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const result = await tx
          .update(this.work)
          .set({ deletedAt: new Date() })
          .where(and(eq(this.work.id, id), isNull(this.work.deletedAt)))
        this.drizzle.assertAffectedRows(result, '作品不存在')

        if (work.forumSectionId) {
          await tx
            .update(this.forumSection)
            .set({
              isEnabled: false,
              deletedAt: new Date(),
            })
            .where(eq(this.forumSection.id, work.forumSectionId))
        }

        // 更新关联作者的作品数量（-1）
        const authorIds = work.authors.map((rel) => rel.authorId)
        if (authorIds.length > 0) {
          await tx
            .update(this.workAuthor)
            .set({ workCount: sql`${this.workAuthor.workCount} - 1` })
            .where(inArray(this.workAuthor.id, authorIds))
        }

        return true
      }),
    )
  }
}
