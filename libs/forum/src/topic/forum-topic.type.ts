import type { Db } from '@db/core'
import type { ForumSectionSelect, ForumTopicSelect } from '@db/schema'
import type { CompiledBodyResult } from '@libs/interaction/body/body.type'
import type { CommentTargetHookPayload } from '@libs/interaction/comment/interfaces/comment-target-resolver.type'
import type { AuditRoleEnum, AuditStatusEnum } from '@libs/platform/constant'
import type { GeoSnapshot } from '@libs/platform/modules/geo/geo.type'
import type { MaterializedForumHashtagFact } from '../hashtag/forum-hashtag.type'
import type { QueryPublicForumTopicDto } from './dto/forum-topic.dto'
import type { ForumTopicContentPreviewSegmentTypeEnum } from './forum-topic.constant'

interface TextPreviewSegment {
  type: ForumTopicContentPreviewSegmentTypeEnum.TEXT
  text: string
}

interface MentionPreviewSegment {
  type: ForumTopicContentPreviewSegmentTypeEnum.MENTION
  text: string
  userId: number
  nickname: string
}

interface HashtagPreviewSegment {
  type: ForumTopicContentPreviewSegmentTypeEnum.HASHTAG
  text: string
  hashtagId: number
  slug: string
  displayName: string
}

interface EmojiPreviewSegment {
  type: ForumTopicContentPreviewSegmentTypeEnum.EMOJI
  text: string
  kind: 1 | 2
  emojiAssetId?: number
  unicodeSequence?: string
  shortcode?: string
}

/**
 * 论坛主题列表预览片段。
 * text 仅展示；mention/hashtag/emoji 由前端按目标字段生成可交互或可渲染片段。
 */
export type ForumTopicContentPreviewSegment =
  | TextPreviewSegment
  | MentionPreviewSegment
  | HashtagPreviewSegment
  | EmojiPreviewSegment

/**
 * 论坛主题列表预览。
 * 由 canonical body 派生并物化，列表接口直接读取该 JSON。
 */
export interface ForumTopicContentPreview {
  plainText: string
  segments: ForumTopicContentPreviewSegment[]
}

/**
 * 构建论坛主题列表预览的配置。
 */
export interface BuildForumTopicContentPreviewOptions {
  maxLength?: number
  maxSegments?: number
}

/**
 * 论坛主题媒体输入。
 * 图片仍使用字符串数组，视频改为原样 JSON 值；controller 可按需省略字段。
 */
export type ForumTopicMediaInput = Partial<
  Pick<ForumTopicSelect, 'images' | 'videos'>
>

/**
 * 论坛主题链路使用的客户端上下文。
 * 统一收口属地、IP 与 UA 信息，供写路径和日志复用。
 */
export interface ForumTopicClientContext extends GeoSnapshot {
  ipAddress?: string
  userAgent?: string
  device?: string
}

/**
 * 公开主题详情加载上下文。
 * 在客户端上下文上补充当前查看者 ID。
 */
export interface PublicForumTopicDetailContext extends ForumTopicClientContext {
  userId?: number
}

/**
 * 评论 resolver 获取主题快照时使用的可见性约束。
 */
export interface ForumTopicCommentTargetSnapshotOptions {
  requirePublicVisible: boolean
}

/**
 * 评论创建 hook 中需要带正文快照的主题评论载荷。
 */
export type ForumTopicCommentHookPayload = CommentTargetHookPayload &
  Required<Pick<CommentTargetHookPayload, 'content'>>

/**
 * 公开主题分页查询在 service 内补充当前用户上下文后的输入。
 */
export type PublicForumTopicQueryWithUser = QueryPublicForumTopicDto & {
  userId?: number
}

/**
 * 关注主题 feed 查询需要登录用户 ID。
 */
export type FollowingPublicForumTopicQuery = QueryPublicForumTopicDto & {
  userId: number
}

/**
 * 公开主题分页查询结果行。
 * 供公开分页查询与 hydrate 阶段共享同一行结构。
 */
