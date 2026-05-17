jest.mock('./services/third-party-comic-import.service', () => ({
  ThirdPartyComicImportService: class ThirdPartyComicImportService {},
}))
jest.mock('./services/third-party-comic-sync.service', () => ({
  ThirdPartyComicSyncService: class ThirdPartyComicSyncService {},
}))

const { ComicThirdPartyService } = require('./third-party-service')

describe('ComicThirdPartyService', () => {
  const workflowJob = {
    jobId: 'job-001',
    workflowType: 'content-import.third-party-import',
  }

  it('forwards confirm import requests with the current admin user id', async () => {
    const importService = {
      confirmImport: jest.fn(async () => workflowJob),
    }
    const syncService = {
      syncLatest: jest.fn(async () => ({
        jobId: 'job-sync',
        workflowType: 'content-import.third-party-sync',
      })),
    }
    const service = new ComicThirdPartyService(
      {} as never,
      importService as never,
      syncService as never,
    )
    const dto = { comicId: 'woduzishenji' } as never

    const confirmImport = service.confirmImport as unknown as (
      dto: never,
      userId: number,
    ) => Promise<unknown>

    const result = await confirmImport.call(service, dto, 7)

    expect(result).toEqual({
      jobId: 'job-001',
      workflowType: 'content-import.third-party-import',
    })
    expect(importService.confirmImport).toHaveBeenCalledWith(dto, 7)
  })

  it('forwards latest sync requests with the current admin user id', async () => {
    const importService = {
      confirmImport: jest.fn(),
    }
    const syncService = {
      syncLatest: jest.fn(async () => ({
        jobId: 'job-sync',
        workflowType: 'content-import.third-party-sync',
      })),
    }
    const service = new ComicThirdPartyService(
      {} as never,
      importService as never,
      syncService as never,
    )
    const dto = { workId: 100 } as never

    const syncLatest = service.syncLatest as unknown as (
      dto: never,
      userId: number,
    ) => Promise<unknown>

    const result = await syncLatest.call(service, dto, 7)

    expect(result).toEqual({
      jobId: 'job-sync',
      workflowType: 'content-import.third-party-sync',
    })
    expect(syncService.syncLatest).toHaveBeenCalledWith(dto, 7)
  })
})
