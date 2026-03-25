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
 * 论坛主题视频最大数量。
 * 控制视频附件规模，降低审核与列表渲染压力。
 */
export const FORUM_TOPIC_VIDEO_MAX_COUNT = 3
