jest.mock('./services/third-party-comic-import.service', () => ({
  ThirdPartyComicImportService: class ThirdPartyComicImportService {},
}))
jest.mock('./services/third-party-comic-sync.service', () => ({
  ThirdPartyComicSyncService: class ThirdPartyComicSyncService {},
}))

const { ComicThirdPartyService } = require('./third-party-service')

describe('ComicThirdPartyService', () => {
  it('forwards confirm import requests with the current admin user id', async () => {
    const importService = {
      confirmImport: jest.fn(async () => ({ taskId: 'task-001' })),
    }
    const syncService = {
      syncLatest: jest.fn(async () => ({ taskId: 'task-sync' })),
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

    expect(result).toEqual({ taskId: 'task-001' })
    expect(importService.confirmImport).toHaveBeenCalledWith(dto, 7)
  })

  it('forwards latest sync requests with the current admin user id', async () => {
    const importService = {
      confirmImport: jest.fn(),
    }
    const syncService = {
      syncLatest: jest.fn(async () => ({ taskId: 'task-sync' })),
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

    expect(result).toEqual({ taskId: 'task-sync' })
    expect(syncService.syncLatest).toHaveBeenCalledWith(dto, 7)
  })
})
