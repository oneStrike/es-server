/**
 * 论坛主题单条媒体地址最大长度。
 * 与仓库内常见上传 URL 长度约束保持一致。
 */
export const FORUM_TOPIC_MEDIA_URL_MAX_LENGTH = 500

/**
 * 论坛主题图片最大数量。
 * 沿用社区帖子常见的 9 图上限，兼顾展示体验与列表负载。
 */
export const FORUM_TOPIC_IMAGE_MAX_COUNT = 9

/**
 * 论坛主题列表预览最大字符数。
 * 与旧列表摘要展示长度保持一致，但输出改为结构化片段。
 */
export const FORUM_TOPIC_CONTENT_PREVIEW_MAX_LENGTH = 60

/**
 * 论坛主题列表预览最大片段数。
 * 控制 JSON 负载上限，避免富文本正文在列表接口放大。
 */
export const FORUM_TOPIC_CONTENT_PREVIEW_MAX_SEGMENTS = 30
