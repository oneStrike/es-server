/// <reference types="jest" />

jest.mock('@libs/platform/modules/upload/upload.service', () => ({
  UploadService: class UploadService {},
}))
jest.mock('uuid', () => ({
  v4: () => 'generated-task-id',
}))

import type { ComicArchiveImportService } from '@libs/content/work/content/comic-archive-import.service'
import type { ComicContentService } from '@libs/content/work/content/comic-content.service'
import { ChapterContentController } from './chapter-content.controller'

describe('ChapterContentController archive import', () => {
  const workflowJob = {
    cancelRequestedAt: null,
    createdAt: new Date('2026-05-17T00:00:00.000Z'),
    displayName: 'archive.zip',
    expiresAt: null,
    failedItemCount: 0,
    finishedAt: null,
    id: 1,
    jobId: 'session-1',
    operatorType: 1,
    operatorUserId: 7,
    progressMessage: null,
    progressPercent: 0,
    selectedItemCount: 2,
    skippedItemCount: 0,
    startedAt: null,
    status: 2,
    successItemCount: 0,
    summary: null,
    updatedAt: new Date('2026-05-17T00:00:00.000Z'),
    workflowType: 'content-import.archive',
  }
  const archiveDetail = {
    ignoredItems: [],
    jobId: 'session-1',
    matchedItems: [
      {
        chapterId: 101,
        chapterTitle: '第 101 话',
        existingImageCount: 0,
        hasExistingContent: false,
        imageCount: 2,
        importMode: 'replace',
        message: '可导入',
        path: '101',
        warningMessage: '',
      },
    ],
    mode: 2,
    requireConfirm: true,
    resultItems: [],
    status: 0,
    summary: {
      ignoredItemCount: 0,
      imageCount: 2,
      matchedChapterCount: 1,
    },
    workId: 1,
  }

  it('creates archive preview sessions through the archive import service', async () => {
    const comicContentService = {} as ComicContentService
    const comicArchiveImportService = {
      createPreviewSession: jest.fn(() =>
        Promise.resolve({ jobId: 'session-1' }),
      ),
    } as unknown as ComicArchiveImportService
    const controller = new ChapterContentController(
      comicContentService,
      comicArchiveImportService,
    )

    await expect(
      controller.archiveSession({ chapterId: 101, workId: 1 }, 7),
    ).resolves.toEqual({ jobId: 'session-1' })

    expect(comicArchiveImportService.createPreviewSession).toHaveBeenCalledWith(
      {
        chapterId: 101,
        workId: 1,
      },
      7,
    )
  })

  it('discards archive preview sessions through the archive import service', async () => {
    const comicContentService = {} as ComicContentService
    const comicArchiveImportService = {
      discardArchivePreview: jest.fn(() =>
        Promise.resolve({ jobId: 'session-1' }),
      ),
    } as unknown as ComicArchiveImportService
    const controller = new ChapterContentController(
      comicContentService,
      comicArchiveImportService,
    )

    await expect(
      controller.archiveDiscard({ jobId: 'session-1' }),
    ).resolves.toEqual({ jobId: 'session-1' })

    expect(
      comicArchiveImportService.discardArchivePreview,
    ).toHaveBeenCalledWith({
      jobId: 'session-1',
    })
  })

  it('confirms archive preview sessions and keeps WorkflowJobDto fields', async () => {
    const comicContentService = {} as ComicContentService
    const comicArchiveImportService = {
      confirmArchive: jest.fn(async () => workflowJob),
    } as unknown as ComicArchiveImportService
    const controller = new ChapterContentController(
      comicContentService,
      comicArchiveImportService,
    )

    await expect(
      controller.archiveConfirm({
        confirmedChapterIds: [101, 102],
        jobId: 'session-1',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        displayName: 'archive.zip',
        jobId: 'session-1',
        selectedItemCount: 2,
        workflowType: 'content-import.archive',
      }),
    )

    expect(comicArchiveImportService.confirmArchive).toHaveBeenCalledWith({
      confirmedChapterIds: [101, 102],
      jobId: 'session-1',
    })
  })

  it('reads archive detail by workflow jobId', async () => {
    const comicContentService = {} as ComicContentService
    const comicArchiveImportService = {
      getArchiveDetail: jest.fn(async () => archiveDetail),
    } as unknown as ComicArchiveImportService
    const controller = new ChapterContentController(
      comicContentService,
      comicArchiveImportService,
    )

    await expect(
      controller.archiveDetail({ jobId: 'session-1' }),
    ).resolves.toEqual(
      expect.objectContaining({
        jobId: 'session-1',
        matchedItems: [
          expect.objectContaining({
            chapterId: 101,
            chapterTitle: '第 101 话',
          }),
        ],
        summary: expect.objectContaining({
          imageCount: 2,
          matchedChapterCount: 1,
        }),
      }),
    )

    expect(comicArchiveImportService.getArchiveDetail).toHaveBeenCalledWith({
      jobId: 'session-1',
    })
  })
})
