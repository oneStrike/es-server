import type {
  WorkflowErrorColumns,
  WorkflowErrorContext,
  WorkflowErrorDiagnosticInput,
  WorkflowErrorFacts,
  WorkflowErrorFactsInput,
  WorkflowErrorRegistryEntry,
  WorkflowErrorView,
  WorkflowLastErrorColumns,
  WorkflowRetryColumns,
} from './workflow-error-facts.type'
import { Buffer } from 'node:buffer'

export type {
  WorkflowErrorColumns,
  WorkflowErrorContext,
  WorkflowErrorDiagnosticInput,
  WorkflowErrorDomain,
  WorkflowErrorFacts,
  WorkflowErrorFactsInput,
  WorkflowErrorRegistryEntry,
  WorkflowErrorSeverity,
  WorkflowErrorView,
  WorkflowLastErrorColumns,
  WorkflowRetryColumns,
} from './workflow-error-facts.type'

export enum WorkflowErrorCodeEnum {
  ARCHIVE_CHAPTER_IMPORT_FAILED = 'ARCHIVE_CHAPTER_IMPORT_FAILED',
  ARCHIVE_IMPORT_CHAPTER_NOT_FOUND = 'ARCHIVE_IMPORT_CHAPTER_NOT_FOUND',
  ARCHIVE_IMPORT_DEPTH_EXCEEDED = 'ARCHIVE_IMPORT_DEPTH_EXCEEDED',
  ARCHIVE_IMPORT_INVALID_CHAPTER_ID_DIR = 'ARCHIVE_IMPORT_INVALID_CHAPTER_ID_DIR',
  ARCHIVE_IMPORT_ITEM_IGNORED = 'ARCHIVE_IMPORT_ITEM_IGNORED',
  ARCHIVE_IMPORT_MATCHED = 'ARCHIVE_IMPORT_MATCHED',
  ARCHIVE_IMPORT_MISSING_CHAPTER_ID = 'ARCHIVE_IMPORT_MISSING_CHAPTER_ID',
  ARCHIVE_IMPORT_NO_IMAGES = 'ARCHIVE_IMPORT_NO_IMAGES',
  ARCHIVE_IMPORT_OVERWRITE_WARNING = 'ARCHIVE_IMPORT_OVERWRITE_WARNING',
  ARCHIVE_IMPORT_PROGRESS_UPDATED = 'ARCHIVE_IMPORT_PROGRESS_UPDATED',
  ATTEMPT_LEASE_EXPIRED = 'ATTEMPT_LEASE_EXPIRED',
  CONTENT_IMPORT_IMAGE_PROGRESS_UPDATED = 'CONTENT_IMPORT_IMAGE_PROGRESS_UPDATED',
  CONTENT_IMPORT_ITEM_FAILED = 'CONTENT_IMPORT_ITEM_FAILED',
  CONTENT_IMPORT_PROGRESS_UPDATED = 'CONTENT_IMPORT_PROGRESS_UPDATED',
  CONTENT_IMPORT_RATE_LIMITED = 'CONTENT_IMPORT_RATE_LIMITED',
  CONTENT_IMPORT_RETRY_EXHAUSTED = 'CONTENT_IMPORT_RETRY_EXHAUSTED',
  DATABASE_WRITE_FAILED = 'DATABASE_WRITE_FAILED',
  THIRD_PARTY_CHAPTER_IMPORT_FAILED = 'THIRD_PARTY_CHAPTER_IMPORT_FAILED',
  THIRD_PARTY_IMAGE_IMPORT_FAILED = 'THIRD_PARTY_IMAGE_IMPORT_FAILED',
  THIRD_PARTY_IMPORT_COMPLETED = 'THIRD_PARTY_IMPORT_COMPLETED',
  THIRD_PARTY_RESOURCE_PARSE_FAILED = 'THIRD_PARTY_RESOURCE_PARSE_FAILED',
  THIRD_PARTY_SYNC_COMPLETED = 'THIRD_PARTY_SYNC_COMPLETED',
  UNKNOWN_WORKFLOW_PROGRESS = 'UNKNOWN_WORKFLOW_PROGRESS',
  UNKNOWN_WORKFLOW_ERROR = 'UNKNOWN_WORKFLOW_ERROR',
}

