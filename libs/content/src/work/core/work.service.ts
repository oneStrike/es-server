import type { Work } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import { DrizzleService, escapeLikePattern } from '@db/core'
import { BrowseLogService } from '@libs/interaction/browse-log'
import { CommentTargetTypeEnum } from '@libs/interaction/comment'
import { FavoriteService } from '@libs/interaction/favorite'
import { FollowService, FollowTargetTypeEnum } from '@libs/interaction/follow'
import { LikeService } from '@libs/interaction/like'
import { ReadingStateService } from '@libs/interaction/reading-state'
import { ContentTypeEnum } from '@libs/platform/constant'
import { isNotNil } from '@libs/platform/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, ilike, inArray, isNull, sql } from 'drizzle-orm'
import { WorkAuthorService } from '../../author'
import {
  CreateWorkInput,
  QueryWorkInput,
  UpdateWorkInput,
  UpdateWorkStatusInput,
} from './work.type'

const PAGE_WORK_PICK_FIELDS = [
  'id',
  'type',
  'name',
  'cover',
  'popularity',
  'isRecommended',
  'isHot',
  'isNew',
  'serialStatus',
  'publisher',
  'language',
  'region',
  'ageRating',
  'createdAt',
  'updatedAt',
  'publishAt',
  'isPublished',
] as const

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
    private readonly workAuthorService: WorkAuthorService,
    private readonly likeService: LikeService,
    private readonly favoriteService: FavoriteService,
    private readonly followService: FollowService,
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

  private getPageWorkSelectFields() {
    return {
      id: this.work.id,
      type: this.work.type,
      name: this.work.name,
      cover: this.work.cover,
      popularity: this.work.popularity,
      isRecommended: this.work.isRecommended,
      isHot: this.work.isHot,
      isNew: this.work.isNew,
      serialStatus: this.work.serialStatus,
      publisher: this.work.publisher,
      language: this.work.language,
      region: this.work.region,
      ageRating: this.work.ageRating,
      createdAt: this.work.createdAt,
      updatedAt: this.work.updatedAt,
      publishAt: this.work.publishAt,
      isPublished: this.work.isPublished,
    }
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
            icon: workData.cover,
            cover: workData.cover,
            userLevelRuleId: null,
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
          await this.workAuthorService.updateAuthorWorkCounts(tx, authorIds, 1)
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
        authorRelations: {
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
    const originalAuthorIds = existingWork.authorRelations.map(
      (rel) => rel.authorId,
    )
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
            await this.workAuthorService.updateAuthorWorkCounts(
              tx,
              addedAuthorIds,
              1,
            )
          }

          // 移除作者的作品数 -1
          if (removedAuthorIds.length > 0) {
            await this.workAuthorService.updateAuthorWorkCounts(
              tx,
              removedAuthorIds,
              -1,
            )
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

  /**
   * 批量更新作品标志位（发布/推荐/热门/新作）
   * 用于管理端快速切换作品的展示状态
   */
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
   * 按类型分页查询作品的通用方法
   * 支持热门、新作、推荐等标志位过滤，返回精简字段列表以优化列表页性能
   */
  async getWorkTypePage(dto: QueryWorkInput, userId?: number) {
    return this.paginateWorkList(dto, userId, {
      forcePublished: true,
      selectPageFields: true,
    })
  }

  /**
   * 批量获取作品分页项详情。
   * 供收藏列表等聚合接口复用，保持与作品分页接口字段语义一致。
   */
  async batchGetPageWorkDetails(
    targetIds: number[],
    type: Work['type'],
    userId?: number,
  ) {
    if (targetIds.length === 0) {
      return new Map<number, unknown>()
    }

    const list = await this.db
      .select(this.getPageWorkSelectFields())
      .from(this.work)
      .where(
        and(
          inArray(this.work.id, targetIds),
          eq(this.work.type, type),
          eq(this.work.isPublished, true),
          isNull(this.work.deletedAt),
        ),
      )

    const page = await this.attachWorkRelations(
      {
        list,
        total: list.length,
        pageIndex: 1,
        pageSize: list.length,
      },
      userId,
    )

    return new Map(page.list.map((item) => [item.id, item]))
  }

  /**
   * 构建作品分页查询条件。
   * app 侧列表可通过 forcePublished 固定限制为已发布作品；
   * 管理端列表则沿用传入的 isPublished 过滤语义。
   */
  private buildWorkPageConditions(
    queryWorkDto: QueryWorkInput,
    options?: { forcePublished?: boolean },
  ): SQL[] {
    const {
      name,
      publisher,
      author,
      authorId,
      categoryIds,
      tagIds,
      ...otherDto
    } =
      queryWorkDto
    const normalizedAuthor = author?.trim()
    const normalizedName = name?.trim()
    const normalizedPublisher = publisher?.trim()
    const normalizedLanguage = otherDto.language?.trim()
    const normalizedRegion = otherDto.region?.trim()
    const normalizedAgeRating = otherDto.ageRating?.trim()

    const conditions: SQL[] = [isNull(this.work.deletedAt)]

    if (isNotNil(otherDto.type)) {
      conditions.push(eq(this.work.type, otherDto.type))
    }

    if (options?.forcePublished) {
      conditions.push(eq(this.work.isPublished, true))
    } else if (isNotNil(otherDto.isPublished)) {
      conditions.push(eq(this.work.isPublished, otherDto.isPublished))
    }

    if (isNotNil(otherDto.serialStatus)) {
      conditions.push(eq(this.work.serialStatus, otherDto.serialStatus))
    }
    if (normalizedLanguage) {
      conditions.push(eq(this.work.language, normalizedLanguage))
    }
    if (normalizedRegion) {
      conditions.push(eq(this.work.region, normalizedRegion))
    }
    if (normalizedAgeRating) {
      conditions.push(eq(this.work.ageRating, normalizedAgeRating))
    }
    if (isNotNil(otherDto.isRecommended)) {
      conditions.push(eq(this.work.isRecommended, otherDto.isRecommended))
    }
    if (isNotNil(otherDto.isHot)) {
      conditions.push(eq(this.work.isHot, otherDto.isHot))
    }
    if (isNotNil(otherDto.isNew)) {
      conditions.push(eq(this.work.isNew, otherDto.isNew))
    }
    if (normalizedName) {
      conditions.push(
        ilike(this.work.name, `%${escapeLikePattern(normalizedName)}%`),
      )
    }
    if (normalizedPublisher) {
      conditions.push(
        ilike(
          this.work.publisher,
          `%${escapeLikePattern(normalizedPublisher)}%`,
        ),
      )
    }

    if (isNotNil(authorId) || normalizedAuthor) {
      const authorConditions: SQL[] = [
        eq(this.workAuthorRelation.workId, this.work.id),
      ]

      if (isNotNil(authorId)) {
        authorConditions.push(eq(this.workAuthorRelation.authorId, authorId))
      }

      if (normalizedAuthor) {
        authorConditions.push(
          ilike(
            this.workAuthor.name,
            `%${escapeLikePattern(normalizedAuthor)}%`,
          ),
        )
        conditions.push(sql`
          exists (
            select 1
            from ${this.workAuthorRelation}
            inner join ${this.workAuthor}
              on ${this.workAuthor.id} = ${this.workAuthorRelation.authorId}
            where ${and(...authorConditions)}
          )
        `)
      } else {
        conditions.push(sql`
          exists (
            select 1
            from ${this.workAuthorRelation}
            where ${and(...authorConditions)}
          )
        `)
      }
    }

    if (Array.isArray(categoryIds) && categoryIds.length > 0) {
      conditions.push(sql`
        exists (
          select 1
          from ${this.workCategoryRelation}
          where ${this.workCategoryRelation.workId} = ${this.work.id}
            and ${inArray(this.workCategoryRelation.categoryId, categoryIds)}
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

    return conditions
  }

  /**
   * 作品列表分页。
   * 先复用共享分页查询 work 主表，再批量补充作者、分类与标签关系。
   */
  private async paginateWorkList(
    dto: QueryWorkInput,
    userId?: number,
    options?: {
      forcePublished?: boolean
      selectPageFields?: boolean
    },
  ) {
    const where = and(...this.buildWorkPageConditions(dto, options))
    if (options?.selectPageFields) {
      const page = await this.drizzle.ext.findPagination(this.work, {
        where,
        pageIndex: dto.pageIndex,
        pageSize: dto.pageSize,
        orderBy: dto.orderBy,
        pick: PAGE_WORK_PICK_FIELDS,
      })

      return this.attachWorkRelations(page, userId)
    }

    const page = await this.drizzle.ext.findPagination(this.work, {
      where,
      pageIndex: dto.pageIndex,
      pageSize: dto.pageSize,
      orderBy: dto.orderBy,
    })

    return this.attachWorkRelations(page, userId)
  }

  /**
   * 批量附加作品的关联数据（作者、分类、标签）
   * 采用批量查询 + 内存映射的方式避免 N+1 查询问题
   * 若传入 userId，会额外查询用户对各作者的关注状态
   */
  private async attachWorkRelations<TWork extends { id: number }>(
    page: {
      list: TWork[]
      total: number
      pageIndex: number
      pageSize: number
    },
    userId?: number,
  ) {
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
    const authorIds = [...new Set(authors.map((item) => item.authorId))]
    const authorFollowStatusMap =
      userId && authorIds.length > 0
        ? await this.followService.checkStatusBatch(
            FollowTargetTypeEnum.AUTHOR,
            authorIds,
            userId,
          )
        : new Map<number, boolean>()

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
        authors: (authorMap.get(item.id) ?? [])
          .map((relation) =>
            relation.author
              ? {
                  ...relation.author,
                  isFollowed:
                    authorFollowStatusMap.get(relation.authorId) ?? false,
                }
              : undefined,
          )
          .filter(Boolean),
        categories: (categoryMap.get(item.id) ?? [])
          .map((relation) => relation.category)
          .filter(Boolean),
        tags: (tagMap.get(item.id) ?? [])
          .map((relation) => relation.tag)
          .filter(Boolean),
      })),
    }
  }

  /**
   * 分页查询作品（支持多条件组合过滤）
   * 查询说明：
   * - 名称、发布者支持模糊匹配（ILIKE）
   * - 作者支持按 ID 精确筛选和名称模糊筛选
   * - 分类、标签支持按 ID 列表筛选
   * - 其他字段（类型、发布状态、连载状态等）支持精确匹配
   */
  async getWorkPage(dto: QueryWorkInput, userId?: number) {
    return this.paginateWorkList(dto, userId)
  }

  /**
   * 获取作品关联的论坛板块信息
   * 业务规则：仅已发布的作品才能访问其论坛板块
   * 若用户已登录，会额外返回用户对该板块的关注状态
   */
  async getWorkForumSection(id: number, userId?: number) {
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
        cover: true,
        isEnabled: true,
        topicReviewPolicy: true,
        topicCount: true,
        commentCount: true,
        followersCount: true,
        lastPostAt: true,
      },
    })

    if (!section) {
      throw new BadRequestException('论坛板块不存在')
    }

    if (!userId) {
      return {
        ...section,
        isFollowed: false,
      }
    }

    const followStatus = await this.followService.checkFollowStatus({
      targetType: FollowTargetTypeEnum.FORUM_SECTION,
      targetId: section.id,
      userId,
    })

    return {
      ...section,
      isFollowed: followStatus.isFollowing,
    }
  }

  /**
   * 获取作品的评论目标信息
   * 业务规则：
   * - 仅已发布的作品才能评论
   * - 根据作品类型映射到对应的评论目标类型（漫画/小说）
   * - 其他类型作品不支持评论
   */
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
        authors: {
          columns: {
            id: true,
            name: true,
            type: true,
            avatar: true,
          },
        },
        categories: {
          columns: {
            id: true,
            name: true,
            icon: true,
          },
        },
        tags: {
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

    const { authors, categories, tags, ...workData } = work

    const workAuthors = authors.map((author) => ({
      ...author,
      isFollowed: false,
    }))

    // 为匿名用户保持稳定的响应结构，使应用可以重用相同的DTO而无需条件解析
    if (!userId) {
      return {
        ...workData,
        authors: workAuthors,
        categories,
        tags,
        liked: false,
        favorited: false,
        viewed: false,
      }
    }

    const now = new Date()
    const authorIds = authors.map((author) => author.id)

    const [liked, favorited, readingState, authorFollowStatusMap] =
      await Promise.all([
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
        authorIds.length > 0
          ? this.followService.checkStatusBatch(
              FollowTargetTypeEnum.AUTHOR,
              authorIds,
              userId,
            )
          : Promise.resolve(new Map<number, boolean>()),
      ])

    const continueChapter = readingState?.continueChapter

    // 历史记录和阅读状态服务于不同目的：
    // - user_browse_log 保持只追加的浏览轨迹和计数器
    // - user_work_reading_state 保持最新快照以快速读取详情
    await this.browseLogService.recordBrowseLogSafely(
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
      workType: workData.type as ContentTypeEnum,
      lastReadAt: now,
      lastReadChapterId: continueChapter?.id,
    })

    return {
      ...workData,
      authors: authors.map((author) => ({
        ...author,
        isFollowed: authorFollowStatusMap.get(author.id) ?? false,
      })),
      categories,
      tags,
      // 立即反映刚记录的浏览，使当前响应与持久化的计数器更新保持一致
      viewCount: workData.viewCount + 1,
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
        authorRelations: {
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
        const authorIds = work.authorRelations.map((rel) => rel.authorId)
        if (authorIds.length > 0) {
          await this.workAuthorService.updateAuthorWorkCounts(tx, authorIds, -1)
        }

        return true
      }),
    )
  }
}
