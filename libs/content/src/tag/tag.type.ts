import type { WorkTagSelect } from '@db/schema'

/** 标签管理端视图（不含人气字段），用于管理端输出 DTO 转换。 */
export type WorkTagAdminView = Omit<WorkTagSelect, 'popularity'>
