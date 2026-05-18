/// <reference types="jest" />

jest.mock('@libs/platform/modules/upload/upload.service', () => ({
  UploadService: class UploadService {},
}))
jest.mock('uuid', () => ({
  v4: () => 'generated-id',
}))

import type { ConfigService } from '@nestjs/config'
import type { UploadService } from '@libs/platform/modules/upload/upload.service'
import type { WorkflowService } from '@libs/platform/modules/workflow/workflow.service'
import type { ContentImportService } from '@libs/content/work/content-import/content-import.service'
import { DrizzleService } from '@db/core'
import { ComicArchiveImportService } from './comic-archive-import.service'

function createService() {
  const updateWhere = jest.fn()
  const updateSet = jest.fn(() => ({ where: updateWhere }))
  const update = jest.fn(() => ({ set: updateSet }))
  const db = {
    update,
  }
  const drizzle = {
    db,
    assertAffectedRows: jest.fn(),
    schema: {
      contentImportJob: { id: 'contentImportJob.id' },
      work: {},
      workChapter: {
        deletedAt: 'workChapter.deletedAt',
        id: 'workChapter.id',
        workId: 'workChapter.workId',
      },
      workflowJob: {},
    },
    withTransaction: jest.fn(async (callback) => callback(db)),
  }
  const uploadService = {
    deleteUploadedFile: jest.fn(),
    uploadLocalFileWithDeleteTarget: jest.fn(),
  }
  const workflowService = {
    cancelJob: jest.fn(),
  }
  const contentImportService = {
    listPendingUploadedFileResidues: jest.fn(async () => []),
    markResidueCleanupFailed: jest.fn(),
    markResiduesCleaned: jest.fn(),
    recordUploadedFileResidue: jest.fn(async () => 'residue-1'),
    readContentImportJobByWorkflowJobId: jest.fn(),
  }
  const configService = {
    get: jest.fn(() => ({
      allowExtensions: {
        image: ['jpg', 'png', 'webp'],
      },
      tmpDir: '/tmp/es-upload',
    })),
  }

  const service = new ComicArchiveImportService(
    drizzle as unknown as DrizzleService,
    uploadService as unknown as UploadService,
    configService as unknown as ConfigService,
    workflowService as unknown as WorkflowService,
    contentImportService as unknown as ContentImportService,
  )

  return {
    contentImportService,
    db,
    service,
    updateSet,
    updateWhere,
    uploadService,
    workflowService,
  }
}

describe('ComicArchiveImportService workflow cleanup', () => {
  it('cancels the workflow draft before removing draft files', async () => {
    const { service, workflowService } = createService()
    const events: string[] = []
    jest.spyOn(service as any, 'removeTaskDir').mockImplementation(async () => {
      events.push('remove-files')
    })
    workflowService.cancelJob.mockImplementation(async () => {
      events.push('cancel-workflow')
      return { jobId: 'job-1' }
    })

    await expect(
      service.discardArchivePreview({ jobId: 'job-1' }),
    ).resolves.toEqual({ jobId: 'job-1' })

    expect(events).toEqual(['cancel-workflow', 'remove-files'])
    expect(workflowService.cancelJob).toHaveBeenCalledWith({ jobId: 'job-1' })
  })

  it('rejects closed preview drafts before reading the upload stream', async () => {
    const { service } = createService()
    const req = { file: jest.fn() }
    jest.spyOn(service as any, 'assertWorkExists').mockResolvedValue(undefined)
    jest
      .spyOn(service as any, 'assertArchiveDraftOpen')
      .mockRejectedValue(new Error('draft closed'))

    await expect(
      service.previewArchive(req as never, { jobId: 'job-1', workId: 1 }),
    ).rejects.toThrow('draft closed')

    expect(req.file).not.toHaveBeenCalled()
  })

  it('clears retained archive paths when an archive workflow is expired', async () => {
    const { contentImportService, service, updateSet } = createService()
    jest.spyOn(service as any, 'removeTaskDir').mockResolvedValue(undefined)
    contentImportService.readContentImportJobByWorkflowJobId.mockResolvedValue({
      id: 11n,
    })

    await service.cleanupRetainedResources('job-1')

    expect((service as any).removeTaskDir).toHaveBeenCalledWith('job-1')
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        archivePath: null,
        extractPath: null,
      }),
    )
  })
})

