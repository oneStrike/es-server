jest.mock('./third-party-service', () => ({
  ComicThirdPartyService: class ComicThirdPartyService {},
}))

const { ComicThirdPartyController } = require('./third-party.controller')

describe('ComicThirdPartyController', () => {
  const workflowJob = {
    cancelRequestedAt: null,
    createdAt: new Date('2026-05-17T00:00:00.000Z'),
    displayName: '我独自升级',
    expiresAt: null,
    failedItemCount: 0,
    finishedAt: null,
    id: 1,
    jobId: 'job-001',
    operatorType: 1,
    operatorUserId: 7,
    progressMessage: null,
    progressPercent: 0,
    selectedItemCount: 1,
    skippedItemCount: 0,
    startedAt: null,
    status: 2,
    successItemCount: 0,
    summary: { sourceType: 'content-import.third-party-import' },
    updatedAt: new Date('2026-05-17T00:00:00.000Z'),
    workflowType: 'content-import.third-party-import',
  }
  const contentImportItem = {
    currentAttemptNo: 1,
    failureCount: 0,
    imageSuccessCount: 2,
    imageTotal: 2,
    itemId: 'item-1',
    localChapterId: 100,
    providerChapterId: 'chapter-1',
    sortOrder: 1,
    stage: 7,
    status: 3,
    title: '第 1 话',
    updatedAt: new Date('2026-05-17T00:00:00.000Z'),
  }

  function createController() {
    const thirdPartyService = {
      confirmImport: jest.fn(async () => workflowJob),
      syncLatest: jest.fn(async () => ({
        ...workflowJob,
        jobId: 'job-sync',
        summary: { sourceType: 'content-import.third-party-sync' },
        workflowType: 'content-import.third-party-sync',
      })),
    }
    const contentImportService = {
      getItemPage: jest.fn(async () => ({
        list: [contentImportItem],
        pageIndex: 1,
        pageSize: 10,
        total: 1,
      })),
    }
    return {
      contentImportService,
      controller: new ComicThirdPartyController(
        thirdPartyService as never,
        contentImportService as never,
      ),
      thirdPartyService,
    }
  }

  it('passes the current admin user id to confirm import', async () => {
    const { controller, thirdPartyService } = createController()
    const body = { comicId: 'woduzishenji' } as never
    const confirmImport = controller.confirmImport as unknown as (
      body: never,
      userId: number,
    ) => Promise<unknown>

    const result = await confirmImport.call(controller, body, 7)

    expect(result).toEqual(
      expect.objectContaining({
        displayName: '我独自升级',
        jobId: 'job-001',
        selectedItemCount: 1,
        workflowType: 'content-import.third-party-import',
      }),
    )
    expect(thirdPartyService.confirmImport).toHaveBeenCalledWith(body, 7)
  })

  it('passes the current admin user id to latest sync', async () => {
    const { controller, thirdPartyService } = createController()
    const body = { workId: 100 } as never
    const syncLatest = controller.syncLatest as unknown as (
      body: never,
      userId: number,
    ) => Promise<unknown>

    const result = await syncLatest.call(controller, body, 7)

    expect(result).toEqual(
      expect.objectContaining({
        jobId: 'job-sync',
        workflowType: 'content-import.third-party-sync',
      }),
    )
    expect(thirdPartyService.syncLatest).toHaveBeenCalledWith(body, 7)
  })

  it('owns content import item pagination under the third-party import route', async () => {
    const { contentImportService, controller } = createController()
    const query = { jobId: 'job-1', pageIndex: 1, pageSize: 10 } as never

    const result = await controller.getImportItemPage(query)

    expect(result.list[0]).toEqual(
      expect.objectContaining({
        imageSuccessCount: 2,
        imageTotal: 2,
        itemId: 'item-1',
        status: 3,
        title: '第 1 话',
      }),
    )
    expect(contentImportService.getItemPage).toHaveBeenCalledWith(query)
  })
})
