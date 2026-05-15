import {
  ThirdPartyComicImportChapterActionEnum,
  ThirdPartyComicImportCoverModeEnum,
  ThirdPartyComicImportModeEnum,
} from '@libs/content/work/content/dto/content.dto'
import {
  BackgroundTaskOperatorTypeEnum,
  BackgroundTaskStatusEnum,
} from '@libs/platform/modules/background-task/background-task.constant'
import { UploadProviderEnum } from '@libs/platform/modules/upload/upload.type'
import { THIRD_PARTY_COMIC_IMPORT_TASK_TYPE } from '../third-party-comic-import.constant'

jest.mock('@libs/content/work/content/comic-content.service', () => ({
  ComicContentService: class ComicContentService {},
}))
jest.mock('@libs/content/work/core/work.service', () => ({
  WorkService: class WorkService {},
}))
jest.mock('@libs/content/work/chapter/work-chapter.service', () => ({
  WorkChapterService: class WorkChapterService {},
}))
jest.mock('./remote-image-import.service', () => ({
  RemoteImageImportService: class RemoteImageImportService {},
}))

const {
  ThirdPartyComicImportService,
} = require('./third-party-comic-import.service')

describe('ThirdPartyComicImportService', () => {
  const detail = {
    id: 'woduzishenji',
    uuid: 'comic-uuid',
    name: '我獨自升級',
    alias: 'Solo Leveling',
    pathWord: 'woduzishenji',
    cover: 'https://sw.mangafunb.fun/w/woduzishenji/cover.jpg',
    brief: '作品简介',
    region: '韩国',
    status: '已完结',
    authors: ['DUBU'],
    taxonomies: ['冒险'],
    popular: 1,
    groups: [{ pathWord: 'default', name: '默认', count: 1 }],
    sourceFlags: {
      isLock: false,
      isLogin: false,
      isMobileBind: false,
      isVip: false,
    },
  }
  const chapters = [
    {
      providerChapterId: 'chapter-001',
      chapterApiVersion: 1,
      title: '第1话',
      group: 'default',
      sortOrder: 1,
      imageCount: 2,
    },
  ]
  const provider = {
    getDetail: jest.fn(async () => detail),
    getChapters: jest.fn(async () => chapters),
    getChapterContent: jest.fn(async () => ({
      providerChapterId: 'chapter-001',
      title: '第1话',
      images: [
        {
          providerImageId: 'image-001',
          url: 'https://sw.mangafunb.fun/w/woduzishenji/1.jpg',
          sortOrder: 1,
        },
      ],
    })),
  }
  const uploadedCover = {
    deleteTarget: {
      provider: UploadProviderEnum.LOCAL,
      filePath: '/uploads/imported.jpg',
      objectKey: 'comic/image/imported.jpg',
    },
    upload: {
      filePath: '/uploads/imported.jpg',
    },
  }
  const uploadedImage = {
    deleteTarget: {
      provider: UploadProviderEnum.LOCAL,
      filePath: '/uploads/1.jpg',
      objectKey: 'work/comic/100/chapter/300/001.jpg',
    },
    upload: {
      filePath: '/uploads/1.jpg',
      fileSize: 3,
      mimeType: 'image/jpeg',
    },
  }

  function createService(overrides: Record<string, unknown> = {}) {
    const registry = {
      resolve: jest.fn(() => provider),
    }
    const workService = {
      createWorkReturningId: jest.fn(async () => 100),
      deleteWork: jest.fn(async () => true),
      getWorkDetail: jest.fn(async () => ({ id: 200 })),
    }
    const workChapterService = {
      createChapterReturningId: jest.fn(async () => 300),
      deleteChapters: jest.fn(async () => true),
      updateChapter: jest.fn(async () => true),
    }
    const comicContentService = {
      replaceChapterContents: jest.fn(async () => true),
    }
    const remoteImageImportService = {
      deleteImportedFile: jest.fn(async () => undefined),
      importImage: jest.fn(async () => uploadedCover),
      importImages: jest.fn(async () => ['/uploads/1.jpg']),
    }
    const backgroundTaskService = {
      createTask: jest.fn(async (input) => ({
        operatorType: input.operator?.type,
        operatorUserId: input.operator?.userId ?? null,
        taskId: 'task-001',
        taskType: input.taskType,
        status: BackgroundTaskStatusEnum.PENDING,
        payload: input.payload,
      })),
    }
    const drizzle = {
      db: {},
      schema: {},
    }

    return {
      backgroundTaskService,
      comicContentService,
      provider,
      registry,
      remoteImageImportService,
      service: new ThirdPartyComicImportService(
        registry as never,
        workService as never,
        workChapterService as never,
        comicContentService as never,
        remoteImageImportService as never,
        backgroundTaskService as never,
        drizzle as never,
      ),
      workChapterService,
      workService,
      ...overrides,
    }
  }

  function createImportRequest() {
    return {
      chapters: [
        {
          action: ThirdPartyComicImportChapterActionEnum.CREATE,
          chapterApiVersion: 1,
          importImages: true,
          providerChapterId: 'chapter-001',
          sortOrder: 1,
          title: '第1话',
        },
      ],
      comicId: 'woduzishenji',
      cover: {
        mode: ThirdPartyComicImportCoverModeEnum.PROVIDER,
        providerImageId: 'cover:woduzishenji',
      },
      mode: ThirdPartyComicImportModeEnum.CREATE_NEW,
      platform: 'copy',
      sourceSnapshot: { providerComicId: 'woduzishenji' },
      workDraft: {
        authorIds: [1],
        canComment: true,
        categoryIds: [1],
        chapterPrice: 0,
        description: '作品简介',
        isHot: false,
        isNew: false,
        isPublished: false,
        isRecommended: false,
        language: 'zh-CN',
        name: '我獨自升級',
        recommendWeight: 0,
        region: 'KR',
        serialStatus: 2,
        tagIds: [1],
        viewRule: 0,
      },
    }
  }

  function createExecutionContext(
    initialResidue: Record<string, unknown> = {},
    onRecordResidue?: (patch: Record<string, unknown>) => Promise<void> | void,
  ) {
    const residue = { ...initialResidue }
    const context = {
      assertNotCancelled: jest.fn(async () => undefined),
      createProgressReporter: jest.fn(
        (options: {
          endPercent?: number
          stage?: string
          startPercent?: number
          total: number
          unit?: string
        }) => {
          let current = 0
          let lastPercent = options.startPercent ?? 0
          return {
            advance: jest.fn(
              async (
                input: {
                  amount?: number
                  current?: number
                  detail?: Record<string, unknown>
                  message?: string
                } = {},
              ) => {
                const total = options.total
                current =
                  input.current ??
                  Math.min(total, current + (input.amount ?? 1))
                const mappedPercent =
                  total > 0
                    ? Math.floor(
                        (options.startPercent ?? 0) +
                          (((options.endPercent ?? 100) -
                            (options.startPercent ?? 0)) *
                            current) /
                            total,
                      )
                    : (options.startPercent ?? 0)
                lastPercent = Math.max(lastPercent, mappedPercent)
                const progress = {
                  current,
                  detail: input.detail,
                  message: input.message,
                  percent: lastPercent,
                  stage: options.stage,
                  total,
                  unit: options.unit,
                }
                await context.updateProgress(progress)
                return progress
              },
            ),
          }
        },
      ),
      getResidue: jest.fn(async () => residue),
      recordResidue: jest.fn(async (patch) => {
        await onRecordResidue?.(patch)
        Object.assign(residue, patch)
      }),
      residue,
      taskId: 'task-001',
      taskType: THIRD_PARTY_COMIC_IMPORT_TASK_TYPE,
      updateProgress: jest.fn(
        async (_progress: Record<string, unknown>) => undefined,
      ),
    }
    return context
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('builds an import preview without local persistence side effects', async () => {
    const { service, workService, workChapterService, comicContentService } =
      createService()

    const preview = await service.previewImport({
      comicId: 'woduzishenji',
      platform: 'copy',
    })

    expect(preview.sourceSnapshot).toEqual(
      expect.objectContaining({
        providerComicId: 'woduzishenji',
        pathWord: 'woduzishenji',
        uuid: 'comic-uuid',
      }),
    )
    expect(preview.workDraft).toEqual(
      expect.objectContaining({
        name: '我獨自升級',
        alias: 'Solo Leveling',
        description: '作品简介',
        suggestedRegion: '韩国',
      }),
    )
    expect(preview.coverOptions.provider).toEqual({
      providerImageId: 'cover:woduzishenji',
      url: 'https://sw.mangafunb.fun/w/woduzishenji/cover.jpg',
    })
    expect(preview.chapters).toHaveLength(1)
    expect(workService.createWorkReturningId).not.toHaveBeenCalled()
    expect(workChapterService.createChapterReturningId).not.toHaveBeenCalled()
    expect(comicContentService.replaceChapterContents).not.toHaveBeenCalled()
  })

  it('creates a background task and does not execute import synchronously', async () => {
    const {
      backgroundTaskService,
      comicContentService,
      provider,
      service,
      workChapterService,
      workService,
    } = createService()

    const confirmImport = service.confirmImport as unknown as (
      dto: ReturnType<typeof createImportRequest>,
      userId: number,
    ) => Promise<unknown>

    const result = await confirmImport.call(service, createImportRequest(), 7)

    expect(result).toEqual(
      expect.objectContaining({
        operatorType: BackgroundTaskOperatorTypeEnum.ADMIN,
        operatorUserId: 7,
        status: BackgroundTaskStatusEnum.PENDING,
        taskId: 'task-001',
        taskType: THIRD_PARTY_COMIC_IMPORT_TASK_TYPE,
      }),
    )
    expect(backgroundTaskService.createTask).toHaveBeenCalledWith({
      taskType: THIRD_PARTY_COMIC_IMPORT_TASK_TYPE,
      payload: expect.objectContaining({
        comicId: 'woduzishenji',
        mode: ThirdPartyComicImportModeEnum.CREATE_NEW,
      }),
      operator: {
        type: BackgroundTaskOperatorTypeEnum.ADMIN,
        userId: 7,
      },
    })
    expect(provider.getDetail).not.toHaveBeenCalled()
    expect(workService.createWorkReturningId).not.toHaveBeenCalled()
    expect(workChapterService.createChapterReturningId).not.toHaveBeenCalled()
    expect(workChapterService.updateChapter).not.toHaveBeenCalled()
    expect(comicContentService.replaceChapterContents).not.toHaveBeenCalled()
  })

  it('executes the background import and records rollback residue', async () => {
    const {
      comicContentService,
      provider,
      remoteImageImportService,
      service,
      workChapterService,
      workService,
    } = createService()
    ;(remoteImageImportService.importImages as jest.Mock).mockImplementation(
      async (_images, _segments, onImported) => {
        await onImported({
          ...uploadedImage,
          filePath: uploadedImage.upload.filePath,
          image: {
            providerImageId: 'image-001',
            sortOrder: 1,
            url: 'https://sw.mangafunb.fun/w/woduzishenji/1.jpg',
          },
          imageIndex: 1,
          imageTotal: 1,
          safeSourceUrl: 'https://sw.mangafunb.fun/w/woduzishenji/1.jpg',
        })
        return ['/uploads/1.jpg']
      },
    )
    const context = createExecutionContext()

    const result = await service.executeImportTask(
      createImportRequest(),
      context as never,
    )

    expect(result).toEqual(
      expect.objectContaining({
        status: 'success',
        work: expect.objectContaining({ id: 100 }),
      }),
    )
    expect(provider.getDetail).toHaveBeenCalledWith({
      comicId: 'woduzishenji',
      platform: 'copy',
    })
    expect(workService.createWorkReturningId).toHaveBeenCalled()
    expect(workChapterService.createChapterReturningId).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '第1话',
        workId: 100,
      }),
    )
    expect(comicContentService.replaceChapterContents).toHaveBeenCalledWith(
      300,
      ['/uploads/1.jpg'],
    )
    expect(context.residue).toEqual({
      createdChapterIds: [300],
      createdWorkIds: [100],
      uploadedFiles: [uploadedCover.deleteTarget, uploadedImage.deleteTarget],
    })
    expect(context.createProgressReporter).toHaveBeenCalledWith({
      endPercent: 95,
      stage: 'image-import',
      startPercent: 10,
      total: 1,
      unit: 'image',
    })
    expect(context.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        current: 1,
        detail: expect.objectContaining({
          imageIndex: 1,
          imageTotal: 1,
          providerChapterId: 'chapter-001',
          providerImageId: 'image-001',
          safeSourceUrl: 'https://sw.mangafunb.fun/w/woduzishenji/1.jpg',
        }),
        percent: 95,
        stage: 'image-import',
        total: 1,
      }),
    )
  })

  it('preserves the original cause when provider cover import fails', async () => {
    const coverError = new Error('remote cover download failed')
    const { remoteImageImportService, service } = createService()
    ;(remoteImageImportService.importImage as jest.Mock).mockRejectedValue(
      coverError,
    )
    const context = createExecutionContext()

    await expect(
      service.executeImportTask(createImportRequest(), context as never),
    ).rejects.toMatchObject({
      cause: coverError,
      message: 'remote cover download failed',
    })
  })

  it('validates update overwrite before fetching chapter content', async () => {
    const request = {
      ...createImportRequest(),
      cover: undefined,
      mode: ThirdPartyComicImportModeEnum.ATTACH_TO_EXISTING,
      targetWorkId: 100,
      workDraft: undefined,
    }
    Object.assign(request.chapters[0], {
      action: ThirdPartyComicImportChapterActionEnum.UPDATE,
      overwriteContent: false,
      targetChapterId: 300,
    })
    const { provider, service, workChapterService } = createService()
    const context = createExecutionContext()

    await expect(
      service.executeImportTask(request, context as never),
    ).rejects.toThrow('更新章节内容必须确认覆盖')

    expect(provider.getChapterContent).not.toHaveBeenCalled()
    expect(workChapterService.updateChapter).not.toHaveBeenCalled()
  })

  it('does not create chapter residue when chapter content planning fails', async () => {
    const request = createImportRequest()
    request.chapters.push({
      ...request.chapters[0],
      providerChapterId: 'chapter-002',
      sortOrder: 2,
      title: '第2话',
    })
    const {
      comicContentService,
      provider,
      remoteImageImportService,
      service,
      workChapterService,
    } = createService()
    ;(provider.getChapterContent as jest.Mock)
      .mockResolvedValueOnce({
        providerChapterId: 'chapter-001',
        title: '第1话',
        images: [
          {
            providerImageId: 'image-001',
            sortOrder: 1,
            url: 'https://sw.mangafunb.fun/w/woduzishenji/1.jpg',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('chapter content failed'))
    const context = createExecutionContext()

    await expect(
      service.executeImportTask(request, context as never),
    ).rejects.toThrow('chapter content failed')

    expect(workChapterService.createChapterReturningId).not.toHaveBeenCalled()
    expect(workChapterService.updateChapter).not.toHaveBeenCalled()
    expect(comicContentService.replaceChapterContents).not.toHaveBeenCalled()
    expect(remoteImageImportService.importImages).not.toHaveBeenCalled()
    expect(context.residue).toEqual({
      createdWorkIds: [100],
      uploadedFiles: [uploadedCover.deleteTarget],
    })
  })

  it('rolls back recorded creates and uploaded files in reverse order', async () => {
    const {
      remoteImageImportService,
      service,
      workChapterService,
      workService,
    } = createService()
    const context = createExecutionContext({
      createdChapterIds: [300, 301],
      createdWorkIds: [100],
      uploadedFiles: [
        {
          provider: UploadProviderEnum.LOCAL,
          filePath: '/uploads/cover.jpg',
          objectKey: 'comic/image/cover.jpg',
        },
        {
          provider: UploadProviderEnum.LOCAL,
          filePath: '/uploads/1.jpg',
          objectKey: 'work/comic/100/chapter/300/001.jpg',
        },
      ],
    })

    await service.rollbackImportTask(context as never, new Error('boom'))

    expect(workChapterService.deleteChapters).toHaveBeenCalledWith([301, 300])
    expect(workService.deleteWork).toHaveBeenCalledWith(100)
    expect(remoteImageImportService.deleteImportedFile).toHaveBeenNthCalledWith(
      1,
      {
        provider: UploadProviderEnum.LOCAL,
        filePath: '/uploads/1.jpg',
        objectKey: 'work/comic/100/chapter/300/001.jpg',
      },
    )
    expect(remoteImageImportService.deleteImportedFile).toHaveBeenNthCalledWith(
      2,
      {
        provider: UploadProviderEnum.LOCAL,
        filePath: '/uploads/cover.jpg',
        objectKey: 'comic/image/cover.jpg',
      },
    )
  })

  it('deletes uploaded cover immediately when residue persistence fails', async () => {
    const { remoteImageImportService, service } = createService()
    const context = createExecutionContext({}, async (patch) => {
      if ('uploadedFiles' in patch) {
        throw new Error('record residue failed')
      }
    })

    await expect(
      service.executeImportTask(createImportRequest(), context as never),
    ).rejects.toThrow('record residue failed')

    expect(remoteImageImportService.deleteImportedFile).toHaveBeenCalledWith(
      uploadedCover.deleteTarget,
    )
  })

  it('deletes created work immediately when work residue persistence fails', async () => {
    const { service, workService } = createService()
    const context = createExecutionContext({}, async (patch) => {
      if ('createdWorkIds' in patch) {
        throw new Error('record created work failed')
      }
    })

    await expect(
      service.executeImportTask(createImportRequest(), context as never),
    ).rejects.toThrow('record created work failed')

    expect(workService.deleteWork).toHaveBeenCalledWith(100)
  })
})