export const WORKFLOW_ERROR_DIAGNOSTIC_LIMITS = {
  maxDiagnosticArrayItems: 20,
  maxDiagnosticBytes: 16_384,
  maxDiagnosticDepth: 3,
  maxDiagnosticStringLength: 2_048,
} as const

export const WORKFLOW_ERROR_CODES = {
  [WorkflowErrorCodeEnum.ARCHIVE_CHAPTER_IMPORT_FAILED]: {
    code: WorkflowErrorCodeEnum.ARCHIVE_CHAPTER_IMPORT_FAILED,
    domain: 'archive-import',
    stage: 'import-chapter',
    severity: 'error',
    retryable: false,
    requiredContextKeys: ['chapterId', 'chapterTitle'],
    diagnosticPolicy: 'internal',
  },
  [WorkflowErrorCodeEnum.ARCHIVE_IMPORT_CHAPTER_NOT_FOUND]: {
    code: WorkflowErrorCodeEnum.ARCHIVE_IMPORT_CHAPTER_NOT_FOUND,
    domain: 'archive-import',
    stage: 'preview',
    severity: 'warning',
    retryable: false,
    requiredContextKeys: ['path'],
    diagnosticPolicy: 'none',
  },
  [WorkflowErrorCodeEnum.ARCHIVE_IMPORT_DEPTH_EXCEEDED]: {
    code: WorkflowErrorCodeEnum.ARCHIVE_IMPORT_DEPTH_EXCEEDED,
    domain: 'archive-import',
    stage: 'preview',
    severity: 'warning',
    retryable: false,
    requiredContextKeys: ['path'],
    diagnosticPolicy: 'none',
  },
  [WorkflowErrorCodeEnum.ARCHIVE_IMPORT_INVALID_CHAPTER_ID_DIR]: {
    code: WorkflowErrorCodeEnum.ARCHIVE_IMPORT_INVALID_CHAPTER_ID_DIR,
    domain: 'archive-import',
    stage: 'preview',
    severity: 'warning',
    retryable: false,
    requiredContextKeys: ['path'],
    diagnosticPolicy: 'none',
  },
  [WorkflowErrorCodeEnum.ARCHIVE_IMPORT_ITEM_IGNORED]: {
    code: WorkflowErrorCodeEnum.ARCHIVE_IMPORT_ITEM_IGNORED,
    domain: 'archive-import',
    stage: 'preview',
    severity: 'warning',
    retryable: false,
    requiredContextKeys: ['path', 'reason'],
    diagnosticPolicy: 'none',
  },
  [WorkflowErrorCodeEnum.ARCHIVE_IMPORT_MATCHED]: {
    code: WorkflowErrorCodeEnum.ARCHIVE_IMPORT_MATCHED,
    domain: 'archive-import',
    stage: 'preview',
    severity: 'info',
    retryable: false,
    requiredContextKeys: ['path', 'chapterId'],
    diagnosticPolicy: 'none',
  },
  [WorkflowErrorCodeEnum.ARCHIVE_IMPORT_MISSING_CHAPTER_ID]: {
    code: WorkflowErrorCodeEnum.ARCHIVE_IMPORT_MISSING_CHAPTER_ID,
    domain: 'archive-import',
    stage: 'preview',
    severity: 'warning',
    retryable: false,
    requiredContextKeys: ['path'],
    diagnosticPolicy: 'none',
  },
  [WorkflowErrorCodeEnum.ARCHIVE_IMPORT_NO_IMAGES]: {
    code: WorkflowErrorCodeEnum.ARCHIVE_IMPORT_NO_IMAGES,
    domain: 'archive-import',
    stage: 'preview',
    severity: 'warning',
    retryable: false,
    requiredContextKeys: ['path'],
    diagnosticPolicy: 'none',
  },
  [WorkflowErrorCodeEnum.ARCHIVE_IMPORT_OVERWRITE_WARNING]: {
    code: WorkflowErrorCodeEnum.ARCHIVE_IMPORT_OVERWRITE_WARNING,
    domain: 'archive-import',
    stage: 'preview',
    severity: 'warning',
    retryable: false,
    requiredContextKeys: ['chapterId', 'existingImageCount'],
    diagnosticPolicy: 'none',
  },
  [WorkflowErrorCodeEnum.ARCHIVE_IMPORT_PROGRESS_UPDATED]: {
    code: WorkflowErrorCodeEnum.ARCHIVE_IMPORT_PROGRESS_UPDATED,
    domain: 'archive-import',
    stage: 'import-images',
    severity: 'info',
    retryable: false,
    requiredContextKeys: [
      'chapterIndex',
      'chapterTotal',
      'imageIndex',
      'imageTotal',
    ],
    diagnosticPolicy: 'none',
  },
  [WorkflowErrorCodeEnum.ATTEMPT_LEASE_EXPIRED]: {
    code: WorkflowErrorCodeEnum.ATTEMPT_LEASE_EXPIRED,
    domain: 'workflow',
    stage: 'lease-recovery',
    severity: 'error',
    retryable: false,
    requiredContextKeys: ['attemptId', 'jobId'],
    diagnosticPolicy: 'internal',
  },
  [WorkflowErrorCodeEnum.CONTENT_IMPORT_IMAGE_PROGRESS_UPDATED]: {
    code: WorkflowErrorCodeEnum.CONTENT_IMPORT_IMAGE_PROGRESS_UPDATED,
    domain: 'content-import',
    stage: 'import-image',
    severity: 'info',
    retryable: false,
    requiredContextKeys: ['imageIndex', 'imageTotal'],
    diagnosticPolicy: 'none',
  },
  [WorkflowErrorCodeEnum.CONTENT_IMPORT_ITEM_FAILED]: {
    code: WorkflowErrorCodeEnum.CONTENT_IMPORT_ITEM_FAILED,
    domain: 'content-import',
    stage: 'import-item',
    severity: 'error',
    retryable: false,
    requiredContextKeys: ['itemId'],
    diagnosticPolicy: 'internal',
  },
  [WorkflowErrorCodeEnum.CONTENT_IMPORT_PROGRESS_UPDATED]: {
    code: WorkflowErrorCodeEnum.CONTENT_IMPORT_PROGRESS_UPDATED,
    domain: 'content-import',
    stage: 'task-progress',
    severity: 'info',
    retryable: false,
    requiredContextKeys: ['selectedItemCount', 'completedItemCount'],
    diagnosticPolicy: 'none',
  },
  [WorkflowErrorCodeEnum.CONTENT_IMPORT_RATE_LIMITED]: {
    code: WorkflowErrorCodeEnum.CONTENT_IMPORT_RATE_LIMITED,
    domain: 'content-import',
    stage: 'rate-limit',
    severity: 'warning',
    retryable: true,
    requiredContextKeys: ['itemId', 'nextRetryAt'],
    diagnosticPolicy: 'internal',
  },
  [WorkflowErrorCodeEnum.CONTENT_IMPORT_RETRY_EXHAUSTED]: {
    code: WorkflowErrorCodeEnum.CONTENT_IMPORT_RETRY_EXHAUSTED,
    domain: 'content-import',
    stage: 'retry-exhausted',
    severity: 'error',
    retryable: false,
    requiredContextKeys: ['itemId'],
    diagnosticPolicy: 'internal',
  },
  [WorkflowErrorCodeEnum.DATABASE_WRITE_FAILED]: {
    code: WorkflowErrorCodeEnum.DATABASE_WRITE_FAILED,
    domain: 'database',
    stage: 'persist',
    severity: 'fatal',
    retryable: false,
    requiredContextKeys: [],
    diagnosticPolicy: 'internal',
  },
  [WorkflowErrorCodeEnum.THIRD_PARTY_CHAPTER_IMPORT_FAILED]: {
    code: WorkflowErrorCodeEnum.THIRD_PARTY_CHAPTER_IMPORT_FAILED,
    domain: 'third-party-source',
    stage: 'import-chapter',
    severity: 'error',
    retryable: false,
    requiredContextKeys: ['chapterTitle'],
    diagnosticPolicy: 'internal',
  },
  [WorkflowErrorCodeEnum.THIRD_PARTY_IMAGE_IMPORT_FAILED]: {
    code: WorkflowErrorCodeEnum.THIRD_PARTY_IMAGE_IMPORT_FAILED,
    domain: 'third-party-source',
    stage: 'import-image',
    severity: 'error',
    retryable: false,
    requiredContextKeys: ['imageIndex'],
    diagnosticPolicy: 'internal',
  },
  [WorkflowErrorCodeEnum.THIRD_PARTY_IMPORT_COMPLETED]: {
    code: WorkflowErrorCodeEnum.THIRD_PARTY_IMPORT_COMPLETED,
    domain: 'third-party-source',
    stage: 'import-complete',
    severity: 'info',
    retryable: false,
    requiredContextKeys: ['workflowType'],
    diagnosticPolicy: 'none',
  },
  [WorkflowErrorCodeEnum.THIRD_PARTY_RESOURCE_PARSE_FAILED]: {
    code: WorkflowErrorCodeEnum.THIRD_PARTY_RESOURCE_PARSE_FAILED,
    domain: 'third-party-source',
    stage: 'parse-resource',
    severity: 'error',
    retryable: false,
    requiredContextKeys: ['source'],
    diagnosticPolicy: 'internal',
  },
  [WorkflowErrorCodeEnum.THIRD_PARTY_SYNC_COMPLETED]: {
    code: WorkflowErrorCodeEnum.THIRD_PARTY_SYNC_COMPLETED,
    domain: 'third-party-source',
    stage: 'sync-complete',
    severity: 'info',
    retryable: false,
    requiredContextKeys: ['workflowType'],
    diagnosticPolicy: 'none',
  },
  [WorkflowErrorCodeEnum.UNKNOWN_WORKFLOW_PROGRESS]: {
    code: WorkflowErrorCodeEnum.UNKNOWN_WORKFLOW_PROGRESS,
    domain: 'workflow',
    stage: 'progress',
    severity: 'info',
    retryable: false,
    requiredContextKeys: [],
    diagnosticPolicy: 'none',
  },
  [WorkflowErrorCodeEnum.UNKNOWN_WORKFLOW_ERROR]: {
    code: WorkflowErrorCodeEnum.UNKNOWN_WORKFLOW_ERROR,
    domain: 'unknown',
    stage: 'unknown',
    severity: 'error',
    retryable: false,
    requiredContextKeys: [],
    diagnosticPolicy: 'internal',
  },
} as const satisfies Record<WorkflowErrorCodeEnum, WorkflowErrorRegistryEntry>