export type PublicTopicPageRow = Pick<
  ForumTopicSelect,
  | 'id'
  | 'sectionId'
  | 'userId'
  | 'title'
  | 'geoCountry'
  | 'geoProvince'
  | 'geoCity'
  | 'geoIsp'
  | 'images'
  | 'videos'
  | 'isPinned'
  | 'isFeatured'
  | 'isLocked'
  | 'viewCount'
  | 'commentCount'
  | 'likeCount'
  | 'favoriteCount'
  | 'lastCommentAt'
  | 'createdAt'
> & {
  contentPreview: ForumTopicContentPreview
}

/**
 * 后台主题分页查询结果行。
 * 与后台分页 DTO 的基础主题字段保持一致；userId 仅用于 hydrate 用户摘要，不返回给客户端。
 */
export type AdminTopicPageRow = Pick<
  ForumTopicSelect,
  | 'id'
  | 'sectionId'
  | 'userId'
  | 'title'
  | 'isPinned'
  | 'isFeatured'
  | 'isLocked'
  | 'isHidden'
  | 'auditStatus'
  | 'likeCount'
  | 'commentCount'
  | 'createdAt'
  | 'deletedAt'
>

/**
 * 公开主题分页 hydrate 阶段使用的用户与板块上下文。
 */
export interface HydratePublicTopicPageOptions {
  userId?: number
  sectionId?: number
}

/**
 * 公开主题详情当前访问者的交互快照。
 */
export interface PublicTopicInteractionSnapshot {
  liked: boolean
  favorited: boolean
  isFollowed: boolean
  viewCount: number
}

/**
 * 公开主题详情关系查询返回的内部行结构。
 */
export type VisiblePublicTopicDetailRow = Pick<
  ForumTopicSelect,
  | 'id'
  | 'sectionId'
  | 'userId'
  | 'title'
  | 'html'
  | 'images'
  | 'videos'
  | 'isPinned'
  | 'isFeatured'
  | 'isLocked'
  | 'geoCountry'
  | 'geoProvince'
  | 'geoCity'
  | 'geoIsp'
  | 'viewCount'
  | 'likeCount'
  | 'commentCount'
  | 'favoriteCount'
  | 'lastCommentAt'
  | 'createdAt'
  | 'updatedAt'
> & {
  section: {
    id: number
    groupId: number | null
    deletedAt: Date | null
    isEnabled: boolean
    name: string
    cover: string
    topicCount: number
    followersCount: number
    group: {
      isEnabled: boolean
      deletedAt: Date | null
    } | null
  } | null
  user: {
    id: number
    nickname: string
    avatarUrl: string | null
  } | null
}

/**
 * 批量关联查询前收集到的可选 ID 候选列表。
 */
export type ForumTopicRelationIdCandidates = Array<number | null | undefined>

/**
 * 获取板块审核策略时的可见性与事务选项。
 */
export interface ForumTopicReviewPolicyOptions {
  requireEnabled?: boolean
  notFoundMessage?: string
  client?: Db
}

/**
 * 主题列表展示所需的板块简要信息。
 * 统一 getTopicSectionBrief / getTopicSectionBriefMap 的返回值类型。
 */
export type TopicSectionBrief = Pick<
  ForumSectionSelect,
  'id' | 'name' | 'icon' | 'cover'
>

/**
 * 批量获取主题板块简要信息时的可见性过滤选项。
 */
export type ForumTopicSectionBriefMapOptions = Pick<
  ForumTopicReviewPolicyOptions,
  'requireEnabled'
>

/**
 * 主题可见性判断需要的最小状态快照。
 */
export interface ForumTopicVisibleState {
  auditStatus: AuditStatusEnum
  isHidden: boolean
  deletedAt?: Date | null
}

/**
 * 创建主题事件 envelope 所需的最小上下文。
 */
