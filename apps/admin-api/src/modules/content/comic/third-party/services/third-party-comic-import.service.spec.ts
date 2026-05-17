/// <reference types="jest" />

jest.mock('@libs/content/work/content/comic-content.service', () => ({
  ComicContentService: class ComicContentService {},
}))
jest.mock('@libs/content/work/core/work.service', () => ({
  WorkService: class WorkService {},
}))
jest.mock('@libs/content/work/chapter/work-chapter.service', () => ({
  WorkChapterService: class WorkChapterService {},
}))
jest.mock('@libs/content/work/third-party/services/remote-image-import.service', () => ({
  RemoteImageImportService: class RemoteImageImportService {},
}))
jest.mock('@libs/content/work/third-party/services/third-party-comic-binding.service', () => ({
  ThirdPartyComicBindingService: class ThirdPartyComicBindingService {},
}))

import {
  ThirdPartyComicImportChapterActionEnum,
  ThirdPartyComicImportCoverModeEnum,
  ThirdPartyComicImportModeEnum,
} from '@libs/content/work/content/dto/content.dto'
import { ContentImportWorkflowType } from '@libs/content/work/content-import/content-import.constant'
import { WorkTypeEnum } from '@libs/platform/constant'
import { WorkflowOperatorTypeEnum } from '@libs/platform/modules/workflow/workflow.constant'
import { ThirdPartyComicImportService } from './third-party-comic-import.service'

