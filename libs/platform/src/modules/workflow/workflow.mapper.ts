import type {
  WorkflowAttemptSelect,
  WorkflowEventSelect,
  WorkflowJobSelect,
} from '@db/schema'
import type { WorkflowObject } from './workflow.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { toWorkflowErrorView } from './workflow-error-facts'
import {
  WorkflowAttemptStatusEnum,
  WorkflowJobStatusEnum,
} from './workflow.constant'

export function toWorkflowJobDto(row: WorkflowJobSelect) {
  return {
    id: Number(row.id),
    jobId: row.jobId,
    workflowType: row.workflowType,
    displayName: row.displayName,
    operatorType: row.operatorType,
    operatorUserId: row.operatorUserId,
    status: normalizeWorkflowJobStatus(row.status),
    progressPercent: row.progressPercent,
    progressCode: row.progressCode,
    progressContext: asNullableWorkflowObject(row.progressContext),
    progressDetail: asNullableWorkflowObject(row.progressDetail),
    selectedItemCount: row.selectedItemCount,
    successItemCount: row.successItemCount,
    failedItemCount: row.failedItemCount,
    skippedItemCount: row.skippedItemCount,
    cancelRequestedAt: row.cancelRequestedAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    expiresAt: row.expiresAt,
    archivedAt: row.archivedAt,
    summary: asNullableWorkflowObject(row.summary),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function toWorkflowAttemptDto(row: WorkflowAttemptSelect) {
  return {
    id: Number(row.id),
    attemptId: row.attemptId,
    attemptNo: row.attemptNo,
    triggerType: row.triggerType,
    status: normalizeWorkflowAttemptStatus(row.status),
    notBeforeAt: row.notBeforeAt,
    selectedItemCount: row.selectedItemCount,
    successItemCount: row.successItemCount,
    failedItemCount: row.failedItemCount,
    skippedItemCount: row.skippedItemCount,
    claimedBy: row.claimedBy,
    claimExpiresAt: row.claimExpiresAt,
    heartbeatAt: row.heartbeatAt,
    error: toWorkflowErrorView(row),
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function toWorkflowEventDto(row: WorkflowEventSelect) {
  return {
    id: Number(row.id),
    eventType: row.eventType,
    eventCode: row.eventCode,
    detail: asNullableWorkflowObject(row.detail),
    createdAt: row.createdAt,
  }
}

export function toWorkflowRecordDto(
  row: WorkflowEventSelect,
  attempt?: WorkflowAttemptSelect,
) {
  return {
    ...toWorkflowEventDto(row),
    attemptId: attempt?.attemptId ?? null,
    attemptNo: attempt?.attemptNo ?? null,
  }
}

export function toWorkflowErrorObject(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    }
  }
  return {
    name: 'UnknownError',
    message: stringifyWorkflowError(error),
  }
}

function normalizeWorkflowJobStatus(status: number) {
  if (
    Object.values(WorkflowJobStatusEnum).includes(
      status as WorkflowJobStatusEnum,
    )
  ) {
    return status as WorkflowJobStatusEnum
  }
  throw new BusinessException(
    BusinessErrorCode.STATE_CONFLICT,
    '工作流任务状态非法',
  )
}

function normalizeWorkflowAttemptStatus(status: number) {
  if (
    Object.values(WorkflowAttemptStatusEnum).includes(
      status as WorkflowAttemptStatusEnum,
    )
  ) {
    return status as WorkflowAttemptStatusEnum
  }
  throw new BusinessException(
    BusinessErrorCode.STATE_CONFLICT,
    '工作流 attempt 状态非法',
  )
}

function asNullableWorkflowObject(value: unknown) {
  return value === null || value === undefined ? null : asWorkflowObject(value)
}

function asWorkflowObject(value: unknown): WorkflowObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as WorkflowObject)
    : {}
}

function stringifyWorkflowError(error: unknown) {
  if (typeof error === 'string') {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return 'unknown error'
  }
}
