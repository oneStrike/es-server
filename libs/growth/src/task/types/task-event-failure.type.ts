import type { TaskEventFailureSelect } from '@db/schema'
import type { DispatchDefinedGrowthEventPayload } from '@libs/growth/growth-reward/types/growth-event-dispatch.type'

/** 任务事件消费失败事实写入入参。 */
export interface TaskEventFailureRecordInput {
  payload: DispatchDefinedGrowthEventPayload
  errorMessage: string
}

/** 任务事件消费失败重试载荷快照。 */
export interface TaskEventFailureReplayPayload
  extends DispatchDefinedGrowthEventPayload {}

/** 任务事件消费失败租约结果。 */
export interface TaskEventFailureClaimResult {
  failure: TaskEventFailureSelect
  token: string
}