export interface CreateTopicEventParams {
  topicId: number
  userId: number
  auditStatus: AuditStatusEnum
  occurredAt?: Date
  context?: Record<string, unknown>
}

/**
 * 主题 mention 可见性跃迁同步所需的前后状态。
 */
export interface TopicMentionVisibilityTransitionParams {
  topicId: number
  actorUserId: number
  topicTitle: string
  currentAuditStatus: AuditStatusEnum
  currentIsHidden: boolean
  nextAuditStatus: AuditStatusEnum
  nextIsHidden: boolean
}

/**
 * 主题图片列表归一化的限制与回退值。
 */
export interface NormalizeImageListOptions {
  label: string
  maxCount: number
  fallback: string[]
}

/**
 * 主题视频 JSON 值归一化的回退值。
 */
export interface NormalizeVideoValueOptions {
  fallback: ForumTopicSelect['videos']
}

/**
 * 主题媒体字段更新时使用的当前持久化回退值。
 */
export type ForumTopicMediaFallback = Pick<
  ForumTopicSelect,
  'images' | 'videos'
>

/**
 * 主题状态更新时用于事务内同步附属状态的选项。
 */
export interface UpdateTopicStatusOptions {
  syncSectionVisibility?: boolean
}

/**
 * 主题普通布尔状态更新载荷；隐藏与审核状态有额外副作用，必须走专用方法。
 */
export type UpdateTopicStatusData = Partial<
  Pick<ForumTopicSelect, 'isPinned' | 'isFeatured' | 'isLocked'>
>

/**
 * 主题审核操作者信息。
 */
export interface TopicAuditActorOptions {
  auditById?: number
  auditRole?: AuditRoleEnum
}

/**
 * 主题治理操作复用的当前主题最小快照。
 */
export type TopicGovernanceSnapshot = Pick<
  ForumTopicSelect,
  'auditStatus' | 'id' | 'isHidden' | 'sectionId' | 'title' | 'userId'
>

/**
 * 主题写路径在加锁前持有的身份快照。
 * 后续事务必须基于 `id` 重新读取当前事实，调用方不可据此承载持久化全行。
 */
export type TopicMutationSnapshot = Pick<ForumTopicSelect, 'id' | 'userId'>

/**
 * 内容更新入口在加锁前需要的主题状态快照。
 */
export type TopicUpdateCurrentSnapshot = TopicMutationSnapshot &
  Pick<ForumTopicSelect, 'isLocked'>

/**
 * 事务内主题内容更新完成后可传给扩展回调的最小状态快照。
 */
export type TopicUpdatedSnapshot = Pick<
  ForumTopicSelect,
  | 'id'
  | 'sectionId'
  | 'userId'
  | 'title'
  | 'auditStatus'
  | 'isHidden'
  | 'deletedAt'
  | 'updatedAt'
>

/**
 * 锁定主题状态切换时用于同步板块可见性的最小快照。
 */
export type TopicSectionSnapshot = Pick<ForumTopicSelect, 'id' | 'sectionId'>

/**
 * 审核通过后补发主题奖励所需的状态跃迁。
 */
export interface ApprovedTopicRewardParams {
  topicId: number
  userId: number
  previousAuditStatus: AuditStatusEnum
  nextAuditStatus: AuditStatusEnum
}

/**
 * topic 正文写入字段。
 * - 对应 DTO 中的 HTML-only 正文合同。
 */
export interface TopicBodyWriteFields {
  html: string
}

/**
 * 主题正文解析结果。
 * - 统一承载 body compiler 的派生产物，供 create/update 共用。
 */
export interface TopicBodyWriteResult extends CompiledBodyResult {}

/**
 * 主题正文物化结果。
 * - 在 body compiler 结果上补充 hashtag 引用事实，供 topic 写路径统一复用。
 */
export interface MaterializedTopicBodyWriteResult extends TopicBodyWriteResult {
  html: string
  contentPreview: ForumTopicContentPreview
  hashtagFacts: MaterializedForumHashtagFact[]
}
