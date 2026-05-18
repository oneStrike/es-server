import type {
  ThirdPartyComicImportProgress,
  ThirdPartyComicImportProgressReporterAdvanceInput,
  ThirdPartyComicImportProgressReporterOptions,
} from '@libs/content/work/third-party/third-party-comic-import.type'
import type { UploadDeleteTarget } from '@libs/platform/modules/upload/upload.type'
import type {
  WorkflowExecutionContext,
  WorkflowObject,
} from '@libs/platform/modules/workflow/workflow.type'
import type {
  WorkflowTaskContextAdapterOptions,
  WorkflowTaskContextResidue,
  WorkflowTaskContextResiduePatch,
} from './workflow-task-context-adapter.type'

// 创建三方导入/同步使用的 workflow 原生任务上下文。
export function createWorkflowTaskContext<
  TPayload,
  TResidue extends WorkflowTaskContextResidue,
>(
  workflowContext: WorkflowExecutionContext,
  payload: TPayload,
  options: WorkflowTaskContextAdapterOptions = {},
) {
  let residue = {} as TResidue
  const uploadedResidueIds = new Map<string, string>()

  return {
    jobId: workflowContext.jobId,
    workflowType: workflowContext.workflowType,
    payload,
    isCancelRequested: workflowContext.isCancelRequested,
    assertNotCancelled: workflowContext.assertNotCancelled,
    assertStillOwned: workflowContext.assertStillOwned,
    updateProgress: workflowContext.updateProgress,
    createProgressReporter: (progressOptions: ThirdPartyComicImportProgressReporterOptions) =>
      createWorkflowProgressReporter(workflowContext, progressOptions, options),
    recordResidue: async (patch: WorkflowTaskContextResiduePatch<TResidue>) => {
      await recordUploadedFileResidues(
        workflowContext,
        residue,
        patch,
        uploadedResidueIds,
        options,
      )
      residue = {
        ...residue,
        ...patch,
      }
    },
    getResidue: async () => residue,
    markUploadedFileResidueCleaned: async (uploadedFile: UploadDeleteTarget) => {
      const residueId = uploadedResidueIds.get(toUploadedFileResidueKey(uploadedFile))
      if (residueId) {
        await options.contentImportService?.markResiduesCleaned([residueId])
      }
    },
    markUploadedFileResidueCleanupFailed: async (
      uploadedFile: UploadDeleteTarget,
      errorMessage: string,
    ) => {
      const residueId = uploadedResidueIds.get(toUploadedFileResidueKey(uploadedFile))
      if (residueId) {
        await options.contentImportService?.markResidueCleanupFailed(
          residueId,
          errorMessage,
        )
      }
    },
    markUploadedResiduesCleaned: async () => {
      await options.contentImportService?.markResiduesCleaned([
        ...uploadedResidueIds.values(),
      ])
    },
  }
}

// 将新追加的上传残留持久化，避免 worker 崩溃后只剩内存记录。
async function recordUploadedFileResidues<TResidue extends WorkflowTaskContextResidue>(
  workflowContext: WorkflowExecutionContext,
  currentResidue: TResidue,
  patch: WorkflowTaskContextResiduePatch<TResidue>,
  uploadedResidueIds: Map<string, string>,
  options: WorkflowTaskContextAdapterOptions,
) {
  const nextUploadedFiles = Array.isArray(patch.uploadedFiles)
    ? patch.uploadedFiles
    : []
  if (!options.contentImportService || nextUploadedFiles.length === 0) {
    return
  }
  const currentKeys = new Set(
    (currentResidue.uploadedFiles ?? []).map(toUploadedFileResidueKey),
  )
  for (const uploadedFile of nextUploadedFiles) {
    const key = toUploadedFileResidueKey(uploadedFile)
    if (currentKeys.has(key) || uploadedResidueIds.has(key)) {
      continue
    }
    const residueId = await options.contentImportService.recordUploadedFileResidue({
      attemptId: workflowContext.attemptId,
      deleteTarget: uploadedFile,
      itemId: options.itemId,
      jobId: workflowContext.jobId,
    })
    uploadedResidueIds.set(key, residueId)
  }
}

// 上传文件删除句柄的稳定本地 key。
function toUploadedFileResidueKey(uploadedFile: UploadDeleteTarget) {
  return `${uploadedFile.provider}:${uploadedFile.filePath}:${uploadedFile.objectKey ?? ''}`
}

// 创建区间进度 reporter，供章节内容读取和图片导入复用。
function createWorkflowProgressReporter(
  context: WorkflowExecutionContext,
  progressOptions: ThirdPartyComicImportProgressReporterOptions,
  adapterOptions: WorkflowTaskContextAdapterOptions,
) {
  const total = Math.max(1, progressOptions.total)
  const startPercent = progressOptions.startPercent ?? 0
  const endPercent = progressOptions.endPercent ?? 100
  let current = 0

  return {
    advance: async (
      input: ThirdPartyComicImportProgressReporterAdvanceInput = {},
    ) => {
      current =
        input.current !== undefined
          ? input.current
          : Math.min(total, current + (input.amount ?? 1))
      const progress: ThirdPartyComicImportProgress = {
        current,
        detail: input.detail ?? progressOptions.detail,
        message: input.message ?? progressOptions.message,
        percent: Math.round(
          startPercent + ((endPercent - startPercent) * current) / total,
        ),
        stage: progressOptions.stage,
        total,
        unit: progressOptions.unit,
      }
      await context.updateProgress({
        detail: normalizeImageProgressDetail(
          context,
          progress.detail,
          adapterOptions,
        ),
        message: progress.message,
      })
      return progress
    },
  }
}

// 规范化内容导入图片进度详情，保证前端不解析进度文案也能定位当前行。
function normalizeImageProgressDetail(
  context: WorkflowExecutionContext,
  detail: WorkflowObject | undefined,
  options: WorkflowTaskContextAdapterOptions,
): WorkflowObject | null {
  if (!detail) {
    return null
  }

  return {
    kind: 'content-import.image',
    workflowType: context.workflowType,
    ...(options.itemId ? { itemId: options.itemId } : {}),
    ...detail,
  }
}
