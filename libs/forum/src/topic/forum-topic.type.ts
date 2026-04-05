import type { ForumTopicSelect } from '@db/schema'

/**
 * 论坛主题媒体输入。
 * 使用有序附件列表承载图片与视频，controller 可按需省略字段。
 */
export type ForumTopicMediaInput = Partial<
  Pick<ForumTopicSelect, 'images' | 'videos'>
>

export interface PublicForumTopicDetailContext {
  userId?: number
  ipAddress?: string
  device?: string
}
