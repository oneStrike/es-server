import type { ForumSearchSortTypeEnum, ForumSearchTypeEnum } from './search.constant'

/**
 * 论坛搜索的领域输入。
 * 支持主题、评论及混合检索。
 */
export interface ForumSearchInput {
  keyword: string
  type?: ForumSearchTypeEnum
  sectionId?: number
  tagId?: number
  sort?: ForumSearchSortTypeEnum
  pageIndex?: number
  pageSize?: number
}

/**
 * 论坛搜索统一结果项。
 * topic/comment 结果统一映射为同一结构，方便 app/admin 复用。
 */
export interface ForumSearchResultItem {
  resultType: ForumSearchTypeEnum
  topicId: number
  topicTitle: string
  topicContentSnippet?: string
  sectionId: number
  sectionName: string
  userId: number
  userNickname: string
  userAvatarUrl?: string
  commentId?: number
  commentContentSnippet?: string
  createdAt: Date
  commentCount: number
  viewCount: number
  likeCount: number
  favoriteCount: number
}

/**
 * 论坛搜索分页结果。
 */
export interface ForumSearchPageResult {
  list: ForumSearchResultItem[]
  total: number
  pageIndex: number
  pageSize: number
}
