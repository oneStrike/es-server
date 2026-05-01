import type { UserReportInsert } from '@db/schema'
import type { CreateReportCommandDto } from './dto/report.dto'
import type { ReportTargetMeta } from './interfaces/report-target-resolver.interface'

/** 举报记录落库载荷，包含目标解析后得到的场景与处理状态字段。 */
export type CreateUserReportPayload = CreateReportCommandDto &
  Pick<ReportTargetMeta, 'sceneType' | 'sceneId' | 'commentLevel'> &
  Partial<Pick<UserReportInsert, 'status' | 'handlerId' | 'handlingNote'>>

/** 创建举报的可选行为参数。 */
export interface CreateUserReportOptions {
  duplicateMessage?: string
}
