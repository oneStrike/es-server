/// <reference types="jest" />

import { DownloadTargetTypeEnum } from './download.constant'
import { DownloadService } from './download.service'

describe('downloadService permission boundary', () => {
  function createService(returningRows: Array<{ id: number }> = [{ id: 1 }]) {
    const returning = jest.fn(async () => Promise.resolve(returningRows))
    const onConflictDoNothing = jest.fn(() => ({ returning }))
    const values = jest.fn(() => ({ onConflictDoNothing }))
    const tx = {
      insert: jest.fn(() => ({ values })),
    }
    const drizzle = {
      schema: {
        userDownloadRecord: { id: 'id' },
      },
      withTransaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback(tx),
      ),
    }
    const service = new DownloadService(drizzle as any)
    return { drizzle, onConflictDoNothing, returning, service, tx, values }
  }

  it('passes user id into target resolver before writing download record', async () => {
    const { service, tx, values } = createService()
    const resolver = {
      applyCountDelta: jest.fn(async () => Promise.resolve()),
      ensureDownloadable: jest.fn(async () => Promise.resolve('chapter-content')),
      targetType: DownloadTargetTypeEnum.COMIC_CHAPTER,
    }
    service.registerResolver(resolver)

    await expect(
      service.downloadTarget({
        targetId: 11,
        targetType: DownloadTargetTypeEnum.COMIC_CHAPTER,
        userId: 23,
      }),
    ).resolves.toBe('chapter-content')

    expect(resolver.ensureDownloadable).toHaveBeenCalledWith(tx, 11, 23)
    expect(values).toHaveBeenCalledWith({
      targetId: 11,
      targetType: DownloadTargetTypeEnum.COMIC_CHAPTER,
      userId: 23,
    })
    expect(resolver.applyCountDelta).toHaveBeenCalledWith(tx, 11, 1)
  })

  it('does not write download records or counts when permission check fails', async () => {
    const { service, tx } = createService()
    const resolver = {
      applyCountDelta: jest.fn(),
      ensureDownloadable: jest.fn(async () =>
        Promise.reject(new Error('permission denied')),
      ),
      targetType: DownloadTargetTypeEnum.NOVEL_CHAPTER,
    }
    service.registerResolver(resolver)

    await expect(
      service.downloadTarget({
        targetId: 12,
        targetType: DownloadTargetTypeEnum.NOVEL_CHAPTER,
        userId: 24,
      }),
    ).rejects.toThrow('permission denied')

    expect(resolver.ensureDownloadable).toHaveBeenCalledWith(tx, 12, 24)
    expect(tx.insert).not.toHaveBeenCalled()
    expect(resolver.applyCountDelta).not.toHaveBeenCalled()
  })
})
