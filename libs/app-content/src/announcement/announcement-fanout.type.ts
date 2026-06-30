import type { Db } from '@db/core'

/**
 * 公告通知扇出端口。
 */
export interface AnnouncementFanoutPort {
  enqueueAnnouncementFanout: (
    announcementId: number,
    tx?: Db,
  ) => Promise<boolean>
  retryFailedAnnouncementFanout: (
    announcementId: number,
    tx?: Db,
  ) => Promise<boolean>
}
