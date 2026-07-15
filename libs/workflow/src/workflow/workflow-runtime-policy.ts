import type { WorkflowAttemptSelect, WorkflowJobSelect } from '@db/schema'
import type {
  CreateWorkflowJobInput,
  WorkflowExpiredAttemptRecoveryResult,
  WorkflowStatusCounters,
} from './workflow.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  WORKFLOW_CLAIM_TIMEOUT_SECONDS,
  WORKFLOW_TERMINAL_JOB_STATUSES,
  WorkflowAttemptStatusEnum,
  WorkflowJobStatusEnum,
  WorkflowOperatorTypeEnum,
} from './workflow.constant'

export function resolveJobStatusFromAttempt(attempt: WorkflowAttemptSelect) {
  if (attempt.status === WorkflowAttemptStatusEnum.SUCCESS) {
    return WorkflowJobStatusEnum.SUCCESS
  }
  if (attempt.status === WorkflowAttemptStatusEnum.PARTIAL_FAILED) {
    return WorkflowJobStatusEnum.PARTIAL_FAILED
  }
  if (attempt.status === WorkflowAttemptStatusEnum.CANCELLED) {
    return WorkflowJobStatusEnum.CANCELLED
  }
  return attempt.successItemCount > 0
    ? WorkflowJobStatusEnum.PARTIAL_FAILED
    : WorkflowJobStatusEnum.FAILED
}

export function resolveAttemptStatusFromCounters(
  counters: WorkflowStatusCounters,
) {
  if (counters.failedItemCount === 0) {
    return WorkflowAttemptStatusEnum.SUCCESS
  }
  return counters.successItemCount > 0
    ? WorkflowAttemptStatusEnum.PARTIAL_FAILED
    : WorkflowAttemptStatusEnum.FAILED
}

export function resolveJobStatusFromCounters(counters: WorkflowStatusCounters) {
  if (counters.failedItemCount === 0) {
    return WorkflowJobStatusEnum.SUCCESS
  }
  return counters.successItemCount > 0
    ? WorkflowJobStatusEnum.PARTIAL_FAILED
    : WorkflowJobStatusEnum.FAILED
}

export function buildDefaultExpiredAttemptRecovery(
  job: WorkflowJobSelect,
  attempt: WorkflowAttemptSelect,
): WorkflowExpiredAttemptRecoveryResult {
  const jobCounters = {
    selectedItemCount: job.selectedItemCount,
    successItemCount: 0,
    failedItemCount: attempt.selectedItemCount,
    skippedItemCount: 0,
  }
  const attemptCounters = {
    successItemCount: 0,
    failedItemCount: attempt.selectedItemCount,
    skippedItemCount: 0,
  }
  return {
    selectedItemCount: jobCounters.selectedItemCount,
    jobCounters,
    attemptCounters,
    recoverableItemCount: 0,
  }
}

export function isWorkflowAttemptDue(
  attempt: WorkflowAttemptSelect,
  now = new Date(),
) {
  return !attempt.notBeforeAt || attempt.notBeforeAt <= now
}

export function isTerminalWorkflowJobStatus(status: number) {
  return (
    WORKFLOW_TERMINAL_JOB_STATUSES as readonly WorkflowJobStatusEnum[]
  ).includes(status)
}

export function normalizeWorkflowOperator(
  operator: CreateWorkflowJobInput['operator'],
) {
  if (operator.type === WorkflowOperatorTypeEnum.ADMIN) {
    if (!Number.isInteger(operator.userId) || operator.userId <= 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '工作流管理员操作者ID非法',
      )
    }
    return {
      operatorType: WorkflowOperatorTypeEnum.ADMIN,
      operatorUserId: operator.userId,
    }
  }
  return {
    operatorType: WorkflowOperatorTypeEnum.SYSTEM,
    operatorUserId: null,
  }
}

export function normalizeWorkflowRequiredText(value: string, label: string) {
  const normalized = value.trim()
  if (!normalized) {
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      `${label}不能为空`,
    )
  }
  return normalized
}

export function normalizeWorkflowProgressPercent(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }
  return Math.min(100, Math.max(0, Math.floor(value)))
}

export function buildWorkflowClaimDeadline(now = new Date()) {
  const deadline = new Date(now)
  deadline.setSeconds(deadline.getSeconds() + WORKFLOW_CLAIM_TIMEOUT_SECONDS)
  return deadline
}
