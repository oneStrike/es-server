import type { ForumTopic } from '@db/schema'
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
import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import { UserGrowthRewardService } from '@libs/growth/growth-reward'
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
import { and, eq, ilike, isNull, or } from 'drizzle-orm'
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
  FORUM_TOPIC_MEDIA_URL_MAX_LENGTH,
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
    private readonly userGrowthRewardService: UserGrowthRewardService,
    private readonly sensitiveWordDetectService: SensitiveWordDetectService,
    private readonly browseLogService: BrowseLogService,
    private readonly forumCounterService: ForumCounterService,
    private readonly appUserCountService: AppUserCountService,
    private readonly actionLogService: ForumUserActionLogService,
    private readonly forumPermissionService: ForumPermissionService,
    private readonly likeService: LikeService,
    private readonly favoriteService: FavoriteService,
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
      if (normalizedItem.length > FORUM_TOPIC_MEDIA_URL_MAX_LENGTH) {
        throw new BadRequestException(
          `${options.label}地址长度不能超过 ${FORUM_TOPIC_MEDIA_URL_MAX_LENGTH} 个字符`,
        )
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
    fallback: Pick<ForumTopic, 'images' | 'videos'> = {
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

    if (topic.auditStatus !== AuditStatusEnum.PENDING) {
      await this.userGrowthRewardService.tryRewardByRule({
        userId,
        ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
        bizKey: `forum:topic:create:${topic.id}:user:${userId}`,
        source: 'forum_topic',
        remark: `create forum topic #${topic.id}`,
        targetId: topic.id,
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
   * 获取公开主题详情，包含当前用户的点赞与收藏状态。
   * 匿名用户返回固定的 liked/favorited 为 false，保持响应结构稳定。
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
        liked: false,
        favorited: false,
      }
    }

    const [liked, favorited] = await Promise.all([
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

    return this.drizzle.ext.findPagination(this.forumTopicTable, {
      where,
      ...otherDto,
    })
  }

  /**
   * 获取公开主题分页列表。
   * - 只返回已审核通过且未隐藏的主题
   * - 排序规则：置顶优先，其次按最后评论时间倒序，再按创建时间倒序
   * - 会校验用户对板块的访问权限
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

    const page = await this.drizzle.ext.findPagination(this.forumTopicTable, {
      where: and(
        eq(this.forumTopicTable.sectionId, query.sectionId),
        isNull(this.forumTopicTable.deletedAt),
        eq(this.forumTopicTable.auditStatus, AuditStatusEnum.APPROVED),
        eq(this.forumTopicTable.isHidden, false),
      ),
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      orderBy: [
        { isPinned: 'desc' },
        { lastCommentAt: 'desc' },
        { createdAt: 'desc' },
      ],
      pick: [
        'id',
        'sectionId',
        'userId',
        'title',
        'images',
        'videos',
        'isPinned',
        'isFeatured',
        'isLocked',
        'viewCount',
        'commentCount',
        'likeCount',
        'favoriteCount',
        'lastCommentAt',
        'createdAt',
      ],
    })

    if (!query.userId || page.list.length === 0) {
      return {
        ...page,
        list: page.list.map((item) => ({
          ...item,
          liked: false,
          favorited: false,
        })),
      }
    }

    const topicIds = page.list.map((item) => item.id)
    const [likedMap, favoritedMap] = await Promise.all([
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

    const topics = await this.db.query.forumTopic.findMany({
      where: {
        id: { in: targetIds },
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        sectionId: true,
        userId: true,
        title: true,
        images: true,
        videos: true,
        isPinned: true,
        isFeatured: true,
        isLocked: true,
        viewCount: true,
        commentCount: true,
        likeCount: true,
        favoriteCount: true,
        lastCommentAt: true,
        createdAt: true,
      },
      with: {
        section: {
          columns: {
            isEnabled: true,
            deletedAt: true,
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

    const visibleTopics = topics.filter(
      (topic) => topic.section && !topic.section.deletedAt && topic.section.isEnabled,
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
          user: topic.user ?? undefined,
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
    topic: ForumTopic,
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
  private async deleteTopicWithCurrent(topic: ForumTopic) {
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
   * 更新主题审核状态。
   * 审核状态变更会影响板块可见主题统计，需同步更新板块状态。
   */
  async updateTopicAuditStatus(
    updateTopicAuditStatusDto: UpdateForumTopicAuditStatusInput,
  ) {
    const { id, auditStatus, auditReason } = updateTopicAuditStatusDto
    return this.updateTopicStatus(
      id,
      {
        auditStatus,
        auditReason,
      },
      {
        syncSectionVisibility: true,
      },
    )
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
