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

  it('passes the current admin user id to confirm import', async () => {
    const thirdPartyService = {
      confirmImport: jest.fn(async () => workflowJob),
      syncLatest: jest.fn(),
    }
    const controller = new ComicThirdPartyController(thirdPartyService as never)
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
    const thirdPartyService = {
      confirmImport: jest.fn(),
      syncLatest: jest.fn(async () => ({
        ...workflowJob,
        jobId: 'job-sync',
        summary: { sourceType: 'content-import.third-party-sync' },
        workflowType: 'content-import.third-party-sync',
      })),
    }
    const controller = new ComicThirdPartyController(thirdPartyService as never)
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
})