const SECRET_KEY_RE =
  /authorization|cookie|password|secret|signature|token|accesskey|access_key/i
const REDACTED = '[REDACTED]'

export function createWorkflowErrorFacts(
  input: WorkflowErrorFactsInput,
): WorkflowErrorFacts {
  const registryEntry =
    WORKFLOW_ERROR_CODES[input.code as WorkflowErrorCodeEnum] ??
    WORKFLOW_ERROR_CODES[WorkflowErrorCodeEnum.UNKNOWN_WORKFLOW_ERROR]

  return {
    code: input.code,
    context: normalizeWorkflowContext(input.context),
    domain: input.domain ?? registryEntry.domain,
    retryable: input.retryable ?? registryEntry.retryable,
    severity: input.severity ?? registryEntry.severity,
    stage: input.stage ?? registryEntry.stage,
  }
}

export function createWorkflowErrorFactsByCode(
  code: WorkflowErrorCodeEnum,
  context?: WorkflowErrorContext | null,
  overrides: Omit<WorkflowErrorFactsInput, 'code' | 'context'> = {},
) {
  return createWorkflowErrorFacts({
    ...overrides,
    code,
    context,
  })
}

export function normalizeUnknownWorkflowError(
  error: unknown,
  context?: WorkflowErrorContext | null,
) {
  const errorName =
    error instanceof Error && error.name ? error.name : undefined
  return createWorkflowErrorFacts({
    code: WorkflowErrorCodeEnum.UNKNOWN_WORKFLOW_ERROR,
    context: {
      ...normalizeWorkflowContext(context),
      ...(errorName ? { errorName } : {}),
    },
    domain: 'unknown',
    retryable: false,
    severity: 'error',
    stage: 'unknown',
  })
}

