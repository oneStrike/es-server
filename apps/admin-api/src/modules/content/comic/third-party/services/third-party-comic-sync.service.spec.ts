/// <reference types="jest" />

jest.mock('@libs/content/work/content/comic-content.service', () => ({
  ComicContentService: class ComicContentService {},
}))
jest.mock('@libs/content/work/chapter/work-chapter.service', () => ({
  WorkChapterService: class WorkChapterService {},
}))
jest.mock(
  '@libs/content/work/third-party/services/remote-image-import.service',
  () => ({
    RemoteImageImportService: class RemoteImageImportService {},
  }),
)
jest.mock(
  '@libs/content/work/third-party/services/third-party-comic-binding.service',
  () => ({
    ThirdPartyComicBindingService: class ThirdPartyComicBindingService {},
  }),
)

import { ContentImportWorkflowType } from '@libs/content/work/content-import/content-import.constant'
import { WorkTypeEnum } from '@libs/platform/constant'
import { WorkflowOperatorTypeEnum } from '@libs/platform/modules/workflow/workflow.constant'
import { ThirdPartyComicSyncService } from './third-party-comic-sync.service'

describe('ThirdPartyComicSyncService workflow reservation', () => {
  const sourceBinding = {
    id: 10,
    platform: 'copy',
    providerComicId: 'woduzishenji',
    providerGroupPathWord: 'default',
    providerPathWord: 'woduzishenji',
    workId: 100,
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

  function createContext() {
    return {
      assertNotCancelled: jest.fn(async () => undefined),
      assertStillOwned: jest.fn(async () => undefined),
      createProgressReporter: jest.fn(() => ({
        advance: jest.fn(async () => undefined),
      })),
      getResidue: jest.fn(async () => ({})),
      initializeItemImageProgress: jest.fn(async () => undefined),
      payload: {
        platform: sourceBinding.platform,
        providerGroupPathWord: sourceBinding.providerGroupPathWord,
        providerPathWord: sourceBinding.providerPathWord,
      },
      recordResidue: jest.fn(async () => undefined),
      updateProgress: jest.fn(async () => undefined),
    }
  }

  function createService(selectRows: unknown[] = []) {
    const selectQueue = [...selectRows]
    const drizzle = {
      db: {
        select: jest.fn(() => selectQueue.shift() ?? createLimitSelect([])),
      },
      schema: {
        work: {
          canComment: 'work.canComment',
          chapterPrice: 'work.chapterPrice',
          deletedAt: 'work.deletedAt',
          id: 'work.id',
          name: 'work.name',
          type: 'work.type',
        },
        workChapter: {
          deletedAt: 'workChapter.deletedAt',
          sortOrder: 'workChapter.sortOrder',
          workId: 'workChapter.workId',
        },
      },
    }
    const workflowJob = {
      jobId: 'job-sync',
      workflowType: ContentImportWorkflowType.THIRD_PARTY_SYNC,
    }
    const workflowService = {
      confirmDraft: jest.fn(async () => workflowJob),
      createDraft: jest.fn(async () => workflowJob),
    }
    const contentImportService = {
      createThirdPartySyncJob: jest.fn(async () => ({ id: 1n })),
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
    }
    const provider = {
      getChapterContent: jest.fn(async () => ({
        images: [
          {
            providerImageId: 'image-1',
            sortOrder: 1,
            url: 'https://example.com/1.jpg',
          },
        ],
      })),
      getChapters: jest.fn(async () => [
        { providerChapterId: 'chapter-old', sortOrder: 1, title: '第 1 话' },
        { providerChapterId: 'chapter-new', sortOrder: 1, title: '第 2 话' },
      ]),
    }
    const registry = {
      resolve: jest.fn(() => provider),
    }
    const workChapterService = {
      createChapterReturningId: jest.fn(async () => 200),
    }
    const comicContentService = {
      replaceChapterContents: jest.fn(async () => undefined),
    }
    const remoteImageImportService = {
      deleteImportedFile: jest.fn(),
      importImages: jest.fn(async () => ['/images/1.jpg']),
    }

    return {
      bindingService,
      comicContentService,
      contentImportService,
      provider,
      registry,
      remoteImageImportService,
      service: new ThirdPartyComicSyncService(
        registry as never,
        workChapterService as never,
        comicContentService as never,
        remoteImageImportService as never,
        bindingService as never,
        workflowService as never,
        contentImportService as never,
        drizzle as never,
      ),
      workflowService,
      workChapterService,
    }
  }

  it('requires an active source binding before creating a sync workflow', async () => {
    const { bindingService, service, workflowService } = createService()
    ;(
      bindingService.getActiveSourceBindingByWorkId as jest.Mock
    ).mockResolvedValueOnce(null)

    await expect(service.syncLatest({ workId: 100 }, 7)).rejects.toThrow(
      '作品未绑定三方来源',
    )

    expect(workflowService.createDraft).not.toHaveBeenCalled()
  })

  it('creates and confirms a sync workflow with source-scope conflict key', async () => {
    const { contentImportService, service, workflowService } = createService([
      createLimitSelect([
        {
          canComment: false,
          chapterPrice: 5,
          id: 100,
          name: '我独自升级',
          type: WorkTypeEnum.COMIC,
        },
      ]),
    ])

    await expect(service.syncLatest({ workId: 100 }, 7)).resolves.toEqual({
      jobId: 'job-sync',
      workflowType: ContentImportWorkflowType.THIRD_PARTY_SYNC,
    })

    expect(workflowService.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictKeys: ['source-scope:copy:woduzishenji:default'],
        displayName: '我独自升级',
        operator: {
          type: WorkflowOperatorTypeEnum.ADMIN,
          userId: 7,
        },
        selectedItemCount: 0,
        workflowType: ContentImportWorkflowType.THIRD_PARTY_SYNC,
      }),
    )
    expect(contentImportService.createThirdPartySyncJob).toHaveBeenCalledWith({
      dto: { workId: 100 },
      jobId: 'job-sync',
      source: expect.objectContaining({
        providerComicId: 'woduzishenji',
        sourceBindingId: 10,
        sourceScopeKey: 'copy:woduzishenji:default',
        workId: 100,
      }),
    })
    expect(workflowService.confirmDraft).toHaveBeenCalledWith({
      jobId: 'job-sync',
    })
  })

  it('scans only unbound remote chapters and builds metadata-only workflow plans', async () => {
    const { provider, service } = createService([
      createLimitSelect([
        {
          canComment: false,
          chapterPrice: 5,
          id: 100,
          name: '我独自升级',
          type: WorkTypeEnum.COMIC,
        },
      ]),
      createWhereSelect([{ sortOrder: 1 }]),
    ])
    const context = createContext()

    const prepared = await service.prepareWorkflowSync(
      {
        ...sourceBinding,
        sourceBindingId: sourceBinding.id,
        sourceScopeKey: 'copy:woduzishenji:default',
      },
      context as never,
    )

    expect(prepared).toEqual(
      expect.objectContaining({
        createdChapterCount: 1,
        scannedChapterCount: 2,
        skippedChapterCount: 1,
        sourceBindingId: 10,
      }),
    )
    expect(prepared.plans[0]).toEqual(
      expect.objectContaining({
        imageTotal: 0,
        images: [],
        localSortOrder: 2,
        providerChapterId: 'chapter-new',
        title: '第 2 话',
      }),
    )
    expect(provider.getChapterContent).not.toHaveBeenCalled()
  })

  it('calls provider chapter list without workflow execution options', async () => {
    const { provider, service } = createService([
      createLimitSelect([
        {
          canComment: false,
          chapterPrice: 5,
          id: 100,
          name: '我独自升级',
          type: WorkTypeEnum.COMIC,
        },
      ]),
      createWhereSelect([{ sortOrder: 1 }]),
    ])
    const context = createContext()

    await service.prepareWorkflowSync(
      {
        ...sourceBinding,
        sourceBindingId: sourceBinding.id,
        sourceScopeKey: 'copy:woduzishenji:default',
      },
      context as never,
    )

    expect(provider.getChapters).toHaveBeenCalledWith({
      comicId: sourceBinding.providerPathWord,
      group: sourceBinding.providerGroupPathWord,
      platform: sourceBinding.platform,
    })
  })

  it('calls provider chapter content without workflow execution options', async () => {
    const { provider, service } = createService()
    const context = createContext()

    await service.importWorkflowSyncChapter({
      context,
      plan: {
        chapterApiVersion: 2,
        chapterIndex: 1,
        chapterTotal: 1,
        datetimeCreated: undefined,
        group: sourceBinding.providerGroupPathWord,
        imageTotal: 0,
        images: [],
        localSortOrder: 2,
        providerChapterId: 'chapter-new',
        sortOrder: 2,
        title: '第 2 话',
      },
      sourceBindingId: sourceBinding.id,
      work: {
        canComment: false,
        chapterPrice: 5,
        id: 100,
      },
    } as never)

    expect(provider.getChapterContent).toHaveBeenCalledWith({
      chapterApiVersion: 2,
      chapterId: 'chapter-new',
      comicId: sourceBinding.providerPathWord,
      group: sourceBinding.providerGroupPathWord,
      platform: sourceBinding.platform,
    })
    expect(context.initializeItemImageProgress).toHaveBeenCalledWith(1)
  })

  it('does not create a chapter when ownership is lost before local write', async () => {
    const { service, workChapterService } = createService()
    const ownershipLost = new Error('claim lost')
    const context = {
      ...createContext(),
      assertStillOwned: jest.fn(async () => {
        throw ownershipLost
      }),
    }

    await expect(
      service.importWorkflowSyncChapter({
        context,
        plan: {
          chapterApiVersion: 2,
          chapterIndex: 1,
          chapterTotal: 1,
          datetimeCreated: undefined,
          group: sourceBinding.providerGroupPathWord,
          imageTotal: 0,
          images: [],
          localSortOrder: 2,
          providerChapterId: 'chapter-new',
          sortOrder: 2,
          title: '第 2 话',
        },
        sourceBindingId: sourceBinding.id,
        work: {
          canComment: false,
          chapterPrice: 5,
          id: 100,
        },
      } as never),
    ).rejects.toBe(ownershipLost)

    expect(workChapterService.createChapterReturningId).not.toHaveBeenCalled()
  })

  it('does not replace chapter contents when ownership is lost after image import', async () => {
    const { comicContentService, service, workChapterService } = createService()
    const ownershipLost = new Error('claim lost')
    let ownershipCheckCount = 0
    const context = {
      ...createContext(),
      assertStillOwned: jest.fn(async () => {
        ownershipCheckCount += 1
        if (ownershipCheckCount > 1) {
          throw ownershipLost
        }
      }),
    }

    await expect(
      service.importWorkflowSyncChapter({
        context,
        plan: {
          chapterApiVersion: 2,
          chapterIndex: 1,
          chapterTotal: 1,
          datetimeCreated: undefined,
          group: sourceBinding.providerGroupPathWord,
          imageTotal: 0,
          images: [],
          localSortOrder: 2,
          providerChapterId: 'chapter-new',
          sortOrder: 2,
          title: '第 2 话',
        },
        sourceBindingId: sourceBinding.id,
        work: {
          canComment: false,
          chapterPrice: 5,
          id: 100,
        },
      } as never),
    ).rejects.toBe(ownershipLost)

    expect(workChapterService.createChapterReturningId).toHaveBeenCalledTimes(1)
    expect(comicContentService.replaceChapterContents).not.toHaveBeenCalled()
  })
})
