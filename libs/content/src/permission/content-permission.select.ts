import type { Prisma } from '@libs/platform/database'

/**
 * 作品权限结果选择器（包含关联的等级信息）
 * 用于 resolveWorkPermission 方法
 */
export const WORK_PERMISSION_SELECT = {
  viewRule: true,
  requiredViewLevelId: true,
  chapterPrice: true,
  canComment: true,
  requiredViewLevel: {
    select: {
      requiredExperience: true,
    },
  },
} satisfies Prisma.WorkSelect

/**
 * 章节权限结果选择器（包含关联的等级信息）
 * 用于 resolveChapterPermission 方法
 */
export const CHAPTER_PERMISSION_SELECT = {
  // 关联信息
  workId: true,
  workType: true,
  // 权限规则相关
  viewRule: true,
  requiredViewLevelId: true,
  // 价格相关
  price: true,
  // 功能开关
  canDownload: true,
  canComment: true,
  isPreview: true,
  // 关联的等级信息
  requiredViewLevel: {
    select: {
      requiredExperience: true,
    },
  },
} satisfies Prisma.WorkChapterSelect
