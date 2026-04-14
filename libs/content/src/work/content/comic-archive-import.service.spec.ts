import { ComicArchiveImportService } from './comic-archive-import.service'
import {
  ComicArchiveImportItemStatusEnum,
  ComicArchivePreviewModeEnum,
  ComicArchiveTaskStatusEnum,
} from './comic-archive-import.type'

jest.mock('@libs/platform/modules/upload/upload.service', () => ({
  UploadService: class {},
}))

jest.mock('uuid', () => ({
  v4: () => 'mock-task-id',
}))

describe('comicArchiveImportService', () => {
  function createService() {
    return new ComicArchiveImportService(
      {
        db: {},
        schema: {},
        withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      } as any,
      {} as any,
      {
        get: jest.fn().mockReturnValue({
          tmpDir: '/tmp',
          allowExtensions: { image: ['jpg', 'jpeg', 'png', 'webp'] },
        }),
      } as any,
    )
  }

  it('uses numeric enums for archive mode and status contracts', () => {
    expect(ComicArchivePreviewModeEnum.SINGLE_CHAPTER).toBe(1)
    expect(ComicArchivePreviewModeEnum.MULTI_CHAPTER).toBe(2)
    expect(ComicArchiveTaskStatusEnum.DRAFT).toBe(0)
    expect(ComicArchiveTaskStatusEnum.CANCELLED).toBe(7)
    expect(ComicArchiveImportItemStatusEnum.PENDING).toBe(0)
    expect(ComicArchiveImportItemStatusEnum.SUCCESS).toBe(1)
    expect(ComicArchiveImportItemStatusEnum.FAILED).toBe(2)
  })

  it('converts persisted numeric values into task view records', () => {
    const service = createService()

    const record = (service as any).toTaskRecord({
      taskId: 'task-1',
      workId: 9,
      mode: 2,
      status: 3,
      archiveName: 'archive.zip',
      archivePath: '/tmp/source.zip',
      extractPath: '/tmp/extract',
      requireConfirm: true,
      summary: {
        matchedChapterCount: 1,
        ignoredItemCount: 0,
        imageCount: 3,
      },
      matchedItems: [],
      ignoredItems: [],
      resultItems: [
        {
          chapterId: 101,
          chapterTitle: '第101话',
          importedImageCount: 3,
          status: 1,
          message: 'ok',
        },
      ],
      confirmedChapterIds: [101],
      startedAt: null,
      finishedAt: null,
      expiresAt: new Date('2026-04-15T00:00:00.000Z'),
      lastError: null,
      createdAt: new Date('2026-04-14T00:00:00.000Z'),
      updatedAt: new Date('2026-04-14T00:00:00.000Z'),
    })

    expect(record).toMatchObject({
      mode: ComicArchivePreviewModeEnum.MULTI_CHAPTER,
      status: ComicArchiveTaskStatusEnum.SUCCESS,
      resultItems: [
        expect.objectContaining({
          status: ComicArchiveImportItemStatusEnum.SUCCESS,
        }),
      ],
    })
  })

  it('rejects legacy string status payloads', () => {
    const service = createService()

    expect(() =>
      (service as any).toTaskRecord({
        taskId: 'task-legacy',
        workId: 9,
        mode: ComicArchivePreviewModeEnum.MULTI_CHAPTER,
        status: 'draft',
        archiveName: 'archive.zip',
        archivePath: '/tmp/source.zip',
        extractPath: '/tmp/extract',
        requireConfirm: true,
        summary: {
          matchedChapterCount: 1,
          ignoredItemCount: 0,
          imageCount: 3,
        },
        matchedItems: [],
        ignoredItems: [],
        resultItems: [],
        confirmedChapterIds: [],
        startedAt: null,
        finishedAt: null,
        expiresAt: new Date('2026-04-15T00:00:00.000Z'),
        lastError: null,
        createdAt: new Date('2026-04-14T00:00:00.000Z'),
        updatedAt: new Date('2026-04-14T00:00:00.000Z'),
      }),
    ).toThrow('漫画压缩包导入任务状态非法')
  })
})
