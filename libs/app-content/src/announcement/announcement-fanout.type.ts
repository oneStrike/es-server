import type { DbExecutor } from '@db/core'

/**
 * 公告通知扇出端口。
 */
export interface AnnouncementFanoutPort {
  enqueueAnnouncementFanout: (
    announcementId: number,
    tx?: DbExecutor,
  ) => Promise<boolean>
  retryFailedAnnouncementFanout: (
    announcementId: number,
    tx?: DbExecutor,
  ) => Promise<boolean>
}
