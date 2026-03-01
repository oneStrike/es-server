// 作品关联关系查询字段选择
export const WORK_RELATION_SELECT = {
  authors: {
    select: {
      sortOrder: true,
      author: {
        select: {
          id: true,
          name: true,
          type: true,
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
// 分页返回作品DTO的字段选择配置
export const PAGE_WORK_SELECT = {
  id: true,
  type: true,
  name: true,
  cover: true,
  popularity: true,
  isRecommended: true,
  isHot: true,
  isNew: true,
  serialStatus: true,
  publisher: true,
  language: true,
  region: true,
  ageRating: true,
  authors: WORK_RELATION_SELECT.authors,
  categories: WORK_RELATION_SELECT.categories,
  tags: WORK_RELATION_SELECT.tags,
} as const
