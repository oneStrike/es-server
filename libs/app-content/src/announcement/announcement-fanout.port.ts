import type { Db } from '@db/core'

export interface AnnouncementFanoutPort {
  enqueueAnnouncementFanout: (announcementId: number, tx?: Db) => Promise<boolean>
  retryFailedAnnouncementFanout: (announcementId: number, tx?: Db) => Promise<boolean>
}

export const ANNOUNCEMENT_FANOUT_PORT = Symbol('ANNOUNCEMENT_FANOUT_PORT')
