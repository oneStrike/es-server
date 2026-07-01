import type { WorkflowErrorCodeEnum } from './workflow-error-facts'

/**
 * 工作流错误上下文。
 */
export type WorkflowErrorContext = Record<string, unknown>

/**
 * 工作流错误归属域。
 */
export type WorkflowErrorDomain =
  | 'archive-import'
  | 'content-import'
  | 'database'
  | 'storage'
  | 'third-party-source'
  | 'unknown'
  | 'workflow'

/**
 * 工作流错误严重级别。
 */
export type WorkflowErrorSeverity = 'error' | 'fatal' | 'info' | 'warning'

/**
 * 工作流错误注册表条目。
 */
export interface WorkflowErrorRegistryEntry {
  code: WorkflowErrorCodeEnum
  domain: WorkflowErrorDomain
  stage: string
  severity: WorkflowErrorSeverity
  retryable: boolean
  requiredContextKeys: readonly string[]
  diagnosticPolicy: 'internal' | 'none'
}

/**
 * 归一化后的工作流错误事实。
 */
export interface WorkflowErrorFacts {
  code: WorkflowErrorCodeEnum | string
  context: WorkflowErrorContext
  domain: WorkflowErrorDomain | string
  retryable: boolean
  severity: WorkflowErrorSeverity | string
  stage: string
}

/**
 * 构造工作流错误事实的输入。
 */
export interface WorkflowErrorFactsInput {
  code: WorkflowErrorCodeEnum | string
  context?: WorkflowErrorContext | null
  domain?: WorkflowErrorDomain | string
  retryable?: boolean
  severity?: WorkflowErrorSeverity | string
  stage?: string
}

/**
 * 工作流错误诊断输入。
 */
export interface WorkflowErrorDiagnosticInput {
  diagnostic?: unknown
  error?: unknown
  source?: string
}

/**
 * 工作流错误持久化列集合。
 */
export interface WorkflowErrorColumns {
  errorCode: string | null
  errorContext: WorkflowErrorContext | null
  errorDiagnostic: WorkflowErrorContext | null
  errorDomain: string | null
  errorRetryable: boolean | null
  errorSeverity: string | null
  errorStage: string | null
}

/**
 * 工作流最近错误持久化列集合。
 */
export interface WorkflowLastErrorColumns {
  lastErrorCode: string | null
  lastErrorContext: WorkflowErrorContext | null
  lastErrorDiagnostic: WorkflowErrorContext | null
  lastErrorDomain: string | null
  lastErrorRetryable: boolean | null
  lastErrorSeverity: string | null
  lastErrorStage: string | null
}

/**
 * 工作流最近重试错误持久化列集合。
 */
export interface WorkflowRetryColumns {
  lastRetryCode: string | null
  lastRetryContext: WorkflowErrorContext | null
  lastRetryDiagnostic: WorkflowErrorContext | null
}

/** 按错误码构造错误事实时的覆盖字段。 */
export type WorkflowErrorFactsOverrides = Omit<
  WorkflowErrorFactsInput,
  'code' | 'context'
>

/**
 * 对外展示的工作流错误视图。
 */
export interface WorkflowErrorView extends WorkflowErrorFacts {}
