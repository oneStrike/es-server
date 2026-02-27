/**
 * 作品权限结果选择器（包含关联的等级信息）
 * 用于 resolveWorkPermission 方法
 */
export const WORK_PERMISSION_SELECT = {
  // 权限规则相关
  viewRule: true,
  requiredViewLevelId: true,
  // 价格相关
  chapterPrice: true,
  chapterExchangePoints: true,
  // 功能开关
  canExchange: true,
  canDownload: true,
  canComment: true,
  // 关联的等级信息
  requiredViewLevel: {
    select: {
      requiredExperience: true,
    },
  },
}

/**
 * 章节权限结果选择器（包含关联的等级信息）
 * 用于 resolveChapterPermission 方法
 */
export const CHAPTER_PERMISSION_SELECT = {
  // 关联信息
  workId: true,
  // 权限规则相关
  viewRule: true,
  requiredViewLevelId: true,
  // 价格相关
  price: true,
  exchangePoints: true,
  // 功能开关
  canExchange: true,
  canDownload: true,
  canComment: true,
  isPreview: true,
  // 关联的等级信息
  requiredViewLevel: {
    select: {
      requiredExperience: true,
    },
  },
}
