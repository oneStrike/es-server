import { WorkflowEventTypeEnum } from './workflow.constant'

export const DEFAULT_WORKFLOW_RECORD_EVENT_TYPES = [
  WorkflowEventTypeEnum.JOB_CREATED,
  WorkflowEventTypeEnum.JOB_CONFIRMED,
  WorkflowEventTypeEnum.ATTEMPT_CLAIMED,
  WorkflowEventTypeEnum.HEARTBEAT,
  WorkflowEventTypeEnum.ITEM_SUCCEEDED,
  WorkflowEventTypeEnum.ITEM_FAILED,
  WorkflowEventTypeEnum.ATTEMPT_COMPLETED,
  WorkflowEventTypeEnum.CANCEL_REQUESTED,
  WorkflowEventTypeEnum.RETRY_REQUESTED,
  WorkflowEventTypeEnum.DRAFT_EXPIRED,
  WorkflowEventTypeEnum.CLEANUP_RECORDED,
] as const
