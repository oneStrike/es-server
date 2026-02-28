// 分页章节DTO的字段选择配置
export const PAGE_WORK_CHAPTER_SELECT = {
  id: true,
  isPreview: true,
  cover: true,
  title: true,
  canComment: true,
  sortOrder: true,
  viewRule: true,
  canDownload: true,
  requiredViewLevelId: true,
  publishAt: true,
  exchangePoints: true,
  canExchange: true,
} as const
