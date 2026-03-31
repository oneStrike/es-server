import type { AppUserSelect, ForumTopicSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  CreateForumTopicInput,
  ForumTopicMediaInput,
  PublicForumTopicDetailContext,
  QueryForumTopicInput,
  QueryPublicForumTopicInput,
  UpdateForumTopicAuditStatusInput,
  UpdateForumTopicFeaturedInput,
  UpdateForumTopicHiddenInput,
  UpdateForumTopicInput,
  UpdateForumTopicLockedInput,
  UpdateForumTopicPinnedInput,
} from './forum-topic.type'
import {
  DrizzleService,
  escapeLikePattern,
} from '@db/core'
import {
  canConsumeEventEnvelopeByConsumer,
  createDefinedEventEnvelope,
  EventDefinitionConsumerEnum,
  EventEnvelopeGovernanceStatusEnum,
} from '@libs/growth/event-definition'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import { GrowthEventBridgeService } from '@libs/growth/growth-reward'
import {
  BrowseLogService,
  BrowseLogTargetTypeEnum,
} from '@libs/interaction/browse-log'
import { CommentTargetTypeEnum } from '@libs/interaction/comment'
import { EmojiParserService, EmojiSceneEnum } from '@libs/interaction/emoji'
import {
  FavoriteService,
  FavoriteTargetTypeEnum,
} from '@libs/interaction/favorite'
import {
  FollowService,
  FollowTargetTypeEnum,
} from '@libs/interaction/follow'
import {
  LikeService,
  LikeTargetTypeEnum,
} from '@libs/interaction/like'
import { AuditStatusEnum } from '@libs/platform/constant'
import {
  SensitiveWordDetectService,
  SensitiveWordLevelEnum,
} from '@libs/sensitive-word'
import { AppUserCountService } from '@libs/user/core'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../action-log/action-log.constant'
import { ForumUserActionLogService } from '../action-log/action-log.service'
import { ForumCounterService } from '../counter/forum-counter.service'
import { ForumReviewPolicyEnum } from '../forum.constant'
import { ForumPermissionService } from '../permission'
import {
  FORUM_TOPIC_IMAGE_MAX_COUNT,
  FORUM_TOPIC_VIDEO_MAX_COUNT,
} from './forum-topic.constant'

/**
 * 论坛主题服务，负责主题的增删改查、审核、置顶、精华、锁定等核心业务。
 * 写操作统一记录操作日志，计数变更与主题状态同步在同一事务中完成。
 */
