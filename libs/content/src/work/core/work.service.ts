import type { WorkSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  BuildPublicWorkDetailParams,
  WorkDetailContext,
  WorkFlagUpdateInput,
  WorkPageConditionOptions,
  WorkPaginationOptions,
} from './work.type'

import { buildILikeCondition, DrizzleService } from '@db/core'
import { BrowseLogService } from '@libs/interaction/browse-log/browse-log.service'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { FavoriteService } from '@libs/interaction/favorite/favorite.service'
import { FollowTargetTypeEnum } from '@libs/interaction/follow/follow.constant'
import { FollowService } from '@libs/interaction/follow/follow.service'
import { LikeService } from '@libs/interaction/like/like.service'
import { ReadingStateService } from '@libs/interaction/reading-state/reading-state.service'

import {
  BusinessErrorCode,
  ContentTypeEnum,
  WorkRootViewPermissionEnum,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { isNotNil } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { WorkAuthorService } from '../../author/author.service'
import { ContentPermissionService } from '../../permission/content-permission.service'
import {
  CreateWorkDto,
  QueryWorkDto,
  UpdateWorkDto,
  UpdateWorkStatusDto,
} from './dto/work.dto'

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
 * 作品服务类
 * 负责作品的全生命周期管理，包括创建、更新、查询、删除等操作
 * 同时处理与作品相关的用户交互（点赞、收藏、浏览）
 */
@Injectable()
export class WorkService {
  // 初始化 WorkService 依赖。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly workAuthorService: WorkAuthorService,
    private readonly likeService: LikeService,
    private readonly favoriteService: FavoriteService,
    private readonly followService: FollowService,
    private readonly browseLogService: BrowseLogService,
    private readonly readingStateService: ReadingStateService,
    private readonly contentPermissionService: ContentPermissionService,
  ) {}

  // 统一复用当前模块的 Drizzle 数据库实例。
  private get db() {
    return this.drizzle.db
  }

  // work 表访问入口。
  get work() {
    return this.drizzle.schema.work
  }

  // work_chapter 表访问入口。
  get workChapter() {
    return this.drizzle.schema.workChapter
  }

  // app_user 表访问入口。
  get appUser() {
    return this.drizzle.schema.appUser
  }

  // forum_section 表访问入口。
  get forumSection() {
    return this.drizzle.schema.forumSection
  }

  // work_author 表访问入口。
  get workAuthor() {
    return this.drizzle.schema.workAuthor
  }

  // work_category 表访问入口。
  get workCategory() {
    return this.drizzle.schema.workCategory
  }

  // work_tag 表访问入口。
  get workTag() {
    return this.drizzle.schema.workTag
  }

  // work_author_relation 表访问入口。
  get workAuthorRelation() {
    return this.drizzle.schema.workAuthorRelation
  }

  // work_category_relation 表访问入口。
  get workCategoryRelation() {
    return this.drizzle.schema.workCategoryRelation
  }

  // work_tag_relation 表访问入口。
  get workTagRelation() {
    return this.drizzle.schema.workTagRelation
  }

  // 构建作品列表页的最小字段投影，列表查询统一复用这一组 select 字段，避免不同分页接口出现字段面不一致。
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

  // 构建 app/public 作品详情响应，公开场景显式裁剪运营内部字段，避免基础表字段变更后意外外泄。
  private buildPublicWorkDetail(params: BuildPublicWorkDetailParams) {
    const { work, authors, categories, tags, chapterPurchasePricing } = params
    return {
      id: work.id,
      name: work.name,
      type: work.type,
      cover: work.cover,
      popularity: work.popularity,
      isRecommended: work.isRecommended,
      isHot: work.isHot,
      isNew: work.isNew,
      serialStatus: work.serialStatus,
      publisher: work.publisher,
      language: work.language,
      region: work.region,
      ageRating: work.ageRating,
      createdAt: work.createdAt,
      updatedAt: work.updatedAt,
      publishAt: work.publishAt,
      isPublished: work.isPublished,
      alias: work.alias,
      description: work.description,
      originalSource: work.originalSource,
      copyright: work.copyright,
      disclaimer: work.disclaimer,
      lastUpdated: work.lastUpdated,
      viewRule: work.viewRule,
      requiredViewLevelId: work.requiredViewLevelId,
      forumSectionId: work.forumSectionId,
      chapterPurchasePricing,
      canComment: work.canComment,
      viewCount: work.viewCount,
      favoriteCount: work.favoriteCount,
      likeCount: work.likeCount,
      commentCount: work.commentCount,
      downloadCount: work.downloadCount,
      rating: work.rating,
      authors,
      categories,
      tags,
    }
  }

  // 验证作品和用户是否存在。
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '作品不存在',
      )
    }

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
    return { work, user }
  }

  // 验证作品关联的作者、分类、标签是否存在且已启用，业务规则：作品必须关联有效的作者、分类和标签，且这些关联项必须处于启用状态。
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '部分作者不存在或已禁用',
      )
    }
    if (existingCategories.length !== categoryIds.length) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '部分分类不存在或已禁用',
      )
    }
    if (existingTags.length !== tagIds.length) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '部分标签不存在或已禁用',
      )
    }
  }

  // 创建作品，并在同一事务中创建论坛板块、关系记录和作者作品计数。
  async createWork(createWorkDto: CreateWorkDto) {
    await this.createWorkReturningId(createWorkDto)
    return true
  }

  // 创建作品并返回本地作品 ID，供需要继续编排章节/内容的导入链路复用。
  async createWorkReturningId(createWorkDto: CreateWorkDto) {
    const { authorIds, categoryIds, tagIds, ...workData } = createWorkDto
    const normalizedWorkData = {
      ...workData,
      publishAt: workData.publishAt
        ? new Date(workData.publishAt).toISOString()
        : undefined,
    }

    // 同类型作品名称必须保持唯一，软删除作品不参与冲突判断。
    const existingWork = await this.db.query.work.findFirst({
      where: {
        name: normalizedWorkData.name,
        type: normalizedWorkData.type,
        deletedAt: { isNull: true },
      },
    })

    if (existingWork) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
        '同类型作品名称已存在',
      )
    }

    // 作品只允许关联当前有效的作者、分类和标签。
    await this.validateWorkRelations(authorIds, categoryIds, tagIds)

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

        return createdWork.id
      }),
    )
  }

  // 更新作品基础资料，并在事务内同步论坛板块与可选关系。
  async updateWork(updateWorkDto: UpdateWorkDto) {
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '作品不存在',
      )
    }

    // 作品名称变更时才校验同类型重名，避免无关更新多查一次。
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
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          '同类型作品名称已存在',
        )
      }
    }

    // 仅在调用方显式传入关系 ID 时校验关系有效性。
    if (authorIds?.length || categoryIds?.length || tagIds?.length) {
      await this.validateWorkRelations(
        authorIds ?? [],
        categoryIds ?? [],
        tagIds ?? [],
      )
    }

    const originalAuthorIds = existingWork.authorRelations.map(
      (rel) => rel.authorId,
    )
    const shouldSyncSectionName =
      isNotNil(updateData.name) && updateData.name !== existingWork.name
    const shouldSyncSectionDescription = isNotNil(updateData.description)
    const shouldSyncSectionEnabled = isNotNil(updateData.isPublished)
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

          const addedAuthorIds = authorIds.filter(
            (aid) => !originalAuthorIds.includes(aid),
          )
          const removedAuthorIds = originalAuthorIds.filter(
            (aid) => !authorIds.includes(aid),
          )

          if (addedAuthorIds.length > 0) {
            await this.workAuthorService.updateAuthorWorkCounts(
              tx,
              addedAuthorIds,
              1,
            )
          }

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

  // 更新作品发布状态。
  async updateStatus(body: UpdateWorkStatusDto) {
    const work = await this.db.query.work.findFirst({
      where: { id: body.id, deletedAt: { isNull: true } },
      columns: {
        id: true,
        forumSectionId: true,
      },
    })
    if (!work) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '作品不存在',
      )
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

  // 批量更新作品标志位（发布/推荐/热门/新作），用于管理端快速切换作品的展示状态。
  async updateWorkFlags(id: number, data: WorkFlagUpdateInput) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.work)
        .set(data)
        .where(and(eq(this.work.id, id), isNull(this.work.deletedAt))),
    )
    this.drizzle.assertAffectedRows(result, '作品不存在')
    return true
  }

  // 按类型分页查询作品的通用方法，支持热门、新作、推荐等标志位过滤，返回精简字段列表以优化列表页性能。
  async getWorkTypePage(dto: QueryWorkDto, userId?: number) {
    return this.paginateWorkList(dto, userId, {
      forcePublished: true,
      selectPageFields: true,
    })
  }

  // 批量获取作品分页项详情，供收藏列表等聚合接口复用，保持与作品分页接口字段语义一致。
  async batchGetPageWorkDetails(
    targetIds: number[],
    type: WorkSelect['type'],
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

  // 构建作品分页查询条件，app 侧列表可通过 forcePublished 固定限制为已发布作品。
  private buildWorkPageConditions(
    queryWorkDto: QueryWorkDto,
    options?: WorkPageConditionOptions,
  ): SQL[] {
    const {
      name,
      publisher,
      author,
      authorId,
      categoryIds,
      tagIds,
      ...otherDto
    } = queryWorkDto
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
      conditions.push(buildILikeCondition(this.work.name, normalizedName)!)
    }
    if (normalizedPublisher) {
      conditions.push(
        buildILikeCondition(this.work.publisher, normalizedPublisher)!,
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
          buildILikeCondition(this.workAuthor.name, normalizedAuthor)!,
        )
        // 使用 exists 子查询避免 join 扩大 work 主表行数，保持分页总数只按作品去重统计。
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
        // 使用 exists 子查询按作者关系过滤，避免 join 后同一作品因多个关系行重复出现。
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
      // 使用 exists 子查询按分类关系过滤，保持分页查询仍以 work 主表为唯一计数口径。
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
      // 使用 exists 子查询按标签关系过滤，避免多标签匹配时重复 work 行。
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

  // 作品列表分页，先复用共享分页查询 work 主表，再批量补充作者、分类与标签关系。
  private async paginateWorkList(
    dto: QueryWorkDto,
    userId?: number,
    options?: WorkPaginationOptions,
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

  // 批量附加作品的关联数据（作者、分类、标签），采用批量查询 + 内存映射的方式避免 N+1 查询问题。
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
        orderBy: (relation, { asc }) => [
          asc(relation.sortOrder),
          asc(relation.authorId),
        ],
        with: {
          author: {
            columns: { id: true, name: true, type: true, avatar: true },
          },
        },
      }),
      this.db.query.workCategoryRelation.findMany({
        where: { workId: { in: workIds } },
        orderBy: (relation, { asc }) => [
          asc(relation.sortOrder),
          asc(relation.categoryId),
        ],
        with: { category: { columns: { id: true, name: true, icon: true } } },
      }),
      this.db.query.workTagRelation.findMany({
        where: { workId: { in: workIds } },
        orderBy: (relation, { asc }) => [asc(relation.tagId)],
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

  // 分页查询作品，复用作品列表条件构建与关系附加逻辑。
  async getWorkPage(dto: QueryWorkDto, userId?: number) {
    return this.paginateWorkList(dto, userId)
  }

  // 获取作品评论目标，未发布或不存在的作品不能创建评论。
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '作品不存在',
      )
    }

    if (!work.isPublished) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '作品未发布',
      )
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

    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '作品类型不支持评论',
    )
  }

  // 获取作品详情。
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '作品不存在',
      )
    }

    if (!bypassVisibilityCheck && !work.isPublished) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '作品未发布',
      )
    }

    const { authors, categories, tags, ...workData } = work
    const chapterPurchasePricing =
      !bypassVisibilityCheck &&
      workData.viewRule === WorkRootViewPermissionEnum.PURCHASE
        ? this.contentPermissionService.buildPurchasePricing(
            workData.chapterPrice,
          )
        : null

    const workAuthors = authors.map((author) => ({
      ...author,
      isFollowed: false,
    }))
    const publicWorkDetail = this.buildPublicWorkDetail({
      work: workData,
      authors: workAuthors,
      categories,
      tags,
      chapterPurchasePricing,
    })

    // 为匿名用户保持稳定的响应结构，使应用可以重用相同的DTO而无需条件解析
    if (!userId) {
      if (bypassVisibilityCheck) {
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

      return {
        ...publicWorkDetail,
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
    const continueChapterView = continueChapter
      ? {
          id: continueChapter.id,
          title: continueChapter.title,
          subtitle: continueChapter.subtitle ?? undefined,
          sortOrder: continueChapter.sortOrder,
        }
      : undefined

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

    const resolvedAuthors = authors.map((author) => ({
      ...author,
      isFollowed: authorFollowStatusMap.get(author.id) ?? false,
    }))

    if (bypassVisibilityCheck) {
      return {
        ...workData,
        authors: resolvedAuthors,
        categories,
        tags,
        viewCount: workData.viewCount + 1,
        liked,
        favorited,
        viewed: true,
        lastReadAt: now,
        continueChapter: continueChapterView,
      }
    }

    return {
      ...this.buildPublicWorkDetail({
        work: {
          ...workData,
          viewCount: workData.viewCount + 1,
        },
        authors: resolvedAuthors,
        categories,
        tags,
        chapterPurchasePricing,
      }),
      liked,
      favorited,
      viewed: true,
      lastReadAt: now,
      continueChapter: continueChapterView,
    }
  }

  // 软删除作品，并在同一事务中停用关联论坛板块和扣减作者作品数。
  async deleteWork(id: number) {
    // 仍有未删除章节的作品不能软删除，避免产生悬空章节。
    const chapterCount = await this.db.$count(
      this.workChapter,
      and(eq(this.workChapter.workId, id), isNull(this.workChapter.deletedAt)),
    )

    if (chapterCount > 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `该作品还有 ${chapterCount} 个关联章节，无法删除`,
      )
    }

    const work = await this.db.query.work.findFirst({
      where: { id, deletedAt: { isNull: true } },
      with: {
        authorRelations: {
          columns: { authorId: true },
        },
      },
    })

    if (!work) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '作品不存在',
      )
    }

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

        const authorIds = work.authorRelations.map((rel) => rel.authorId)
        if (authorIds.length > 0) {
          await this.workAuthorService.updateAuthorWorkCounts(tx, authorIds, -1)
        }

        return true
      }),
    )
  }
}
