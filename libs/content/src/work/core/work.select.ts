// 作品关联关系查询字段选择
export const WORK_RELATION_SELECT = {
  authorRelations: {
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
  categoryRelations: {
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
  tagRelations: {
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
  publishAt: true,
  createdAt: true,
  updatedAt: true,
  isPublished: true,
  authorRelations: WORK_RELATION_SELECT.authorRelations,
  categoryRelations: WORK_RELATION_SELECT.categoryRelations,
  tagRelations: WORK_RELATION_SELECT.tagRelations,
} as const
