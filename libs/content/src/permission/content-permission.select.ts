/**
 * 作品权限结果选择器（包含关联的等级信息）
 * 用于 resolveWorkPermission 方法
 */
export const WORK_PERMISSION_SELECT = {
  // 作品级阅读规则。
  viewRule: true,
  // 作品级阅读会员等级 ID。
  requiredViewLevelId: true,
  // 章节默认价格。
  chapterPrice: true,
  // 作品是否允许评论。
  canComment: true,
  // 阅读会员等级快照。
  requiredViewLevel: {
    // 关联表字段选择。
    select: {
      // 访问所需经验值。
      requiredExperience: true,
    },
  },
} as const

/**
 * 章节权限结果选择器（包含关联的等级信息）
 * 用于 resolveChapterPermission 方法
 */
export const CHAPTER_PERMISSION_SELECT = {
  // 章节所属作品 ID。
  workId: true,
  // 章节所属作品类型。
  workType: true,
  // 章节级阅读规则。
  viewRule: true,
  // 章节级阅读会员等级 ID。
  requiredViewLevelId: true,
  // 章节购买价格。
  price: true,
  // 章节是否允许下载。
  canDownload: true,
  // 章节是否允许评论。
  canComment: true,
  // 章节是否为预览章节。
  isPreview: true,
  // 阅读会员等级快照。
  requiredViewLevel: {
    // 关联表字段选择。
    select: {
      // 访问所需经验值。
      requiredExperience: true,
    },
  },
} as const
