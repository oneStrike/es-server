import type { ContentImportService } from '@libs/content/work/content-import/content-import.service'
import type { UploadDeleteTarget } from '@libs/platform/modules/upload/upload.type'

/** workflow task context adapter 支持持久化的上传残留基础形状。 */
export interface WorkflowTaskContextResidue {
  uploadedFiles?: UploadDeleteTarget[]
}

/** workflow task context adapter 的外部依赖与当前条目定位。 */
export interface WorkflowTaskContextAdapterOptions {
  contentImportService?: ContentImportService
  itemId?: string
}

/** workflow task context 记录残留时的局部补丁。 */
export type WorkflowTaskContextResiduePatch<
  TResidue extends WorkflowTaskContextResidue,
> = Partial<TResidue>
