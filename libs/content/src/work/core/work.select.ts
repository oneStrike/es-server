/**
 * 作品查询字段选择配置
 * 用于统一作品列表返回的字段结构，包含作者、分类、标签等关联信息
 */

/**
 * 作品列表查询的字段选择配置
 * 用于统一作品列表返回的字段结构
 */
export const WORK_LIST_SELECT = {
  id: true,
  type: true,
  name: true,
  alias: true,
  cover: true,
  popularity: true,
  language: true,
  region: true,
  ageRating: true,
  isPublished: true,
  publishAt: true,
  lastUpdated: true,
  publisher: true,
  originalSource: true,
  serialStatus: true,
  rating: true,
  ratingCount: true,
  recommendWeight: true,
  isRecommended: true,
  isHot: true,
  isNew: true,
  likeCount: true,
  favoriteCount: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  authors: {
    select: {
      sortOrder: true,
      role: true,
      author: {
        select: {
          id: true,
          name: true,
          role: true,
          avatar: true,
        },
      },
    },
  },
  categories: {
    select: {
      sortOrder: true,
      category: {
        select: {
          id: true,
          name: true,
          icon: true,
        },
      },
    },
  },
  tags: {
    select: {
      sortOrder: true,
      tag: {
        select: {
          id: true,
          name: true,
          icon: true,
        },
      },
    },
  },
} as const

/**
 * 作品列表查询字段选择的类型
 */
export type WorkListSelect = typeof WORK_LIST_SELECT
