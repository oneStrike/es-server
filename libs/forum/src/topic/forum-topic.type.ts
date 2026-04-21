import type { ForumTopicSelect } from '@db/schema'
import type { GeoSnapshot } from '@libs/platform/modules/geo/geo.types'

/**
 * 论坛主题媒体输入。
 * 图片仍使用字符串数组，视频改为原样 JSON 值；controller 可按需省略字段。
 */
/** 稳定领域类型 `ForumTopicMediaInput`。仅供内部领域/服务链路复用，避免重复定义。 */
export type ForumTopicMediaInput = Partial<
  Pick<ForumTopicSelect, 'images' | 'videos'>
>

/** 稳定领域类型 `ForumTopicClientContext`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface ForumTopicClientContext extends GeoSnapshot {
  ipAddress?: string
  userAgent?: string
  device?: string
}

/** 稳定领域类型 `PublicForumTopicDetailContext`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface PublicForumTopicDetailContext extends ForumTopicClientContext {
  userId?: number
}