export function toWorkflowErrorColumns(
  facts?: WorkflowErrorFacts | WorkflowErrorFactsInput | null,
  diagnosticInput?: WorkflowErrorDiagnosticInput | null,
): WorkflowErrorColumns {
  if (!facts) {
    return {
      errorCode: null,
      errorContext: null,
      errorDiagnostic: null,
      errorDomain: null,
      errorRetryable: null,
      errorSeverity: null,
      errorStage: null,
    }
  }

  const normalized = hasFullWorkflowErrorFacts(facts)
    ? facts
    : createWorkflowErrorFacts(facts)

  return {
    errorCode: normalized.code,
    errorContext: normalized.context,
    errorDiagnostic: sanitizeErrorDiagnostic(diagnosticInput),
    errorDomain: normalized.domain,
    errorRetryable: normalized.retryable,
    errorSeverity: normalized.severity,
    errorStage: normalized.stage,
  }
}

export function toWorkflowLastErrorColumns(
  facts?: WorkflowErrorFacts | WorkflowErrorFactsInput | null,
  diagnosticInput?: WorkflowErrorDiagnosticInput | null,
): WorkflowLastErrorColumns {
  const columns = toWorkflowErrorColumns(facts, diagnosticInput)
  return {
    lastErrorCode: columns.errorCode,
    lastErrorContext: columns.errorContext,
    lastErrorDiagnostic: columns.errorDiagnostic,
    lastErrorDomain: columns.errorDomain,
    lastErrorRetryable: columns.errorRetryable,
    lastErrorSeverity: columns.errorSeverity,
    lastErrorStage: columns.errorStage,
  }
}