describe('ThirdPartyComicImportService workflow reservation', () => {
  function createLimitSelect(rows: unknown[]) {
    return {
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(async () => rows),
        })),
      })),
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
          title: '第 1 话',
        },
      ],
      comicId: 'woduzishenji',
      cover: {
        mode: ThirdPartyComicImportCoverModeEnum.PROVIDER,
        providerImageId: 'cover:woduzishenji',
      },
      mode: ThirdPartyComicImportModeEnum.CREATE_NEW,
      platform: 'copy',
      sourceSnapshot: {
        fetchedAt: '2026-05-17T00:00:00.000Z',
        providerComicId: 'woduzishenji',
        providerGroupPathWord: 'default',
        providerPathWord: 'woduzishenji',
      },
      workDraft: {
        authorIds: [1],
        canComment: true,
        categoryIds: [1],
        chapterPrice: 0,
        description: '作品简介',
        isHot: false,
        isNew: false,
        isRecommended: false,
        language: 'zh-CN',
        name: '我独自升级',
        recommendWeight: 0,
        region: 'KR',
        serialStatus: 2,
        tagIds: [1],
        viewRule: 0,
      },
    }
  }

  function createService(selectRows: unknown[][] = [[]]) {
    const selectQueue = [...selectRows]
    const db = {
      select: jest.fn(() => createLimitSelect(selectQueue.shift() ?? [])),
    }
    const drizzle = {
      db,
      schema: {
        work: {
          deletedAt: 'work.deletedAt',
          id: 'work.id',
          name: 'work.name',
          type: 'work.type',
        },
        workChapter: {
          deletedAt: 'workChapter.deletedAt',
          id: 'workChapter.id',
          title: 'workChapter.title',
          workId: 'workChapter.workId',
        },
      },
    }
    const workflowJob = {
      jobId: 'job-1',
      workflowType: ContentImportWorkflowType.THIRD_PARTY_IMPORT,
    }
    const workflowService = {
      confirmDraft: jest.fn(async () => workflowJob),
      createDraft: jest.fn(async () => workflowJob),
    }
    const contentImportService = {
      createThirdPartyImportJob: jest.fn(async () => ({ id: 1n })),
    }
    const bindingService = {
      getActiveSourceBindingByScope: jest.fn(async () => null),
    }
    const workService = {
      createWorkReturningId: jest.fn(),
    }
    const workChapterService = {
      createChapterReturningId: jest.fn(),
    }
    const comicContentService = {
      replaceChapterContents: jest.fn(),
    }
    const registry = {
      resolve: jest.fn(),
    }
    const remoteImageImportService = {
      importImage: jest.fn(),
    }

    return {
      bindingService,
      contentImportService,
      service: new ThirdPartyComicImportService(
        registry as never,
        workService as never,
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
      workService,
    }
  }

  it('creates and confirms a workflow job without importing content synchronously', async () => {
    const {
      contentImportService,
      service,
      workflowService,
      workChapterService,
      workService,
    } = createService([[]])
    const dto = createImportRequest()

    await expect(service.confirmImport(dto as never, 7)).resolves.toEqual({
      jobId: 'job-1',
      workflowType: ContentImportWorkflowType.THIRD_PARTY_IMPORT,
    })

    expect(workflowService.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictKeys: expect.arrayContaining([
          'source-comic:copy:woduzishenji',
          'source-scope:copy:woduzishenji:default',
          'work-name:comic:我独自升级',
          'chapter-title:comic:work-name:我独自升级:第 1 话',
        ]),
        displayName: '我独自升级',
        operator: {
          type: WorkflowOperatorTypeEnum.ADMIN,
          userId: 7,
        },
        selectedItemCount: 1,
        workflowType: ContentImportWorkflowType.THIRD_PARTY_IMPORT,
      }),
    )
    expect(contentImportService.createThirdPartyImportJob).toHaveBeenCalledWith({
      dto,
      jobId: 'job-1',
    })
    expect(workflowService.confirmDraft).toHaveBeenCalledWith({
      jobId: 'job-1',
    })
    expect(workService.createWorkReturningId).not.toHaveBeenCalled()
    expect(workChapterService.createChapterReturningId).not.toHaveBeenCalled()
  })

  it('rejects retry when the persisted reservation snapshot no longer matches', async () => {
    const { service } = createService([[]])
    const dto = createImportRequest()
    const reservation = await service.buildImportReservationSnapshot(dto as never)

    await expect(
      service.validateRetryReservationSnapshot(dto as never, {
        conflictKeys: reservation.conflictKeys.slice(0, 1),
        dedupeKey: reservation.dedupeKey,
        serialKey: reservation.serialKey,
      }),
    ).rejects.toMatchObject({
      cause: {
        code: 'third_party_import_retry_invalid_reservation_snapshot',
      },
      message:
        '破坏性更新前的三方导入任务缺少或不匹配 reservation snapshot，请重新提交导入任务',
    })
  })

  it('blocks same-title work conflicts before creating workflow draft', async () => {
    const { service, workflowService } = createService([[{ id: 100 }]])

    await expect(
      service.confirmImport(createImportRequest() as never, 7),
    ).rejects.toThrow('同名漫画作品已存在，不能重复导入')

    expect(workflowService.createDraft).not.toHaveBeenCalled()
  })

  it('blocks source-scope conflicts before creating workflow draft', async () => {
    const { bindingService, service, workflowService } = createService([[]])
    ;(
      bindingService.getActiveSourceBindingByScope as jest.Mock
    ).mockResolvedValueOnce({
      workId: 999,
    })

    await expect(
      service.confirmImport(createImportRequest() as never, 7),
    ).rejects.toThrow('三方来源已绑定其他作品，不能重复绑定')

    expect(workflowService.createDraft).not.toHaveBeenCalled()
  })

  it('blocks same-title chapter conflicts for existing-work imports', async () => {
    const { service, workflowService } = createService([
      [{ id: 100, name: '目标作品', type: WorkTypeEnum.COMIC }],
      [{ id: 300 }],
    ])
    const dto = {
      ...createImportRequest(),
      mode: ThirdPartyComicImportModeEnum.ATTACH_TO_EXISTING,
      targetWorkId: 100,
      workDraft: undefined,
    }

    await expect(service.confirmImport(dto as never, 7)).rejects.toThrow(
      '目标作品下已存在同名章节，不能重复导入',
    )

    expect(workflowService.createDraft).not.toHaveBeenCalled()
  })
})
