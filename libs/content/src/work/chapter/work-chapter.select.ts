// 分页章节DTO的字段选择配置
export const PAGE_WORK_CHAPTER_SELECT = {
  id: true,
  isPreview: true,
  cover: true,
  title: true,
  canComment: true,
  sortOrder: true,
  readRule: true,
  downloadRule: true,
  readPoints: true,
  downloadPoints: true,
  requiredReadLevelId: true,
  requiredDownloadLevelId: true,
} as const