export function toWorkflowRetryColumns(
  facts?: WorkflowErrorFacts | WorkflowErrorFactsInput | null,
  diagnosticInput?: WorkflowErrorDiagnosticInput | null,
): WorkflowRetryColumns {
  if (!facts) {
    return {
      lastRetryCode: null,
      lastRetryContext: null,
      lastRetryDiagnostic: null,
    }
  }

  const normalized = hasFullWorkflowErrorFacts(facts)
    ? facts
    : createWorkflowErrorFacts(facts)

  return {
    lastRetryCode: normalized.code,
    lastRetryContext: normalized.context,
    lastRetryDiagnostic: sanitizeErrorDiagnostic(diagnosticInput),
  }
}

export function toWorkflowErrorView(row: {
  errorCode?: null | string
  errorContext?: null | unknown
  errorDomain?: null | string
  errorRetryable?: boolean | null
  errorSeverity?: null | string
  errorStage?: null | string
}): WorkflowErrorView | null {
  if (!row.errorCode) {
    return null
  }

  return {
    code: row.errorCode,
    context: normalizeWorkflowContext(row.errorContext),
    domain: row.errorDomain ?? 'unknown',
    retryable: row.errorRetryable ?? false,
    severity: row.errorSeverity ?? 'error',
    stage: row.errorStage ?? 'unknown',
  }
}

export function toWorkflowLastErrorView(row: {
  lastErrorCode?: null | string
  lastErrorContext?: null | unknown
  lastErrorDomain?: null | string
  lastErrorRetryable?: boolean | null
  lastErrorSeverity?: null | string
  lastErrorStage?: null | string
}): WorkflowErrorView | null {
  return toWorkflowErrorView({
    errorCode: row.lastErrorCode,
    errorContext: row.lastErrorContext,
    errorDomain: row.lastErrorDomain,
    errorRetryable: row.lastErrorRetryable,
    errorSeverity: row.lastErrorSeverity,
    errorStage: row.lastErrorStage,
  })
}

