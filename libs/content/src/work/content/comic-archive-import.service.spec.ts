/// <reference types="jest" />

jest.mock('@libs/platform/modules/upload/upload.service', () => ({
  UploadService: class UploadService {},
}))
jest.mock('uuid', () => ({
  v4: () => 'generated-task-id',
}))

import type { ConfigService } from '@nestjs/config'
import type { UploadService } from '@libs/platform/modules/upload/upload.service'
import type { ComicArchiveTaskRecord } from './comic-archive-import.type'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  ComicArchivePreviewModeEnum,
  ComicArchiveTaskStatusEnum,
} from './comic-archive-import.constant'
import { ComicArchiveImportService } from './comic-archive-import.service'

function createService() {
  const db = {
    delete: jest.fn(),
    insert: jest.fn(),
    query: {},
    select: jest.fn(),
    update: jest.fn(),
  }
  const drizzle = {
    assertAffectedRows: jest.fn(),
    db,
    ext: {
      exists: jest.fn(),
    },
    schema: {
      work: {},
      workChapter: {},
      workComicArchiveImportPreviewSession: {},
      workComicArchiveImportTask: {},
    },
    withErrorHandling: jest.fn(async <T>(callback: () => Promise<T>) =>
      callback(),
    ),
    withTransaction: jest.fn(
      async <T>(callback: (tx: typeof db) => Promise<T>) => callback(db),
    ),
  }
  const uploadService = {}
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
    uploadService as UploadService,
    configService as unknown as ConfigService,
  )

  return { db, drizzle, service }
}

function createTaskRecord(
  overrides: Partial<ComicArchiveTaskRecord> = {},
): ComicArchiveTaskRecord {
  const now = new Date('2026-05-14T00:00:00.000Z')

  return {
    archiveName: 'chapters.zip',
    archivePath: '/tmp/es-upload/comic-archive-import/task-1/source.zip',
    confirmedChapterIds: [],
    createdAt: now,
    expiresAt: new Date('2026-05-15T00:00:00.000Z'),
    extractPath: '/tmp/es-upload/comic-archive-import/task-1/extract',
    finishedAt: null,
    ignoredItems: [],
    lastError: null,
    matchedItems: [
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
    ],
    mode: ComicArchivePreviewModeEnum.MULTI_CHAPTER,
    requireConfirm: true,
    resultItems: [],
    startedAt: null,
    status: ComicArchiveTaskStatusEnum.DRAFT,
    summary: {
      ignoredItemCount: 0,
      imageCount: 2,
      matchedChapterCount: 1,
    },
    taskId: 'task-1',
    updatedAt: now,
    workId: 1,
    ...overrides,
  }
}

describe('ComicArchiveImportService strong discard', () => {
  it('creates an open preview session before upload starts', async () => {
    const { service } = createService()
    const assertWorkExists = jest
      .spyOn(service as any, 'assertWorkExists')
      .mockResolvedValue(undefined)
    const createPreviewSessionRecord = jest
      .spyOn(service as any, 'createPreviewSessionRecord')
      .mockResolvedValue(undefined)

    const result = await (service as any).createPreviewSession({
      chapterId: 101,
      workId: 1,
    })

    expect(result.taskId).toEqual(expect.any(String))
    expect(assertWorkExists).toHaveBeenCalledWith(1)
    expect(createPreviewSessionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterId: 101,
        status: 1,
        taskId: result.taskId,
        workId: 1,
      }),
    )
  })

  it('hard-deletes a claimed pre-confirm draft only after temp files are removed', async () => {
    const { service } = createService()
    const events: string[] = []
    jest
      .spyOn(service as any, 'claimPreviewSessionForDiscard')
      .mockResolvedValue({
        taskId: 'task-1',
      })
    jest
      .spyOn(service as any, 'tryReadTaskRecord')
      .mockResolvedValue(createTaskRecord())
    jest.spyOn(service as any, 'removeTaskDir').mockImplementation(async () => {
      events.push('remove-files')
    })
    jest
      .spyOn(service as any, 'deletePreConfirmResidue')
      .mockImplementation(async () => {
        events.push('delete-db')
      })

    await expect(
      (service as any).discardArchivePreview({ taskId: 'task-1' }),
    ).resolves.toBe(true)

    expect(events).toEqual(['remove-files', 'delete-db'])
  })

  it('keeps the draft/session retryable when temp file deletion fails', async () => {
    const { service } = createService()
    jest
      .spyOn(service as any, 'claimPreviewSessionForDiscard')
      .mockResolvedValue({
        taskId: 'task-1',
      })
    jest
      .spyOn(service as any, 'tryReadTaskRecord')
      .mockResolvedValue(createTaskRecord())
    jest
      .spyOn(service as any, 'removeTaskDir')
      .mockRejectedValue(new Error('locked'))
    const deletePreConfirmResidue = jest
      .spyOn(service as any, 'deletePreConfirmResidue')
      .mockResolvedValue(undefined)

    await expect(
      (service as any).discardArchivePreview({ taskId: 'task-1' }),
    ).rejects.toThrow('locked')

    expect(deletePreConfirmResidue).not.toHaveBeenCalled()
  })

  it('rejects discard for confirmed background-owned tasks', async () => {
    const { service } = createService()
    jest
      .spyOn(service as any, 'claimPreviewSessionForDiscard')
      .mockResolvedValue({
        taskId: 'task-1',
      })
    jest.spyOn(service as any, 'tryReadTaskRecord').mockResolvedValue(
      createTaskRecord({
        confirmedChapterIds: [101],
        status: ComicArchiveTaskStatusEnum.PENDING,
      }),
    )
    const removeTaskDir = jest
      .spyOn(service as any, 'removeTaskDir')
      .mockResolvedValue(undefined)

    await expect(
      (service as any).discardArchivePreview({ taskId: 'task-1' }),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
    } satisfies Partial<BusinessException>)

    expect(removeTaskDir).not.toHaveBeenCalled()
  })

  it('requires an open preview session before confirming a draft', async () => {
    const { service } = createService()
    const record = createTaskRecord()
    jest.spyOn(service as any, 'readTaskRecord').mockResolvedValue(record)
    jest
      .spyOn(service as any, 'assertDraftTaskAvailable')
      .mockResolvedValue(record)
    jest
      .spyOn(service as any, 'claimPreviewSessionForConfirm')
      .mockResolvedValue(false)
    const updateTaskRecord = jest
      .spyOn(service as any, 'updateTaskRecord')
      .mockResolvedValue(undefined)

    await expect(
      service.confirmArchive({
        confirmedChapterIds: [101],
        taskId: 'task-1',
      }),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
    } satisfies Partial<BusinessException>)

    expect(updateTaskRecord).not.toHaveBeenCalled()
  })

  it('exposes backgroundOwned only after confirmed chapter ids are persisted', () => {
    const { service } = createService()

    expect(
      (service as any).toTaskView(createTaskRecord()).backgroundOwned,
    ).toBe(false)
    expect(
      (service as any).toTaskView(
        createTaskRecord({
          confirmedChapterIds: [101],
          status: ComicArchiveTaskStatusEnum.EXPIRED,
        }),
      ).backgroundOwned,
    ).toBe(true)
  })
})
