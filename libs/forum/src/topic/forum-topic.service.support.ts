import type { Db, DrizzleService } from '@db/core'
import type { AppUserSelect, ForumTopicSelect } from '@db/schema'

import type { GrowthBalanceQueryService } from '@libs/growth/growth-ledger/growth-balance-query.service'
import type { BodyCompilerService } from '@libs/interaction/body/body-compiler.service'

import type { BodyHtmlCodecService } from '@libs/interaction/body/body-html-codec.service'
import type { MentionService } from '@libs/interaction/mention/mention.service'
import type { InteractionSummaryReadService } from '@libs/interaction/summary/interaction-summary-read.service'
import type { InteractionAuditorSummaryKey } from '@libs/interaction/summary/interaction-summary.type'
import type { SensitiveWordDetectService } from '@libs/sensitive-word/sensitive-word-detect.service'
import type { ForumCounterService } from '../counter/forum-counter.service'
import type { ForumHashtagBodyService } from '../hashtag/forum-hashtag-body.service'
import type { ForumHashtagReferenceService } from '../hashtag/forum-hashtag-reference.service'
import type { ForumPermissionService } from '../permission/forum-permission.service'
import type { CreateForumTopicDto } from './dto/forum-topic.dto'
import type {
  AdminTopicPageRow,
  CreateTopicEventParams,
  ForumTopicMediaFallback,
  ForumTopicMediaInput,
  ForumTopicRelationIdCandidates,
  ForumTopicReviewPolicyOptions,
  ForumTopicSectionBriefMapOptions,
  ForumTopicVisibleState,
  MaterializedTopicBodyWriteResult,
  NormalizeImageListOptions,
  NormalizeVideoValueOptions,
  TopicBodyWriteFields,
  TopicMentionVisibilityTransitionParams,
} from './forum-topic.type'
import { createDefinedEventEnvelope } from '@libs/growth/event-definition/event-envelope.helper'
import { EventEnvelopeGovernanceStatusEnum } from '@libs/growth/event-definition/event-envelope.type'
import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant'
import { BodySceneEnum } from '@libs/interaction/body/body.constant'
import { AuditStatusEnum, BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import {
  ForumHashtagCreateSourceTypeEnum,
  ForumHashtagReferenceSourceTypeEnum,
} from '../hashtag/forum-hashtag.constant'
import { FORUM_SECTION_MUTATION_LOCK_NAMESPACE } from '../section/forum-section.constant'
import { buildForumTopicContentPreview } from './forum-topic-preview.helper'
import { FORUM_TOPIC_IMAGE_MAX_COUNT } from './forum-topic.constant'

// 论坛主题模块共享 support 基类。
// 统一收口底层表访问、权限校验、计数映射与通用 helper，
// 供 facade 拆分后的 query / command 子服务复用。
// 不注册为 NestJS provider；子类通过 super() 显式传递依赖。
export abstract class ForumTopicServiceSupport {
  constructor(
    protected readonly drizzle: DrizzleService,
    protected readonly forumPermissionService: ForumPermissionService,
    protected readonly forumCounterService: ForumCounterService,
    protected readonly forumHashtagReferenceService: ForumHashtagReferenceService,
    protected readonly mentionService: MentionService,
    protected readonly bodyCompilerService: BodyCompilerService,
    protected readonly bodyHtmlCodecService: BodyHtmlCodecService,
    protected readonly sensitiveWordDetectService: SensitiveWordDetectService,
    protected readonly forumHashtagBodyService: ForumHashtagBodyService,
    protected readonly interactionSummaryReadService: InteractionSummaryReadService,
    protected readonly growthBalanceQueryService: GrowthBalanceQueryService,
  ) {}

  protected get db() {
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
  protected uniquePositiveIds(ids: ForumTopicRelationIdCandidates) {
    return [...new Set(ids)].filter(
      (id): id is number => typeof id === 'number' && id > 0,
    )
  }

  // 串行化同一板块的删板块与发帖写路径，避免删除后仍写入新主题。
  protected async lockSectionForMutation(client: Db, sectionId: number) {
    await client.execute(
      sql`SELECT pg_advisory_xact_lock(${FORUM_SECTION_MUTATION_LOCK_NAMESPACE}, ${sectionId})`,
    )
  }

  protected async lockSectionsForMutation(
    client: Db,
    sectionIds: Array<number | null | undefined>,
  ) {
    const uniqueSectionIds = [
      ...new Set(sectionIds.filter(Boolean) as number[]),
    ].sort((left, right) => left - right)

    for (const sectionId of uniqueSectionIds) {
      await this.lockSectionForMutation(client, sectionId)
    }
  }

  // ─── 通用查询 ──────────────────────────────────────────────

  // 获取未删除的主题快照；供编辑、删除等需要复用主题当前状态的写路径共享使用。
  protected async getActiveTopicOrThrow(id: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
    })

    if (!topic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    return topic
  }

  // 在事务内获取未删除的主题快照；供 moderator-governance 等需要在已有事务中操作的场景使用。
  async getActiveTopicByIdInTx(tx: Db, id: number) {
    const topic = await tx.query.forumTopic.findFirst({
      where: {
        id,
        deletedAt: { isNull: true },
      },
    })

    if (!topic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    return topic
  }

  // 获取板块的主题审核策略；供创建和编辑时计算审核状态使用。
  protected async getSectionTopicReviewPolicy(
    sectionId: number,
    options?: ForumTopicReviewPolicyOptions,
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

    return section.topicReviewPolicy
  }

  // 批量获取主题列表使用的发帖用户简要信息；仅查询列表展示所需字段，避免在公开分页中暴露额外资料。
  protected async getTopicUserBriefMap(userIds: number[]) {
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
  protected async getTopicSectionBrief(sectionId: number) {
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
  protected async getTopicSectionBriefMap(
    sectionIds: number[],
    options?: ForumTopicSectionBriefMapOptions,
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
      visibleSections.map((section) => {
        const { groupId, deletedAt, isEnabled, group, ...brief } = section
        return [section.id, brief]
      }),
    )
  }

  // 批量获取后台主题列表所需的发帖用户摘要。
  protected async getAdminTopicUserSummaryMap(userIds: number[]) {
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
      users.map((user) => {
        const { level, ...rest } = user
        return [user.id, { ...rest, levelName: level?.name ?? null }]
      }),
    )
  }

  // 批量获取后台主题列表所需的板块摘要。
  protected async getAdminTopicSectionSummaryMap(sectionIds: number[]) {
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
      sections.map((section) => {
        const { group, ...rest } = section
        return [
          section.id,
          {
            ...rest,
            groupName: group && !group.deletedAt ? group.name : null,
          },
        ]
      }),
    )
  }

  // 为后台主题分页条目补齐发帖用户与所属板块摘要。
  protected async hydrateAdminTopicPageItems(items: AdminTopicPageRow[]) {
    if (items.length === 0) {
      return []
    }

    const [userSummaryMap, sectionSummaryMap] = await Promise.all([
      this.getAdminTopicUserSummaryMap(items.map((item) => item.userId)),
      this.getAdminTopicSectionSummaryMap(items.map((item) => item.sectionId)),
    ])

    return items.map((item) => ({
      ...item,
      auditReason: item.auditReason ?? null,
      auditAt: item.auditAt ?? null,
      lastCommentAt: item.lastCommentAt ?? null,
      lastCommentUserId: item.lastCommentUserId ?? null,
      userSummary: userSummaryMap.get(item.userId) ?? null,
      sectionSummary: sectionSummaryMap.get(item.sectionId) ?? null,
    }))
  }

  // 获取主题审核人展示摘要。
  protected async getTopicAuditorSummary(topic: InteractionAuditorSummaryKey) {
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
  protected async getTopicHashtags(topicId: number) {
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

  // ─── 纯计算 ────────────────────────────────────────────────

  // 为创建主题补齐标题；未传标题时优先从富文本正文提纯可读文本再截取前 30 个字符。
  protected resolveCreateTopicTitle(
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
  protected resolveUpdateTopicTitle(currentTitle: string, title?: string) {
    const normalizedTitle = title?.trim()
    if (normalizedTitle) {
      return normalizedTitle
    }

    return currentTitle
  }

  // 将主题审核状态映射为统一事件治理状态；CREATE_TOPIC 事件是否可进入主链路统一以该状态判断。
  protected resolveTopicGovernanceStatus(auditStatus: AuditStatusEnum) {
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

  // 判断主题当前是否对外可见；mention 仅在真正可见时发送，避免待审核/隐藏内容提前触达接收人。
  protected isTopicVisible(topic: ForumTopicVisibleState) {
    return (
      topic.auditStatus === AuditStatusEnum.APPROVED &&
      !topic.isHidden &&
      topic.deletedAt == null
    )
  }

  // 构建主题创建事件 envelope；统一沉淀 CREATE_TOPIC 的目标、治理态与最小上下文，供奖励补发等链路复用。
  protected buildCreateTopicEventEnvelope(params: CreateTopicEventParams) {
    return createDefinedEventEnvelope({
      code: GrowthRuleTypeEnum.CREATE_TOPIC,
      subjectId: params.userId,
      targetId: params.topicId,
      occurredAt: params.occurredAt,
      governanceStatus: this.resolveTopicGovernanceStatus(params.auditStatus),
      context: params.context,
    })
  }

  // 在事务内同步主题 mention 可见性跃迁；当主题从不可见变为可见时补发 mention 通知。
  protected async syncTopicMentionVisibilityTransitionInTx(
    tx: Db,
    params: TopicMentionVisibilityTransitionParams,
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

  // ─── 正文编译 ──────────────────────────────────────────────

  // 在事务内将 topic DTO 的双模输入物化为带 hashtag 事实的 canonical body 编译结果。
  protected async materializeTopicBodyInTx(
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

  // ─── 媒体归一化 ────────────────────────────────────────────

  // 规范化论坛主题图片列表；去除空白、保留首现顺序去重、校验数量上限。
  protected normalizeImageList(
    value: string[] | null | undefined,
    options: NormalizeImageListOptions,
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
  protected normalizeVideoValue(
    value: ForumTopicSelect['videos'] | null | undefined,
    options: NormalizeVideoValueOptions,
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
  protected normalizeTopicMedia(
    media: ForumTopicMediaInput,
    fallback: ForumTopicMediaFallback = {
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
}