export function toWorkflowRetryView(row: {
  lastRetryCode?: null | string
  lastRetryContext?: null | unknown
}): WorkflowErrorView | null {
  if (!row.lastRetryCode) {
    return null
  }

  return createWorkflowErrorFacts({
    code: row.lastRetryCode,
    context: normalizeWorkflowContext(row.lastRetryContext),
  })
}

export function sanitizeErrorDiagnostic(
  input?: WorkflowErrorDiagnosticInput | null,
): WorkflowErrorContext | null {
  if (!input) {
    return null
  }

  const raw: WorkflowErrorContext = {}
  if (input.source) {
    raw.source = input.source
  }
  if (input.error !== undefined) {
    raw.error = serializeDiagnosticValue(input.error, 0)
  }
  if (input.diagnostic !== undefined) {
    raw.diagnostic = serializeDiagnosticValue(input.diagnostic, 0)
  }

  if (Object.keys(raw).length === 0) {
    return null
  }

  return enforceDiagnosticByteLimit(raw)
}

export function normalizeWorkflowContext(value: unknown): WorkflowErrorContext {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as WorkflowErrorContext)
    : {}
}

function hasFullWorkflowErrorFacts(
  facts: WorkflowErrorFacts | WorkflowErrorFactsInput,
): facts is WorkflowErrorFacts {
  return (
    typeof facts.domain === 'string' &&
    typeof facts.stage === 'string' &&
    typeof facts.severity === 'string' &&
    typeof facts.retryable === 'boolean' &&
    typeof facts.context === 'object' &&
    facts.context !== null
  )
}

function serializeDiagnosticValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'string') {
    return truncateString(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof Error) {
    return serializeError(value, depth)
  }

  if (Array.isArray(value)) {
    if (depth >= WORKFLOW_ERROR_DIAGNOSTIC_LIMITS.maxDiagnosticDepth) {
      return { truncated: true, reason: 'max-depth' }
    }

    const sliced = value
      .slice(0, WORKFLOW_ERROR_DIAGNOSTIC_LIMITS.maxDiagnosticArrayItems)
      .map((item) => serializeDiagnosticValue(item, depth + 1))

    return value.length > sliced.length
      ? { items: sliced, truncated: true, totalItems: value.length }
      : sliced
  }

  if (typeof value === 'object') {
    if (depth >= WORKFLOW_ERROR_DIAGNOSTIC_LIMITS.maxDiagnosticDepth) {
      return { truncated: true, reason: 'max-depth' }
    }

    const output: WorkflowErrorContext = {}
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      output[key] = SECRET_KEY_RE.test(key)
        ? REDACTED
        : serializeDiagnosticValue(child, depth + 1)
    }
    return output
  }

  return String(value)
}

function serializeError(error: Error, depth: number): WorkflowErrorContext {
  return {
    cause: serializeDiagnosticValue(
      (error as { cause?: unknown }).cause,
      depth + 1,
    ),
    message: truncateString(error.message),
    name: error.name,
    stack: error.stack ? truncateString(error.stack) : undefined,
  }
}

function truncateString(value: string) {
  const max = WORKFLOW_ERROR_DIAGNOSTIC_LIMITS.maxDiagnosticStringLength
  return value.length > max
    ? `${value.slice(0, max)}...[truncated:${value.length - max}]`
    : value
}

function enforceDiagnosticByteLimit(
  value: WorkflowErrorContext,
): WorkflowErrorContext {
  const serialized = safeJsonStringify(value)
  if (
    Buffer.byteLength(serialized) <=
    WORKFLOW_ERROR_DIAGNOSTIC_LIMITS.maxDiagnosticBytes
  ) {
    return value
  }

  return {
    originalBytes: Buffer.byteLength(serialized),
    summary: truncateString(serialized),
    truncated: true,
    truncationReason: 'max-diagnostic-bytes',
  }
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return JSON.stringify({ stringified: String(value), truncated: true })
  }
}
