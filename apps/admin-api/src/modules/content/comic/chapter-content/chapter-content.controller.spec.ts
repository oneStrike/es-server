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
  it('creates archive preview sessions through the archive import service', async () => {
    const comicContentService = {} as ComicContentService
    const comicArchiveImportService = {
      createPreviewSession: jest.fn(() =>
        Promise.resolve({ taskId: 'session-1' }),
      ),
    } as unknown as ComicArchiveImportService
    const controller = new ChapterContentController(
      comicContentService,
      comicArchiveImportService,
    )

    await expect(
      controller.archiveSession({ chapterId: 101, workId: 1 }),
    ).resolves.toEqual({ taskId: 'session-1' })

    expect(comicArchiveImportService.createPreviewSession).toHaveBeenCalledWith(
      {
        chapterId: 101,
        workId: 1,
      },
    )
  })

  it('discards archive preview sessions through the archive import service', async () => {
    const comicContentService = {} as ComicContentService
    const comicArchiveImportService = {
      discardArchivePreview: jest.fn(() => Promise.resolve(true)),
    } as unknown as ComicArchiveImportService
    const controller = new ChapterContentController(
      comicContentService,
      comicArchiveImportService,
    )

    await expect(
      controller.archiveDiscard({ taskId: 'session-1' }),
    ).resolves.toBe(true)

    expect(
      comicArchiveImportService.discardArchivePreview,
    ).toHaveBeenCalledWith({
      taskId: 'session-1',
    })
  })
})
