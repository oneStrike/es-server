import type { UserReportInsert, UserReportSelect } from '@db/schema'
import type { CreateReportCommandDto } from './dto/report.dto'
import type {
  ReportDispositionResult,
  ReportTargetMeta,
} from './interfaces/report-target-resolver.type'

/** 举报处理对比所需的处置状态字段子集。 */
export type ReportDispositionComparison = Pick<
  UserReportSelect,
  'status' | 'targetAction' | 'targetActionReason' | 'targetActionStatus'
>

/** 举报目标类型引用，仅承载 targetType 字段。 */
export type ReportTargetTypeRef = Pick<UserReportSelect, 'targetType'>

/** 举报目标关键字段，用于处置事务内定位目标。 */
export type ReportTargetKeyFields = Pick<
  UserReportSelect,
  'id' | 'targetId' | 'targetType'
>

/** 举报处置事务返回结果。 */
export interface ReportDispositionTxResult {
  result: Record<string, unknown>
  events: ReportDispositionResult[]
}

/** 举报记录落库载荷，包含目标解析后得到的场景与处理状态字段。 */
export type CreateUserReportPayload = CreateReportCommandDto &
  Pick<ReportTargetMeta, 'sceneType' | 'sceneId' | 'commentLevel'> &
  Partial<Pick<UserReportInsert, 'status' | 'handlerId' | 'handlingNote'>>

/** 创建举报的可选行为参数。 */
export interface CreateUserReportOptions {
  duplicateMessage?: string
}

/** 举报记录与本轮处理事件的组合视图，只服务处理流程内部状态承载。 */
export type UserReportWithDispositionEvents = UserReportSelect & {
  dispositionEvents?: ReportDispositionResult[]
}
