jest.mock('./third-party-service', () => ({
  ComicThirdPartyService: class ComicThirdPartyService {},
}))

const { ComicThirdPartyController } = require('./third-party.controller')

describe('ComicThirdPartyController', () => {
  it('passes the current admin user id to confirm import', async () => {
    const thirdPartyService = {
      confirmImport: jest.fn(async () => ({ taskId: 'task-001' })),
      syncLatest: jest.fn(),
    }
    const controller = new ComicThirdPartyController(thirdPartyService as never)
    const body = { comicId: 'woduzishenji' } as never
    const confirmImport = controller.confirmImport as unknown as (
      body: never,
      userId: number,
    ) => Promise<unknown>

    const result = await confirmImport.call(controller, body, 7)

    expect(result).toEqual({ taskId: 'task-001' })
    expect(thirdPartyService.confirmImport).toHaveBeenCalledWith(body, 7)
  })

  it('passes the current admin user id to latest sync', async () => {
    const thirdPartyService = {
      confirmImport: jest.fn(),
      syncLatest: jest.fn(async () => ({ taskId: 'task-sync' })),
    }
    const controller = new ComicThirdPartyController(thirdPartyService as never)
    const body = { workId: 100 } as never
    const syncLatest = controller.syncLatest as unknown as (
      body: never,
      userId: number,
    ) => Promise<unknown>

    const result = await syncLatest.call(controller, body, 7)

    expect(result).toEqual({ taskId: 'task-sync' })
    expect(thirdPartyService.syncLatest).toHaveBeenCalledWith(body, 7)
  })
})
