import type { AppUserCountSelect, userBadge } from '@db/schema'
import type {
  QueryMyForumTopicDto,
  QueryPublicUserForumTopicDto,
} from '../topic/dto/forum-topic.dto'

/**
 * profile 模块复用的用户计数快照。
 * 对齐 `app_user_count` 读模型，供资料聚合场景共享。
 */
export type ProfileUserCountRow = Pick<
  AppUserCountSelect,
  | 'userId'
  | 'commentCount'
  | 'likeCount'
  | 'favoriteCount'
  | 'followingUserCount'
  | 'followingAuthorCount'
  | 'followingSectionCount'
  | 'followingHashtagCount'
  | 'followersCount'
  | 'forumTopicCount'
  | 'commentReceivedLikeCount'
  | 'forumTopicReceivedLikeCount'
  | 'forumTopicReceivedFavoriteCount'
>

/**
 * profile 模块内部使用的成长快照。
 * 仅承载积分与经验余额，不承担 HTTP 文档职责。
 */
export interface ProfileGrowthSnapshot {
  points: number
  experience: number
}

/**
 * profile 资料页使用的用户徽章行。
 * 聚合 badge 指派时间与徽章快照，供列表/详情复用。
 */
export interface ProfileUserBadgeRow {
  createdAt: Date
  badge: typeof userBadge.$inferSelect
}

/**
 * profile 主题列表使用的板块简要信息。
 * 供公开主题页和我的主题页复用。
 */
export interface ProfileTopicSectionBrief {
  id: number
  name: string
  icon: string | null
  cover: string | null
}

/**
 * 公开用户主题页查询参数。
 * 仅承载分页与板块筛选，不在 service 层重复声明。
 */
export type PublicUserProfileTopicPageQuery = Pick<
  QueryPublicUserForumTopicDto,
  'sectionId' | 'pageIndex' | 'pageSize' | 'orderBy'
>

/**
 * 我的主题页查询参数。
 * 仅承载分页与板块筛选，不在 service 层重复声明。
 */
export type MyProfileTopicPageQuery = Pick<
  QueryMyForumTopicDto,
  'sectionId' | 'pageIndex' | 'pageSize' | 'orderBy'
>
