import { WorkTypeEnum } from '@libs/platform/constant'
import {
  BackgroundTaskOperatorTypeEnum,
  BackgroundTaskStatusEnum,
} from '@libs/platform/modules/background-task/background-task.constant'
import { BackgroundTaskClaimLostError } from '@libs/platform/modules/background-task/background-task.service'
import { UploadProviderEnum } from '@libs/platform/modules/upload/upload.type'
import { THIRD_PARTY_COMIC_SYNC_TASK_TYPE } from '../third-party-comic-sync.constant'

jest.mock('@libs/content/work/content/comic-content.service', () => ({
  ComicContentService: class ComicContentService {},
}))
jest.mock('@libs/content/work/chapter/work-chapter.service', () => ({
  WorkChapterService: class WorkChapterService {},
}))
jest.mock('./remote-image-import.service', () => ({
  RemoteImageImportService: class RemoteImageImportService {},
}))
jest.mock('./third-party-comic-binding.service', () => ({
  ThirdPartyComicBindingService: class ThirdPartyComicBindingService {},
}))

const {
  ThirdPartyComicSyncService,
} = require('./third-party-comic-sync.service')

describe('ThirdPartyComicSyncService', () => {
  const sourceBinding = {
    id: 10,
    workId: 100,
    platform: 'copy',
    providerComicId: 'woduzishenji',
    providerPathWord: 'woduzishenji',
    providerGroupPathWord: 'default',
  }
  const uploadedImage = {
    deleteTarget: {
      provider: UploadProviderEnum.LOCAL,
      filePath: '/uploads/1.jpg',
      objectKey: 'work/comic/100/chapter/300/001.jpg',
    },
    filePath: '/uploads/1.jpg',
    fileSize: 3,
    image: {
      providerImageId: 'image-001',
      sortOrder: 1,
      url: 'https://sw.mangafunb.fun/w/woduzishenji/1.jpg',
    },
    imageIndex: 1,
    imageTotal: 1,
    mimeType: 'image/jpeg',
    safeSourceUrl: 'https://sw.mangafunb.fun/w/woduzishenji/1.jpg',
  }

  function createLimitSelect(rows: unknown[]) {
    return {
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(async () => rows),
        })),
      })),
    }
  }

  function createWhereSelect(rows: unknown[]) {
    return {
      from: jest.fn(() => ({
        where: jest.fn(async () => rows),
      })),
    }
  }

  function createExecutionContext(
    initialResidue: Record<string, unknown> = {},
    onRecordResidue?: (patch: Record<string, unknown>) => Promise<void> | void,
  ) {
    const residue = { ...initialResidue }
    const context = {
      assertStillOwned: jest.fn(async () => undefined),
      assertNotCancelled: jest.fn(async () => undefined),
      createProgressReporter: jest.fn(() => ({
        advance: jest.fn(async () => undefined),
      })),
      getResidue: jest.fn(async () => residue),
      recordResidue: jest.fn(async (patch) => {
        await onRecordResidue?.(patch)
        Object.assign(residue, patch)
      }),
      residue,
      taskId: 'task-sync',
      taskType: THIRD_PARTY_COMIC_SYNC_TASK_TYPE,
      updateProgress: jest.fn(async () => undefined),
    }
    return context
  }

  function createService(
    options: { dbSelects?: unknown[]; txRows?: unknown[] } = {},
  ) {
    const defaultWorkSelect = createLimitSelect([
      {
        id: 100,
        name: '我独自升级',
        type: WorkTypeEnum.COMIC,
        chapterPrice: 5,
        canComment: false,
      },
    ])
    const provider = {
      getChapterContent: jest.fn(async () => ({
        images: [uploadedImage.image],
        providerChapterId: 'chapter-new',
        title: '第2话',
      })),
      getChapters: jest.fn(async () => [
        {
          providerChapterId: 'chapter-old',
          title: '第1话',
          group: 'default',
          sortOrder: 1,
          chapterApiVersion: 1,
        },
        {
          providerChapterId: 'chapter-new',
          title: '第2话',
          group: 'default',
          sortOrder: 1,
          chapterApiVersion: 1,
          datetimeCreated: '2026-05-11T00:00:00.000Z',
        },
      ]),
    }
    const registry = {
      resolve: jest.fn(() => provider),
    }
    const workChapterService = {
      createChapterReturningId: jest.fn(async () => 300),
      deleteChapters: jest.fn(async () => true),
    }
    const comicContentService = {
      replaceChapterContents: jest.fn(async () => true),
    }
    const remoteImageImportService = {
      deleteImportedFile: jest.fn(async () => undefined),
      importImages: jest.fn(async (_images, _segments, onImported) => {
        await onImported(uploadedImage)
        return ['/uploads/1.jpg']
      }),
    }
    const bindingService = {
      buildSourceScopeKey: jest.fn(
        (binding) =>
          `${binding.platform}:${binding.providerComicId}:${binding.providerGroupPathWord}`,
      ),
      createOrGetChapterBinding: jest.fn(async () => ({
        created: true,
        id: 20,
      })),
      getActiveSourceBindingById: jest.fn(async () => sourceBinding),
      getActiveSourceBindingByWorkId: jest.fn(async () => sourceBinding),
      listActiveChapterBindings: jest.fn(async () => [
        { providerChapterId: 'chapter-old' },
      ]),
      softDeleteChapterBindings: jest.fn(async () => undefined),
    }
    const backgroundTaskService = {
      createTaskInTransaction: jest.fn(async (_input) => ({
        status: BackgroundTaskStatusEnum.PENDING,
        taskId: 'task-created',
        taskType: THIRD_PARTY_COMIC_SYNC_TASK_TYPE,
      })),
      getTaskDetail: jest.fn(async () => ({
        status: BackgroundTaskStatusEnum.PROCESSING,
        taskId: 'task-existing',
        taskType: THIRD_PARTY_COMIC_SYNC_TASK_TYPE,
      })),
    }
    const dbSelects = [...(options.dbSelects ?? [defaultWorkSelect])]
    const tx = {
      execute: jest.fn(async () => undefined),
      select: jest.fn(() => createLimitSelect(options.txRows ?? [])),
    }
    const drizzle = {
      db: {
        select: jest.fn(() => dbSelects.shift()),
      },
      schema: {
        backgroundTask: {
          payload: 'payload',
          status: 'status',
          taskId: 'taskId',
          taskType: 'taskType',
        },
        work: {
          canComment: 'canComment',
          chapterPrice: 'chapterPrice',
          deletedAt: 'workDeletedAt',
          id: 'workId',
          name: 'workName',
          type: 'type',
        },
        workChapter: {
          deletedAt: 'chapterDeletedAt',
          sortOrder: 'sortOrder',
          workId: 'chapterWorkId',
        },
      },
      withTransaction: jest.fn(async (callback) => callback(tx)),
    }

    return {
      backgroundTaskService,
      bindingService,
      comicContentService,
      drizzle,
      provider,
      remoteImageImportService,
      service: new ThirdPartyComicSyncService(
        registry as never,
        workChapterService as never,
        comicContentService as never,
        remoteImageImportService as never,
        bindingService as never,
        backgroundTaskService as never,
        drizzle as never,
      ),
      tx,
      workChapterService,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fails sync enqueue when the work has no active source binding', async () => {
    const { bindingService, service } = createService()
    ;(
      bindingService.getActiveSourceBindingByWorkId as jest.Mock
    ).mockResolvedValue(null)

    await expect(service.syncLatest({ workId: 100 }, 7)).rejects.toThrow(
      '作品未绑定三方来源',
    )
  })

  it('returns the existing active same-scope task instead of creating another one', async () => {
    const { backgroundTaskService, service, tx } = createService({
      txRows: [{ taskId: 'task-existing' }],
    })

    const result = await service.syncLatest({ workId: 100 }, 7)

    expect(result).toEqual(
      expect.objectContaining({
        taskId: 'task-existing',
      }),
    )
    expect(tx.execute).toHaveBeenCalled()
    expect(backgroundTaskService.createTaskInTransaction).not.toHaveBeenCalled()
    expect(backgroundTaskService.getTaskDetail).toHaveBeenCalledWith({
      taskId: 'task-existing',
    })
  })

  it('creates a sync task with source-scope payload when no active task exists', async () => {
    const { backgroundTaskService, service } = createService({ txRows: [] })

    await service.syncLatest({ workId: 100 }, 7)

    expect(backgroundTaskService.createTaskInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        operator: {
          type: BackgroundTaskOperatorTypeEnum.ADMIN,
          userId: 7,
        },
        payload: expect.objectContaining({
          sourceBindingId: 10,
          sourceScopeKey: 'copy:woduzishenji:default',
          workId: 100,
        }),
        displayName: '我独自升级',
        taskType: THIRD_PARTY_COMIC_SYNC_TASK_TYPE,
      }),
      expect.any(Object),
    )
  })

  it('imports only unbound chapters and appends sort order on conflict', async () => {
    const { bindingService, comicContentService, service, workChapterService } =
      createService({
        dbSelects: [
          createLimitSelect([
            {
              id: 100,
              name: '我独自升级',
              type: WorkTypeEnum.COMIC,
              chapterPrice: 5,
              canComment: false,
            },
          ]),
          createWhereSelect([{ sortOrder: 1 }, { sortOrder: 2 }]),
        ],
      })
    const context = createExecutionContext()

    const result = await service.executeSyncTask(
      {
        ...sourceBinding,
        sourceBindingId: sourceBinding.id,
        sourceScopeKey: 'copy:woduzishenji:default',
      },
      context as never,
    )

    expect(result).toEqual(
      expect.objectContaining({
        createdChapterCount: 1,
        createdChapterIds: [300],
        scannedChapterCount: 2,
        skippedChapterCount: 1,
      }),
    )
    expect(workChapterService.createChapterReturningId).toHaveBeenCalledWith(
      expect.objectContaining({
        canComment: false,
        canDownload: false,
        isPublished: true,
        price: 5,
        sortOrder: 3,
        title: '第2话',
        workId: 100,
      }),
    )
    expect(comicContentService.replaceChapterContents).toHaveBeenCalledWith(
      300,
      ['/uploads/1.jpg'],
    )
    expect(bindingService.createOrGetChapterBinding).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterId: 300,
        providerChapterId: 'chapter-new',
        remoteSortOrder: 1,
        workThirdPartySourceBindingId: 10,
      }),
    )
    expect(context.residue).toEqual({
      createdChapterBindingIds: [20],
      createdChapterIds: [300],
      uploadedFiles: [uploadedImage.deleteTarget],
    })
    expect(context.createProgressReporter).toHaveBeenCalledWith({
      endPercent: 10,
      stage: 'chapter-content',
      startPercent: 2,
      total: 1,
      unit: 'chapter',
    })
  })

  it('does not create chapter-content progress when no new remote chapters exist', async () => {
    const { bindingService, service } = createService({
      dbSelects: [
        createLimitSelect([
          {
            id: 100,
            name: '我独自升级',
            type: WorkTypeEnum.COMIC,
            chapterPrice: 5,
            canComment: false,
          },
        ]),
        createWhereSelect([{ sortOrder: 1 }]),
      ],
    })
    ;(bindingService.listActiveChapterBindings as jest.Mock).mockResolvedValue([
      { providerChapterId: 'chapter-old' },
      { providerChapterId: 'chapter-new' },
    ])
    const context = createExecutionContext()

    const result = await service.executeSyncTask(
      {
        ...sourceBinding,
        sourceBindingId: sourceBinding.id,
        sourceScopeKey: 'copy:woduzishenji:default',
      },
      context as never,
    )

    expect(result.createdChapterCount).toBe(0)
    expect(context.createProgressReporter).not.toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'chapter-content',
      }),
    )
  })

  it('rolls back created bindings, chapters and uploads in reverse order', async () => {
    const {
      bindingService,
      remoteImageImportService,
      service,
      workChapterService,
    } = createService()
    const context = createExecutionContext({
      createdChapterBindingIds: [20, 21],
      createdChapterIds: [300, 301],
      uploadedFiles: [
        {
          provider: UploadProviderEnum.LOCAL,
          filePath: '/uploads/1.jpg',
          objectKey: 'work/comic/100/chapter/300/001.jpg',
        },
        {
          provider: UploadProviderEnum.LOCAL,
          filePath: '/uploads/2.jpg',
          objectKey: 'work/comic/100/chapter/301/001.jpg',
        },
      ],
    })

    await service.rollbackSyncTask(context as never)

    expect(bindingService.softDeleteChapterBindings).toHaveBeenCalledWith([
      21, 20,
    ])
    expect(workChapterService.deleteChapters).toHaveBeenCalledWith([301, 300])
    expect(remoteImageImportService.deleteImportedFile).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ filePath: '/uploads/2.jpg' }),
    )
    expect(remoteImageImportService.deleteImportedFile).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ filePath: '/uploads/1.jpg' }),
    )
  })

  it('reports uploaded file cleanup failures during rollback', async () => {
    const { remoteImageImportService, service } = createService()
    ;(
      remoteImageImportService.deleteImportedFile as jest.Mock
    ).mockRejectedValue(new Error('delete failed'))
    const context = createExecutionContext({
      uploadedFiles: [uploadedImage.deleteTarget],
    })

    await expect(service.rollbackSyncTask(context as never)).rejects.toThrow(
      '存在无法自动清理的上传文件',
    )
  })

  it('propagates claim loss during rollback uploaded-file cleanup', async () => {
    const { remoteImageImportService, service } = createService()
    const claimLost = new BackgroundTaskClaimLostError()
    const context = createExecutionContext({
      uploadedFiles: [uploadedImage.deleteTarget],
    })
    ;(context.assertStillOwned as jest.Mock).mockRejectedValueOnce(claimLost)

    await expect(service.rollbackSyncTask(context as never)).rejects.toBe(
      claimLost,
    )

    expect(remoteImageImportService.deleteImportedFile).not.toHaveBeenCalled()
  })

  it.each([
    {
      key: 'uploadedFiles',
      assertNoCleanup: ({
        remoteImageImportService,
      }: ReturnType<typeof createService>) => {
        expect(
          remoteImageImportService.deleteImportedFile,
        ).not.toHaveBeenCalled()
      },
    },
    {
      key: 'createdChapterIds',
      assertNoCleanup: ({
        workChapterService,
      }: ReturnType<typeof createService>) => {
        expect(workChapterService.deleteChapters).not.toHaveBeenCalled()
      },
    },
    {
      key: 'createdChapterBindingIds',
      assertNoCleanup: ({
        bindingService,
      }: ReturnType<typeof createService>) => {
        expect(bindingService.softDeleteChapterBindings).not.toHaveBeenCalled()
      },
    },
  ])(
    'does not run immediate cleanup when $key residue persistence fails because claim is lost',
    async ({ key, assertNoCleanup }) => {
      const harness = createService({
        dbSelects: [
          createLimitSelect([
            {
              id: 100,
              name: '我独自升级',
              type: WorkTypeEnum.COMIC,
              chapterPrice: 5,
              canComment: false,
            },
          ]),
          createWhereSelect([{ sortOrder: 1 }, { sortOrder: 2 }]),
        ],
      })
      const claimLost = new BackgroundTaskClaimLostError()
      const context = createExecutionContext({}, async (patch) => {
        if (key in patch) {
          throw claimLost
        }
      })

      await expect(
        harness.service.executeSyncTask(
          {
            ...sourceBinding,
            sourceBindingId: sourceBinding.id,
            sourceScopeKey: 'copy:woduzishenji:default',
          },
          context as never,
        ),
      ).rejects.toBe(claimLost)

      assertNoCleanup(harness)
    },
  )
})
