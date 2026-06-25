import type { Pool } from 'pg'
import { DbLifecycleService } from './db-lifecycle.service'
import { DbNotificationService } from './db-notification.service'

describe('DbLifecycleService', () => {
  it('closes db notifications before ending the shared pool', async () => {
    const calls: string[] = []
    const dbNotificationService = {
      closeAllSubscriptions: jest.fn(async () => {
        calls.push('notifications')
      }),
    }
    const pool = {
      end: jest.fn(async () => {
        calls.push('pool')
      }),
    }
    const service = new DbLifecycleService(
      dbNotificationService as unknown as DbNotificationService,
      pool as unknown as Pool,
    )

    await service.onApplicationShutdown()

    expect(calls).toEqual(['notifications', 'pool'])
    expect(dbNotificationService.closeAllSubscriptions).toHaveBeenCalledTimes(1)
    expect(pool.end).toHaveBeenCalledTimes(1)
  })

  it('runs shutdown only once', async () => {
    const dbNotificationService = {
      closeAllSubscriptions: jest.fn(async () => undefined),
    }
    const pool = {
      end: jest.fn(async () => undefined),
    }
    const service = new DbLifecycleService(
      dbNotificationService as unknown as DbNotificationService,
      pool as unknown as Pool,
    )

    await service.onApplicationShutdown()
    await service.onApplicationShutdown()

    expect(dbNotificationService.closeAllSubscriptions).toHaveBeenCalledTimes(1)
    expect(pool.end).toHaveBeenCalledTimes(1)
  })
})
