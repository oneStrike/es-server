import type { ForumTopicSelect } from '@db/schema'
import type { CompiledBodyResult } from '@libs/interaction/body/body.type'
import type { GeoSnapshot } from '@libs/platform/modules/geo/geo.types'
import type { MaterializedForumHashtagFact } from '../hashtag/forum-hashtag.type'

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
  contentSnippet: string
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
  hashtagFacts: MaterializedForumHashtagFact[]
}