describe('ComicArchiveImportService chapter atomicity', () => {
  it('emits structured progress for each uploaded archive image', async () => {
    const { contentImportService, service, uploadService } = createService()
    const updateProgress = jest.fn(async () => undefined)
    contentImportService.recordUploadedFileResidue
      .mockResolvedValueOnce('residue-1')
      .mockResolvedValueOnce('residue-2')
    uploadService.uploadLocalFileWithDeleteTarget
      .mockResolvedValueOnce({
        deleteTarget: {
          filePath: 'uploaded/001.jpg',
          objectKey: 'comic/1/chapter/101/job-1/001.jpg',
          provider: 'local',
        },
        upload: { filePath: 'uploaded/001.jpg' },
      })
      .mockResolvedValueOnce({
        deleteTarget: {
          filePath: 'uploaded/002.jpg',
          objectKey: 'comic/1/chapter/101/job-1/002.jpg',
          provider: 'local',
        },
        upload: { filePath: 'uploaded/002.jpg' },
      })

    await expect(
      (service as any).importChapter(
        {
          assertStillOwned: jest.fn(),
          attemptId: 'attempt-1',
          chapterIndex: 2,
          chapterTotal: 5,
          itemId: 'item-1',
          jobId: 'job-1',
          updateProgress,
          workId: 1,
        },
        {
          chapterId: 101,
          chapterTitle: '第 101 话',
          existingImageCount: 0,
          hasExistingContent: false,
          imageCount: 2,
          imagePaths: ['/tmp/001.jpg', '/tmp/002.jpg'],
          importMode: 'replace',
          message: '可导入',
          path: '101',
          warningMessage: '',
        },
      ),
    ).resolves.toEqual(['uploaded/001.jpg', 'uploaded/002.jpg'])

    expect(updateProgress).toHaveBeenNthCalledWith(1, {
      detail: {
        kind: 'content-import.image',
        workflowType: 'content-import.archive-import',
        itemId: 'item-1',
        localChapterId: 101,
        chapterIndex: 2,
        chapterTotal: 5,
        imageIndex: 1,
        imageTotal: 2,
        title: '第 101 话',
      },
      message: '已导入压缩包章节 2/5 的第 1/2 张图片',
    })
    expect(updateProgress).toHaveBeenNthCalledWith(2, {
      detail: expect.objectContaining({
        imageIndex: 2,
        imageTotal: 2,
        localChapterId: 101,
      }),
      message: '已导入压缩包章节 2/5 的第 2/2 张图片',
    })
  })

  it('does not overwrite chapter content when any image upload fails', async () => {
    const { contentImportService, db, service, uploadService } = createService()
    const deleteTarget = {
      filePath: 'uploaded/001.jpg',
      objectKey: 'comic/1/chapter/101/job-1/001.jpg',
      provider: 'local',
    }
    uploadService.uploadLocalFileWithDeleteTarget
      .mockResolvedValueOnce({
        deleteTarget,
        upload: { filePath: 'uploaded/001.jpg' },
      })
      .mockRejectedValueOnce(new Error('upstream image upload failed'))

    await expect(
      (service as any).importChapter(
        {
          assertStillOwned: jest.fn(),
          attemptId: 'attempt-1',
          itemId: 'item-1',
          jobId: 'job-1',
          workId: 1,
        },
        {
          chapterId: 101,
          chapterTitle: '第 101 话',
          existingImageCount: 0,
          hasExistingContent: false,
          imageCount: 2,
          imagePaths: ['/tmp/001.jpg', '/tmp/002.jpg'],
          importMode: 'replace',
          message: '可导入',
          path: '101',
          warningMessage: '',
        },
      ),
    ).rejects.toThrow('upstream image upload failed')

    expect(db.update).not.toHaveBeenCalled()
    expect(uploadService.deleteUploadedFile).toHaveBeenCalledWith(deleteTarget)
    expect(contentImportService.recordUploadedFileResidue).toHaveBeenCalledWith({
      attemptId: 'attempt-1',
      deleteTarget,
      itemId: 'item-1',
      jobId: 'job-1',
    })
    expect(contentImportService.markResiduesCleaned).toHaveBeenCalledWith([
      'residue-1',
    ])
  })
})