@Injectable()
export class ForumTopicService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly growthEventBridgeService: GrowthEventBridgeService,
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly browseLogService: BrowseLogService,
    private readonly forumCounterService: ForumCounterService,
    private readonly appUserCountService: AppUserCountService,
    private readonly actionLogService: ForumUserActionLogService,
    private readonly forumPermissionService: ForumPermissionService,
    private readonly likeService: LikeService,
    private readonly favoriteService: FavoriteService,
    private readonly followService: FollowService,
    private readonly emojiParserService: EmojiParserService,
  ) { }

  private get db() {
    return this.drizzle.db
  }

  get forumTopicTable() {
    return this.drizzle.schema.forumTopic
  }

  get userCommentTable() {
    return this.drizzle.schema.userComment
  }

  /**
   * 批量获取主题列表使用的发帖用户简要信息。
   * 仅查询列表展示所需字段，避免在公开分页中暴露额外资料。
   */
  private async getTopicUserBriefMap(userIds: number[]) {
    const uniqueUserIds = [...new Set(userIds)]
    if (uniqueUserIds.length === 0) {
      return new Map<number, Pick<AppUserSelect, 'id' | 'nickname' | 'avatarUrl'>>()
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

  /**
   * 获取主题列表使用的板块简要信息。
   * 仅返回列表展示所需字段，供公开分页等场景复用。
   */
  private async getTopicSectionBrief(sectionId: number) {
    return this.db.query.forumSection.findFirst({
      where: {
        id: sectionId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        name: true,
        icon: true,
        cover: true,
      },
    })
  }

  /**
   * 批量获取主题列表使用的板块简要信息。
   * 可按需限制为当前仍可见的板块，供收藏列表等需要剔除失效板块的场景复用。
   */
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

    const sections = await this.db.query.forumSection.findMany({
      where: {
        id: { in: uniqueSectionIds },
        deletedAt: { isNull: true },
        ...(options?.requireEnabled ? { isEnabled: true } : {}),
      },
      columns: {
        id: true,
        name: true,
        icon: true,
        cover: true,
      },
    })

    return new Map(sections.map((section) => [section.id, section]))
  }

  /**
   * 构建主题列表使用的正文摘要 SQL。
   * 直接在数据库侧截取前 60 个字符，避免列表查询搬运完整正文。
   */
  private buildTopicContentSnippetSql() {
    return sql<string>`left(trim(${this.forumTopicTable.content}), 60)`
  }

  /**
   * 规范化论坛主题媒体列表。
   * - 去除空白字符串
   * - 保留首个出现顺序并去重
   * - 统一校验单项长度与数量上限
   */
  private normalizeMediaList(
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
      throw new BadRequestException(
        `${options.label}最多支持 ${options.maxCount} 个`,
      )
    }

    return normalizedList
  }

  /**
   * 统一规范化论坛主题媒体输入。
   * 创建时补空数组，更新时对未传字段保留当前值。
   */
  private normalizeTopicMedia(
    media: ForumTopicMediaInput,
    fallback: Pick<ForumTopicSelect, 'images' | 'videos'> = {
      images: [],
      videos: [],
    },
  ) {
    return {
      images: this.normalizeMediaList(media.images, {
        label: '图片',
        maxCount: FORUM_TOPIC_IMAGE_MAX_COUNT,
        fallback: fallback.images,
      }),
      videos: this.normalizeMediaList(media.videos, {
        label: '视频',
        maxCount: FORUM_TOPIC_VIDEO_MAX_COUNT,
        fallback: fallback.videos,
      }),
    }
  }

  /**
   * 获取未删除的主题快照。
   * 供编辑、删除等需要复用主题当前状态的写路径共享使用。
   */
  private async getActiveTopicOrThrow(id: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: { id, deletedAt: { isNull: true } },
    })

    if (!topic) {
      throw new NotFoundException('主题不存在')
    }

    return topic
  }

  /**
   * 获取板块的主题审核策略。
   * 用于创建/编辑主题时决定是否需要进入审核队列。
   */
  private async getSectionTopicReviewPolicy(
    sectionId: number,
    options?: {
      requireEnabled?: boolean
      notFoundMessage?: string
    },
  ) {
    const section = await this.db.query.forumSection.findFirst({
      where: {
        id: sectionId,
        deletedAt: { isNull: true },
      },
      columns: {
        topicReviewPolicy: true,
        isEnabled: true,
      },
    })

    if (!section) {
      throw new BadRequestException(
        options?.notFoundMessage ?? '板块不存在或已禁用',
      )
    }

    if (options?.requireEnabled && !section.isEnabled) {
      throw new BadRequestException('板块不存在或已禁用')
    }

    return section.topicReviewPolicy as ForumReviewPolicyEnum
  }

  /**
   * 根据板块审核策略与敏感词等级计算主题的审核状态与隐藏状态。
   * - 严重敏感词一律隐藏
   * - 审核策略决定哪些敏感词等级需要进入审核队列
   */
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

  /**
   * 将主题审核状态映射为统一事件治理状态。
   * 当前 CREATE_TOPIC 事件是否可进入主链路，统一以该状态判断。
   */
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

  /**
   * 构建主题创建事件 envelope。
   * 统一沉淀 CREATE_TOPIC 的目标、治理态与最小上下文，供奖励补发等链路复用。
   */
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

  /**
   * 创建论坛主题。
   * - 敏感词检测与审核策略计算在写入前完成
   * - 计数更新与板块状态同步在同一事务中执行
   * - 审核通过时触发成长奖励事件
   * - 写入后记录操作日志
   */
  async createForumTopic(createTopicDto: CreateForumTopicInput) {
    const { sectionId, userId, images, videos, ...topicData } = createTopicDto

    const section = await this.forumPermissionService.ensureUserCanCreateTopic(
      userId,
      sectionId,
    )

    const { hits, highestLevel } =
      this.sensitiveWordDetectService.getMatchedWords({
        content: topicData.content + topicData.title,
      })

    const reviewPolicy = section.topicReviewPolicy as ForumReviewPolicyEnum

    const { auditStatus, isHidden } = this.calculateAuditStatus(
      reviewPolicy,
      highestLevel,
    )
    const bodyTokens = await this.emojiParserService.parse({
      body: topicData.content,
      scene: EmojiSceneEnum.FORUM,
    })

    const media = this.normalizeTopicMedia({ images, videos })

    const createPayload = {
      ...topicData,
      bodyTokens: bodyTokens.length ? bodyTokens : null,
      sectionId,
      userId,
      ...media,
      auditStatus,
      sensitiveWordHits: hits?.length ? hits : undefined,
      isHidden,
    }

    const topic = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const [newTopic] = await tx
          .insert(this.forumTopicTable)
          .values(createPayload)
          .returning()

        await this.forumCounterService.updateTopicRelatedCounts(
          tx,
          sectionId,
          userId,
          1,
        )
        await this.forumCounterService.syncSectionVisibleState(tx, sectionId)

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
        remark: `create forum topic #${topic.id}`,
      })
    }

    return true
  }

  async getTopicById(id: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
      with: {
        topicTags: true,
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
      throw new NotFoundException('主题不存在')
    }

    return topic
  }

  /**
   * 获取对公开访问可见的主题详情。
   * 只返回已审核通过且未隐藏的主题，同时校验板块访问权限。
   */
  private async getVisiblePublicTopic(id: number, userId?: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
      },
      with: {
        tags: {
          columns: {
            id: true,
            icon: true,
            name: true,
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
      throw new NotFoundException('主题不存在')
    }

    await this.forumPermissionService.ensureUserCanAccessSection(
      topic.sectionId,
      userId,
      {
        requireEnabled: true,
        notFoundMessage: '主题不存在',
      },
    )
    return topic
  }

  /**
   * 获取公开主题详情，包含当前用户的点赞、收藏与关注发帖用户状态。
   * 匿名用户返回固定状态（liked/favorited/isFollowed 为 false），保持响应结构稳定。
   */
  async getPublicTopicById(
    id: number,
    context: PublicForumTopicDetailContext = {},
  ) {
    const { userId, ipAddress, device } = context
    const topic = await this.getVisiblePublicTopic(id, userId)

    if (!userId) {
      return {
        ...topic,
        user: {
          ...topic.user,
          isFollowed: false,
        },
        liked: false,
        favorited: false,
      }
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
        : this.followService.checkFollowStatus({
            targetType: FollowTargetTypeEnum.USER,
            targetId: topic.userId,
            userId,
          }).then((result) => result.isFollowing),
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

    return {
      ...topic,
      user: {
        ...topic.user,
        isFollowed,
      },
      viewCount: topic.viewCount + 1,
      liked,
      favorited,
    }
  }

  /**
   * 获取主题的评论目标信息，用于评论服务定位评论对象。
   * 会先校验主题是否对当前用户可见。
   */
  async getTopicCommentTarget(id: number, userId?: number) {
    await this.getVisiblePublicTopic(id, userId)
    return {
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: id,
    }
  }

  /**
   * 获取后台主题分页列表。
   * 后台列表仅返回展示所需字段和正文摘要，避免分页接口直接传输完整正文。
   */
  async getTopics(queryForumTopicDto: QueryForumTopicInput) {
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
      conditions.push(eq(this.forumTopicTable.auditStatus, otherDto.auditStatus))
    }
    if (keyword) {
      conditions.push(
        or(
          ilike(
            this.forumTopicTable.title,
            `%${escapeLikePattern(keyword)}%`,
          ),
          ilike(
            this.forumTopicTable.content,
            `%${escapeLikePattern(keyword)}%`,
          ),
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
        contentSnippet: this.buildTopicContentSnippetSql(),
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
      list,
      total,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  /**
   * 获取公开主题分页列表。
   * - 只返回已审核通过且未隐藏的主题
   * - 排序规则：置顶优先，其次按最后评论时间倒序，再按创建时间倒序
   * - 会校验用户对板块的访问权限
   * - 会补充每条主题的发帖用户简要信息与所属板块简要信息
   * - 登录用户会返回每条主题的点赞与收藏状态
   */
  async getPublicTopics(query: QueryPublicForumTopicInput) {
    await this.forumPermissionService.ensureUserCanAccessSection(
      query.sectionId,
      query.userId,
      {
        requireEnabled: true,
      },
    )

    const where = and(
      eq(this.forumTopicTable.sectionId, query.sectionId),
      isNull(this.forumTopicTable.deletedAt),
      eq(this.forumTopicTable.auditStatus, AuditStatusEnum.APPROVED),
      eq(this.forumTopicTable.isHidden, false),
    )
    const pageQuery = this.drizzle.buildPage({
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
    })
    const order = this.drizzle.buildOrderBy(undefined, {
      table: this.forumTopicTable,
      fallbackOrderBy: [
        { isPinned: 'desc' },
        { lastCommentAt: 'desc' },
        { createdAt: 'desc' },
      ],
    })
    const listQuery = this.db
      .select({
        id: this.forumTopicTable.id,
        sectionId: this.forumTopicTable.sectionId,
        userId: this.forumTopicTable.userId,
        title: this.forumTopicTable.title,
        contentSnippet: this.buildTopicContentSnippetSql(),
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
      })
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
    const page = {
      list,
      total,
      pageIndex: pageQuery.pageIndex,
      pageSize: pageQuery.pageSize,
    }

    if (page.list.length === 0) {
      return page
    }

    const userIds = page.list.map((item) => item.userId)

    if (!query.userId) {
      const [section, userMap] = await Promise.all([
        this.getTopicSectionBrief(query.sectionId),
        this.getTopicUserBriefMap(userIds),
      ])
      return {
        ...page,
        list: page.list.map((item) => ({
          ...item,
          liked: false,
          favorited: false,
          user: userMap.get(item.userId),
          section,
        })),
      }
    }

    const topicIds = page.list.map((item) => item.id)
    const [section, userMap, likedMap, favoritedMap] = await Promise.all([
      this.getTopicSectionBrief(query.sectionId),
      this.getTopicUserBriefMap(userIds),
      this.likeService.checkStatusBatch(
        LikeTargetTypeEnum.FORUM_TOPIC,
        topicIds,
        query.userId,
      ),
      this.favoriteService.checkStatusBatch(
        FavoriteTargetTypeEnum.FORUM_TOPIC,
        topicIds,
        query.userId,
      ),
    ])

    return {
      ...page,
      list: page.list.map((item) => ({
        ...item,
        liked: likedMap.get(item.id) ?? false,
        favorited: favoritedMap.get(item.id) ?? false,
        user: userMap.get(item.userId),
        section,
      })),
    }
  }

  /**
   * 批量获取收藏列表所需的公开主题分页项详情。
   * 复用主题分页的字段语义，并补充当前用户的点赞/收藏状态与发帖用户简要信息。
   */
  async batchGetFavoriteTopicDetails(targetIds: number[], userId?: number) {
    if (targetIds.length === 0) {
      return new Map<number, unknown>()
    }

    const topics = await this.db
      .select({
        id: this.forumTopicTable.id,
        sectionId: this.forumTopicTable.sectionId,
        userId: this.forumTopicTable.userId,
        title: this.forumTopicTable.title,
        contentSnippet: this.buildTopicContentSnippetSql(),
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
      })
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
    const visibleTopics = topics.filter((topic) => sectionMap.has(topic.sectionId))

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
          contentSnippet: topic.contentSnippet,
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

  /**
   * 更新论坛主题内容。
   * - 锁定主题不允许编辑
   * - 编辑时会重新检测敏感词并重新计算审核状态
   * - 板块可见状态在事务中同步更新
   * - 记录编辑前后的差异日志
   */
  private async updateTopicWithCurrent(
    topic: ForumTopicSelect,
    updateForumTopicDto: UpdateForumTopicInput,
  ) {
    const { id, images, videos, ...updateData } = updateForumTopicDto

    if (topic.isLocked) {
      throw new BadRequestException('主题已锁定，无法编辑')
    }

    const reviewPolicy = await this.getSectionTopicReviewPolicy(
      topic.sectionId,
      {
        notFoundMessage: '主题所属板块不存在',
      },
    )

    const { hits, highestLevel } =
      this.sensitiveWordDetectService.getMatchedWords({
        content:
          (updateData.content || topic.content) +
          (updateData.title || topic.title),
      })

    const { auditStatus, isHidden } = this.calculateAuditStatus(
      reviewPolicy,
      highestLevel,
    )
    const nextContent = updateData.content || topic.content
    const bodyTokens = await this.emojiParserService.parse({
      body: nextContent,
      scene: EmojiSceneEnum.FORUM,
    })

    const media = this.normalizeTopicMedia(
      { images, videos },
      {
        images: topic.images,
        videos: topic.videos,
      },
    )

    const updatePayload = {
      ...updateData,
      ...media,
      bodyTokens: bodyTokens.length ? bodyTokens : null,
      auditStatus,
      sensitiveWordHits: hits?.length ? hits : null,
      isHidden,
    }

    const updatedTopic = await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
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
          throw new NotFoundException('主题不存在')
        }

        await this.forumCounterService.syncSectionVisibleState(
          tx,
          topic.sectionId,
        )
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
    })

    return true
  }

  async updateTopic(updateForumTopicDto: UpdateForumTopicInput) {
    const topic = await this.getActiveTopicOrThrow(updateForumTopicDto.id)
    return this.updateTopicWithCurrent(topic, updateForumTopicDto)
  }

  /**
   * 删除论坛主题（软删除）。
   * - 同时软删除该主题下的所有评论
   * - 在同一事务中回退相关计数：用户发帖数、评论数、点赞数、收藏数
   * - 同步更新板块可见状态
   * - 记录删除操作日志
   */
  private async deleteTopicWithCurrent(topic: ForumTopicSelect) {
    const { id } = topic
    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const commentRows = await tx.query.userComment.findMany({
          where: {
            targetType: CommentTargetTypeEnum.FORUM_TOPIC,
            targetId: id,
            deletedAt: { isNull: true },
          },
          columns: { userId: true, likeCount: true },
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

        await this.forumCounterService.updateTopicRelatedCounts(
          tx,
          topic.sectionId,
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
            commentReceivedLikeCountByUser.set(
              comment.userId,
              (commentReceivedLikeCountByUser.get(comment.userId) ?? 0) +
              comment.likeCount,
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

        await this.forumCounterService.syncSectionVisibleState(
          tx,
          topic.sectionId,
        )
      }),
    )

    await this.actionLogService.createActionLog({
      userId: topic.userId,
      actionType: ForumUserActionTypeEnum.DELETE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId: id,
      beforeData: JSON.stringify(topic),
    })

    return true
  }

  async deleteTopic(id: number) {
    const topic = await this.getActiveTopicOrThrow(id)
    return this.deleteTopicWithCurrent(topic)
  }

  /**
   * 主题状态更新通用方法。
   * 统一处理存在性校验、事务包装与板块可见状态同步。
   */
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
      throw new NotFoundException('主题不存在')
    }

    return this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
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
            currentTopic.sectionId,
          )
        }

        return true
      }),
    )
  }

  async updateTopicPinned(updateTopicPinnedDto: UpdateForumTopicPinnedInput) {
    return this.updateTopicStatus(updateTopicPinnedDto.id, {
      isPinned: updateTopicPinnedDto.isPinned,
    })
  }

  async updateTopicFeatured(
    updateTopicFeaturedDto: UpdateForumTopicFeaturedInput,
  ) {
    return this.updateTopicStatus(updateTopicFeaturedDto.id, {
      isFeatured: updateTopicFeaturedDto.isFeatured,
    })
  }

  async updateTopicLocked(updateTopicLockedDto: UpdateForumTopicLockedInput) {
    return this.updateTopicStatus(updateTopicLockedDto.id, {
      isLocked: updateTopicLockedDto.isLocked,
    })
  }

  /**
   * 更新主题隐藏状态。
   * 隐藏状态变更会影响板块可见主题统计，需同步更新板块状态。
   */
  async updateTopicHidden(updateTopicHiddenDto: UpdateForumTopicHiddenInput) {
    return this.updateTopicStatus(
      updateTopicHiddenDto.id,
      {
        isHidden: updateTopicHiddenDto.isHidden,
      },
      {
        syncSectionVisibility: true,
      },
    )
  }

  /**
   * 在主题首次审核通过后补发创建主题奖励。
   * 继续复用创建时的 bizKey，避免“即时发奖”和“审核补发”双发。
   */
  private async rewardApprovedTopicIfNeeded(params: {
    topicId: number
    userId: number
    previousAuditStatus: AuditStatusEnum
    nextAuditStatus: AuditStatusEnum
  }) {
    if (
      params.previousAuditStatus !== AuditStatusEnum.PENDING
      || params.nextAuditStatus !== AuditStatusEnum.APPROVED
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
      remark: `approve forum topic #${params.topicId}`,
    })
  }

  /**
   * 更新主题审核状态。
   * 审核状态变更会影响板块可见主题统计，需同步更新板块状态。
   */
  async updateTopicAuditStatus(
    updateTopicAuditStatusDto: UpdateForumTopicAuditStatusInput,
  ) {
    const { id, auditStatus, auditReason } = updateTopicAuditStatusDto
    const currentTopic = await this.db.query.forumTopic.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        sectionId: true,
        userId: true,
        auditStatus: true,
      },
    })

    if (!currentTopic) {
      throw new NotFoundException('主题不存在')
    }

    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        const result = await tx
          .update(this.forumTopicTable)
          .set({
            auditStatus,
            auditReason,
          })
          .where(
            and(
              eq(this.forumTopicTable.id, id),
              isNull(this.forumTopicTable.deletedAt),
            ),
          )
        this.drizzle.assertAffectedRows(result, '主题不存在')

        await this.forumCounterService.syncSectionVisibleState(
          tx,
          currentTopic.sectionId,
        )
      }),
    )

    await this.rewardApprovedTopicIfNeeded({
      topicId: currentTopic.id,
      userId: currentTopic.userId,
      previousAuditStatus: currentTopic.auditStatus as AuditStatusEnum,
      nextAuditStatus: auditStatus,
    })

    return true
  }

  /**
   * 用户编辑自己的主题。
   * 校验主题所有权后调用通用更新方法。
   */
  async updateUserTopic(userId: number, input: UpdateForumTopicInput) {
    const topic = await this.getActiveTopicOrThrow(input.id)

    if (topic.userId !== userId) {
      throw new BadRequestException('无权修改该主题')
    }

    return this.updateTopicWithCurrent(topic, input)
  }

  /**
   * 用户删除自己的主题。
   * 校验主题所有权后调用通用删除方法。
   */
  async deleteUserTopic(userId: number, id: number) {
    const topic = await this.getActiveTopicOrThrow(id)

    if (topic.userId !== userId) {
      throw new BadRequestException('无权删除该主题')
    }

    return this.deleteTopicWithCurrent(topic)
  }
}
