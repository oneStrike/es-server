import type { DbExecutor, DbTransaction } from '@db/core'
import type { WorkSelect } from '@db/schema'
import type { ManagedForumSectionMutationSnapshot } from '@libs/forum/section/forum-section.type'
import type { SQL } from 'drizzle-orm'
import type {
  AppWorkFallbackOrderBy,
  AppWorkFeedKind,
  BuildPublicWorkDetailParams,
  WorkDetailContext,
  WorkFlagUpdateInput,
  WorkMutationDiscovery,
  WorkPageConditionOptions,
  WorkStatusMutationDiscovery,
  WorkStatusMutationSnapshotRow,
} from './work.type'

import {
  acquireIntegrityLocks,
  buildILikeCondition,
  DrizzleService,
  exclusiveIntegrityLock,
  sharedIntegrityLock,
  tableIntegrityLock,
  toPageResult,
} from '@db/core'
import { ForumSectionService } from '@libs/forum/section/forum-section.service'
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
  WorkTypeEnum,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { formatDateOnlyInAppTimeZone, isNotNil } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import { and, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm'
import { AuthorTypeEnum } from '../../author/author.constant'
import { WorkAuthorService } from '../../author/author.service'
import { ContentPermissionService } from '../../permission/content-permission.service'
import {
  CreateWorkDto,
  QueryAppWorkDto,
  QueryWorkDto,
  UpdateWorkDto,
  UpdateWorkStatusDto,
} from './dto/work.dto'
import {
  workCatalogRelationEndpointLocks,
  workCatalogWorkLock,
} from './work-integrity-lock'

// 仅标记取锁前后快照发生漂移，外层只对这一类并发变化执行一次全新重试。
class WorkSnapshotDriftError extends Error {}

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
    private readonly forumSectionService: ForumSectionService,
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

  // 用户等级规则表访问入口。
  get userLevelRule() {
    return this.drizzle.schema.userLevelRule
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

  // work_third_party_source_binding 表访问入口。
  get workThirdPartySourceBinding() {
    return this.drizzle.schema.workThirdPartySourceBinding
  }

  // work_third_party_chapter_binding 表访问入口。
  get workThirdPartyChapterBinding() {
    return this.drizzle.schema.workThirdPartyChapterBinding
  }

  // 存在性与重名检查不需要加载作品正文和运营字段。
  private getWorkExistenceColumns() {
    return { id: true } as const
  }

  // 作品写路径只以作者 ID 计算关系差集和计数。
  private getWorkAuthorRelationIdColumns() {
    return { authorId: true } as const
  }

  // 作品写路径只以分类 ID 计算关系差集和锁集合。
  private getWorkCategoryRelationIdColumns() {
    return { categoryId: true } as const
  }

  // 作品写路径只以标签 ID 计算关系差集和锁集合。
  private getWorkTagRelationIdColumns() {
    return { tagId: true } as const
  }

  // 更新与删除只读取名称、类型、托管板块和关系差集所需字段。
  private getWorkMutationSnapshotColumns() {
    return {
      name: true,
      type: true,
      forumSectionId: true,
      id: true,
    } as const
  }

  // 发布状态变更只读取作品主键和托管板块主键。
  private getWorkStatusMutationSnapshotColumns() {
    return { forumSectionId: true, id: true } as const
  }

  // 读取作品托管板块快照；缺失快照视为并发漂移并交由外层全新重试。
  private async readManagedSectionMutationSnapshotForWork(
    work: WorkStatusMutationSnapshotRow,
    client: DbExecutor,
  ) {
    if (!work.forumSectionId) {
      return undefined
    }

    const managedSection =
      await this.forumSectionService.readManagedSectionMutationSnapshot(
        work.id,
        work.forumSectionId,
        client,
      )
    if (!managedSection) {
      throw new WorkSnapshotDriftError()
    }
    return managedSection
  }

  // 读取作品更新或删除规划完整锁集合所需的关系与托管板块快照。
  private async readWorkMutationDiscovery(
    id: number,
    expectedType: WorkTypeEnum,
    client: DbExecutor = this.db,
  ): Promise<WorkMutationDiscovery | undefined> {
    const work = await client.query.work.findFirst({
      where: { id, type: expectedType, deletedAt: { isNull: true } },
      columns: this.getWorkMutationSnapshotColumns(),
      with: {
        authorRelations: {
          columns: this.getWorkAuthorRelationIdColumns(),
        },
        categoryRelations: {
          columns: this.getWorkCategoryRelationIdColumns(),
        },
        tagRelations: {
          columns: this.getWorkTagRelationIdColumns(),
        },
      },
    })
    if (!work) {
      return undefined
    }

    const managedSection = await this.readManagedSectionMutationSnapshotForWork(
      work,
      client,
    )
    return { work, managedSection }
  }

  // 读取发布状态变更规划锁集合所需的窄作品与托管板块快照。
  private async readWorkStatusMutationDiscovery(
    id: number,
    expectedType: WorkTypeEnum,
    client: DbExecutor = this.db,
  ): Promise<WorkStatusMutationDiscovery | undefined> {
    const work = await client.query.work.findFirst({
      where: { id, type: expectedType, deletedAt: { isNull: true } },
      columns: this.getWorkStatusMutationSnapshotColumns(),
    })
    if (!work) {
      return undefined
    }

    const managedSection = await this.readManagedSectionMutationSnapshotForWork(
      work,
      client,
    )
    return { work, managedSection }
  }

  // 比对取锁前后的托管板块身份及其父级引用是否一致。
  private isSameManagedSectionMutationSnapshot(
    left: ManagedForumSectionMutationSnapshot | undefined,
    right: ManagedForumSectionMutationSnapshot | undefined,
  ) {
    if (!left || !right) {
      return left === right
    }
    return (
      left.workId === right.workId &&
      left.id === right.id &&
      left.groupId === right.groupId &&
      left.userLevelRuleId === right.userLevelRuleId
    )
  }

  // 比对更新或删除在取锁前后的作品、关系与托管板块快照。
  private isSameWorkMutationDiscovery(
    left: WorkMutationDiscovery | undefined,
    right: WorkMutationDiscovery | undefined,
  ) {
    if (!left || !right) {
      return left === right
    }

    const ids = (values: readonly number[]) =>
      [...new Set(values)].sort((a, b) => a - b).join(',')
    return (
      left.work.id === right.work.id &&
      left.work.name === right.work.name &&
      left.work.type === right.work.type &&
      left.work.forumSectionId === right.work.forumSectionId &&
      ids(left.work.authorRelations.map((row) => row.authorId)) ===
        ids(right.work.authorRelations.map((row) => row.authorId)) &&
      ids(left.work.categoryRelations.map((row) => row.categoryId)) ===
        ids(right.work.categoryRelations.map((row) => row.categoryId)) &&
      ids(left.work.tagRelations.map((row) => row.tagId)) ===
        ids(right.work.tagRelations.map((row) => row.tagId)) &&
      this.isSameManagedSectionMutationSnapshot(
        left.managedSection,
        right.managedSection,
      )
    )
  }

  // 比对发布状态变更在取锁前后的作品与托管板块快照。
  private isSameWorkStatusMutationDiscovery(
    left: WorkStatusMutationDiscovery | undefined,
    right: WorkStatusMutationDiscovery | undefined,
  ) {
    if (!left || !right) {
      return left === right
    }
    return (
      left.work.id === right.work.id &&
      left.work.forumSectionId === right.work.forumSectionId &&
      this.isSameManagedSectionMutationSnapshot(
        left.managedSection,
        right.managedSection,
      )
    )
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

  // app 作品详情只读取公开 DTO 字段；chapterPrice 仅用于计算章节购买价格，构建响应前必须剥离。
  private getPublicWorkDetailColumns() {
    return {
      id: true,
      name: true,
      type: true,
      cover: true,
      popularity: true,
      isRecommended: true,
      isHot: true,
      isNew: true,
      serialStatus: true,
      publisher: true,
      language: true,
      region: true,
      ageRating: true,
      createdAt: true,
      updatedAt: true,
      publishAt: true,
      isPublished: true,
      alias: true,
      description: true,
      originalSource: true,
      copyright: true,
      disclaimer: true,
      lastUpdated: true,
      viewRule: true,
      requiredViewLevelId: true,
      forumSectionId: true,
      canComment: true,
      viewCount: true,
      favoriteCount: true,
      likeCount: true,
      commentCount: true,
      downloadCount: true,
      rating: true,
      chapterPrice: true,
    } as const
  }

  // admin/bypass 详情在公开详情字段基础上显式增加后台专属运营字段。
  private getAdminWorkDetailColumns() {
    return {
      ...this.getPublicWorkDetailColumns(),
      recommendWeight: true,
      remark: true,
    } as const
  }

  // 作品详情统一加载公开作者、分类和标签字段，避免入口间关系投影漂移。
  private getWorkDetailRelations() {
    return {
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
    } as const
  }

  // 构建 app/public 作品详情响应，公开场景显式裁剪运营内部字段，避免基础表字段变更后意外外泄。
  private buildPublicWorkDetail(params: BuildPublicWorkDetailParams) {
    const { work, authors, categories, tags, chapterPurchasePricing } = params
    // WorkPublicDetailRow 已通过 Pick 裁剪了 remark/chapterPrice/recommendWeight/deletedAt 等内部字段。
    return {
      ...work,
      publisher: work.publisher ?? null,
      ageRating: work.ageRating ?? null,
      publishAt: work.publishAt ?? null,
      alias: work.alias ?? null,
      originalSource: work.originalSource ?? null,
      copyright: work.copyright ?? null,
      disclaimer: work.disclaimer ?? null,
      lastUpdated: work.lastUpdated ?? null,
      requiredViewLevelId: work.requiredViewLevelId ?? null,
      forumSectionId: work.forumSectionId ?? null,
      rating: work.rating ?? null,
      chapterPurchasePricing,
      authors,
      categories,
      tags,
    }
  }

  // 校验显式提交的关系集合非空，创建场景可将缺省值一并视为非法。
  private assertNonEmptyRelationIds(
    ids: number[] | undefined,
    relationName: string,
    required = false,
  ) {
    if ((required && !ids?.length) || (ids !== undefined && ids.length === 0)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `作品必须至少关联一个${relationName}`,
      )
    }
  }

  // 将作品类型映射为作者必须具备的领域角色。
  private getRequiredAuthorType(workType: WorkTypeEnum): AuthorTypeEnum {
    if (workType === WorkTypeEnum.COMIC) {
      return AuthorTypeEnum.MANGA
    }
    if (workType === WorkTypeEnum.NOVEL) {
      return AuthorTypeEnum.NOVEL
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '作品类型不支持作者角色校验',
    )
  }

  // 查询当前有效且未删除的作者及其角色，用于事务内外同口径校验。
  private async findEnabledAuthors(
    authorIds?: number[],
    runner: DbExecutor = this.db,
  ) {
    if (authorIds === undefined) {
      return []
    }

    return runner.query.workAuthor.findMany({
      where: {
        id: { in: authorIds },
        isEnabled: true,
        deletedAt: { isNull: true },
      },
      columns: { id: true, type: true },
    })
  }

  // 查询当前已启用的作品分类，用于确认完整关系集合。
  private async findEnabledCategories(
    categoryIds?: number[],
    runner: DbExecutor = this.db,
  ) {
    if (categoryIds === undefined) {
      return []
    }

    return runner.query.workCategory.findMany({
      where: {
        id: { in: categoryIds },
        isEnabled: true,
      },
      columns: { id: true },
    })
  }

  // 查询当前已启用的作品标签，用于确认完整关系集合。
  private async findEnabledTags(
    tagIds?: number[],
    runner: DbExecutor = this.db,
  ) {
    if (tagIds === undefined) {
      return []
    }

    return runner.query.workTag.findMany({
      where: {
        id: { in: tagIds },
        isEnabled: true,
      },
      columns: { id: true },
    })
  }

  // 验证作品关联的作者、分类、标签是否存在且已启用，业务规则：作品必须关联有效的作者、分类和标签，且这些关联项必须处于启用状态。
  private async validateWorkRelations(
    authorIds?: number[],
    categoryIds?: number[],
    tagIds?: number[],
    options: {
      requireAll?: boolean
      workType?: WorkTypeEnum
    } = {},
    runner: DbExecutor = this.db,
  ) {
    this.assertNonEmptyRelationIds(authorIds, '作者', options.requireAll)
    this.assertNonEmptyRelationIds(categoryIds, '分类', options.requireAll)
    this.assertNonEmptyRelationIds(tagIds, '标签', options.requireAll)

    const [existingAuthors, existingCategories, existingTags] =
      await Promise.all([
        this.findEnabledAuthors(authorIds, runner),
        this.findEnabledCategories(categoryIds, runner),
        this.findEnabledTags(tagIds, runner),
      ])

    if (
      authorIds !== undefined &&
      existingAuthors.length !== authorIds.length
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '部分作者不存在或已禁用',
      )
    }
    if (authorIds !== undefined && options.workType !== undefined) {
      const requiredAuthorType = this.getRequiredAuthorType(options.workType)
      const invalidAuthor = existingAuthors.find(
        (author) => !author.type?.includes(requiredAuthorType),
      )
      if (invalidAuthor) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          options.workType === WorkTypeEnum.COMIC
            ? '漫画作品只能关联漫画家'
            : '小说作品只能关联轻小说作者',
        )
      }
    }
    if (
      categoryIds !== undefined &&
      existingCategories.length !== categoryIds.length
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '部分分类不存在或已禁用',
      )
    }
    if (tagIds !== undefined && existingTags.length !== tagIds.length) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '部分标签不存在或已禁用',
      )
    }
  }

  /**
   * work.required_view_level_id 无物理外键；锁与 user_level_rule 删除使用同一
   * canonical key，再在当前事务内确认目标仍存在。
   */
  private async assertRequiredViewLevelInTx(
    tx: DbTransaction,
    requiredViewLevelId: number,
  ) {
    const levelRule = await tx.query.userLevelRule.findFirst({
      where: { id: requiredViewLevelId },
      columns: { id: true },
    })
    if (!levelRule) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '阅读等级规则不存在',
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
    const requiredViewLevelId = normalizedWorkData.requiredViewLevelId

    // 同类型作品名称必须保持唯一，软删除作品不参与冲突判断。
    const existingWork = await this.db.query.work.findFirst({
      where: {
        name: normalizedWorkData.name,
        type: normalizedWorkData.type,
        deletedAt: { isNull: true },
      },
      columns: this.getWorkExistenceColumns(),
    })

    if (existingWork) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
        '同类型作品名称已存在',
      )
    }

    // 作品只允许关联当前有效的作者、分类和标签。
    await this.validateWorkRelations(authorIds, categoryIds, tagIds, {
      requireAll: true,
      workType: normalizedWorkData.type,
    })

    return this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        await acquireIntegrityLocks(tx, [
          ...workCatalogRelationEndpointLocks({
            authorIds,
            categoryIds,
            tagIds,
          }).map(sharedIntegrityLock),
          ...(requiredViewLevelId === undefined || requiredViewLevelId === null
            ? []
            : [
                sharedIntegrityLock(
                  tableIntegrityLock('user_level_rule', requiredViewLevelId),
                ),
              ]),
        ])
        const lockedExistingWork = await tx.query.work.findFirst({
          where: {
            name: normalizedWorkData.name,
            type: normalizedWorkData.type,
            deletedAt: { isNull: true },
          },
          columns: this.getWorkExistenceColumns(),
        })
        if (lockedExistingWork) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
            '同类型作品名称已存在',
          )
        }
        await this.validateWorkRelations(
          authorIds,
          categoryIds,
          tagIds,
          {
            requireAll: true,
            workType: normalizedWorkData.type,
          },
          tx,
        )
        if (requiredViewLevelId !== undefined && requiredViewLevelId !== null) {
          await this.assertRequiredViewLevelInTx(tx, requiredViewLevelId)
        }
        const forumSectionId =
          await this.forumSectionService.createManagedSectionForWork(tx, {
            name: workData.name,
            description: workData.description,
            icon: workData.cover,
            cover: workData.cover,
            isEnabled: workData.isPublished ?? true,
          })

        const [createdWork] = await tx
          .insert(this.work)
          .values({
            ...normalizedWorkData,
            forumSectionId,
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
            tagIds.map((tagId, index) => ({
              workId: createdWork.id,
              tagId,
              sortOrder: index,
            })),
          )
        }

        return createdWork.id
      }),
    )
  }

  // 更新作品基础资料，并在事务内同步论坛板块与可选关系。
  async updateWork(updateWorkDto: UpdateWorkDto, expectedType: WorkTypeEnum) {
    const {
      id,
      authorIds,
      categoryIds,
      tagIds,
      type: _type,
      ...updateData
    } = updateWorkDto as UpdateWorkDto & { type?: WorkTypeEnum }
    const normalizedUpdateData = {
      ...updateData,
      publishAt: updateData.publishAt
        ? new Date(updateData.publishAt).toISOString()
        : updateData.publishAt,
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const discovered = await this.readWorkMutationDiscovery(
          id,
          expectedType,
        )
        if (!discovered) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '作品不存在',
          )
        }
        const result = await this.drizzle.withErrorHandling(async () =>
          this.db.transaction(async (tx) => {
            const requestedRequiredViewLevelId =
              normalizedUpdateData.requiredViewLevelId
            const discoveredWork = discovered.work
            const discoveredManagedSection = discovered.managedSection
            const originalAuthorIds = discoveredWork.authorRelations.map(
              (relation) => relation.authorId,
            )
            const originalCategoryIds = discoveredWork.categoryRelations.map(
              (relation) => relation.categoryId,
            )
            const originalTagIds = discoveredWork.tagRelations.map(
              (relation) => relation.tagId,
            )

            await acquireIntegrityLocks(tx, [
              exclusiveIntegrityLock(workCatalogWorkLock(id)),
              ...workCatalogRelationEndpointLocks({
                authorIds: [...originalAuthorIds, ...(authorIds ?? [])],
                categoryIds: [...originalCategoryIds, ...(categoryIds ?? [])],
                tagIds: [...originalTagIds, ...(tagIds ?? [])],
              }).map(sharedIntegrityLock),
              ...(requestedRequiredViewLevelId === undefined ||
              requestedRequiredViewLevelId === null
                ? []
                : [
                    sharedIntegrityLock(
                      tableIntegrityLock(
                        'user_level_rule',
                        requestedRequiredViewLevelId,
                      ),
                    ),
                  ]),
              ...(discoveredManagedSection
                ? [
                    exclusiveIntegrityLock(
                      tableIntegrityLock(
                        'forum_section',
                        discoveredManagedSection.id,
                      ),
                    ),
                    ...(discoveredManagedSection.groupId === null
                      ? []
                      : [
                          sharedIntegrityLock(
                            tableIntegrityLock(
                              'forum_section_group',
                              discoveredManagedSection.groupId,
                            ),
                          ),
                        ]),
                    ...(discoveredManagedSection.userLevelRuleId === null
                      ? []
                      : [
                          sharedIntegrityLock(
                            tableIntegrityLock(
                              'user_level_rule',
                              discoveredManagedSection.userLevelRuleId,
                            ),
                          ),
                        ]),
                  ]
                : []),
            ])

            const lockedDiscovery = await this.readWorkMutationDiscovery(
              id,
              expectedType,
              tx,
            )
            if (
              !lockedDiscovery ||
              !this.isSameWorkMutationDiscovery(discovered, lockedDiscovery)
            ) {
              throw new WorkSnapshotDriftError()
            }
            const existingWork = lockedDiscovery.work

            if (
              requestedRequiredViewLevelId !== undefined &&
              requestedRequiredViewLevelId !== null
            ) {
              await this.assertRequiredViewLevelInTx(
                tx,
                requestedRequiredViewLevelId,
              )
            }

            const resultingWorkName = updateData.name ?? existingWork.name
            const lockedOriginalAuthorIds = existingWork.authorRelations.map(
              (rel) => rel.authorId,
            )
            if (
              isNotNil(updateData.name) &&
              updateData.name !== existingWork.name
            ) {
              const duplicateWork = await tx.query.work.findFirst({
                where: {
                  name: resultingWorkName,
                  type: existingWork.type,
                  deletedAt: { isNull: true },
                  id: { ne: id },
                },
                columns: this.getWorkExistenceColumns(),
              })
              if (duplicateWork) {
                throw new BusinessException(
                  BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
                  '同类型作品名称已存在',
                )
              }
            }

            if (
              authorIds !== undefined ||
              categoryIds !== undefined ||
              tagIds !== undefined
            ) {
              await this.validateWorkRelations(
                authorIds,
                categoryIds,
                tagIds,
                { workType: existingWork.type },
                tx,
              )
            }

            const shouldSyncSectionName =
              isNotNil(updateData.name) && updateData.name !== existingWork.name
            const shouldSyncSectionDescription = isNotNil(
              updateData.description,
            )
            const shouldSyncSectionEnabled = isNotNil(updateData.isPublished)
            const hasScalarUpdate = Object.values(normalizedUpdateData).some(
              (value) => value !== undefined,
            )
            const workWhere = and(
              eq(this.work.id, id),
              eq(this.work.type, expectedType),
              isNull(this.work.deletedAt),
            )

            if (hasScalarUpdate) {
              const result = await tx
                .update(this.work)
                .set(normalizedUpdateData)
                .where(workWhere)
              this.drizzle.assertAffectedRows(result, '作品不存在')
            } else {
              // 关联关系单独更新时仍锁定目标行，保留事务内的存在性与并发语义。
              const lockedRows = await tx
                .select({ id: this.work.id })
                .from(this.work)
                .where(workWhere)
                .for('update')
              this.drizzle.assertAffectedRows(lockedRows, '作品不存在')
            }

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
              await this.forumSectionService.syncManagedSectionForWork(tx, {
                workId: id,
                sectionId: existingWork.forumSectionId,
                name: sectionUpdateData.name as string | undefined,
                description: sectionUpdateData.description as
                  string | undefined,
                isEnabled: sectionUpdateData.isEnabled as boolean | undefined,
              })
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
                (aid) => !lockedOriginalAuthorIds.includes(aid),
              )
              const removedAuthorIds = lockedOriginalAuthorIds.filter(
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
                  tagIds.map((tagId, index) => ({
                    workId: id,
                    tagId,
                    sortOrder: index,
                  })),
                )
              }
            }

            return true
          }),
        )
        return result
      } catch (error) {
        if (!(error instanceof WorkSnapshotDriftError)) {
          throw error
        }
        if (attempt === 1) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '作品状态已变化，请重试',
          )
        }
      }
    }

    throw new BusinessException(
      BusinessErrorCode.STATE_CONFLICT,
      '作品状态已变化，请重试',
    )
  }

  // 更新作品发布状态。
  async updateStatus(body: UpdateWorkStatusDto, expectedType: WorkTypeEnum) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const discovered = await this.readWorkStatusMutationDiscovery(
          body.id,
          expectedType,
        )
        if (!discovered) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '作品不存在',
          )
        }
        const updated = await this.drizzle.withTransaction({
          execute: async (tx) => {
            const managedSection = discovered.managedSection
            await acquireIntegrityLocks(tx, [
              exclusiveIntegrityLock(workCatalogWorkLock(body.id)),
              ...(managedSection
                ? [
                    exclusiveIntegrityLock(
                      tableIntegrityLock('forum_section', managedSection.id),
                    ),
                    ...(managedSection.groupId === null
                      ? []
                      : [
                          sharedIntegrityLock(
                            tableIntegrityLock(
                              'forum_section_group',
                              managedSection.groupId,
                            ),
                          ),
                        ]),
                    ...(managedSection.userLevelRuleId === null
                      ? []
                      : [
                          sharedIntegrityLock(
                            tableIntegrityLock(
                              'user_level_rule',
                              managedSection.userLevelRuleId,
                            ),
                          ),
                        ]),
                  ]
                : []),
            ])
            const lockedDiscovery = await this.readWorkStatusMutationDiscovery(
              body.id,
              expectedType,
              tx,
            )
            if (
              !lockedDiscovery ||
              !this.isSameWorkStatusMutationDiscovery(
                discovered,
                lockedDiscovery,
              )
            ) {
              throw new WorkSnapshotDriftError()
            }

            const result = await tx
              .update(this.work)
              .set({ isPublished: body.isPublished })
              .where(
                and(
                  eq(this.work.id, body.id),
                  eq(this.work.type, expectedType),
                  isNull(this.work.deletedAt),
                ),
              )
            this.drizzle.assertAffectedRows(result, '作品不存在')

            if (lockedDiscovery.work.forumSectionId) {
              await this.forumSectionService.syncManagedSectionForWork(tx, {
                workId: body.id,
                sectionId: lockedDiscovery.work.forumSectionId,
                isEnabled: body.isPublished,
              })
            }

            return true
          },
        })
        return updated
      } catch (error) {
        if (!(error instanceof WorkSnapshotDriftError)) {
          throw error
        }
        if (attempt === 1) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '作品状态已变化，请重试',
          )
        }
      }
    }

    throw new BusinessException(
      BusinessErrorCode.STATE_CONFLICT,
      '作品状态已变化，请重试',
    )
  }

  // 批量更新作品标志位（发布/推荐/热门/新作），用于管理端快速切换作品的展示状态。
  async updateWorkFlags(
    id: number,
    data: WorkFlagUpdateInput,
    expectedType: WorkTypeEnum,
  ) {
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        await acquireIntegrityLocks(tx, [
          exclusiveIntegrityLock(workCatalogWorkLock(id)),
        ])
        const work = await tx.query.work.findFirst({
          where: {
            id,
            type: expectedType,
            deletedAt: { isNull: true },
          },
          columns: { id: true },
        })
        if (!work) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '作品不存在',
          )
        }
        const result = await tx
          .update(this.work)
          .set(data)
          .where(
            and(
              eq(this.work.id, id),
              eq(this.work.type, expectedType),
              isNull(this.work.deletedAt),
            ),
          )
        this.drizzle.assertAffectedRows(result, '作品不存在')
        return true
      },
    })
  }

  // 按类型分页查询作品的通用方法，支持热门、新作、推荐等标志位过滤，返回精简字段列表以优化列表页性能。
  async getWorkTypePage(dto: QueryAppWorkDto, userId?: number) {
    return this.paginateAppWorkList(dto, userId)
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

  // app/public 作品列表按 route 语义使用固定排序，并返回统一 offset 分页结果。
  private async paginateAppWorkList(dto: QueryAppWorkDto, userId?: number) {
    const feedKind = this.getAppWorkFeedKind(dto)
    const conditions = this.buildWorkPageConditions(dto, {
      forcePublished: true,
    })
    const pageParams = this.drizzle.buildPageParams(dto, {
      allowlistedOrderBy: {
        columns: this.getAppWorkOrderColumns(feedKind),
        fallbackOrderBy: this.getAppWorkFallbackOrderBy(feedKind),
      },
    })
    if (pageParams.dateRange?.gte) {
      conditions.push(
        gte(
          this.work.publishAt,
          formatDateOnlyInAppTimeZone(pageParams.dateRange.gte),
        ),
      )
    }
    if (pageParams.dateRange?.lt) {
      conditions.push(
        lt(
          this.work.publishAt,
          formatDateOnlyInAppTimeZone(pageParams.dateRange.lt),
        ),
      )
    }

    const where = and(...conditions)
    const [rows, total] = await Promise.all([
      this.db
        .select({
          ...this.getPageWorkSelectFields(),
          recommendWeight: this.work.recommendWeight,
        })
        .from(this.work)
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(this.work, where),
    ])
    const publicList = rows.map(
      ({ recommendWeight: _recommendWeight, ...item }) => item,
    )

    return this.attachWorkRelations(
      toPageResult(publicList, total, pageParams.page),
      userId,
    )
  }

  // 根据显式筛选参数确定 app 作品流唯一排序场景。
  private getAppWorkFeedKind(dto: QueryAppWorkDto): AppWorkFeedKind {
    if (dto.isHot === true) {
      return 'hot'
    }
    if (dto.isRecommended === true) {
      return 'recommended'
    }
    return 'default'
  }

  // 为未指定排序的 app 作品流提供确定性场景排序和主键兜底。
  private getAppWorkFallbackOrderBy(
    kind: AppWorkFeedKind,
  ): AppWorkFallbackOrderBy {
    if (kind === 'hot') {
      return [
        { popularity: 'desc' as const },
        { publishAt: 'desc' as const },
        { id: 'desc' as const },
      ]
    }
    if (kind === 'recommended') {
      return [
        { recommendWeight: 'desc' as const },
        { publishAt: 'desc' as const },
        { id: 'desc' as const },
      ]
    }

    return [{ publishAt: 'desc' as const }, { id: 'desc' as const }]
  }

  // 只向分页排序构建器暴露当前作品流场景允许使用的列。
  private getAppWorkOrderColumns(kind: AppWorkFeedKind) {
    const columns = {
      publishAt: sql`coalesce(${this.work.publishAt}, '-infinity'::timestamptz)`,
      id: this.work.id,
      createdAt: this.work.createdAt,
      updatedAt: this.work.updatedAt,
    }

    if (kind === 'hot') {
      return {
        ...columns,
        popularity: this.work.popularity,
      }
    }
    if (kind === 'recommended') {
      return {
        ...columns,
        recommendWeight: this.work.recommendWeight,
      }
    }

    return {
      ...columns,
      popularity: this.work.popularity,
    }
  }

  // 作品列表分页，先复用共享分页查询 work 主表，再批量补充作者、分类与标签关系。
  private async paginateWorkList(
    dto: QueryWorkDto,
    userId?: number,
    options?: WorkPageConditionOptions,
  ) {
    const where = and(...this.buildWorkPageConditions(dto, options))
    const pageQuery = this.drizzle.buildPage({
      pageIndex: dto.pageIndex,
      pageSize: dto.pageSize,
    })
    const orderQuery = this.drizzle.buildOrderBy(dto.orderBy, {
      table: this.work,
    })
    const [list, total] = await Promise.all([
      this.db
        .select(this.getPageWorkSelectFields())
        .from(this.work)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.work, where),
    ])
    const page = toPageResult(list, total, pageQuery)

    return this.attachWorkRelations(page, userId)
  }

  // 批量附加作品的关联数据（作者、分类、标签），采用批量查询 + 内存映射的方式避免 N+1 查询问题。
  private async attachWorkRelations<
    TWork extends {
      id: number
      publisher?: string | null
      ageRating?: string | null
      publishAt?: Date | string | null
    },
  >(
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
    const [authors, categories, tags, sourceBindings] = await Promise.all([
      this.db.query.workAuthorRelation.findMany({
        where: { workId: { in: workIds } },
        columns: {
          workId: true,
          authorId: true,
        },
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
        columns: {
          workId: true,
          categoryId: true,
        },
        orderBy: (relation, { asc }) => [
          asc(relation.sortOrder),
          asc(relation.categoryId),
        ],
        with: { category: { columns: { id: true, name: true, icon: true } } },
      }),
      this.db.query.workTagRelation.findMany({
        where: { workId: { in: workIds } },
        columns: {
          workId: true,
          tagId: true,
        },
        orderBy: (relation, { asc }) => [
          asc(relation.sortOrder),
          asc(relation.tagId),
        ],
        with: { tag: { columns: { id: true, name: true, icon: true } } },
      }),
      this.db
        .select({ workId: this.workThirdPartySourceBinding.workId })
        .from(this.workThirdPartySourceBinding)
        .where(
          and(
            inArray(this.workThirdPartySourceBinding.workId, workIds),
            isNull(this.workThirdPartySourceBinding.deletedAt),
          ),
        ),
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
    const sourceBindingWorkIds = new Set(
      sourceBindings.map((binding) => binding.workId),
    )
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
        publisher: item.publisher ?? null,
        ageRating: item.ageRating ?? null,
        publishAt: item.publishAt ?? null,
        authors: (authorMap.get(item.id) ?? [])
          .map((relation) =>
            relation.author
              ? {
                  ...relation.author,
                  avatar: relation.author.avatar ?? null,
                  type: relation.author.type ?? null,
                  isFollowed:
                    authorFollowStatusMap.get(relation.authorId) ?? false,
                }
              : undefined,
          )
          .filter(Boolean),
        categories: (categoryMap.get(item.id) ?? [])
          .map((relation) =>
            relation.category
              ? {
                  ...relation.category,
                  icon: relation.category.icon ?? null,
                }
              : undefined,
          )
          .filter(Boolean),
        hasThirdPartySourceBinding: sourceBindingWorkIds.has(item.id),
        tags: (tagMap.get(item.id) ?? [])
          .map((relation) =>
            relation.tag
              ? {
                  ...relation.tag,
                  icon: relation.tag.icon ?? null,
                }
              : undefined,
          )
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
      expectedType,
    } = context
    const where = {
      id,
      ...(expectedType ? { type: expectedType } : {}),
      deletedAt: { isNull: true },
    } as const
    const work = bypassVisibilityCheck
      ? await this.db.query.work.findFirst({
          where,
          columns: this.getAdminWorkDetailColumns(),
          with: this.getWorkDetailRelations(),
        })
      : await this.db.query.work.findFirst({
          where,
          columns: this.getPublicWorkDetailColumns(),
          with: this.getWorkDetailRelations(),
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

    const { authors, categories, tags, chapterPrice, ...workData } = work
    const adminWork =
      'recommendWeight' in work && 'remark' in work ? work : undefined
    const chapterPurchasePricing =
      !bypassVisibilityCheck &&
      workData.viewRule === WorkRootViewPermissionEnum.PURCHASE
        ? this.contentPermissionService.buildPurchasePricing(chapterPrice)
        : null

    const workAuthors = authors.map((author) => ({
      ...author,
      avatar: author.avatar ?? null,
      type: author.type ?? null,
      isFollowed: false,
    }))
    const buildAdminWorkDetail = (
      responseAuthors: typeof workAuthors,
      viewCount = workData.viewCount,
    ) => ({
      ...this.buildPublicWorkDetail({
        work: {
          ...workData,
          viewCount,
        },
        authors: responseAuthors,
        categories,
        tags,
        chapterPurchasePricing: null,
      }),
      chapterPrice,
      recommendWeight: adminWork!.recommendWeight,
      remark: adminWork!.remark ?? null,
    })
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
          ...buildAdminWorkDetail(workAuthors),
          liked: false,
          favorited: false,
          viewed: false,
          lastReadAt: null,
          continueChapter: null,
        }
      }

      return {
        ...publicWorkDetail,
        liked: false,
        favorited: false,
        viewed: false,
        lastReadAt: null,
        continueChapter: null,
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
        this.readingStateService.getReadingState(work.type, id, userId),
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
          subtitle: continueChapter.subtitle ?? null,
          sortOrder: continueChapter.sortOrder,
        }
      : null

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
      workType: workData.type,
      lastReadAt: now,
      lastReadChapterId: continueChapter?.id,
    })

    const resolvedAuthors = authors.map((author) => ({
      ...author,
      avatar: author.avatar ?? null,
      type: author.type ?? null,
      isFollowed: authorFollowStatusMap.get(author.id) ?? false,
    }))

    if (bypassVisibilityCheck) {
      return {
        ...buildAdminWorkDetail(resolvedAuthors, workData.viewCount + 1),
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
  async deleteWork(id: number, expectedType: WorkTypeEnum) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const discovered = await this.readWorkMutationDiscovery(
          id,
          expectedType,
        )
        if (!discovered) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '作品不存在',
          )
        }
        const deleted = await this.drizzle.withErrorHandling(async () =>
          this.db.transaction(async (tx) => {
            const discoveredWork = discovered.work
            const managedSection = discovered.managedSection
            await acquireIntegrityLocks(tx, [
              exclusiveIntegrityLock(workCatalogWorkLock(id)),
              ...workCatalogRelationEndpointLocks({
                authorIds: discoveredWork.authorRelations.map(
                  (relation) => relation.authorId,
                ),
                categoryIds: discoveredWork.categoryRelations.map(
                  (relation) => relation.categoryId,
                ),
                tagIds: discoveredWork.tagRelations.map(
                  (relation) => relation.tagId,
                ),
              }).map(sharedIntegrityLock),
              ...(managedSection
                ? [
                    exclusiveIntegrityLock(
                      tableIntegrityLock('forum_section', managedSection.id),
                    ),
                    ...(managedSection.groupId === null
                      ? []
                      : [
                          sharedIntegrityLock(
                            tableIntegrityLock(
                              'forum_section_group',
                              managedSection.groupId,
                            ),
                          ),
                        ]),
                    ...(managedSection.userLevelRuleId === null
                      ? []
                      : [
                          sharedIntegrityLock(
                            tableIntegrityLock(
                              'user_level_rule',
                              managedSection.userLevelRuleId,
                            ),
                          ),
                        ]),
                  ]
                : []),
            ])

            const lockedDiscovery = await this.readWorkMutationDiscovery(
              id,
              expectedType,
              tx,
            )
            if (
              !lockedDiscovery ||
              !this.isSameWorkMutationDiscovery(discovered, lockedDiscovery)
            ) {
              throw new WorkSnapshotDriftError()
            }
            const work = lockedDiscovery.work

            const chapterCount = await tx.$count(
              this.workChapter,
              and(
                eq(this.workChapter.workId, id),
                isNull(this.workChapter.deletedAt),
              ),
            )
            if (chapterCount > 0) {
              throw new BusinessException(
                BusinessErrorCode.OPERATION_NOT_ALLOWED,
                `该作品还有 ${chapterCount} 个关联章节，无法删除`,
              )
            }

            const now = new Date()
            await this.softDeleteThirdPartyBindingsForWork(id, tx, now)

            const result = await tx
              .update(this.work)
              .set({ deletedAt: now })
              .where(
                and(
                  eq(this.work.id, id),
                  eq(this.work.type, expectedType),
                  isNull(this.work.deletedAt),
                ),
              )
            this.drizzle.assertAffectedRows(result, '作品不存在')

            if (work.forumSectionId) {
              await this.forumSectionService.releaseManagedSectionForWork(tx, {
                workId: id,
                sectionId: work.forumSectionId,
                deletedAt: now,
              })
            }

            const authorIds = work.authorRelations.map((rel) => rel.authorId)
            if (authorIds.length > 0) {
              await this.workAuthorService.updateAuthorWorkCounts(
                tx,
                authorIds,
                -1,
              )
            }

            return true
          }),
        )
        return deleted
      } catch (error) {
        if (!(error instanceof WorkSnapshotDriftError)) {
          throw error
        }
        if (attempt === 1) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '作品状态已变化，请重试',
          )
        }
      }
    }

    throw new BusinessException(
      BusinessErrorCode.STATE_CONFLICT,
      '作品状态已变化，请重试',
    )
  }

  // 软删除作品时同步释放 active 三方来源和章节绑定，避免已删除作品继续占用三方来源。
  private async softDeleteThirdPartyBindingsForWork(
    workId: number,
    tx: DbExecutor,
    now: Date,
  ) {
    const sourceBindings = await tx
      .select({ id: this.workThirdPartySourceBinding.id })
      .from(this.workThirdPartySourceBinding)
      .where(
        and(
          eq(this.workThirdPartySourceBinding.workId, workId),
          isNull(this.workThirdPartySourceBinding.deletedAt),
        ),
      )
    const sourceBindingIds = sourceBindings.map((binding) => binding.id)
    if (sourceBindingIds.length === 0) {
      return
    }

    await tx
      .update(this.workThirdPartyChapterBinding)
      .set({ deletedAt: now })
      .where(
        and(
          inArray(
            this.workThirdPartyChapterBinding.workThirdPartySourceBindingId,
            sourceBindingIds,
          ),
          isNull(this.workThirdPartyChapterBinding.deletedAt),
        ),
      )

    await tx
      .update(this.workThirdPartySourceBinding)
      .set({ deletedAt: now })
      .where(
        and(
          inArray(this.workThirdPartySourceBinding.id, sourceBindingIds),
          isNull(this.workThirdPartySourceBinding.deletedAt),
        ),
      )
  }
}
