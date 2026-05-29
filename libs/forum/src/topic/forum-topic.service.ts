import type { Db, SQL } from '@db/core'
import type { AppUserSelect, ForumTopicSelect } from '@db/schema'

import type { InteractionAuditorSummaryKey } from '@libs/interaction/summary/interaction-summary.type'
import type { JsonValue } from '@libs/platform/utils'
import type {
  AdminTopicPageRow,
  ForumTopicClientContext,
  ForumTopicMediaInput,
  ForumTopicRelationIdCandidates,
  MaterializedTopicBodyWriteResult,
  PublicForumTopicDetailContext,
  PublicTopicPageRow,
  TopicBodyWriteFields,
} from './forum-topic.type'
import { buildLikePattern, DrizzleService } from '@db/core'

import { EventDefinitionConsumerEnum } from '@libs/growth/event-definition/event-definition.constant'
import {
  canConsumeEventEnvelopeByConsumer,
  createDefinedEventEnvelope,
  EventEnvelopeGovernanceStatusEnum,
} from '@libs/growth/event-definition/event-envelope.type'
import { GrowthBalanceQueryService } from '@libs/growth/growth-ledger/growth-balance-query.service'
import { GrowthEventBridgeService } from '@libs/growth/growth-reward/growth-event-bridge.service'
import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant'
import { BodyCompilerService } from '@libs/interaction/body/body-compiler.service'
import { BodyHtmlCodecService } from '@libs/interaction/body/body-html-codec.service'
import {
  BODY_VERSION_V1,
  BodySceneEnum,
} from '@libs/interaction/body/body.constant'
import { BrowseLogTargetTypeEnum } from '@libs/interaction/browse-log/browse-log.constant'
import { BrowseLogService } from '@libs/interaction/browse-log/browse-log.service'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { EmojiCatalogService } from '@libs/interaction/emoji/emoji-catalog.service'
import { EmojiSceneEnum } from '@libs/interaction/emoji/emoji.constant'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { FavoriteService } from '@libs/interaction/favorite/favorite.service'
import { FollowTargetTypeEnum } from '@libs/interaction/follow/follow.constant'
import { FollowService } from '@libs/interaction/follow/follow.service'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import { LikeService } from '@libs/interaction/like/like.service'
import { MentionSourceTypeEnum } from '@libs/interaction/mention/mention.constant'
import { MentionService } from '@libs/interaction/mention/mention.service'
import { InteractionSummaryReadService } from '@libs/interaction/summary/interaction-summary-read.service'
import {
  AuditRoleEnum,
  AuditStatusEnum,
  BusinessErrorCode,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { SensitiveWordLevelEnum } from '@libs/sensitive-word/sensitive-word-constant'
import { SensitiveWordDetectService } from '@libs/sensitive-word/sensitive-word-detect.service'
import { SensitiveWordStatisticsService } from '@libs/sensitive-word/sensitive-word-statistics.service'
import { AppUserCountService } from '@libs/user/app-user-count.service'
import { Injectable } from '@nestjs/common'
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../action-log/action-log.constant'
import { ForumUserActionLogService } from '../action-log/action-log.service'
import { ForumCounterService } from '../counter/forum-counter.service'
import { ForumReviewPolicyEnum } from '../forum.constant'
import { ForumHashtagBodyService } from '../hashtag/forum-hashtag-body.service'
import { ForumHashtagReferenceService } from '../hashtag/forum-hashtag-reference.service'
import {
  ForumHashtagCreateSourceTypeEnum,
  ForumHashtagReferenceSourceTypeEnum,
} from '../hashtag/forum-hashtag.constant'
import { ForumPermissionService } from '../permission/forum-permission.service'
import { FORUM_SECTION_MUTATION_LOCK_NAMESPACE } from '../section/forum-section.constant'
import {
  AdminForumTopicDetailDto,
  CreateForumTopicDto,
  MoveForumTopicDto,
  PublicForumTopicDetailDto,
  QueryForumTopicDto,
  QueryPublicForumTopicDto,
  UpdateForumTopicAuditStatusDto,
  UpdateForumTopicDto,
  UpdateForumTopicFeaturedDto,
  UpdateForumTopicHiddenDto,
  UpdateForumTopicLockedDto,
  UpdateForumTopicPinnedDto,
} from './dto/forum-topic.dto'
import { buildForumTopicContentPreview } from './forum-topic-preview.helper'
import { FORUM_TOPIC_IMAGE_MAX_COUNT } from './forum-topic.constant'

const DEFAULT_PUBLIC_TOPIC_FEED_ORDER: Array<Record<string, 'asc' | 'desc'>> = [
  { isPinned: 'desc' as const },
  { lastCommentAt: 'desc' as const },
  { createdAt: 'desc' as const },
]

const HOT_PUBLIC_TOPIC_FEED_ORDER: Array<Record<string, 'asc' | 'desc'>> = [
  { commentCount: 'desc' as const },
  { likeCount: 'desc' as const },
  { viewCount: 'desc' as const },
  { createdAt: 'desc' as const },
]

// 论坛主题服务，负责主题的增删改查、审核、置顶、精华、锁定等核心业务。
// 写操作统一记录操作日志，计数变更与主题状态同步在同一事务中完成。
@Injectable()
export class ForumTopicService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly growthEventBridgeService: GrowthEventBridgeService,
    private readonly growthBalanceQueryService: GrowthBalanceQueryService,
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly browseLogService: BrowseLogService,
    private readonly forumCounterService: ForumCounterService,
    private readonly appUserCountService: AppUserCountService,
    private readonly actionLogService: ForumUserActionLogService,
    private readonly forumPermissionService: ForumPermissionService,
    private readonly likeService: LikeService,
    private readonly favoriteService: FavoriteService,
    private readonly followService: FollowService,
    private readonly bodyHtmlCodecService: BodyHtmlCodecService,
    private readonly bodyCompilerService: BodyCompilerService,
    private readonly mentionService: MentionService,
    private readonly emojiCatalogService: EmojiCatalogService,
    private readonly sensitiveWordStatisticsService: SensitiveWordStatisticsService,
    private readonly forumHashtagBodyService: ForumHashtagBodyService,
    private readonly forumHashtagReferenceService: ForumHashtagReferenceService,
    private readonly interactionSummaryReadService: InteractionSummaryReadService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  get forumTopicTable() {
    return this.drizzle.schema.forumTopic
  }

  get userCommentTable() {
    return this.drizzle.schema.userComment
  }

  get userFollowTable() {
    return this.drizzle.schema.userFollow
  }

  get forumHashtagReferenceTable() {
    return this.drizzle.schema.forumHashtagReference
  }

  // ─── 工具方法 ───────────────────────────────────────────────

  // 去重并过滤正数 ID，避免批量摘要查询带入无效条件。
  private uniquePositiveIds(ids: ForumTopicRelationIdCandidates) {
    return [...new Set(ids)].filter(
      (id): id is number => typeof id === 'number' && id > 0,
    )
  }

  // 串行化同一板块的删板块与发帖写路径，避免删除后仍写入新主题。
  private async lockSectionForMutation(client: Db, sectionId: number) {
    await client.execute(
      sql`SELECT pg_advisory_xact_lock(${FORUM_SECTION_MUTATION_LOCK_NAMESPACE}, ${sectionId})`,
    )
  }

  // ─── 查询-公开 ──────────────────────────────────────────────

  // 批量获取主题列表使用的发帖用户简要信息；仅查询列表展示所需字段，避免在公开分页中暴露额外资料。
  private async getTopicUserBriefMap(userIds: number[]) {
    const uniqueUserIds = [...new Set(userIds)]
    if (uniqueUserIds.length === 0) {
      return new Map<
        number,
        Pick<AppUserSelect, 'id' | 'nickname' | 'avatarUrl'>
      >()
    }

    const users = await this.db.query.appUser.findMany({
      where: {
        id: { in: uniqueUserIds },
      },
      columns: {
        id: true,
        nickname: true,
        avatarUrl: true,
      },
    })

    return new Map(users.map((user) => [user.id, user]))
  }

  // 获取主题列表使用的板块简要信息；仅返回列表展示所需字段，供公开分页等场景复用。
  private async getTopicSectionBrief(sectionId: number) {
    const section = await this.db.query.forumSection.findFirst({
      where: {
        id: sectionId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        groupId: true,
        deletedAt: true,
        isEnabled: true,
        name: true,
        icon: true,
        cover: true,
      },
      with: {
        group: {
          columns: {
            isEnabled: true,
            deletedAt: true,
          },
        },
      },
    })

    if (
      !section ||
      !this.forumPermissionService.isSectionPubliclyAvailable(section)
    ) {
      return null
    }

    return {
      id: section.id,
      name: section.name,
      icon: section.icon,
      cover: section.cover,
    }
  }

  // 批量获取主题列表使用的板块简要信息；可按需限制为当前仍可见的板块，供收藏列表等需要剔除失效板块的场景复用。
  private async getTopicSectionBriefMap(
    sectionIds: number[],
    options?: {
      requireEnabled?: boolean
    },
  ) {
    const uniqueSectionIds = [...new Set(sectionIds)]
    if (uniqueSectionIds.length === 0) {
      return new Map<
        number,
        {
          id: number
          name: string
          icon: string | null
          cover: string | null
        }
      >()
    }

    const baseWhere = {
      id: { in: uniqueSectionIds },
      deletedAt: { isNull: true } as const,
    }

    const sections = await this.db.query.forumSection.findMany({
      where: options?.requireEnabled
        ? { ...baseWhere, isEnabled: true }
        : baseWhere,
      columns: {
        id: true,
        groupId: true,
        deletedAt: true,
        isEnabled: true,
        name: true,
        icon: true,
        cover: true,
      },
      with: {
        group: {
          columns: {
            isEnabled: true,
            deletedAt: true,
          },
        },
      },
    })

    const visibleSections = options?.requireEnabled
      ? sections.filter((section) =>
          this.forumPermissionService.isSectionPubliclyAvailable(section),
        )
      : sections

    return new Map(
      visibleSections.map((section) => [
        section.id,
        {
          id: section.id,
          name: section.name,
          icon: section.icon,
          cover: section.cover,
        },
      ]),
    )
  }

  // 批量获取后台主题列表所需的发帖用户摘要。
  private async getAdminTopicUserSummaryMap(userIds: number[]) {
    const uniqueUserIds = this.uniquePositiveIds(userIds)
    if (uniqueUserIds.length === 0) {
      return new Map<
        number,
        {
          id: number
          nickname: string
          avatarUrl: string | null
          status: number
          isEnabled: boolean
          levelName: string | null
        }
      >()
    }

    const users = await this.db.query.appUser.findMany({
      where: {
        id: { in: uniqueUserIds },
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        nickname: true,
        avatarUrl: true,
        status: true,
        isEnabled: true,
      },
      with: {
        level: {
          columns: {
            name: true,
          },
        },
      },
    })

    return new Map(
      users.map((user) => [
        user.id,
        {
          id: user.id,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
          status: user.status,
          isEnabled: user.isEnabled,
          levelName: user.level?.name ?? null,
        },
      ]),
    )
  }

  // 批量获取后台主题列表所需的板块摘要。
  private async getAdminTopicSectionSummaryMap(sectionIds: number[]) {
    const uniqueSectionIds = this.uniquePositiveIds(sectionIds)
    if (uniqueSectionIds.length === 0) {
      return new Map<
        number,
        {
          id: number
          name: string
          isEnabled: boolean
          topicReviewPolicy: number
          groupName: string | null
        }
      >()
    }

    const sections = await this.db.query.forumSection.findMany({
      where: {
        id: { in: uniqueSectionIds },
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        name: true,
        isEnabled: true,
        topicReviewPolicy: true,
      },
      with: {
        group: {
          columns: {
            name: true,
            deletedAt: true,
          },
        },
      },
    })

    return new Map(
      sections.map((section) => [
        section.id,
        {
          id: section.id,
          name: section.name,
          isEnabled: section.isEnabled,
          topicReviewPolicy: section.topicReviewPolicy,
          groupName:
            section.group && !section.group.deletedAt
              ? section.group.name
              : null,
        },
      ]),
    )
  }

  // 为后台主题分页条目补齐发帖用户与所属板块摘要。
  private async hydrateAdminTopicPageItems(items: AdminTopicPageRow[]) {
    if (items.length === 0) {
      return []
    }

    const [userSummaryMap, sectionSummaryMap] = await Promise.all([
      this.getAdminTopicUserSummaryMap(items.map((item) => item.userId)),
      this.getAdminTopicSectionSummaryMap(items.map((item) => item.sectionId)),
    ])

    return items.map((item) => ({
      ...item,
      userSummary: userSummaryMap.get(item.userId) ?? null,
      sectionSummary: sectionSummaryMap.get(item.sectionId) ?? null,
    }))
  }

  // 获取主题审核人展示摘要。
  private async getTopicAuditorSummary(topic: InteractionAuditorSummaryKey) {
    const auditor = {
      auditById: topic.auditById,
      auditRole: topic.auditRole,
    }
    const key =
      this.interactionSummaryReadService.buildAuditorSummaryKey(auditor)

    if (!key) {
      return null
    }

    const auditorSummaryMap =
      await this.interactionSummaryReadService.getAuditorSummaryMap([auditor])

    return auditorSummaryMap.get(key) ?? null
  }

  // 加载主题关联的话题列表；统一按 sourceType=topic 的引用事实表读取，替代已删除的旧 tag 关系表。
  private async getTopicHashtags(topicId: number) {
    return this.db
      .select({
        id: this.drizzle.schema.forumHashtag.id,
        slug: this.drizzle.schema.forumHashtag.slug,
        displayName: this.drizzle.schema.forumHashtag.displayName,
        description: this.drizzle.schema.forumHashtag.description,
        topicRefCount: this.drizzle.schema.forumHashtag.topicRefCount,
        commentRefCount: this.drizzle.schema.forumHashtag.commentRefCount,
        followerCount: this.drizzle.schema.forumHashtag.followerCount,
        lastReferencedAt: this.drizzle.schema.forumHashtag.lastReferencedAt,
      })
      .from(this.drizzle.schema.forumHashtagReference)
      .innerJoin(
        this.drizzle.schema.forumHashtag,
        eq(
          this.drizzle.schema.forumHashtag.id,
          this.drizzle.schema.forumHashtagReference.hashtagId,
        ),
      )
      .where(
        and(
          eq(
            this.drizzle.schema.forumHashtagReference.sourceType,
            ForumHashtagReferenceSourceTypeEnum.TOPIC,
          ),
          eq(this.drizzle.schema.forumHashtagReference.sourceId, topicId),
          isNull(this.drizzle.schema.forumHashtag.deletedAt),
        ),
      )
      .orderBy(
        desc(this.drizzle.schema.forumHashtagReference.createdAt),
        desc(this.drizzle.schema.forumHashtag.id),
      )
  }

  // 构建公开主题分页的 select 投影，复用统一字段列表。
  private buildPublicTopicPageSelect() {
    return {
      id: this.forumTopicTable.id,
      sectionId: this.forumTopicTable.sectionId,
      userId: this.forumTopicTable.userId,
      title: this.forumTopicTable.title,
      contentPreview: this.forumTopicTable.contentPreview,
      geoCountry: this.forumTopicTable.geoCountry,
      geoProvince: this.forumTopicTable.geoProvince,
      geoCity: this.forumTopicTable.geoCity,
      geoIsp: this.forumTopicTable.geoIsp,
      images: this.forumTopicTable.images,
      videos: this.forumTopicTable.videos,
      isPinned: this.forumTopicTable.isPinned,
      isFeatured: this.forumTopicTable.isFeatured,
      isLocked: this.forumTopicTable.isLocked,
      viewCount: this.forumTopicTable.viewCount,
      commentCount: this.forumTopicTable.commentCount,
      likeCount: this.forumTopicTable.likeCount,
      favoriteCount: this.forumTopicTable.favoriteCount,
      lastCommentAt: this.forumTopicTable.lastCommentAt,
      createdAt: this.forumTopicTable.createdAt,
    }
  }

  // 解析公开主题分页的可用板块 ID 列表；传入 sectionId 时校验单板块权限，否则取全部可访问板块。
  private async resolvePublicTopicSectionIds(
    sectionId: number | undefined,
    userId?: number,
  ) {
    if (sectionId !== undefined) {
      await this.forumPermissionService.ensureUserCanAccessSection(
        sectionId,
        userId,
        {
          requireEnabled: true,
        },
      )

      return [sectionId]
    }

    return this.forumPermissionService.getAccessibleSectionIds(userId)
  }

  // 获取关注来源的目标 ID 集合（关注用户、关注板块、关注话题），供关注 feed 聚合使用。
  private async getFollowingFeedTargetIds(userId: number) {
    const follows = await this.db
      .select({
        targetType: this.userFollowTable.targetType,
        targetId: this.userFollowTable.targetId,
      })
      .from(this.userFollowTable)
      .where(eq(this.userFollowTable.userId, userId))

    const followingUserIds: number[] = []
    const followingSectionIds: number[] = []
    const followingHashtagIds: number[] = []
    for (const follow of follows) {
      if (follow.targetType === FollowTargetTypeEnum.USER) {
        followingUserIds.push(follow.targetId)
        continue
      }

      if (follow.targetType === FollowTargetTypeEnum.FORUM_SECTION) {
        followingSectionIds.push(follow.targetId)
        continue
      }

      if (follow.targetType === FollowTargetTypeEnum.FORUM_HASHTAG) {
        followingHashtagIds.push(follow.targetId)
      }
    }

    return {
      followingUserIds: [...new Set(followingUserIds)],
      followingSectionIds: [...new Set(followingSectionIds)],
      followingHashtagIds: [...new Set(followingHashtagIds)],
    }
  }

  // 解析已关注话题对应的公开主题集合；仅消费 sourceType=topic 且当前公开可见的引用事实。
  private async getVisibleTopicIdsByHashtagIds(
    hashtagIds: number[],
    visibleSectionIds: number[],
  ) {
    if (hashtagIds.length === 0) {
      return []
    }

    const rows = await this.db
      .select({
        topicId: this.forumHashtagReferenceTable.topicId,
      })
      .from(this.forumHashtagReferenceTable)
      .where(
        and(
          inArray(this.forumHashtagReferenceTable.hashtagId, hashtagIds),
          eq(
            this.forumHashtagReferenceTable.sourceType,
            ForumHashtagReferenceSourceTypeEnum.TOPIC,
          ),
          eq(this.forumHashtagReferenceTable.isSourceVisible, true),
          visibleSectionIds.length > 0
            ? inArray(
                this.forumHashtagReferenceTable.sectionId,
                visibleSectionIds,
              )
            : undefined,
        ),
      )

    return [...new Set(rows.map((row) => row.topicId))]
  }

  // 为公开主题分页条目补齐用户简要信息、板块简要信息与当前用户的点赞/收藏状态。
  private async hydratePublicTopicPageItems(
    rows: PublicTopicPageRow[],
    options: {
      userId?: number
      sectionId?: number
    },
  ) {
    if (rows.length === 0) {
      return []
    }

    const topicIds = rows.map((item) => item.id)
    const userIds = rows.map((item) => item.userId)
    const [singleSection, sectionMap, userMap, likedMap, favoritedMap] =
      await Promise.all([
        options.sectionId !== undefined
          ? this.getTopicSectionBrief(options.sectionId)
          : Promise.resolve(null),
        options.sectionId === undefined
          ? this.getTopicSectionBriefMap(
              rows.map((item) => item.sectionId),
              { requireEnabled: true },
            )
          : Promise.resolve(new Map()),
        this.getTopicUserBriefMap(userIds),
        options.userId
          ? this.likeService.checkStatusBatch(
              LikeTargetTypeEnum.FORUM_TOPIC,
              topicIds,
              options.userId,
            )
          : Promise.resolve(new Map<number, boolean>()),
        options.userId
          ? this.favoriteService.checkStatusBatch(
              FavoriteTargetTypeEnum.FORUM_TOPIC,
              topicIds,
              options.userId,
            )
          : Promise.resolve(new Map<number, boolean>()),
      ])

    return rows
      .map((item) => {
        const section =
          options.sectionId !== undefined
            ? singleSection
            : sectionMap.get(item.sectionId)

        if (!section) {
          return null
        }

        return {
          ...item,
          geoCountry: item.geoCountry,
          geoProvince: item.geoProvince,
          geoCity: item.geoCity,
          geoIsp: item.geoIsp,
          liked: likedMap.get(item.id) ?? false,
          favorited: favoritedMap.get(item.id) ?? false,
          user: userMap.get(item.userId),
          section,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }

  // 按条件查询公开主题分页；统一封装筛选、排序、计数与条目组装逻辑。
  private async getPublicTopicPageByConditions(
    query: QueryPublicForumTopicDto & {
      userId?: number
    },
    sectionIds: number[],
    fallbackOrderBy: Array<Record<string, 'asc' | 'desc'>>,
    extraCondition?: SQL,
  ) {
    const pageQuery = this.drizzle.buildPage({
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
    })

    if (sectionIds.length === 0) {
      return {
        list: [],
        total: 0,
        pageIndex: pageQuery.pageIndex,
        pageSize: pageQuery.pageSize,
      }
    }

    const conditions: SQL[] = [
      inArray(this.forumTopicTable.sectionId, [...new Set(sectionIds)]),
      isNull(this.forumTopicTable.deletedAt),
      eq(this.forumTopicTable.auditStatus, AuditStatusEnum.APPROVED),
      eq(this.forumTopicTable.isHidden, false),
    ]
    if (extraCondition) {
      conditions.push(extraCondition)
    }

    const where = and(...conditions)
    const order = this.drizzle.buildOrderBy(undefined, {
      table: this.forumTopicTable,
      fallbackOrderBy,
    })
    const listQuery = this.db
      .select(this.buildPublicTopicPageSelect())
      .from(this.forumTopicTable)
      .where(where)
      .limit(pageQuery.limit)
      .offset(pageQuery.offset)

    const [list, total] = await Promise.all([
      order.orderBySql.length > 0
        ? listQuery.orderBy(...order.orderBySql)
        : listQuery,
      this.db.$count(this.forumTopicTable, where),
    ])

    return {
      list: await this.hydratePublicTopicPageItems(
        list as PublicTopicPageRow[],
        {
          userId: query.userId,
          sectionId: query.sectionId,
        },
      ),
      total,
      pageIndex: pageQuery.pageIndex,
      pageSize: pageQuery.pageSize,
    }
  }

  // 规范化论坛主题图片列表；去除空白、保留首现顺序去重、校验数量上限。
  private normalizeImageList(
    value: string[] | null | undefined,
    options: {
      label: string
      maxCount: number
      fallback: string[]
    },
  ) {
    if (value === undefined) {
      return options.fallback
    }
    if (value === null) {
      return []
    }

    const normalizedList: string[] = []
    const seen = new Set<string>()

    for (const item of value) {
      const normalizedItem = item.trim()
      if (!normalizedItem) {
        continue
      }
      if (seen.has(normalizedItem)) {
        continue
      }
      seen.add(normalizedItem)
      normalizedList.push(normalizedItem)
    }

    if (normalizedList.length > options.maxCount) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `${options.label}最多支持 ${options.maxCount} 个`,
      )
    }

    return normalizedList
  }

  // 规范化论坛主题视频 JSON 值；创建时默认空数组，更新时未传字段保留当前值。
  private normalizeVideoValue(
    value: ForumTopicSelect['videos'] | null | undefined,
    options: {
      fallback: ForumTopicSelect['videos']
    },
  ) {
    if (value === undefined) {
      return options.fallback
    }

    const candidate = value ?? []

    try {
      const serialized = JSON.stringify(candidate)
      if (serialized === undefined) {
        throw new Error('invalid json')
      }

      return JSON.parse(serialized) as ForumTopicSelect['videos']
    } catch {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'videos 必须是合法 JSON',
      )
    }
  }

  // 统一规范化论坛主题媒体输入；创建时补空数组，更新时对未传字段保留当前值。
  private normalizeTopicMedia(
    media: ForumTopicMediaInput,
    fallback: Pick<ForumTopicSelect, 'images' | 'videos'> = {
      images: [],
      videos: [],
    },
  ) {
    return {
      images: this.normalizeImageList(media.images, {
        label: '图片',
        maxCount: FORUM_TOPIC_IMAGE_MAX_COUNT,
        fallback: fallback.images,
      }),
      videos: this.normalizeVideoValue(media.videos, {
        fallback: fallback.videos,
      }),
    }
  }

  // 在事务内将 topic DTO 的双模输入物化为带 hashtag 事实的 canonical body 编译结果。
  private async materializeTopicBodyInTx(
    tx: Db,
    input: TopicBodyWriteFields,
    actorUserId: number,
  ): Promise<MaterializedTopicBodyWriteResult> {
    const normalizedHtml = input.html?.trim()
    if (!normalizedHtml) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'html 不能为空',
      )
    }
    const bodyDoc = this.bodyHtmlCodecService.parseHtmlOrThrow(
      normalizedHtml,
      BodySceneEnum.TOPIC,
    )

    const materialized = await this.forumHashtagBodyService.materializeBodyInTx(
      {
        tx,
        body: bodyDoc,
        actorUserId,
        createSourceType: ForumHashtagCreateSourceTypeEnum.TOPIC_BODY,
      },
    )
    const compiledBody = await this.bodyCompilerService.compile(
      materialized.body,
      BodySceneEnum.TOPIC,
    )
    const canonicalHtml = this.bodyHtmlCodecService.renderHtml(
      materialized.body,
      BodySceneEnum.TOPIC,
    )

    return {
      ...compiledBody,
      html: canonicalHtml,
      contentPreview: buildForumTopicContentPreview(compiledBody.bodyTokens),
      hashtagFacts: materialized.hashtagFacts,
    }
  }

  // ─── 查询-通用 ──────────────────────────────────────────────

  // 获取未删除的主题快照；供编辑、删除等需要复用主题当前状态的写路径共享使用。
  private async getActiveTopicOrThrow(id: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: { id, deletedAt: { isNull: true } },
    })

    if (!topic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    return topic
  }

  // 在事务内获取未删除的主题快照；供跨模块事务链路复用。
  async getActiveTopicByIdInTx(tx: Db, id: number) {
    const topic = await tx.query.forumTopic.findFirst({
      where: { id, deletedAt: { isNull: true } },
    })

    if (!topic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    return topic
  }

  // 获取板块的主题审核策略；用于创建/编辑主题时决定是否需要进入审核队列。
  private async getSectionTopicReviewPolicy(
    sectionId: number,
    options?: {
      requireEnabled?: boolean
      notFoundMessage?: string
      client?: Db
    },
  ) {
    const client = options?.client ?? this.db
    const section = await client.query.forumSection.findFirst({
      where: {
        id: sectionId,
        deletedAt: { isNull: true },
      },
      columns: {
        groupId: true,
        deletedAt: true,
        topicReviewPolicy: true,
        isEnabled: true,
      },
      with: {
        group: {
          columns: {
            isEnabled: true,
            deletedAt: true,
          },
        },
      },
    })

    if (!section) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        options?.notFoundMessage ?? '板块不存在或已禁用',
      )
    }

    if (
      options?.requireEnabled &&
      !this.forumPermissionService.isSectionPubliclyAvailable(section)
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '板块不存在或已禁用',
      )
    }

    return section.topicReviewPolicy as ForumReviewPolicyEnum
  }

  // 根据板块审核策略与敏感词等级计算主题的审核状态与隐藏状态；严重敏感词一律隐藏。
  private calculateAuditStatus(
    reviewPolicy: ForumReviewPolicyEnum,
    highestLevel?: SensitiveWordLevelEnum,
  ) {
    let needAudit = false
    let isHidden = false

    if (reviewPolicy === ForumReviewPolicyEnum.MANUAL) {
      needAudit = true
    } else if (highestLevel) {
      if (highestLevel === SensitiveWordLevelEnum.SEVERE) {
        isHidden = true
      }

      if (reviewPolicy === ForumReviewPolicyEnum.SEVERE_SENSITIVE_WORD) {
        needAudit = highestLevel === SensitiveWordLevelEnum.SEVERE
      } else if (
        reviewPolicy === ForumReviewPolicyEnum.GENERAL_SENSITIVE_WORD
      ) {
        needAudit =
          highestLevel === SensitiveWordLevelEnum.SEVERE ||
          highestLevel === SensitiveWordLevelEnum.GENERAL
      } else if (reviewPolicy === ForumReviewPolicyEnum.MILD_SENSITIVE_WORD) {
        needAudit = true
      }
    }

    return {
      auditStatus: needAudit
        ? AuditStatusEnum.PENDING
        : AuditStatusEnum.APPROVED,
      isHidden,
    }
  }

  // 分别检测标题和正文，避免字段拼接制造跨边界假命中。
  private detectTopicSensitiveWords(title: string, content: string) {
    return this.sensitiveWordDetectService.getMatchedWordsWithMetadataBySegments(
      [
        { field: 'title' as const, content: title },
        { field: 'content' as const, content },
      ].filter((segment) => segment.content.length > 0),
    )
  }

  // 为创建主题补齐标题；未传标题时优先从富文本正文提纯可读文本再截取前 30 个字符。
  private resolveCreateTopicTitle(
    title: CreateForumTopicDto['title'],
    plainText: string,
  ) {
    const normalizedTitle = title?.trim()
    if (normalizedTitle) {
      return normalizedTitle
    }

    return plainText.trim().slice(0, 30)
  }

  // 用户编辑主题时，未传 title 则保持原标题；仅显式传值时才更新标题。
  private resolveUpdateTopicTitle(currentTitle: string, title?: string) {
    const normalizedTitle = title?.trim()
    if (normalizedTitle) {
      return normalizedTitle
    }

    return currentTitle
  }

  // 将主题审核状态映射为统一事件治理状态；CREATE_TOPIC 事件是否可进入主链路统一以该状态判断。
  private resolveTopicGovernanceStatus(auditStatus: AuditStatusEnum) {
    switch (auditStatus) {
      case AuditStatusEnum.APPROVED:
        return EventEnvelopeGovernanceStatusEnum.PASSED
      case AuditStatusEnum.PENDING:
        return EventEnvelopeGovernanceStatusEnum.PENDING
      case AuditStatusEnum.REJECTED:
        return EventEnvelopeGovernanceStatusEnum.REJECTED
      default:
        throw new Error(`不支持的主题审核状态: ${auditStatus}`)
    }
  }

  // 构建主题创建事件 envelope；统一沉淀 CREATE_TOPIC 的目标、治理态与最小上下文，供奖励补发等链路复用。
  private buildCreateTopicEventEnvelope(params: {
    topicId: number
    userId: number
    auditStatus: AuditStatusEnum
    occurredAt?: Date
    context?: Record<string, unknown>
  }) {
    return createDefinedEventEnvelope({
      code: GrowthRuleTypeEnum.CREATE_TOPIC,
      subjectId: params.userId,
      targetId: params.topicId,
      occurredAt: params.occurredAt,
      governanceStatus: this.resolveTopicGovernanceStatus(params.auditStatus),
      context: params.context,
    })
  }

  // 判断主题当前是否对外可见；mention 仅在真正可见时发送，避免待审核/隐藏内容提前触达接收人。
  private isTopicVisible(topic: {
    auditStatus: AuditStatusEnum
    isHidden: boolean
    deletedAt?: Date | null
  }) {
    return (
      topic.auditStatus === AuditStatusEnum.APPROVED &&
      !topic.isHidden &&
      topic.deletedAt == null
    )
  }

  // 同步主题从不可见到可见时的 mention 补偿；仅在首次转可见时补发尚未通知的 receiver。
  private async syncTopicMentionVisibilityTransitionInTx(
    tx: Db,
    params: {
      topicId: number
      actorUserId: number
      topicTitle: string
      currentAuditStatus: AuditStatusEnum
      currentIsHidden: boolean
      nextAuditStatus: AuditStatusEnum
      nextIsHidden: boolean
    },
  ) {
    const wasVisible = this.isTopicVisible({
      auditStatus: params.currentAuditStatus,
      isHidden: params.currentIsHidden,
      deletedAt: null,
    })
    const willBeVisible = this.isTopicVisible({
      auditStatus: params.nextAuditStatus,
      isHidden: params.nextIsHidden,
      deletedAt: null,
    })

    if (wasVisible || !willBeVisible) {
      return
    }

    await this.mentionService.dispatchTopicMentionsInTx(tx, {
      topicId: params.topicId,
      actorUserId: params.actorUserId,
      topicTitle: params.topicTitle,
    })
  }

  // ─── 写入-创建 ──────────────────────────────────────────────

  // 创建论坛主题；敏感词检测与审核策略计算在写入前完成，计数更新与板块状态同步在同一事务中执行。
  async createForumTopic(
    createTopicDto: CreateForumTopicDto,
    context: ForumTopicClientContext = {},
  ) {
    const {
      sectionId,
      userId,
      images,
      videos,
      title: inputTitle,
      html,
    } = createTopicDto

    await this.forumPermissionService.ensureUserCanCreateTopic(
      userId,
      sectionId,
    )

    const media = this.normalizeTopicMedia({ images, videos })

    const topic = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const compiledBody = await this.materializeTopicBodyInTx(
          tx,
          {
            html,
          },
          userId,
        )
        await this.lockSectionForMutation(tx, sectionId)
        const liveSection = await tx.query.forumSection.findFirst({
          where: {
            id: sectionId,
            deletedAt: { isNull: true },
            isEnabled: true,
          },
          columns: {
            id: true,
            groupId: true,
            deletedAt: true,
            isEnabled: true,
            topicReviewPolicy: true,
          },
          with: {
            group: {
              columns: {
                isEnabled: true,
                deletedAt: true,
              },
            },
          },
        })
        if (
          !liveSection ||
          !this.forumPermissionService.isSectionPubliclyAvailable(liveSection)
        ) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '板块不存在或已禁用',
          )
        }
        const title = this.resolveCreateTopicTitle(
          inputTitle,
          compiledBody.plainText,
        )
        const { hits, publicHits, highestLevel } =
          this.detectTopicSensitiveWords(title, compiledBody.plainText)
        const reviewPolicy =
          liveSection.topicReviewPolicy as ForumReviewPolicyEnum
        const { auditStatus, isHidden } = this.calculateAuditStatus(
          reviewPolicy,
          highestLevel,
        )
        const createPayload = {
          title,
          html: compiledBody.html,
          content: compiledBody.plainText,
          body: compiledBody.body as unknown as JsonValue,
          contentPreview: compiledBody.contentPreview as unknown as JsonValue,
          bodyVersion: BODY_VERSION_V1,
          sectionId,
          userId,
          geoCountry: context.geoCountry,
          geoProvince: context.geoProvince,
          geoCity: context.geoCity,
          geoIsp: context.geoIsp,
          geoSource: context.geoSource,
          ...media,
          auditStatus,
          sensitiveWordHits: publicHits.length ? publicHits : undefined,
          isHidden,
        }
        const [newTopic] = await tx
          .insert(this.forumTopicTable)
          .values(createPayload)
          .returning()

        await this.sensitiveWordStatisticsService.recordEntityHitsInTx(tx, {
          entityType: 'topic',
          entityId: newTopic.id,
          operationType: 'create',
          hits,
          occurredAt: newTopic.createdAt,
        })

        await this.mentionService.replaceMentionsInTx({
          tx,
          sourceType: MentionSourceTypeEnum.FORUM_TOPIC,
          sourceId: newTopic.id,
          content: compiledBody.plainText,
          mentions: compiledBody.mentionFacts,
        })
        await this.emojiCatalogService.recordRecentUsageInTx(tx, {
          userId,
          scene: EmojiSceneEnum.FORUM,
          items: compiledBody.emojiRecentUsageItems,
        })
        await this.forumHashtagReferenceService.replaceReferencesInTx({
          tx,
          sourceType: ForumHashtagReferenceSourceTypeEnum.TOPIC,
          sourceId: newTopic.id,
          topicId: newTopic.id,
          sectionId,
          userId,
          sourceAuditStatus: newTopic.auditStatus as AuditStatusEnum,
          sourceIsHidden: newTopic.isHidden,
          isSourceVisible: this.isTopicVisible({
            auditStatus: newTopic.auditStatus as AuditStatusEnum,
            isHidden: newTopic.isHidden,
            deletedAt: newTopic.deletedAt,
          }),
          hashtagFacts: compiledBody.hashtagFacts,
        })

        await this.forumCounterService.updateUserForumTopicCount(tx, userId, 1)
        await this.forumCounterService.syncSectionVisibleState(tx, sectionId)

        if (
          this.isTopicVisible({
            auditStatus: newTopic.auditStatus as AuditStatusEnum,
            isHidden: newTopic.isHidden,
            deletedAt: newTopic.deletedAt,
          })
        ) {
          await this.mentionService.dispatchTopicMentionsInTx(tx, {
            topicId: newTopic.id,
            actorUserId: userId,
            topicTitle: newTopic.title,
          })
        }

        const { deletedAt, ...data } = newTopic
        return data
      }),
    )

    await this.actionLogService.createActionLog({
      userId,
      actionType: ForumUserActionTypeEnum.CREATE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId: topic.id,
      afterData: JSON.stringify(topic),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      geoCountry: context.geoCountry,
      geoProvince: context.geoProvince,
      geoCity: context.geoCity,
      geoIsp: context.geoIsp,
      geoSource: context.geoSource,
    })

    const topicCreatedEvent = this.buildCreateTopicEventEnvelope({
      topicId: topic.id,
      userId,
      auditStatus: topic.auditStatus as AuditStatusEnum,
      occurredAt: topic.createdAt,
      context: {
        sectionId,
        auditStatus: topic.auditStatus,
      },
    })

    if (
      canConsumeEventEnvelopeByConsumer(
        topicCreatedEvent,
        EventDefinitionConsumerEnum.GROWTH,
      )
    ) {
      await this.growthEventBridgeService.dispatchDefinedEvent({
        eventEnvelope: topicCreatedEvent,
        bizKey: `forum:topic:create:${topic.id}:user:${userId}`,
        source: 'forum_topic',
      })
    }

    return { id: topic.id }
  }

  // ─── 查询-后台 ──────────────────────────────────────────────

  // 获取后台主题详情，包含发帖用户、板块、审核人与成长信息。
  async getTopicById(id: number): Promise<AdminForumTopicDetailDto> {
    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
      with: {
        section: true,
        user: {
          with: {
            counts: true,
            level: true,
          },
        },
      },
    })

    if (!topic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    const [hashtags, auditorSummary] = await Promise.all([
      this.getTopicHashtags(topic.id),
      this.getTopicAuditorSummary({
        auditById: topic.auditById,
        auditRole: topic.auditRole as AuditRoleEnum | null,
      }),
    ])

    let points = 0
    if (topic.user) {
      const growth = await this.growthBalanceQueryService.getUserGrowthSnapshot(
        topic.userId,
      )
      points = growth.points
    }

    return {
      id: topic.id,
      sectionId: topic.sectionId,
      userId: topic.userId,
      title: topic.title,
      html: topic.html,
      images: topic.images ?? [],
      videos: (topic.videos ??
        []) as unknown as AdminForumTopicDetailDto['videos'],
      isPinned: topic.isPinned,
      isFeatured: topic.isFeatured,
      isLocked: topic.isLocked,
      isHidden: topic.isHidden,
      auditStatus: topic.auditStatus,
      auditReason: topic.auditReason,
      auditAt: topic.auditAt,
      viewCount: topic.viewCount,
      likeCount: topic.likeCount,
      commentCount: topic.commentCount,
      favoriteCount: topic.favoriteCount,
      version: topic.version,
      sensitiveWordHits: topic.sensitiveWordHits as AdminForumTopicDetailDto['sensitiveWordHits'],
      lastCommentAt: topic.lastCommentAt,
      lastCommentUserId: topic.lastCommentUserId,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
      hashtags,
      section: topic.section
        ? {
            id: topic.section.id,
            name: topic.section.name,
            description: topic.section.description,
            icon: topic.section.icon,
            cover: topic.section.cover,
            isEnabled: topic.section.isEnabled,
            topicReviewPolicy: topic.section.topicReviewPolicy,
          }
        : undefined,
      user: topic.user
        ? {
            id: topic.user.id,
            nickname: topic.user.nickname,
            avatarUrl: topic.user.avatarUrl,
            signature: topic.user.signature,
            bio: topic.user.bio,
            isEnabled: topic.user.isEnabled,
            points,
            levelId: topic.user.levelId,
            status: topic.user.status,
            banReason: topic.user.banReason,
            banUntil: topic.user.banUntil,
            counts: topic.user.counts
              ? {
                  commentCount: topic.user.counts.commentCount,
                  likeCount: topic.user.counts.likeCount,
                  favoriteCount: topic.user.counts.favoriteCount,
                  forumTopicCount: topic.user.counts.forumTopicCount,
                  commentReceivedLikeCount:
                    topic.user.counts.commentReceivedLikeCount,
                  forumTopicReceivedLikeCount:
                    topic.user.counts.forumTopicReceivedLikeCount,
                  forumTopicReceivedFavoriteCount:
                    topic.user.counts.forumTopicReceivedFavoriteCount,
                }
              : undefined,
            level: topic.user.level
              ? {
                  id: topic.user.level.id,
                  name: topic.user.level.name,
                  icon: topic.user.level.icon,
                  sortOrder: topic.user.level.sortOrder,
                }
              : undefined,
          }
        : undefined,
      auditorSummary,
    } as AdminForumTopicDetailDto
  }

  // 获取对公开访问可见的主题详情；只返回已审核通过且未隐藏的主题，同时校验板块访问权限。
  private async getVisiblePublicTopic(id: number, userId?: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
      },
      with: {
        section: {
          columns: {
            id: true,
            groupId: true,
            deletedAt: true,
            isEnabled: true,
            name: true,
            cover: true,
            topicCount: true,
            followersCount: true,
          },
          with: {
            group: {
              columns: {
                isEnabled: true,
                deletedAt: true,
              },
            },
          },
        },
        user: {
          columns: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        },
      },
    })

    if (!topic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    await this.forumPermissionService.ensureUserCanAccessSection(
      topic.sectionId,
      userId,
      {
        requireEnabled: true,
        notFoundMessage: '主题不存在',
      },
    )

    if (!topic.user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题作者不存在',
      )
    }
    if (!topic.section) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    return topic
  }

  // 构建公开主题详情响应；显式裁剪 app/public 可见字段，避免把审核、治理等后台字段直接透传到外部契约。
  private async buildPublicTopicDetail(
    topic: Awaited<ReturnType<ForumTopicService['getVisiblePublicTopic']>>,
    interaction: {
      liked: boolean
      favorited: boolean
      isFollowed: boolean
      viewCount: number
    },
  ): Promise<PublicForumTopicDetailDto> {
    if (!topic.user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题作者不存在',
      )
    }
    if (!topic.section) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    return {
      id: topic.id,
      sectionId: topic.sectionId,
      userId: topic.userId,
      title: topic.title,
      html: topic.html,
      geoCountry: topic.geoCountry,
      geoProvince: topic.geoProvince,
      geoCity: topic.geoCity,
      geoIsp: topic.geoIsp,
      images: topic.images,
      videos: topic.videos as JsonValue,
      isPinned: topic.isPinned,
      isFeatured: topic.isFeatured,
      isLocked: topic.isLocked,
      viewCount: interaction.viewCount,
      commentCount: topic.commentCount,
      likeCount: topic.likeCount,
      favoriteCount: topic.favoriteCount,
      lastCommentAt: topic.lastCommentAt,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
      liked: interaction.liked,
      favorited: interaction.favorited,
      user: {
        id: topic.user.id,
        nickname: topic.user.nickname,
        avatarUrl: topic.user.avatarUrl,
        isFollowed: interaction.isFollowed,
      },
      section: {
        id: topic.section.id,
        name: topic.section.name,
        cover: topic.section.cover,
        topicCount: topic.section.topicCount,
        followersCount: topic.section.followersCount,
      },
      hashtags: await this.getTopicHashtags(topic.id),
    }
  }

  // 获取公开主题详情，包含当前用户的点赞、收藏与关注发帖用户状态；匿名用户返回固定状态保持响应结构稳定。
  async getPublicTopicById(
    id: number,
    context: PublicForumTopicDetailContext = {},
  ): Promise<PublicForumTopicDetailDto> {
    const { userId, ipAddress, device } = context
    const topic = await this.getVisiblePublicTopic(id, userId)

    if (!userId) {
      return this.buildPublicTopicDetail(topic, {
        liked: false,
        favorited: false,
        isFollowed: false,
        viewCount: topic.viewCount,
      })
    }

    const [liked, favorited, isFollowed] = await Promise.all([
      this.likeService.checkLikeStatus({
        targetType: LikeTargetTypeEnum.FORUM_TOPIC,
        targetId: id,
        userId,
      }),
      this.favoriteService.checkFavoriteStatus({
        targetType: FavoriteTargetTypeEnum.FORUM_TOPIC,
        targetId: id,
        userId,
      }),
      userId === topic.userId
        ? Promise.resolve(false)
        : this.followService
            .checkFollowStatus({
              targetType: FollowTargetTypeEnum.USER,
              targetId: topic.userId,
              userId,
            })
            .then((result) => result.isFollowing),
    ])

    await this.browseLogService.recordBrowseLogSafely(
      BrowseLogTargetTypeEnum.FORUM_TOPIC,
      id,
      userId,
      ipAddress,
      device,
      undefined,
      {
        skipTargetValidation: true,
        deferPostProcess: true,
      },
    )

    return this.buildPublicTopicDetail(topic, {
      liked,
      favorited,
      isFollowed,
      viewCount: topic.viewCount,
    })
  }

  // 获取主题的评论目标信息，用于评论服务定位评论对象；会先校验主题是否对当前用户可见。
  async getTopicCommentTarget(id: number, userId?: number) {
    await this.getVisiblePublicTopic(id, userId)
    return {
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: id,
    }
  }

  // 获取后台主题分页列表；后台列表仅返回展示所需字段和正文摘要，避免分页接口直接传输完整正文。
  async getTopics(queryForumTopicDto: QueryForumTopicDto) {
    const { keyword, sectionId, userId, ...otherDto } = queryForumTopicDto
    const conditions: SQL[] = [isNull(this.forumTopicTable.deletedAt)]

    if (sectionId !== undefined) {
      conditions.push(eq(this.forumTopicTable.sectionId, sectionId))
    }
    if (userId !== undefined) {
      conditions.push(eq(this.forumTopicTable.userId, userId))
    }
    if (otherDto.isPinned !== undefined) {
      conditions.push(eq(this.forumTopicTable.isPinned, otherDto.isPinned))
    }
    if (otherDto.isFeatured !== undefined) {
      conditions.push(eq(this.forumTopicTable.isFeatured, otherDto.isFeatured))
    }
    if (otherDto.isLocked !== undefined) {
      conditions.push(eq(this.forumTopicTable.isLocked, otherDto.isLocked))
    }
    if (otherDto.isHidden !== undefined) {
      conditions.push(eq(this.forumTopicTable.isHidden, otherDto.isHidden))
    }
    if (otherDto.auditStatus !== undefined) {
      conditions.push(
        eq(this.forumTopicTable.auditStatus, otherDto.auditStatus),
      )
    }
    if (keyword) {
      const keywordLike = buildLikePattern(keyword)!
      conditions.push(
        or(
          ilike(this.forumTopicTable.title, keywordLike),
          ilike(this.forumTopicTable.content, keywordLike),
        )!,
      )
    }

    const where = and(...conditions)
    const page = this.drizzle.buildPage({
      pageIndex: otherDto.pageIndex,
      pageSize: otherDto.pageSize,
    })
    const order = this.drizzle.buildOrderBy(otherDto.orderBy, {
      table: this.forumTopicTable,
    })

    const listQuery = this.db
      .select({
        id: this.forumTopicTable.id,
        sectionId: this.forumTopicTable.sectionId,
        userId: this.forumTopicTable.userId,
        title: this.forumTopicTable.title,
        contentPreview: this.forumTopicTable.contentPreview,
        geoCountry: this.forumTopicTable.geoCountry,
        geoProvince: this.forumTopicTable.geoProvince,
        geoCity: this.forumTopicTable.geoCity,
        geoIsp: this.forumTopicTable.geoIsp,
        images: this.forumTopicTable.images,
        videos: this.forumTopicTable.videos,
        isPinned: this.forumTopicTable.isPinned,
        isFeatured: this.forumTopicTable.isFeatured,
        isLocked: this.forumTopicTable.isLocked,
        isHidden: this.forumTopicTable.isHidden,
        auditStatus: this.forumTopicTable.auditStatus,
        auditReason: this.forumTopicTable.auditReason,
        auditAt: this.forumTopicTable.auditAt,
        viewCount: this.forumTopicTable.viewCount,
        likeCount: this.forumTopicTable.likeCount,
        commentCount: this.forumTopicTable.commentCount,
        favoriteCount: this.forumTopicTable.favoriteCount,
        lastCommentAt: this.forumTopicTable.lastCommentAt,
        lastCommentUserId: this.forumTopicTable.lastCommentUserId,
        createdAt: this.forumTopicTable.createdAt,
        updatedAt: this.forumTopicTable.updatedAt,
      })
      .from(this.forumTopicTable)
      .where(where)
      .limit(page.limit)
      .offset(page.offset)

    const [list, total] = await Promise.all([
      order.orderBySql.length > 0
        ? listQuery.orderBy(...order.orderBySql)
        : listQuery,
      this.db.$count(this.forumTopicTable, where),
    ])

    return {
      list: await this.hydrateAdminTopicPageItems(list),
      total,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  // 获取公开主题分页列表；只返回已审核通过且未隐藏的主题，登录用户返回点赞与收藏状态。
  async getPublicTopics(query: QueryPublicForumTopicDto & { userId?: number }) {
    const sectionIds = await this.resolvePublicTopicSectionIds(
      query.sectionId,
      query.userId,
    )

    return this.getPublicTopicPageByConditions(
      query,
      sectionIds,
      DEFAULT_PUBLIC_TOPIC_FEED_ORDER,
    )
  }

  // 获取公开主题热门分页列表；基于可访问板块聚合，排序规则为评论数、点赞数、浏览数、发布时间倒序。
  async getHotPublicTopics(
    query: QueryPublicForumTopicDto & { userId?: number },
  ) {
    const sectionIds = await this.resolvePublicTopicSectionIds(
      query.sectionId,
      query.userId,
    )

    return this.getPublicTopicPageByConditions(
      query,
      sectionIds,
      HOT_PUBLIC_TOPIC_FEED_ORDER,
    )
  }

  // 获取关注主题分页列表；聚合“关注用户发帖”与“关注板块下主题”两类来源，仅返回当前用户仍可访问板块下的公开主题。
  async getFollowingPublicTopics(
    query: QueryPublicForumTopicDto & {
      userId: number
    },
  ) {
    const sectionIds = await this.resolvePublicTopicSectionIds(
      query.sectionId,
      query.userId,
    )
    if (sectionIds.length === 0) {
      return this.getPublicTopicPageByConditions(
        query,
        [],
        DEFAULT_PUBLIC_TOPIC_FEED_ORDER,
      )
    }

    const { followingUserIds, followingSectionIds, followingHashtagIds } =
      await this.getFollowingFeedTargetIds(query.userId)
    const visibleSectionIds = new Set(sectionIds)
    const followedVisibleSectionIds = followingSectionIds.filter((id) =>
      visibleSectionIds.has(id),
    )
    const followedHashtagTopicIds = await this.getVisibleTopicIdsByHashtagIds(
      followingHashtagIds,
      [...visibleSectionIds],
    )
    const followConditions: SQL[] = []

    if (followingUserIds.length > 0) {
      followConditions.push(
        inArray(this.forumTopicTable.userId, followingUserIds),
      )
    }
    if (followedVisibleSectionIds.length > 0) {
      followConditions.push(
        inArray(this.forumTopicTable.sectionId, followedVisibleSectionIds),
      )
    }
    if (followedHashtagTopicIds.length > 0) {
      followConditions.push(
        inArray(this.forumTopicTable.id, followedHashtagTopicIds),
      )
    }

    if (followConditions.length === 0) {
      return this.getPublicTopicPageByConditions(
        query,
        [],
        DEFAULT_PUBLIC_TOPIC_FEED_ORDER,
      )
    }

    return this.getPublicTopicPageByConditions(
      query,
      sectionIds,
      DEFAULT_PUBLIC_TOPIC_FEED_ORDER,
      followConditions.length === 1
        ? followConditions[0]
        : or(...followConditions),
    )
  }

  // 批量获取收藏列表所需的公开主题分页项详情；复用主题分页的字段语义，并补充当前用户的点赞/收藏状态与发帖用户简要信息。
  async batchGetFavoriteTopicDetails(targetIds: number[], userId?: number) {
    if (targetIds.length === 0) {
      return new Map<number, unknown>()
    }

    const topics = await this.db
      .select(this.buildPublicTopicPageSelect())
      .from(this.forumTopicTable)
      .where(
        and(
          inArray(this.forumTopicTable.id, [...new Set(targetIds)]),
          eq(this.forumTopicTable.auditStatus, AuditStatusEnum.APPROVED),
          eq(this.forumTopicTable.isHidden, false),
          isNull(this.forumTopicTable.deletedAt),
        ),
      )

    const sectionIds = topics.map((topic) => topic.sectionId)
    const userIds = topics.map((topic) => topic.userId)
    const [sectionMap, userMap] = await Promise.all([
      this.getTopicSectionBriefMap(sectionIds, {
        requireEnabled: true,
      }),
      this.getTopicUserBriefMap(userIds),
    ])
    const visibleTopics = topics.filter((topic) =>
      sectionMap.has(topic.sectionId),
    )

    if (visibleTopics.length === 0) {
      return new Map()
    }

    let likedMap = new Map<number, boolean>()
    let favoritedMap = new Map<number, boolean>()
    if (userId) {
      const visibleTopicIds = visibleTopics.map((topic) => topic.id)
      ;[likedMap, favoritedMap] = await Promise.all([
        this.likeService.checkStatusBatch(
          LikeTargetTypeEnum.FORUM_TOPIC,
          visibleTopicIds,
          userId,
        ),
        this.favoriteService.checkStatusBatch(
          FavoriteTargetTypeEnum.FORUM_TOPIC,
          visibleTopicIds,
          userId,
        ),
      ])
    }

    return new Map(
      visibleTopics.map((topic) => [
        topic.id,
        {
          id: topic.id,
          sectionId: topic.sectionId,
          userId: topic.userId,
          title: topic.title,
          contentPreview: topic.contentPreview,
          geoCountry: topic.geoCountry,
          geoProvince: topic.geoProvince,
          geoCity: topic.geoCity,
          geoIsp: topic.geoIsp,
          images: topic.images,
          videos: topic.videos,
          isPinned: topic.isPinned,
          isFeatured: topic.isFeatured,
          isLocked: topic.isLocked,
          viewCount: topic.viewCount,
          commentCount: topic.commentCount,
          likeCount: topic.likeCount,
          favoriteCount: topic.favoriteCount,
          lastCommentAt: topic.lastCommentAt,
          createdAt: topic.createdAt,
          liked: likedMap.get(topic.id) ?? false,
          favorited: favoritedMap.get(topic.id) ?? false,
          section: sectionMap.get(topic.sectionId),
          user: userMap.get(topic.userId),
        },
      ]),
    )
  }

  // ─── 写入-编辑 ──────────────────────────────────────────────

  // 更新论坛主题内容；锁定主题不允许编辑，编辑时会重新检测敏感词并重新计算审核状态，板块可见状态在事务中同步更新。
  private async updateTopicWithCurrent(
    topic: ForumTopicSelect,
    updateForumTopicDto: UpdateForumTopicDto,
    context: ForumTopicClientContext = {},
    actorUserId = topic.userId,
  ) {
    const {
      id,
      images,
      videos,
      title: nextTitleInput,
      html,
    } = updateForumTopicDto

    if (topic.isLocked) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '主题已锁定，无法编辑',
      )
    }

    const reviewPolicy = await this.getSectionTopicReviewPolicy(
      topic.sectionId,
      {
        notFoundMessage: '主题所属板块不存在',
      },
    )

    const media = this.normalizeTopicMedia(
      { images, videos },
      {
        images: topic.images,
        videos: topic.videos,
      },
    )

    const updatedTopic = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const compiledBody = await this.materializeTopicBodyInTx(
          tx,
          {
            html,
          },
          actorUserId,
        )
        const nextTitle = this.resolveUpdateTopicTitle(
          topic.title,
          nextTitleInput,
        )
        const nextContent = compiledBody.plainText
        const { hits, publicHits, highestLevel } =
          this.detectTopicSensitiveWords(nextTitle, nextContent)
        const { auditStatus, isHidden } = this.calculateAuditStatus(
          reviewPolicy,
          highestLevel,
        )
        const updatePayload = {
          title: nextTitle,
          html: compiledBody.html,
          content: compiledBody.plainText,
          body: compiledBody.body as unknown as JsonValue,
          contentPreview: compiledBody.contentPreview as unknown as JsonValue,
          ...media,
          bodyVersion: BODY_VERSION_V1,
          auditStatus,
          sensitiveWordHits: publicHits.length ? publicHits : null,
          isHidden,
        }
        const [nextTopic] = await tx
          .update(this.forumTopicTable)
          .set(updatePayload)
          .where(
            and(
              eq(this.forumTopicTable.id, id),
              isNull(this.forumTopicTable.deletedAt),
            ),
          )
          .returning()
        if (!nextTopic) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '主题不存在',
          )
        }

        await this.sensitiveWordStatisticsService.recordEntityHitsInTx(tx, {
          entityType: 'topic',
          entityId: nextTopic.id,
          operationType: 'update',
          hits,
          occurredAt: nextTopic.updatedAt ?? new Date(),
        })

        await this.mentionService.replaceMentionsInTx({
          tx,
          sourceType: MentionSourceTypeEnum.FORUM_TOPIC,
          sourceId: nextTopic.id,
          content: compiledBody.plainText,
          mentions: compiledBody.mentionFacts,
        })
        await this.emojiCatalogService.recordRecentUsageInTx(tx, {
          userId: actorUserId,
          scene: EmojiSceneEnum.FORUM,
          items: compiledBody.emojiRecentUsageItems,
        })
        await this.forumHashtagReferenceService.replaceReferencesInTx({
          tx,
          sourceType: ForumHashtagReferenceSourceTypeEnum.TOPIC,
          sourceId: nextTopic.id,
          topicId: nextTopic.id,
          sectionId: topic.sectionId,
          userId: nextTopic.userId,
          sourceAuditStatus: nextTopic.auditStatus as AuditStatusEnum,
          sourceIsHidden: nextTopic.isHidden,
          isSourceVisible: this.isTopicVisible({
            auditStatus: nextTopic.auditStatus as AuditStatusEnum,
            isHidden: nextTopic.isHidden,
            deletedAt: nextTopic.deletedAt,
          }),
          hashtagFacts: compiledBody.hashtagFacts,
        })

        await this.forumCounterService.syncSectionVisibleState(
          tx,
          topic.sectionId,
        )
        await this.forumHashtagReferenceService.syncCommentVisibilityByTopicInTx(
          tx,
          nextTopic.id,
          this.isTopicVisible({
            auditStatus: nextTopic.auditStatus as AuditStatusEnum,
            isHidden: nextTopic.isHidden,
            deletedAt: nextTopic.deletedAt,
          }),
        )

        if (
          this.isTopicVisible({
            auditStatus: nextTopic.auditStatus as AuditStatusEnum,
            isHidden: nextTopic.isHidden,
            deletedAt: nextTopic.deletedAt,
          })
        ) {
          await this.mentionService.dispatchTopicMentionsInTx(tx, {
            topicId: nextTopic.id,
            actorUserId,
            topicTitle: nextTopic.title,
          })
        }

        return nextTopic
      }),
    )

    await this.actionLogService.createActionLog({
      userId: topic.userId,
      actionType: ForumUserActionTypeEnum.UPDATE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId: id,
      beforeData: JSON.stringify(topic),
      afterData: JSON.stringify(updatedTopic),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      geoCountry: context.geoCountry,
      geoProvince: context.geoProvince,
      geoCity: context.geoCity,
      geoIsp: context.geoIsp,
      geoSource: context.geoSource,
    })

    return true
  }

  // 更新论坛主题内容；获取当前主题快照后委托 updateTopicWithCurrent 执行。
  async updateTopic(
    updateForumTopicDto: UpdateForumTopicDto,
    context: ForumTopicClientContext = {},
    actorUserId?: number,
  ) {
    const topic = await this.getActiveTopicOrThrow(updateForumTopicDto.id)
    return this.updateTopicWithCurrent(
      topic,
      updateForumTopicDto,
      context,
      actorUserId ?? topic.userId,
    )
  }

  // ─── 写入-删除 ──────────────────────────────────────────────

  // 删除论坛主题（软删除）；同时软删除该主题下的所有评论，在同一事务中回退相关计数，同步更新板块可见状态。
  private async deleteTopicWithCurrent(
    topic: ForumTopicSelect,
    context: ForumTopicClientContext = {},
    actorUserId = topic.userId,
  ) {
    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        await this.deleteTopicWithCurrentInTx(tx, topic, context, actorUserId)
      }),
    )

    return true
  }

  // 在事务内执行主题软删除及关联清理；回退计数、同步板块状态并记录操作日志。
  async deleteTopicWithCurrentInTx(
    tx: Db,
    topic: ForumTopicSelect,
    context: ForumTopicClientContext = {},
    actorUserId = topic.userId,
  ) {
    const { id } = topic
    const commentRows = await tx.query.userComment.findMany({
      where: {
        targetType: CommentTargetTypeEnum.FORUM_TOPIC,
        targetId: id,
        deletedAt: { isNull: true },
      },
      columns: { id: true, userId: true, likeCount: true },
    })

    await tx
      .update(this.userCommentTable)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(
            this.userCommentTable.targetType,
            CommentTargetTypeEnum.FORUM_TOPIC,
          ),
          eq(this.userCommentTable.targetId, id),
          isNull(this.userCommentTable.deletedAt),
        ),
      )

    const result = await tx
      .update(this.forumTopicTable)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(this.forumTopicTable.id, id),
          isNull(this.forumTopicTable.deletedAt),
        ),
      )
    this.drizzle.assertAffectedRows(result, '主题不存在')

    await this.mentionService.deleteMentionsInTx({
      tx,
      sourceType: MentionSourceTypeEnum.FORUM_TOPIC,
      sourceIds: [id],
    })
    await this.forumHashtagReferenceService.deleteReferencesInTx({
      tx,
      sourceType: ForumHashtagReferenceSourceTypeEnum.TOPIC,
      sourceIds: [id],
    })
    await this.mentionService.deleteMentionsInTx({
      tx,
      sourceType: MentionSourceTypeEnum.COMMENT,
      sourceIds: commentRows.map((item) => item.id),
    })
    await this.forumHashtagReferenceService.deleteReferencesInTx({
      tx,
      sourceType: ForumHashtagReferenceSourceTypeEnum.COMMENT,
      sourceIds: commentRows.map((item) => item.id),
    })

    await this.forumCounterService.updateUserForumTopicCount(
      tx,
      topic.userId,
      -1,
    )

    if (topic.likeCount > 0) {
      await this.forumCounterService.updateUserForumTopicReceivedLikeCount(
        tx,
        topic.userId,
        -topic.likeCount,
      )
    }
    if (topic.favoriteCount > 0) {
      await this.forumCounterService.updateUserForumTopicReceivedFavoriteCount(
        tx,
        topic.userId,
        -topic.favoriteCount,
      )
    }

    const commentCountByUser = new Map<number, number>()
    const commentReceivedLikeCountByUser = new Map<number, number>()
    for (const comment of commentRows) {
      commentCountByUser.set(
        comment.userId,
        (commentCountByUser.get(comment.userId) ?? 0) + 1,
      )
      if (comment.likeCount > 0) {
        const nextReceivedLikeCount =
          (commentReceivedLikeCountByUser.get(comment.userId) ?? 0) +
          comment.likeCount
        commentReceivedLikeCountByUser.set(
          comment.userId,
          nextReceivedLikeCount,
        )
      }
    }

    const commentCountTasks: Promise<void>[] = []
    for (const [userId, count] of commentCountByUser.entries()) {
      commentCountTasks.push(
        this.appUserCountService.updateCommentCount(tx, userId, -count),
      )
    }

    for (const [
      userId,
      likeCount,
    ] of commentReceivedLikeCountByUser.entries()) {
      commentCountTasks.push(
        this.appUserCountService.updateCommentReceivedLikeCount(
          tx,
          userId,
          -likeCount,
        ),
      )
    }

    await Promise.all(commentCountTasks)
    await this.forumCounterService.syncSectionVisibleState(tx, topic.sectionId)
    await this.actionLogService.createActionLogInTx(tx, {
      userId: actorUserId,
      actionType: ForumUserActionTypeEnum.DELETE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId: topic.id,
      beforeData: JSON.stringify(topic),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      geoCountry: context.geoCountry,
      geoProvince: context.geoProvince,
      geoCity: context.geoCity,
      geoIsp: context.geoIsp,
      geoSource: context.geoSource,
    })

    return true
  }

  // 删除论坛主题；获取当前主题快照后委托 deleteTopicWithCurrent 执行。
  async deleteTopic(
    id: number,
    context: ForumTopicClientContext = {},
    actorUserId?: number,
  ) {
    const topic = await this.getActiveTopicOrThrow(id)
    return this.deleteTopicWithCurrent(
      topic,
      context,
      actorUserId ?? topic.userId,
    )
  }

  // ─── 写入-状态变更 ───────────────────────────────────────────

  // 移动主题到新的板块；会同时重建来源板块与目标板块的可见主题统计，避免聚合口径漂移。
  async moveTopic(input: MoveForumTopicDto) {
    const currentTopic = await this.db.query.forumTopic.findFirst({
      where: {
        id: input.id,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        sectionId: true,
      },
    })

    if (!currentTopic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    if (currentTopic.sectionId === input.sectionId) {
      return true
    }

    await this.getSectionTopicReviewPolicy(input.sectionId, {
      requireEnabled: true,
      notFoundMessage: '目标板块不存在或已禁用',
    })

    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        await this.moveTopicInTx(tx, input, currentTopic.sectionId)
      }),
    )

    return true
  }

  // 在事务内移动主题到新板块并同步板块统计。
  async moveTopicInTx(
    tx: Db,
    input: MoveForumTopicDto,
    currentSectionId?: number,
  ) {
    const sourceSectionId =
      currentSectionId ??
      (
        await tx.query.forumTopic.findFirst({
          where: {
            id: input.id,
            deletedAt: { isNull: true },
          },
          columns: {
            sectionId: true,
          },
        })
      )?.sectionId

    if (!sourceSectionId) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    if (sourceSectionId === input.sectionId) {
      return true
    }

    await this.getSectionTopicReviewPolicy(input.sectionId, {
      client: tx,
      requireEnabled: true,
      notFoundMessage: '目标板块不存在或已禁用',
    })

    const result = await tx
      .update(this.forumTopicTable)
      .set({
        sectionId: input.sectionId,
      })
      .where(
        and(
          eq(this.forumTopicTable.id, input.id),
          eq(this.forumTopicTable.sectionId, sourceSectionId),
          isNull(this.forumTopicTable.deletedAt),
        ),
      )
    this.drizzle.assertAffectedRows(result, '主题不存在')

    await this.forumHashtagReferenceService.syncSectionIdsByTopicInTx(
      tx,
      input.id,
      input.sectionId,
    )

    await Promise.all([
      this.forumCounterService.syncSectionVisibleState(tx, sourceSectionId),
      this.forumCounterService.syncSectionVisibleState(tx, input.sectionId),
    ])

    return true
  }

  // 主题状态更新通用方法；统一处理存在性校验、事务包装与板块可见状态同步。
  private async updateTopicStatus(
    id: number,
    updateData: Record<string, unknown>,
    options?: {
      syncSectionVisibility?: boolean
    },
  ) {
    const currentTopic = await this.db.query.forumTopic.findFirst({
      where: { id, deletedAt: { isNull: true } },
      columns: { sectionId: true },
    })

    if (!currentTopic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    return this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) =>
        this.updateTopicStatusInTx(
          tx,
          id,
          updateData,
          options,
          currentTopic.sectionId,
        ),
      ),
    )
  }

  // 在事务内执行主题状态更新；支持可选的板块可见状态同步。
  async updateTopicStatusInTx(
    tx: Db,
    id: number,
    updateData: Record<string, unknown>,
    options?: {
      syncSectionVisibility?: boolean
    },
    sectionId?: number,
  ) {
    const currentSectionId =
      sectionId ??
      (
        await tx.query.forumTopic.findFirst({
          where: { id, deletedAt: { isNull: true } },
          columns: { sectionId: true },
        })
      )?.sectionId

    if (!currentSectionId) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    const result = await tx
      .update(this.forumTopicTable)
      .set(updateData)
      .where(
        and(
          eq(this.forumTopicTable.id, id),
          isNull(this.forumTopicTable.deletedAt),
        ),
      )
    this.drizzle.assertAffectedRows(result, '主题不存在')

    if (options?.syncSectionVisibility) {
      await this.forumCounterService.syncSectionVisibleState(
        tx,
        currentSectionId,
      )
    }

    return true
  }

  // 更新主题置顶状态。
  async updateTopicPinned(updateTopicPinnedDto: UpdateForumTopicPinnedDto) {
    return this.updateTopicStatus(updateTopicPinnedDto.id, {
      isPinned: updateTopicPinnedDto.isPinned,
    })
  }

  // 在事务内更新主题置顶状态。
  async updateTopicPinnedInTx(
    tx: Db,
    updateTopicPinnedDto: UpdateForumTopicPinnedDto,
  ) {
    return this.updateTopicStatusInTx(tx, updateTopicPinnedDto.id, {
      isPinned: updateTopicPinnedDto.isPinned,
    })
  }

  // 更新主题精华状态。
  async updateTopicFeatured(
    updateTopicFeaturedDto: UpdateForumTopicFeaturedDto,
  ) {
    return this.updateTopicStatus(updateTopicFeaturedDto.id, {
      isFeatured: updateTopicFeaturedDto.isFeatured,
    })
  }

  // 在事务内更新主题精华状态。
  async updateTopicFeaturedInTx(
    tx: Db,
    updateTopicFeaturedDto: UpdateForumTopicFeaturedDto,
  ) {
    return this.updateTopicStatusInTx(tx, updateTopicFeaturedDto.id, {
      isFeatured: updateTopicFeaturedDto.isFeatured,
    })
  }

  // 更新主题锁定状态。
  async updateTopicLocked(updateTopicLockedDto: UpdateForumTopicLockedDto) {
    return this.updateTopicStatus(updateTopicLockedDto.id, {
      isLocked: updateTopicLockedDto.isLocked,
    })
  }

  // 在事务内更新主题锁定状态。
  async updateTopicLockedInTx(
    tx: Db,
    updateTopicLockedDto: UpdateForumTopicLockedDto,
  ) {
    return this.updateTopicStatusInTx(tx, updateTopicLockedDto.id, {
      isLocked: updateTopicLockedDto.isLocked,
    })
  }

  // 更新主题隐藏状态；隐藏状态变更会影响板块可见主题统计，需同步更新板块状态。
  async updateTopicHidden(updateTopicHiddenDto: UpdateForumTopicHiddenDto) {
    const currentTopic = await this.db.query.forumTopic.findFirst({
      where: {
        id: updateTopicHiddenDto.id,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        sectionId: true,
        userId: true,
        title: true,
        auditStatus: true,
        isHidden: true,
      },
    })

    if (!currentTopic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) =>
        this.updateTopicHiddenInTx(tx, updateTopicHiddenDto, currentTopic),
      ),
    )

    return true
  }

  // 在事务内更新主题隐藏状态；同步更新 hashtag 引用可见性与 mention 补偿。
  async updateTopicHiddenInTx(
    tx: Db,
    updateTopicHiddenDto: UpdateForumTopicHiddenDto,
    currentTopic?: Pick<
      ForumTopicSelect,
      'auditStatus' | 'id' | 'isHidden' | 'sectionId' | 'title' | 'userId'
    >,
  ) {
    const topic =
      currentTopic ??
      (await tx.query.forumTopic.findFirst({
        where: {
          id: updateTopicHiddenDto.id,
          deletedAt: { isNull: true },
        },
        columns: {
          id: true,
          sectionId: true,
          userId: true,
          title: true,
          auditStatus: true,
          isHidden: true,
        },
      }))

    if (!topic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    const result = await tx
      .update(this.forumTopicTable)
      .set({
        isHidden: updateTopicHiddenDto.isHidden,
      })
      .where(
        and(
          eq(this.forumTopicTable.id, updateTopicHiddenDto.id),
          isNull(this.forumTopicTable.deletedAt),
        ),
      )
    this.drizzle.assertAffectedRows(result, '主题不存在')

    await this.forumCounterService.syncSectionVisibleState(tx, topic.sectionId)
    await this.forumHashtagReferenceService.syncSourceVisibilityInTx({
      tx,
      sourceType: ForumHashtagReferenceSourceTypeEnum.TOPIC,
      sourceId: topic.id,
      sourceAuditStatus: topic.auditStatus as AuditStatusEnum,
      sourceIsHidden: updateTopicHiddenDto.isHidden,
      isSourceVisible: this.isTopicVisible({
        auditStatus: topic.auditStatus as AuditStatusEnum,
        isHidden: updateTopicHiddenDto.isHidden,
        deletedAt: null,
      }),
    })
    await this.forumHashtagReferenceService.syncCommentVisibilityByTopicInTx(
      tx,
      topic.id,
      this.isTopicVisible({
        auditStatus: topic.auditStatus as AuditStatusEnum,
        isHidden: updateTopicHiddenDto.isHidden,
        deletedAt: null,
      }),
    )
    await this.syncTopicMentionVisibilityTransitionInTx(tx, {
      topicId: topic.id,
      actorUserId: topic.userId,
      topicTitle: topic.title,
      currentAuditStatus: topic.auditStatus as AuditStatusEnum,
      currentIsHidden: topic.isHidden,
      nextAuditStatus: topic.auditStatus as AuditStatusEnum,
      nextIsHidden: updateTopicHiddenDto.isHidden,
    })

    return true
  }

  // 在主题首次审核通过后补发创建主题奖励；复用创建时的 bizKey 避免“即时发奖”和“审核补发”双发。
  private async dispatchApprovedTopicRewardIfNeeded(params: {
    topicId: number
    userId: number
    previousAuditStatus: AuditStatusEnum
    nextAuditStatus: AuditStatusEnum
  }) {
    if (
      params.previousAuditStatus !== AuditStatusEnum.PENDING ||
      params.nextAuditStatus !== AuditStatusEnum.APPROVED
    ) {
      return
    }

    const topicApprovedEvent = this.buildCreateTopicEventEnvelope({
      topicId: params.topicId,
      userId: params.userId,
      auditStatus: params.nextAuditStatus,
      context: {
        previousAuditStatus: params.previousAuditStatus,
        nextAuditStatus: params.nextAuditStatus,
      },
    })

    if (
      !canConsumeEventEnvelopeByConsumer(
        topicApprovedEvent,
        EventDefinitionConsumerEnum.GROWTH,
      )
    ) {
      return
    }

    await this.growthEventBridgeService.dispatchDefinedEvent({
      eventEnvelope: topicApprovedEvent,
      bizKey: `forum:topic:create:${params.topicId}:user:${params.userId}`,
      source: 'forum_topic',
    })
  }

  // 更新主题审核状态；审核状态变更会影响板块可见主题统计，需同步更新板块状态。
  async updateTopicAuditStatus(
    updateTopicAuditStatusDto: UpdateForumTopicAuditStatusDto,
    options?: {
      auditById?: number
      auditRole?: AuditRoleEnum
    },
  ) {
    const { id, auditStatus } = updateTopicAuditStatusDto
    const currentTopic = await this.db.query.forumTopic.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        sectionId: true,
        userId: true,
        title: true,
        auditStatus: true,
        isHidden: true,
      },
    })

    if (!currentTopic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) =>
        this.updateTopicAuditStatusInTx(
          tx,
          updateTopicAuditStatusDto,
          options,
          currentTopic,
        ),
      ),
    )

    await this.dispatchApprovedTopicRewardIfNeeded({
      topicId: currentTopic.id,
      userId: currentTopic.userId,
      previousAuditStatus: currentTopic.auditStatus as AuditStatusEnum,
      nextAuditStatus: auditStatus,
    })

    return true
  }

  // 在事务内更新主题审核状态；同步更新 hashtag 引用可见性与 mention 补偿。
  async updateTopicAuditStatusInTx(
    tx: Db,
    updateTopicAuditStatusDto: UpdateForumTopicAuditStatusDto,
    options?: {
      auditById?: number
      auditRole?: AuditRoleEnum
    },
    currentTopic?: Pick<
      ForumTopicSelect,
      'auditStatus' | 'id' | 'isHidden' | 'sectionId' | 'title' | 'userId'
    >,
  ) {
    const { id, auditStatus, auditReason } = updateTopicAuditStatusDto
    const topic =
      currentTopic ??
      (await tx.query.forumTopic.findFirst({
        where: {
          id,
          deletedAt: { isNull: true },
        },
        columns: {
          id: true,
          sectionId: true,
          userId: true,
          title: true,
          auditStatus: true,
          isHidden: true,
        },
      }))

    if (!topic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    const result = await tx
      .update(this.forumTopicTable)
      .set({
        auditStatus,
        auditReason,
        auditById: options?.auditById ?? null,
        auditRole: options?.auditRole ?? null,
        auditAt: new Date(),
      })
      .where(
        and(
          eq(this.forumTopicTable.id, id),
          isNull(this.forumTopicTable.deletedAt),
        ),
      )
    this.drizzle.assertAffectedRows(result, '主题不存在')

    await this.forumCounterService.syncSectionVisibleState(tx, topic.sectionId)
    await this.forumHashtagReferenceService.syncSourceVisibilityInTx({
      tx,
      sourceType: ForumHashtagReferenceSourceTypeEnum.TOPIC,
      sourceId: topic.id,
      sourceAuditStatus: auditStatus,
      sourceIsHidden: topic.isHidden,
      isSourceVisible: this.isTopicVisible({
        auditStatus,
        isHidden: topic.isHidden,
        deletedAt: null,
      }),
    })
    await this.forumHashtagReferenceService.syncCommentVisibilityByTopicInTx(
      tx,
      topic.id,
      this.isTopicVisible({
        auditStatus,
        isHidden: topic.isHidden,
        deletedAt: null,
      }),
    )
    await this.syncTopicMentionVisibilityTransitionInTx(tx, {
      topicId: topic.id,
      actorUserId: topic.userId,
      topicTitle: topic.title,
      currentAuditStatus: topic.auditStatus as AuditStatusEnum,
      currentIsHidden: topic.isHidden,
      nextAuditStatus: auditStatus,
      nextIsHidden: topic.isHidden,
    })

    return true
  }

  // 补发审核通过主题的奖励；委托 dispatchApprovedTopicRewardIfNeeded 执行。
  async rewardApprovedTopicIfNeeded(params: {
    topicId: number
    userId: number
    previousAuditStatus: AuditStatusEnum
    nextAuditStatus: AuditStatusEnum
  }) {
    await this.dispatchApprovedTopicRewardIfNeeded(params)
  }

  // 用户编辑自己的主题；校验主题所有权后调用通用更新方法。
  async updateUserTopic(
    userId: number,
    input: UpdateForumTopicDto,
    context: ForumTopicClientContext = {},
  ) {
    const topic = await this.getActiveTopicOrThrow(input.id)

    if (topic.userId !== userId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '无权修改该主题',
      )
    }

    return this.updateTopicWithCurrent(topic, input, context, userId)
  }

  // 用户删除自己的主题；校验主题所有权后调用通用删除方法。
  async deleteUserTopic(
    userId: number,
    id: number,
    context: ForumTopicClientContext = {},
  ) {
    const topic = await this.getActiveTopicOrThrow(id)

    if (topic.userId !== userId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '无权删除该主题',
      )
    }

    return this.deleteTopicWithCurrent(topic, context, userId)
  }
}
