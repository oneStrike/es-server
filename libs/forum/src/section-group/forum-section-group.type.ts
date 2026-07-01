import type { ForumSectionGroupSelect } from '@db/schema'

/** 版块分组行（不含删除时间），用于输出 DTO 转换。 */
export type ForumSectionGroupRow = Omit<ForumSectionGroupSelect, 'deletedAt'>
