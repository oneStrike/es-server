import type { UserReport } from '@db/schema'
import type { ReportTargetTypeEnum } from './report.constant'

/**
 * 创建举报的服务层入参。
 * - 由 controller 传入目标与原因信息并附带举报人
 * - targetType 使用业务枚举保持解析器路由类型安全
 */
export type CreateReportInput = Pick<
  UserReport,
  'reporterId' | 'targetId' | 'reasonType'
> &
Partial<Pick<UserReport, 'description' | 'evidenceUrl'>> & {
    targetType: ReportTargetTypeEnum
  }

/**
 * 创建举报记录的完整落库数据。
 * - 在创建入参基础上补齐场景字段
 * - 支持在特定流程下覆盖状态与处理信息
 */
export type CreateUserReportInput = CreateReportInput &
  Pick<UserReport, 'sceneType' | 'sceneId'> &
  Partial<Pick<UserReport, 'commentLevel' | 'status' | 'handlerId' | 'handlingNote'>>

/**
 * 创建举报可选项。
 * - duplicateMessage 用于不同目标类型的重复举报提示覆盖
 */
export interface CreateUserReportOptions {
  duplicateMessage?: string
}

/**
 * 举报列表查询条件。
 * - reporterId 用于限定“我的举报”视角
 * - 其余字段为可选筛选条件
 */
export type ReportListQuery = Pick<UserReport, 'reporterId'> &
  Partial<Pick<UserReport, 'targetId' | 'reasonType' | 'status'>> & {
    targetType?: ReportTargetTypeEnum
    pageIndex?: number
    pageSize?: number
  }
